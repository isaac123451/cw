import "server-only";

/**
 * Envio de e-mail transacional.
 *
 * O projeto não tinha nenhum — e a verificação em duas etapas depende
 * disto antes de qualquer outra coisa. É a camada mais fina que
 * resolve o problema: uma função, um provedor escolhido por variável
 * de ambiente, e nenhuma dependência nova no `package.json`.
 *
 * **Por que Resend e por que por `fetch`.** É o provedor transacional
 * que funciona sem configuração de servidor na Vercel, e a API dele é
 * um POST com JSON — o pacote oficial seria 200 kB para embrulhar
 * quinze linhas. Trocar por SMTP depois é escrever outro `provedor`
 * aqui embaixo; nada fora deste arquivo sabe qual é.
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

export type Provedor = "resend" | "console" | "nenhum";

/**
 * De onde o e-mail sai.
 *
 * O domínio precisa estar verificado no provedor; sem isso o envio é
 * recusado com 403 e a mensagem do provedor diz exatamente qual
 * domínio falta.
 */
function remetente() {
  return (
    process.env.EMAIL_REMETENTE ||
    "CW Reputação <nao-responda@cardapioweb.com>"
  );
}

/** Qual provedor está de fato configurado agora. */
export function provedorAtivo(): Provedor {

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
    return await porResend(email);
  } catch (erro) {

    /**
     * Rede fora do ar, DNS, timeout. Vira resultado, não exceção: quem
     * chama precisa poder dizer "não consegui enviar, tente de novo"
     * sem derrubar a tela de login.
     */
    return {
      ok: false,
      provedor: "resend",
      erro:
        erro instanceof Error
          ? erro.message
          : String(erro),
    };
  }
}
