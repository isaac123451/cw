import "server-only";

/**
 * Envio de e-mail transacional.
 *
 * O projeto não tinha nenhum — e a verificação em duas etapas depende
 * disto antes de qualquer outra coisa. É a camada mais fina que
 * resolve o problema: uma função, um provedor escolhido por variável
 * de ambiente, e nenhuma dependência nova no `package.json`.
 *
 * **Dois provedores, e o motivo de cada um.**
 *
 * O **Resend** entra por `fetch`: é um POST com JSON, e o pacote
 * oficial seria 200 kB para embrulhar quinze linhas. Funciona sem
 * configuração de servidor na Vercel. A pegadinha dele é o domínio: sem
 * verificar o DNS, entrega só para o dono da conta.
 *
 * O **SMTP** entra porque o DNS depende de terceiros e a operação não
 * podia esperar. O servidor da empresa já está autorizado a enviar pelo
 * domínio dela, então cada pessoa recebe o próprio código sem mexer em
 * registro nenhum. Custa uma dependência (`nodemailer`), carregada só
 * quando este caminho é usado.
 *
 * Qual vale: `EMAIL_PROVEDOR` decide, e sem ela o SMTP ganha, porque é
 * o único que alcança a equipe inteira. Nada fora deste arquivo sabe
 * qual está em uso.
 *
 * **O que acontece sem provedor configurado.** Fora de produção, o
 * e-mail vai para o terminal — é o que deixa desenvolver o fluxo de
 * login sem chave nenhuma. Em produção, `enviarEmail` **falha**, e
 * falha alto: um código de verificação que ninguém recebe é uma porta
 * trancada com a pessoa do lado de fora, e é melhor a tela dizer isso
 * do que a pessoa ficar esperando um e-mail que não vem.
 */

export interface Email {
  para: string;
  assunto: string;
  /** Versão em texto puro. Obrigatória: é o que sobrevive a tudo. */
  texto: string;
  /** Versão em HTML. Opcional. */
  html?: string;
}

export type Provedor =
  | "smtp"
  | "resend"
  | "console"
  | "nenhum";

/**
 * O SMTP está configurado?
 *
 * Exige as quatro peças. Faltando uma, a conexão falharia com uma
 * mensagem do servidor de e-mail em vez de um aviso nosso — e o lugar
 * de descobrir isso não é o login de alguém.
 */
function temSmtp() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USUARIO &&
      process.env.SMTP_SENHA
  );
}

/** O endereço puro de dentro de `Nome <caixa@dominio>`. */
function soOEndereco(bruto: string) {
  return (bruto.match(/<([^>]+)>/)?.[1] ?? bruto)
    .trim()
    .toLowerCase();
}

/**
 * De onde o e-mail sai.
 *
 * No Resend, o domínio precisa estar verificado; sem isso o envio é
 * recusado com 403 dizendo qual domínio falta.
 *
 * **No SMTP a regra é outra, e ignorá-la sai caro.** O servidor só
 * deixa enviar em nome da conta autenticada: um `From` diferente é
 * reescrito em silêncio pelo Google, ou recusado. Pior que isso, o
 * `EMAIL_REMETENTE` que está configurado hoje aponta para o sandbox do
 * Resend — mantê-lo faria `remetenteEhSandbox()` continuar dizendo
 * "sim" com o SMTP ativo, e a tela seguiria bloqueando a exigência
 * para toda a equipe, que é justamente o que a migração veio destravar.
 *
 * Então, com SMTP, o endereço vem de `SMTP_USUARIO`. O
 * `EMAIL_REMETENTE` ainda vale para o **nome de exibição**, e para o
 * endereço só quando ele for o mesmo da conta — o caso de quem
 * configurou um "enviar como" no provedor.
 */
function remetente() {

  const configurado = process.env.EMAIL_REMETENTE;

  if (provedorAtivo() === "smtp") {

    const conta = (process.env.SMTP_USUARIO ?? "").trim();

    if (
      configurado &&
      soOEndereco(configurado) === conta.toLowerCase()
    ) {
      return configurado;
    }

    const nome =
      configurado?.match(/^(.*)</)?.[1].trim() ||
      "CW Reputação";

    return `${nome} <${conta}>`;
  }

  return (
    configurado ||
    "CW Reputação <nao-responda@cardapioweb.com>"
  );
}

/** Qual provedor está de fato configurado agora. */
export function provedorAtivo(): Provedor {

  /**
   * A escolha explícita manda, quando existe.
   *
   * Sem ela, o SMTP ganha do Resend — e não por preferência técnica:
   * com o domínio ainda não verificado, o Resend só entrega para uma
   * pessoa, e o SMTP entrega para a equipe. Deixar o Resend ganhar
   * significaria que configurar o SMTP não muda nada, sem dizer isso a
   * ninguém.
   */
  const escolhido = process.env
    .EMAIL_PROVEDOR?.trim()
    .toLowerCase();

  if (escolhido === "smtp" && temSmtp()) return "smtp";
  if (escolhido === "resend" && process.env.RESEND_API_KEY)
    return "resend";

  if (temSmtp()) return "smtp";

  if (process.env.RESEND_API_KEY) return "resend";

  if (process.env.NODE_ENV !== "production") {
    return "console";
  }

  return "nenhum";
}

/**
 * O envio dá para acontecer?
 *
 * A tela de configurações pergunta isto **antes** de deixar alguém
 * ligar a verificação em duas etapas. Ligar 2FA sem provedor de
 * e-mail tranca todo mundo para fora na próxima vez que a sessão
 * expirar, e o conserto exigiria acesso ao banco.
 */
export function podeEnviarEmail() {
  return provedorAtivo() !== "nenhum";
}

/**
 * O envio está saindo pelo remetente de sandbox do Resend?
 *
 * `resend.dev` é o remetente emprestado que funciona sem verificar
 * domínio nenhum — e por isso o Resend **só entrega para o e-mail dono
 * da conta**. É o que permite ligar a verificação em duas etapas para
 * uma pessoa antes do DNS ficar pronto.
 *
 * Quem precisa saber disto é a tela de Segurança: com o sandbox,
 * exigir a verificação de **todo mundo** trancaria todo mundo, menos
 * uma pessoa, para fora. A trava mora lá; aqui só se responde a
 * pergunta, porque é aqui que o remetente é decidido.
 */
export function remetenteEhSandbox() {

  const dominio = remetente()
    .split("@")
    .pop()
    ?.replace(">", "")
    .trim()
    .toLowerCase();

  return (
    dominio === "resend.dev" ||
    Boolean(dominio?.endsWith(".resend.dev"))
  );
}

/**
 * O remetente que sairia agora, decidido por `remetente()`.
 *
 * Existe para a conferência **relatar** o remetente em vez de deduzi-lo
 * de `EMAIL_REMETENTE`. As duas coisas divergem no caminho do SMTP, e
 * um relatório que lê a variável dizia "o remetente é
 * onboarding@resend.dev" enquanto o envio de verdade saía da conta do
 * servidor — certo no formato, errado no fato.
 */
export function remetenteAtual() {
  return remetente();
}

export interface ResultadoDoEnvio {
  ok: boolean;
  provedor: Provedor;
  /** Id da mensagem no provedor, quando ele devolve um. */
  id?: string;
  erro?: string;
}

async function porResend(
  email: Email
): Promise<ResultadoDoEnvio> {

  const resposta = await fetch(
    "https://api.resend.com/emails",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: remetente(),
        to: [email.para],
        subject: email.assunto,
        text: email.texto,
        ...(email.html ? { html: email.html } : {}),
      }),
    }
  );

  /**
   * O corpo do erro do Resend diz o motivo real (domínio não
   * verificado, chave inválida, destinatário recusado). Engolir isso e
   * mostrar "falha ao enviar" transformaria um problema de dez
   * segundos numa investigação.
   */
  if (!resposta.ok) {

    const corpo = await resposta.text();

    return {
      ok: false,
      provedor: "resend",
      erro: `${resposta.status} — ${corpo.slice(0, 300)}`,
    };
  }

  const dados = (await resposta.json()) as {
    id?: string;
  };

  return {
    ok: true,
    provedor: "resend",
    id: dados.id,
  };
}

/**
 * Envio por SMTP — o caminho que alcança a equipe inteira.
 *
 * Existe porque o Resend, sem domínio verificado, entrega para uma
 * pessoa só. O servidor de e-mail da empresa (Google Workspace) já
 * está autorizado a enviar pelo domínio dela, então não há DNS a
 * mexer: autentica-se com a conta e pronto.
 *
 * O `nodemailer` entra por importação dinâmica de propósito — assim
 * quem usa o Resend não carrega um cliente de SMTP junto.
 */
async function porSmtp(
  email: Email
): Promise<ResultadoDoEnvio> {

  const { createTransport } = await import("nodemailer");

  const porta = Number(process.env.SMTP_PORTA ?? 587);

  const transporte = createTransport({
    host: process.env.SMTP_HOST,
    port: porta,
    /* 465 fala TLS desde o primeiro byte; 587 sobe para TLS depois. */
    secure: porta === 465,
    auth: {
      user: process.env.SMTP_USUARIO,
      pass: process.env.SMTP_SENHA,
    },
  });

  const info = await transporte.sendMail({
    from: remetente(),
    to: email.para,
    subject: email.assunto,
    text: email.texto,
    ...(email.html ? { html: email.html } : {}),
  });

  /**
   * Recusa de destinatário não é sucesso.
   *
   * O SMTP aceita a mensagem para uns e recusa para outros na mesma
   * entrega. Se o único destinatário caiu em `rejected`, o envio
   * falhou — e devolver `ok` aqui ligaria a verificação em duas etapas
   * de alguém que nunca receberia o código.
   */
  if (info.rejected?.length) {
    return {
      ok: false,
      provedor: "smtp",
      erro: `O servidor recusou o destinatário: ${info.rejected.join(", ")}`,
    };
  }

  return {
    ok: true,
    provedor: "smtp",
    id: info.messageId,
  };
}

function porConsole(email: Email): ResultadoDoEnvio {

  console.log(
    [
      "",
      "  ┌─ E-MAIL (sem provedor configurado, modo local) ─────────",
      `  │ para:    ${email.para}`,
      `  │ assunto: ${email.assunto}`,
      "  │",
      ...email.texto
        .split("\n")
        .map((linha) => `  │ ${linha}`),
      "  └──────────────────────────────────────────────────────────",
      "",
    ].join("\n")
  );

  return { ok: true, provedor: "console" };
}

export async function enviarEmail(
  email: Email
): Promise<ResultadoDoEnvio> {

  const provedor = provedorAtivo();

  if (provedor === "nenhum") {
    return {
      ok: false,
      provedor,
      erro:
        "Nenhum provedor de e-mail configurado. Defina RESEND_API_KEY.",
    };
  }

  if (provedor === "console") {
    return porConsole(email);
  }

  try {
    return provedor === "smtp"
      ? await porSmtp(email)
      : await porResend(email);
  } catch (erro) {

    /**
     * Rede fora do ar, DNS, timeout, credencial recusada. Vira
     * resultado, não exceção: quem chama precisa poder dizer "não
     * consegui enviar, tente de novo" sem derrubar a tela de login.
     */
    return {
      ok: false,
      provedor,
      erro:
        erro instanceof Error
          ? erro.message
          : String(erro),
    };
  }
}
