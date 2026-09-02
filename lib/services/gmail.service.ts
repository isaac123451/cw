import "server-only";

/**
 * Leitura da caixa de entrada, para a reclamação chegar sozinha.
 *
 * **O problema que isto resolve.** O Reclame Aqui não tem API pública, e
 * a página é protegida por Cloudflare — não há como o servidor perguntar
 * "chegou reclamação nova?". A extensão resolve com a aba aberta, mas
 * reclamação de madrugada fica esperando alguém ligar o computador.
 *
 * O RA manda um e-mail a cada reclamação nova. Esse e-mail chega
 * independente de navegador, e é o único sinal que o servidor consegue
 * observar sozinho.
 *
 * **Só lê.** O escopo é `gmail.readonly` e nenhuma função aqui escreve:
 * nada é marcado como lido, movido ou apagado. Quem confere depois na
 * caixa vê exatamente o que veria se esta rotina não existisse.
 *
 * **O que chega daqui é dado, nunca instrução.** Um e-mail é texto que
 * um terceiro escreveu e mandou; quem o processa trata como conteúdo a
 * ser extraído, e a extração vive em funções puras conferidas contra
 * amostras reais — ver `raEmail.service.ts`.
 */

/** Uma mensagem já achatada no que interessa. */
export interface MensagemDoGmail {
  id: string;
  /** Id da conversa — duas mensagens da mesma reclamação compartilham. */
  threadId: string;
  remetente: string;
  assunto: string;
  /** Quando o Google recebeu, em ISO. */
  recebidoEm: string;
  /** Corpo em texto puro, já decodificado. */
  texto: string;
}

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

/**
 * `base64url` do Google para texto.
 *
 * O Gmail devolve o corpo em base64 com `-` e `_` no lugar de `+` e
 * `/`, e sem o preenchimento. Decodificar com o alfabeto errado não
 * falha: devolve lixo silencioso, que depois vira campo vazio na
 * reclamação sem ninguém entender por quê.
 */
function decodificar(dados: string) {

  const normalizado = dados
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  return Buffer.from(normalizado, "base64").toString(
    "utf8"
  );
}

interface ParteDoCorpo {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: ParteDoCorpo[];
}

/**
 * O texto puro de dentro da árvore de partes.
 *
 * Um e-mail de notificação costuma vir `multipart/alternative`: uma
 * parte em texto e outra em HTML, com o mesmo conteúdo. A de texto é
 * preferida por ser estável — o HTML muda de layout a cada campanha de
 * marketing, e a extração quebraria junto.
 *
 * Sem parte de texto, o HTML é convertido de forma grosseira: tags
 * fora, entidades básicas de volta. Grosseiro serve porque o que se
 * procura depois são protocolo e nome, não formatação.
 */
function textoDaParte(parte: ParteDoCorpo): string {

  if (parte.mimeType === "text/plain" && parte.body?.data) {
    return decodificar(parte.body.data);
  }

  for (const filha of parte.parts ?? []) {
    const achado = textoDaParte(filha);
    if (achado) return achado;
  }

  if (parte.mimeType === "text/html" && parte.body?.data) {
    return decodificar(parte.body.data)
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/tr>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#(\d+);/g, (_, n) =>
        String.fromCharCode(Number(n))
      )
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  return "";
}

function cabecalho(
  headers: { name?: string; value?: string }[],
  nome: string
) {
  return (
    headers.find(
      (h) =>
        h.name?.toLowerCase() === nome.toLowerCase()
    )?.value ?? ""
  );
}

/**
 * As mensagens que casam com a consulta.
 *
 * A consulta é a do Gmail, a mesma que se digita na barra de busca —
 * `from:`, `newer_than:`, `subject:`. Ela é o filtro por remetente que
 * o escopo não sabe fazer: o Google entrega a caixa inteira, e é aqui
 * que se decide olhar só o que interessa.
 *
 * `teto` existe para uma caixa cheia não virar centenas de chamadas na
 * primeira execução.
 */
export async function buscarMensagens(
  accessToken: string,
  consulta: string,
  teto = 25
): Promise<string[]> {

  const url = new URL(`${API}/messages`);

  url.searchParams.set("q", consulta);
  url.searchParams.set("maxResults", String(teto));

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!r.ok) {
    throw new Error(
      `Gmail respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`
    );
  }

  const dados = (await r.json()) as {
    messages?: { id: string }[];
  };

  return (dados.messages ?? []).map((m) => m.id);
}

/** Uma mensagem, já achatada. */
export async function lerMensagem(
  accessToken: string,
  id: string
): Promise<MensagemDoGmail | null> {

  const r = await fetch(
    `${API}/messages/${id}?format=full`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );

  if (!r.ok) return null;

  const m = (await r.json()) as {
    id: string;
    threadId: string;
    internalDate?: string;
    payload?: ParteDoCorpo & {
      headers?: { name?: string; value?: string }[];
    };
  };

  const headers = m.payload?.headers ?? [];

  return {
    id: m.id,
    threadId: m.threadId,
    remetente: cabecalho(headers, "From"),
    assunto: cabecalho(headers, "Subject"),
    recebidoEm: new Date(
      Number(m.internalDate ?? Date.now())
    ).toISOString(),
    texto: m.payload ? textoDaParte(m.payload) : "",
  };
}

/**
 * A conta do Google está ligada e com permissão de leitura?
 *
 * Uma chamada mínima — um único id — que responde a pergunta que a tela
 * de Integrações precisa fazer: adianta ligar a entrada automática?
 *
 * Separa os dois "não" que importam. **403** é o escopo: a conta foi
 * conectada antes de `gmail.readonly` existir e precisa ser reconectada
 * — o caso de todo mundo que já usava a agenda. Qualquer outro erro é
 * outra coisa, e dizer "reconecte" para um problema de rede mandaria a
 * pessoa refazer uma autorização que já estava boa.
 */
export async function podeLerEmail(
  accessToken: string
): Promise<
  { ok: true } | { ok: false; reconectar: boolean; erro: string }
> {

  const url = new URL(`${API}/messages`);
  url.searchParams.set("maxResults", "1");

  try {

    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (r.ok) return { ok: true };

    const corpo = (await r.text()).slice(0, 200);

    return {
      ok: false,
      reconectar: r.status === 403 || r.status === 401,
      erro: `${r.status} — ${corpo}`,
    };

  } catch (erro) {
    return {
      ok: false,
      reconectar: false,
      erro:
        erro instanceof Error ? erro.message : String(erro),
    };
  }
}
