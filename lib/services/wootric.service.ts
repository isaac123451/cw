/**
 * Integração com o Wootric (InMoment) — a plataforma onde a pesquisa de
 * NPS é respondida de verdade.
 *
 * **Sem `server-only` de propósito.** Aquele módulo lança ao ser
 * carregado fora do ambiente do Next, e este serviço precisa rodar
 * também no script de linha de comando (`npm run nps:wootric`), que é
 * por onde as janelas grandes e o cron passam — mesma divisão que
 * `case.repository.ts` já segue. As credenciais continuam protegidas
 * pelo que sempre as protegeu: variáveis sem o prefixo `NEXT_PUBLIC_`
 * não entram no pacote do navegador.
 *
 * Até aqui o NPS da aplicação era digitado à mão. O ciclo de tratativa
 * já existia inteiro (os sete tipos, o SLA por segmento, as três
 * tentativas); o que faltava era a resposta chegar sozinha.
 *
 * **Só lê.** Puxa respostas e o contato de quem respondeu; não escreve
 * no Wootric, não dispara pesquisa, não altera nota. A tratativa —
 * humor pós-contato, causa raiz, encerramento — vive aqui e não volta
 * para lá. São dois papéis diferentes, e misturá-los criaria duas
 * verdades para manter sincronizadas.
 *
 * Documentação: https://docs.wootric.com/api/
 *
 * ============================================================
 * O QUE A API FEZ DE VERDADE (medido em 17/08/2026, conta da
 * Cardápio Web — não é leitura da documentação, é o que voltou)
 * ============================================================
 *
 * 1. **A paginação para em 1.500 registros.** Pedindo página a página
 *    com `sort_order=asc`, a página 31 volta vazia — sempre, mesmo
 *    havendo muito mais resposta depois. Por isso a leitura aqui **não**
 *    é "paginar até acabar": é um cursor por `created[gt]`, que reinicia
 *    a paginação a cada bloco. Sem isso, a importação pararia calada em
 *    março de 2022 e ninguém notaria.
 *
 * 2. **`created[gt]` só aceita timestamp Unix.** Em ISO 8601 a API
 *    responde `400 created[gt] is invalid`.
 *
 * 3. **`end_user` vem embutido** em cada resposta, com e-mail e
 *    `properties`. Consultar `/end_users/:id` um por um custaria ~2.000
 *    requisições numa janela de 90 dias, contra um teto de 100 por
 *    minuto — e devolveria a mesma coisa. O único campo que só existe
 *    no objeto completo é `phone_number`, e ele está **nulo em 100%**
 *    da base (7.020 respostas do último ano, nenhuma com telefone).
 *
 * 4. **`properties.company_id`** é o id do estabelecimento no sistema da
 *    Cardápio Web, e aparece em praticamente toda resposta recente
 *    (7.025 de 7.020 do último ano — algumas trazem mais de uma). É a
 *    chave que liga NPS a estabelecimento, e por isso é guardada mesmo
 *    sem ter onde casar ainda.
 *
 * 5. **Volume:** ~790 respostas por mês. É o número que obriga a regra
 *    de fila em `exigeTratativa()` — 790 ciclos abertos por mês não é
 *    uma fila, é um aterro.
 */

/** Ambiente. O Wootric espelha a API em três regiões. */
function base() {
  const regiao = (
    process.env.WOOTRIC_REGIAO ?? "com"
  ).trim();

  return `https://api.wootric.${
    ["com", "eu", "au"].includes(regiao) ? regiao : "com"
  }`;
}

export function temWootric() {
  return (
    (process.env.WOOTRIC_CLIENT_ID ?? "").trim() !== "" &&
    (process.env.WOOTRIC_CLIENT_SECRET ?? "").trim() !== ""
  );
}

/* ============================================================
   TOKEN
============================================================ */

/**
 * O token vale 2 horas e fica em memória do processo.
 *
 * Pedir um novo a cada chamada gastaria uma ida de rede por página — e
 * a importação são dezenas de páginas. A margem de 5 minutos evita o
 * caso em que ele vence no meio de uma sincronização longa.
 */
let cache: { token: string; expira: number } | null = null;

const MARGEM_MS = 5 * 60 * 1000;

export class FalhaWootric extends Error {
  status?: number;

  constructor(mensagem: string, status?: number) {
    super(mensagem);
    this.name = "FalhaWootric";
    this.status = status;
  }
}

async function token(): Promise<string> {

  if (cache && Date.now() < cache.expira - MARGEM_MS) {
    return cache.token;
  }

  if (!temWootric()) {
    throw new FalhaWootric(
      "WOOTRIC_CLIENT_ID e WOOTRIC_CLIENT_SECRET não configurados."
    );
  }

  const corpo = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: (process.env.WOOTRIC_CLIENT_ID ?? "").trim(),
    client_secret: (
      process.env.WOOTRIC_CLIENT_SECRET ?? ""
    ).trim(),
  });

  const resposta = await fetch(`${base()}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: corpo.toString(),
    cache: "no-store",
  });

  if (!resposta.ok) {
    throw new FalhaWootric(
      resposta.status === 401
        ? "Wootric recusou as credenciais. Confira WOOTRIC_CLIENT_ID e WOOTRIC_CLIENT_SECRET."
        : `Wootric respondeu ${resposta.status} ao pedir o token.`,
      resposta.status
    );
  }

  const dados = (await resposta.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!dados.access_token) {
    throw new FalhaWootric(
      "Wootric não devolveu access_token."
    );
  }

  cache = {
    token: dados.access_token,
    expira: Date.now() + (dados.expires_in ?? 7200) * 1000,
  };

  return cache.token;
}

/* ============================================================
   CHAMADA
============================================================ */

/**
 * Uma requisição, com repetição em caso de 429.
 *
 * O teto medido é de 100 requisições por minuto. O Wootric devolve
 * `X-Rate-Limit-Reset` (timestamp Unix) junto do 429 — esperar até ele
 * acerta o tempo mínimo sem inventar intervalo.
 */
async function pegar<T>(
  caminho: string,
  parametros: Record<string, string> = {},
  tentativa = 0
): Promise<T> {

  const url = new URL(`${base()}/v1${caminho}`);

  for (const [chave, valor] of Object.entries(parametros)) {
    if (valor !== "") url.searchParams.set(chave, valor);
  }

  const resposta = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${await token()}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (resposta.status === 429 && tentativa < 3) {

    const reset = Number(
      resposta.headers.get("X-Rate-Limit-Reset") ?? 0
    );

    const esperaMs = reset
      ? Math.max(reset * 1000 - Date.now(), 1000)
      : 15000;

    await new Promise((r) =>
      setTimeout(r, Math.min(esperaMs, 61000))
    );

    return pegar<T>(caminho, parametros, tentativa + 1);
  }

  if (resposta.status === 401 && tentativa < 1) {
    // Token vencido antes da hora: descarta e tenta de novo, uma vez.
    cache = null;
    return pegar<T>(caminho, parametros, tentativa + 1);
  }

  if (!resposta.ok) {
    throw new FalhaWootric(
      `Wootric respondeu ${resposta.status} em ${caminho}.`,
      resposta.status
    );
  }

  return (await resposta.json()) as T;
}

/* ============================================================
   O QUE O WOOTRIC DEVOLVE
============================================================ */

export interface WootricEndUser {
  id?: number;
  email?: string | null;
  external_id?: string | null;
  phone_number?: string | null;
  properties?: Record<string, unknown> | null;
}

export interface WootricResponse {
  id: number;
  end_user_id: number;
  survey_id?: number;
  score: number;
  text?: string | null;
  completed?: boolean;
  excluded_from_calculations?: boolean;
  /** Formato "2026-08-17 14:44:07 -0700" — o `Date` do Node lê certo. */
  created_at: string;
  updated_at?: string;
  origin_url?: string | null;
  tags?: unknown;
  end_user?: WootricEndUser;
}

/** Teto da API: a página 31 volta vazia, sempre. */
const PAGINAS_POR_BLOCO = 30;

const POR_PAGINA = 50;

/** Trava de segurança do cursor, para nenhuma rodada rodar sem fim. */
const MAXIMO_BLOCOS = 40;

function emSegundos(valor: string) {
  return Math.floor(new Date(valor).getTime() / 1000);
}

/**
 * Todas as respostas criadas depois de uma data.
 *
 * O cursor existe por causa do teto de 1.500: a cada bloco esgotado, a
 * paginação recomeça da página 1 com `created[gt]` avançado para o
 * instante da última resposta lida. O recuo de um segundo garante que
 * nenhuma resposta que dividia o mesmo segundo com a última fique de
 * fora; as repetições que isso causa morrem no `upsert` por
 * `externalId`.
 */
export async function listarRespostas(
  desde: Date,
  aoProgredir?: (lidas: number) => void,
  /**
   * Fim da janela. Existe para fatiar: uma importação de um ano inteiro
   * são ~9.500 respostas, muito além do que uma server action consegue
   * gravar antes de a Vercel cortar. Com o teto, a tela pede pedaço por
   * pedaço e cada chamada termina.
   */
  ate?: Date,
  /**
   * Quantas bastam.
   *
   * A leitura é a metade lenta: são idas e voltas ao Wootric, 50 por
   * página, e uma janela grande são dezenas delas. Quem chama de dentro
   * de uma server action tem tempo contado — a Vercel corta a
   * requisição e o botão devolve um erro que não explica nada.
   *
   * Com o teto, a leitura para assim que junta o suficiente para uma
   * rodada, e quem chamou volta a pedir do ponto em que parou.
   */
  teto?: number
): Promise<WootricResponse[]> {

  const encontradas = new Map<number, WootricResponse>();

  const limite = ate
    ? Math.floor(ate.getTime() / 1000)
    : null;

  let cursor = Math.floor(desde.getTime() / 1000);

  for (let bloco = 0; bloco < MAXIMO_BLOCOS; bloco++) {

    let doBloco = 0;
    let maior = cursor;

    for (
      let pagina = 1;
      pagina <= PAGINAS_POR_BLOCO;
      pagina++
    ) {

      const parametros: Record<string, string> = {
        page: String(pagina),
        per_page: String(POR_PAGINA),
        sort_order: "asc",
        sort_key: "created_at",
        "created[gt]": String(cursor),
      };

      if (limite !== null) {
        parametros["created[lt]"] = String(limite);
      }

      const lote = await pegar<WootricResponse[]>(
        "/responses",
        parametros
      );

      if (!Array.isArray(lote) || lote.length === 0) break;

      for (const item of lote) {
        encontradas.set(item.id, item);
        doBloco += 1;

        const quando = emSegundos(item.created_at);
        if (quando > maior) maior = quando;
      }

      /**
       * O corte vem **depois** de guardar a página.
       *
       * Cortando antes, a página que acabou de custar uma ida à rede
       * seria jogada fora — e a rodada seguinte a buscaria de novo.
       */
      if (teto && encontradas.size >= teto) break;

      if (lote.length < POR_PAGINA) break;
    }

    aoProgredir?.(encontradas.size);

    if (doBloco === 0) break;

    // Já tem o bastante para esta rodada.
    if (teto && encontradas.size >= teto) break;

    const proximo = maior - 1 > cursor ? maior - 1 : maior;

    // Sem avanço não há o que buscar: encerra em vez de girar em falso.
    if (proximo <= cursor) break;

    cursor = proximo;
  }

  return [...encontradas.values()];
}

/* ============================================================
   TRADUÇÃO PARA O NOSSO MODELO
============================================================ */

export interface RespostaImportada {
  externalId: string;
  score: number;
  comment: string;
  respondedAt: Date;
  customer: string;
  email?: string;
  phone?: string;
  company?: string;
  /** `properties.company_id` — o estabelecimento no sistema da casa. */
  externalCompanyId?: string;
  /** Falso para promotor calado: entra na conta, não entra na fila. */
  exigeTratativa: boolean;
}

function texto(valor: unknown) {
  if (typeof valor === "string" && valor.trim() !== "") {
    return valor.trim();
  }

  if (typeof valor === "number") return String(valor);

  return undefined;
}

/** Procura nas propriedades personalizadas, aceitando sinônimos. */
function propriedade(
  usuario: WootricEndUser | undefined,
  ...chaves: string[]
) {
  const props = (usuario?.properties ??
    {}) as Record<string, unknown>;

  for (const chave of chaves) {
    const achado = texto(props[chave]);
    if (achado) return achado;
  }

  return undefined;
}

/**
 * Nome de quem respondeu.
 *
 * O Wootric não tem campo de nome — ele viveria nas propriedades
 * personalizadas, e nesta conta elas só trazem `company_id`. Então o
 * caminho real é a parte antes do @: feia, mas identificável e
 * pesquisável, muito melhor do que "Anônimo" repetido milhares de
 * vezes numa lista que a operação precisa varrer.
 */
function nomeDe(usuario?: WootricEndUser) {

  const daPropriedade = propriedade(
    usuario,
    "name",
    "nome",
    "full_name",
    "customer_name",
    "first_name"
  );

  if (daPropriedade) return daPropriedade;

  const email = usuario?.email ?? "";

  if (email.includes("@")) return email.split("@")[0];

  const externo = texto(usuario?.external_id);

  return externo ? `Cliente ${externo}` : "Não identificado";
}

/**
 * Esta resposta precisa de tratativa individual?
 *
 * A régua: **nota até 8, ou qualquer comentário escrito**. Detrator e
 * neutro são o trabalho de retenção; o comentário é de onde sai a causa
 * raiz, venha de quem vier. O que fica de fora é o promotor calado —
 * nota 9 ou 10 sem uma palavra.
 *
 * Não é preguiça: são ~790 respostas por mês, e 1.051 notas 10 no
 * primeiro ano medido. Abrir ciclo individual para cada uma
 * transformaria a fila em ruído e enterraria os detratores no meio.
 * Eles continuam **entrando na base** — o NPS calculado segue correto,
 * porque tirá-los da conta mudaria o indicador — só não nascem com
 * status "Novo" esperando alguém.
 */
export function exigeTratativa(
  score: number,
  comentario: string
) {
  return score <= 8 || comentario.trim() !== "";
}

export function traduzir(
  resposta: WootricResponse
): RespostaImportada | null {

  if (typeof resposta.score !== "number") return null;

  /**
   * Resposta que o próprio Wootric tirou do cálculo fica de fora: com
   * ela, as duas plataformas mostrariam NPS diferentes.
   */
  if (resposta.excluded_from_calculations) return null;

  const quando = new Date(resposta.created_at);

  if (Number.isNaN(quando.getTime())) return null;

  const usuario = resposta.end_user;

  const comentario = (resposta.text ?? "").trim();

  return {
    externalId: String(resposta.id),
    score: resposta.score,
    comment: comentario,
    respondedAt: quando,
    customer: nomeDe(usuario),
    email: usuario?.email ?? undefined,
    phone: usuario?.phone_number ?? undefined,
    company: propriedade(
      usuario,
      "company",
      "empresa",
      "establishment",
      "estabelecimento",
      "account"
    ),
    externalCompanyId: propriedade(
      usuario,
      "company_id",
      "companyId",
      "empresa_id"
    ),
    exigeTratativa: exigeTratativa(
      resposta.score,
      comentario
    ),
  };
}
