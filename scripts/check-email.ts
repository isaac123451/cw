/**
 * O envio de e-mail está de pé? E se não está, por quê?
 *
 *   npm run check:email                        (só diagnostica, não envia)
 *   npm run check:email -- --enviar seu@email  (manda um de verdade)
 *
 * **Por que este script existe.** O envio de e-mail serve a uma coisa
 * só neste projeto: entregar o código de seis dígitos da verificação em
 * duas etapas. E é a única peça cuja falha aparece no pior lugar
 * possível — na tela de login de alguém que já digitou a senha certa e
 * agora espera um código que não vem.
 *
 * Configurar o Resend tem três passos, e **dois deles falham calados**:
 *
 *   1. a chave — erra e volta 401 na hora do envio, não antes;
 *   2. o domínio verificado — erra e volta 403 na hora do envio;
 *   3. o remetente casar com o domínio — idem.
 *
 * Nenhum aparece ao definir a variável na Vercel. Todos aparecem no
 * primeiro login de verdade, quando o custo de descobrir é uma pessoa
 * trancada do lado de fora.
 *
 * Então este script pergunta ao Resend **antes**: a chave vale? quais
 * domínios existem e em que estado? o remetente sai de um deles? São
 * consultas de leitura, não gastam cota de envio, e transformam uma
 * investigação de meia hora num comando.
 *
 * O envio real fica atrás de `--enviar` com endereço explícito, de
 * propósito: um script de conferência que manda e-mail sem pedir vira
 * uma surpresa na caixa de entrada de alguém.
 */
import "dotenv/config";

import {
  enviarEmail,
  podeEnviarEmail,
  provedorAtivo,
} from "../lib/email/enviar";

let falhas = 0;
let avisos = 0;

function ok(titulo: string, detalhe = "") {
  console.log(
    `  ok     ${titulo}${detalhe ? `\n         ${detalhe}` : ""}`
  );
}

function aviso(titulo: string, detalhe: string) {
  avisos += 1;
  console.log(`  aviso  ${titulo}\n         ${detalhe}`);
}

function falhar(titulo: string, detalhe: string) {
  falhas += 1;
  console.log(`FALHA    ${titulo}\n         ${detalhe}`);
}

/* ---------------------------------------------- os argumentos ---- */

const args = process.argv.slice(2);

const indiceEnviar = args.indexOf("--enviar");

const destino =
  indiceEnviar >= 0 ? args[indiceEnviar + 1] : undefined;

if (indiceEnviar >= 0 && !destino) {
  console.error(
    "\n  --enviar precisa do endereço: npm run check:email -- --enviar voce@empresa.com\n"
  );
  process.exit(1);
}

/**
 * O remetente, separado em nome e endereço.
 *
 * O formato `Nome <caixa@dominio>` é o do cabeçalho de e-mail, e é o
 * que o Resend espera. Um remetente escrito errado é recusado com uma
 * mensagem de validação que não diz "olha o formato" — diz só
 * "invalid `from` field".
 */
function lerRemetente(bruto: string) {

  const comNome = bruto.match(/^(.*)<([^>]+)>\s*$/);

  const endereco = (
    comNome ? comNome[2] : bruto
  ).trim();

  return {
    nome: comNome ? comNome[1].trim() : "",
    endereco,
    dominio: endereco.split("@")[1]?.toLowerCase() ?? "",
    temFormatoDeEmail: /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(
      endereco
    ),
  };
}

interface DominioNoResend {
  name: string;
  status: string;
  region?: string;
}

/**
 * A lista de domínios da conta.
 *
 * Serve a dois propósitos de uma vez: prova que a chave vale (chave
 * ruim volta 401 aqui, sem gastar envio) e diz o estado de cada
 * domínio, que é a informação que falta quando o envio dá 403.
 *
 * **Três respostas, não duas.** O Resend tem dois tipos de chave, e a
 * boa prática é a restrita — "Sending access", que envia e não lê mais
 * nada da conta. Essa chave responde **401 `restricted_api_key`** aqui,
 * e a leitura ingênua disso é "a chave não vale", que é o oposto da
 * verdade: ela vale, e vale mais do que a outra. Confundir as duas
 * mandaria alguém revogar a chave certa e criar uma com permissão a
 * mais, piorando a segurança por causa da mensagem deste script.
 */
type ConsultaDeDominios =
  | { tipo: "lista"; lista: DominioNoResend[] }
  | { tipo: "restrita" }
  | { tipo: "erro"; status: number; corpo: string };

async function dominiosDoResend(
  chave: string
): Promise<ConsultaDeDominios> {

  const resposta = await fetch(
    "https://api.resend.com/domains",
    { headers: { Authorization: `Bearer ${chave}` } }
  );

  if (!resposta.ok) {

    const corpo = (await resposta.text()).slice(0, 300);

    if (/restricted_api_key/i.test(corpo)) {
      return { tipo: "restrita" };
    }

    return {
      tipo: "erro",
      status: resposta.status,
      corpo,
    };
  }

  const dados = (await resposta.json()) as {
    data?: DominioNoResend[];
  };

  return { tipo: "lista", lista: dados.data ?? [] };
}

/**
 * O que cada erro do Resend quer dizer, em português e com o conserto.
 *
 * O corpo cru também é impresso — mas sozinho ele manda a pessoa para
 * a documentação. Traduzido, manda para a tela onde se resolve.
 */
function traduzir(status: number, corpo: string) {

  /*
    O texto vem antes do código de status, e não o contrário.

    O Resend não é consistente aqui: uma chave inválida volta **400**
    `validation_error`, não o 401 que qualquer um esperaria — e uma
    tradução organizada por status deixaria justamente o erro mais
    comum (chave com typo, ou colada pela metade) cair no caso "não sei
    o que é isto". Casar pelo texto acerta os dois.
  */
  if (/restricted_api_key/i.test(corpo)) {
    return "A chave vale — ela é do tipo restrito (Sending access), que envia e não lê o resto da conta. É o tipo certo. Só não dá para consultar os domínios por ela.";
  }

  if (/api key is invalid|missing_api_key/i.test(corpo)) {
    return "A chave não vale — errada, revogada, ou copiada pela metade. Resend → API Keys → Create API Key (ela só aparece uma vez, então recopie inteira).";
  }

  if (
    /domain is not verified|not verified|testing emails/i.test(
      corpo
    )
  ) {
    return "O domínio do remetente não está verificado. Resend → Domains → adicionar o domínio e criar os registros DNS (SPF e DKIM) que ele mostrar. Enquanto isso, dá para testar com o remetente de sandbox: EMAIL_REMETENTE=\"CW Reputação <onboarding@resend.dev>\" — mas ele só entrega para o e-mail dono da conta.";
  }

  if (status === 401 || status === 403) {
    return "O Resend recusou a permissão. Confira se a chave tem acesso de envio (Sending access).";
  }

  if (status === 422) {
    return "O Resend recusou os dados da mensagem — quase sempre o formato do remetente. Use `Nome <caixa@dominio.com>`.";
  }

  if (status === 429) {
    return "Limite de envio atingido (o plano grátis é 100/dia, 3.000/mês). Espere e tente de novo.";
  }

  return "";
}

async function main() {

  console.log(
    "\n  E-MAIL — dá para entregar o código de duas etapas?\n"
  );

  /* --------------------------------------- 1. qual provedor ---- */

  const provedor = provedorAtivo();

  const chave = process.env.RESEND_API_KEY ?? "";

  console.log(
    `  provedor ativo: ${provedor} · NODE_ENV=${process.env.NODE_ENV ?? "(vazio)"}\n`
  );

  if (provedor === "nenhum") {
    falhar(
      "há um provedor de e-mail configurado",
      "Nenhum. Em produção, sem RESEND_API_KEY, a verificação em duas etapas não liga — de propósito. Defina a variável na Vercel e refaça o deploy."
    );
  } else if (provedor === "console") {
    aviso(
      "há um provedor de e-mail configurado",
      "Modo local: o e-mail sai no terminal, não na caixa de entrada. É o esperado fora de produção sem RESEND_API_KEY — dá para desenvolver o login sem chave. Mas nada aqui prova que o envio de verdade funciona."
    );
  } else {
    ok(
      "há um provedor de e-mail configurado",
      "resend"
    );
  }

  /*
    O que a tela de Segurança lê.

    `podeEnviarEmail` é a mesma função que decide se o botão de ligar a
    verificação aparece habilitado. Imprimir aqui evita a pergunta
    "configurei e a tela continua reclamando".
  */
  console.log(
    `\n  a tela de Segurança vê: ${
      podeEnviarEmail()
        ? "envio ativo — o 2FA pode ser ligado"
        : "envio desligado — o 2FA fica indisponível"
    }\n`
  );

  /* ------------------------------------------ 2. a chave ---- */

  if (chave) {

    if (!chave.startsWith("re_")) {
      falhar(
        "a chave tem cara de chave do Resend",
        `começa com "${chave.slice(0, 4)}…" — as do Resend começam com re_. Confira se não foi colada a chave de outro serviço.`
      );
    } else if (chave.length < 20) {
      falhar(
        "a chave tem cara de chave do Resend",
        `só ${chave.length} caracteres — parece cortada. Ela só aparece uma vez no Resend; se perdeu, crie outra.`
      );
    } else {
      ok(
        "a chave tem cara de chave do Resend",
        `re_… ${chave.length} caracteres`
      );
    }
  }

  /* --------------------------------------- 3. o remetente ---- */

  const bruto =
    process.env.EMAIL_REMETENTE ||
    "CW Reputação <nao-responda@cardapioweb.com>";

  const de = lerRemetente(bruto);

  console.log("");

  if (!de.temFormatoDeEmail) {
    falhar(
      "o remetente está num formato que o Resend aceita",
      `EMAIL_REMETENTE = "${bruto}" — não achei um endereço válido. Use \`Nome <caixa@dominio.com>\`.`
    );
  } else {
    ok(
      "o remetente está num formato que o Resend aceita",
      `${de.nome ? `${de.nome} ` : ""}<${de.endereco}>${
        process.env.EMAIL_REMETENTE
          ? ""
          : "  (padrão do código — EMAIL_REMETENTE não está definida)"
      }`
    );
  }

  /* ------------------------------ 4. o domínio, no Resend ---- */

  if (chave && de.dominio) {

    console.log("");

    /*
      Duas perguntas, não uma — e é por isso que o sandbox não
      atalha a consulta.

      "A chave vale?" e "o remetente sai de domínio verificado?" são
      independentes, e a primeira só se responde perguntando ao Resend.
      Uma versão anterior daqui pulava a consulta inteira quando o
      remetente era o de sandbox, e com isso perdia calada a conferência
      da chave: um `re_` inventado passaria batido.

      O que o sandbox decide é só a **conclusão sobre o domínio**.
      `resend.dev` não é um domínio que alguém verifica — é o remetente
      de teste que o próprio Resend empresta, e funciona sem DNS
      nenhum. Sem essa separação o script dizia 'se "resend.dev" não
      estiver verificado…' para um remetente que **acabou de enviar com
      sucesso**: aviso certo no formato, errado no motivo.
    */
    const ehSandbox =
      de.dominio === "resend.dev" ||
      de.dominio.endsWith(".resend.dev");

    const AVISO_SANDBOX =
      "Remetente de sandbox (resend.dev). Funciona sem DNS nenhum, e é o jeito de provar o caminho hoje — mas o Resend só entrega para o e-mail dono da conta. Não serve para a equipe: os outros não receberiam o código.";

    const consulta = await dominiosDoResend(chave);

    if (consulta.tipo === "erro") {

      const explicacao = traduzir(
        consulta.status,
        consulta.corpo
      );

      falhar(
        "a chave foi aceita pelo Resend",
        `${consulta.status} — ${consulta.corpo}${
          explicacao ? `\n         → ${explicacao}` : ""
        }`
      );

    } else if (consulta.tipo === "restrita") {

      ok(
        "a chave foi aceita pelo Resend",
        "chave restrita (Sending access) — envia e não lê o resto da conta. É o tipo certo."
      );

      /*
        Sem a lista de domínios, a verificação do remetente não dá para
        ser feita daqui — e dizer que está tudo bem seria inventar.

        A única prova que sobra é o envio de verdade, que é justamente
        o que `--enviar` faz. O aviso existe para que ninguém leia
        "chave ok" como "o e-mail chega".
      */
      aviso(
        "o remetente sai de um domínio verificado",
        ehSandbox
          ? AVISO_SANDBOX
          : `Não dá para conferir por esta chave — a consulta de domínios exige uma chave de acesso total. O que resta é provar enviando: npm run check:email -- --enviar voce@cardapioweb.com. Se "${de.dominio}" não estiver verificado no Resend, o envio volta 403 dizendo isso.`
      );

    } else {

      ok(
        "a chave foi aceita pelo Resend",
        `${consulta.lista.length} domínio(s) na conta`
      );

      for (const dominio of consulta.lista) {
        console.log(
          `         · ${dominio.name} — ${dominio.status}`
        );
      }

      /*
        O remetente sai de um domínio verificado?

        Esta é a pergunta que o 403 responde tarde demais. O Resend
        aceita subdomínio de um domínio registrado, então a conferência
        olha o nome exato e depois o sufixo.
      */
      const casa = consulta.lista.find(
        (d) =>
          d.name.toLowerCase() === de.dominio ||
          de.dominio.endsWith(`.${d.name.toLowerCase()}`)
      );

      if (ehSandbox) {
        aviso(
          "o remetente sai de um domínio verificado",
          AVISO_SANDBOX
        );
      } else if (!casa) {
        falhar(
          "o remetente sai de um domínio verificado",
          `"${de.dominio}" não está na conta. O envio vai voltar 403. Resend → Domains → adicionar ${de.dominio} e criar os registros DNS que ele mostrar — isso depende de quem administra o DNS.`
        );
      } else if (casa.status !== "verified") {
        falhar(
          "o remetente sai de um domínio verificado",
          `"${casa.name}" está em "${casa.status}", não "verified". Os registros DNS foram criados? A propagação leva de minutos a algumas horas; depois, Resend → Domains → Verify.`
        );
      } else {
        ok(
          "o remetente sai de um domínio verificado",
          `${casa.name} — verified`
        );
      }
    }
  }

  /* ------------------------------------ 5. o envio de verdade ---- */

  console.log("");

  if (!destino) {

    console.log(
      "  Nada foi enviado. Para mandar um de verdade:\n"
    );
    console.log(
      "    npm run check:email -- --enviar voce@cardapioweb.com\n"
    );

  } else {

    console.log(
      `  Enviando para ${destino}…\n`
    );

    const agora = new Date().toLocaleString("pt-BR");

    const resultado = await enviarEmail({
      para: destino,
      assunto: "CW Reputação — teste de envio",
      texto: [
        "Este é um teste de envio do CW Reputação.",
        "",
        `Disparado em ${agora} pelo comando npm run check:email.`,
        "",
        "Se você recebeu isto, o envio do código de seis dígitos da",
        "verificação em duas etapas também vai chegar.",
        "",
        `Remetente: ${de.endereco}`,
      ].join("\n"),
    });

    if (resultado.ok) {

      ok(
        `o envio saiu pelo provedor "${resultado.provedor}"`,
        resultado.provedor === "console"
          ? "Impresso acima, no terminal. Nada foi para caixa de entrada nenhuma — é o modo local."
          : `id da mensagem: ${resultado.id ?? "(sem id)"}. Confira a caixa de entrada de ${destino}, e o spam.`
      );

      if (resultado.provedor === "resend") {
        console.log(
          "\n         Aceito pelo Resend não é o mesmo que entregue.\n         O painel do Resend → Emails mostra o que aconteceu depois.\n"
        );
      }

    } else {

      const status = Number(
        resultado.erro?.match(/^(\d{3})/)?.[1] ?? 0
      );

      const explicacao = traduzir(
        status,
        resultado.erro ?? ""
      );

      falhar(
        "o envio chegou ao provedor",
        `${resultado.erro}${
          explicacao ? `\n         → ${explicacao}` : ""
        }`
      );
    }
  }

  /* ------------------------------------------ o veredito ---- */

  if (falhas === 0 && avisos === 0) {
    console.log(
      "\n  O caminho do e-mail está de pé.\n"
    );
  } else if (falhas === 0) {
    console.log(
      `\n  Sem falhas, ${avisos} aviso(s) — leia acima antes de contar com o envio.\n`
    );
  } else {
    console.log(
      `\n  ${falhas} ponto(s) a corrigir antes que o código de duas etapas chegue a alguém.\n`
    );
  }

  /*
    `exitCode` em vez de `exit()`.

    Encerrar à força logo depois de um `fetch` derruba o Node no
    Windows com uma asserção do libuv — a conexão ainda está fechando
    quando o processo some. O código de saída é o mesmo; só a saída
    passa a ser ordenada, o que importa porque este script vai rodar em
    terminal de gente e não pode terminar parecendo que quebrou.
  */
  process.exitCode = falhas === 0 ? 0 : 1;
}

main().catch((erro) => {
  console.error("\n  Erro:", erro);
  process.exitCode = 1;
});
