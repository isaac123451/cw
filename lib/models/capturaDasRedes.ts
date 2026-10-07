/**
 * Captura das Redes: o que chega pela planilha e pelo Slack vira atendimento.
 *
 * **O pedido.** "Identificados os casos de uma planilha … e também casos
 * do Slack." Os casos das Redes nascem fora da plataforma — numa planilha
 * do Google preenchida pela automação e num canal do Slack — e eram
 * redigitados um a um no formulário.
 *
 * **A regra mora aqui, e só aqui.** A extensão lê (a planilha aberta, a
 * mensagem do Slack) e manda o texto cru; este arquivo reconhece as
 * colunas, lê rede, perfil, seguidores e data, e dá a cada linha uma
 * chave estável — a mesma linha lida amanhã tem a mesma chave, e é isso
 * que separa **nova**, **já no CW** e **duplicada na própria planilha**.
 *
 * Sem banco e sem React: a conferência prova sem servidor.
 */

export type OrigemDaCaptura = "planilha" | "slack";

export type CampoDaCaptura = "quando" | "rede" | "perfil" | "nome" | "seguidores" | "telefone" | "link" | "texto" | "assunto";

export interface ItemCapturado {
  origem: OrigemDaCaptura;
  /** Estável: vira o `externalId` do caso. */
  chave: string;
  /** "linha 12", "mensagem de 14:32". */
  referencia: string;
  rede: string | null;
  perfil: string;
  nome: string;
  seguidores: number | null;
  telefone: string;
  link: string;
  texto: string;
  assunto: string;
  /** ISO, ou vazio quando a data não veio ou não foi entendida. */
  quando: string;
}

export const REDES_DA_CAPTURA = ["Instagram", "Facebook", "WhatsApp", "ManyChat"] as const;

/* ============================================================
   CSV
============================================================ */

/**
 * CSV com aspas, vírgula ou ponto e vírgula, e quebra de linha dentro
 * da célula — o relato do cliente tem as três.
 */
export function lerCsv(texto: string): string[][] {
  const bruto = texto.replace(/^\uFEFF/, "");
  const primeira = bruto.slice(0, bruto.indexOf("\n") >= 0 ? bruto.indexOf("\n") : bruto.length);
  const separador = (primeira.match(/;/g)?.length ?? 0) > (primeira.match(/,/g)?.length ?? 0) ? ";" : ",";

  const linhas: string[][] = [];
  let linha: string[] = [];
  let celula = "";
  let aspas = false;

  for (let i = 0; i < bruto.length; i++) {
    const c = bruto[i];
    if (aspas) {
      if (c === '"' && bruto[i + 1] === '"') {
        celula += '"';
        i++;
      } else if (c === '"') {
        aspas = false;
      } else if (c === "\r" && bruto[i + 1] === "\n") {
        /* A quebra do Windows dentro do relato vira uma quebra só. */
      } else {
        celula += c;
      }
      continue;
    }
    if (c === '"') aspas = true;
    else if (c === separador) {
      linha.push(celula);
      celula = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && bruto[i + 1] === "\n") i++;
      linha.push(celula);
      linhas.push(linha);
      linha = [];
      celula = "";
    } else celula += c;
  }
  if (celula !== "" || linha.length > 0) {
    linha.push(celula);
    linhas.push(linha);
  }
  return linhas.filter((l) => l.some((v) => v.trim() !== ""));
}

/* ============================================================
   COLUNAS
============================================================ */

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9@]+/g, " ")
    .trim();

/** Os nomes que a operação usa para cada coluna, do mais específico ao mais solto. */
const SINONIMOS: Record<CampoDaCaptura, RegExp> = {
  seguidores: /\bseguidores?\b|\bfollowers?\b|\balcance\b/,
  telefone: /\btelefone\b|\bcelular\b|\bwhats ?app do cliente\b|\bfone\b|\bphone\b/,
  link: /\blink\b|\burl\b|\bpost\b|\bpublicacao\b|\bcomentario link\b/,
  perfil: /\bperfil\b|@|\busuario\b|\buser(name)?\b|\bhandle\b|\barroba\b|\binstagram do cliente\b/,
  nome: /\bnome\b|\bcliente\b|\bquem\b|\bautor\b/,
  rede: /\brede\b|\bcanal\b|\borigem\b|\bplataforma\b|\bfonte\b/,
  quando: /\bdata\b|\bquando\b|\bhora\b|\bcarimbo\b|\btimestamp\b|\bdia\b|\brecebid/,
  assunto: /\bassunto\b|\bcategoria\b|\bmotivo\b|\btema\b|\btipo\b/,
  texto: /\brelato\b|\bmensagem\b|\btexto\b|\bcomentario\b|\bdescricao\b|\bconteudo\b|\breclamacao\b|\bobs/,
};

/** A ordem em que as colunas disputam um cabeçalho ambíguo ("Link do perfil" é link). */
const ORDEM: CampoDaCaptura[] = ["seguidores", "telefone", "link", "perfil", "rede", "quando", "assunto", "texto", "nome"];

export type MapaDeColunas = Partial<Record<CampoDaCaptura, number>>;

export function mapearColunas(cabecalho: string[]): MapaDeColunas {
  const mapa: MapaDeColunas = {};
  const usadas = new Set<number>();
  for (const campo of ORDEM) {
    const i = cabecalho.findIndex((h, idx) => !usadas.has(idx) && SINONIMOS[campo].test(normalizar(h)));
    if (i >= 0) {
      mapa[campo] = i;
      usadas.add(i);
    }
  }
  return mapa;
}

/** A planilha dá para ler se houver o que registrar: o relato ou o link. */
export function colunasSuficientes(mapa: MapaDeColunas) {
  return mapa.texto !== undefined || mapa.link !== undefined;
}

/* ============================================================
   VALORES
============================================================ */

export function redeDoTexto(...valores: string[]): string | null {
  const t = valores.join(" ").toLowerCase();
  if (/instagram|\binsta\b|\big\b/.test(t)) return "Instagram";
  if (/facebook|\bfb\b|fb\.com|messenger/.test(t)) return "Facebook";
  if (/whats\s?app|wa\.me|\bzap\b/.test(t)) return "WhatsApp";
  if (/manychat/.test(t)) return "ManyChat";
  return null;
}

/** "@maria.silva", "instagram.com/maria.silva/" → "maria.silva". */
export function perfilDoTexto(valor: string, link = ""): string {
  const direto = valor.trim().match(/^@?([A-Za-z0-9._]{2,40})$/);
  if (direto) return direto[1];
  const doLink = `${valor} ${link}`.match(/instagram\.com\/(?!p\/|reel\/|stories\/)([A-Za-z0-9._]{2,40})/i);
  if (doLink) return doLink[1];
  const arroba = valor.match(/@([A-Za-z0-9._]{2,40})/);
  return arroba ? arroba[1] : "";
}

/** "18,4 mil", "18.400", "1,2M", "18k" → número. */
export function seguidoresDoTexto(valor: string): number | null {
  const t = valor.toLowerCase().replace(/\s+/g, " ").trim();
  const m = t.match(/(\d+(?:[.,]\d+)*)\s*(milh[õo]es|mil|mi|k|m)?/);
  if (!m) return null;
  let numero = m[1];
  const mult = m[2] === "mil" || m[2] === "k" ? 1_000 : m[2] ? 1_000_000 : 1;
  if (mult > 1) numero = numero.replace(",", ".");
  else numero = numero.replace(/[.,](?=\d{3}\b)/g, "").replace(",", ".");
  const n = Number(numero) * mult;
  return Number.isFinite(n) ? Math.round(n) : null;
}

/**
 * A data da célula, em Brasília: "17/09/2026 14:30", "17/09/2026",
 * "2026-09-17 14:30:00". Sem hora, meio-dia — o relógio do caso parte
 * do expediente e a tela já avisa quando falta a hora.
 */
export function dataDaCelula(valor: string, anoPadrao = new Date().getFullYear()): string {
  const t = valor.trim();
  let a: number, m: number, d: number;
  let h = 12, min = 0;
  const br = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:[ ,T]+(\d{1,2}):(\d{2}))?/);
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (iso) {
    [a, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    if (iso[4]) [h, min] = [Number(iso[4]), Number(iso[5])];
  } else if (br) {
    [d, m] = [Number(br[1]), Number(br[2])];
    a = br[3] ? Number(br[3].length === 2 ? `20${br[3]}` : br[3]) : anoPadrao;
    if (br[4]) [h, min] = [Number(br[4]), Number(br[5])];
  } else return "";
  if (m < 1 || m > 12 || d < 1 || d > 31 || h > 23 || min > 59) return "";
  /* Brasília é UTC−3 o ano todo desde 2019. */
  const instante = new Date(Date.UTC(a, m - 1, d, h + 3, min));
  return Number.isNaN(instante.getTime()) ? "" : instante.toISOString();
}

/** FNV-1a de 32 bits em hexadecimal: curto, estável e sem dependência. */
export function resumoEstavel(texto: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/* ============================================================
   LINHAS → ITENS
============================================================ */

export function itensDaPlanilha(
  linhas: string[][],
  planilha: { id: string; gid: string },
  anoPadrao?: number
): { mapa: MapaDeColunas; cabecalho: string[]; itens: ItemCapturado[] } {
  const [cabecalho = [], ...corpo] = linhas;
  const mapa = mapearColunas(cabecalho);
  const celula = (l: string[], campo: CampoDaCaptura) => (mapa[campo] !== undefined ? (l[mapa[campo]!] ?? "").trim() : "");

  const itens = corpo
    .map((l, i): ItemCapturado | null => {
      const texto = celula(l, "texto");
      const link = celula(l, "link");
      if (!texto && !link) return null;
      const perfilBruto = celula(l, "perfil");
      const quando = dataDaCelula(celula(l, "quando"), anoPadrao);
      const rede = redeDoTexto(celula(l, "rede")) ?? redeDoTexto(link, perfilBruto);
      const perfil = perfilDoTexto(perfilBruto, link);
      /*
        A chave é o conteúdo, e não o número da linha: ordenar a planilha
        ou apagar uma linha acima não pode transformar tudo em "novo".
      */
      const chave = `planilha:${planilha.id}:${resumoEstavel([link, rede ?? "", perfil, quando.slice(0, 16), texto.slice(0, 500)].join("|"))}`;
      return {
        origem: "planilha",
        chave,
        referencia: `linha ${i + 2}`,
        rede,
        perfil,
        nome: celula(l, "nome"),
        seguidores: seguidoresDoTexto(celula(l, "seguidores")),
        telefone: celula(l, "telefone").replace(/\D/g, ""),
        link,
        texto,
        assunto: celula(l, "assunto"),
        quando,
      };
    })
    .filter((x): x is ItemCapturado => x !== null);

  return { mapa, cabecalho, itens };
}

/**
 * O texto da mensagem sem as menções do Slack e sem o "Olá" do começo.
 *
 * A automação do canal escreve "Olá @Carlos Isaac Cliente Janaina entrou
 * em contato no Instagram…": a menção é a quem vai atender, e o leitor a
 * tomava pelo perfil do cliente — o caso nascia com o cliente "@Carlos" e
 * o título "Olá @Carlos Isaac Cliente…" (out/2026). A extensão manda a
 * lista das menções; sem ela (extensão antiga), "@Nome Sobrenome" com
 * maiúsculas é menção — perfil do Instagram não tem espaço.
 */
export function semMencoesDoSlack(texto: string, mencoes: string[] = []) {
  let t = texto;
  for (const m of mencoes) {
    const limpa = m.trim();
    if (limpa.length > 1) t = t.split(limpa).join(" ");
  }
  /* Nome e sobrenome, e só: com mais palavras ela comia o "Cliente Janaina" que vem logo depois. */
  t = t.replace(/@[A-ZÀ-Ú][\wÀ-ú]+\s+[A-ZÀ-Ú][\wÀ-ú]+/g, " ");
  return t
    /* Sem "\b": depois do "á" ele não existe, e o "Olá" ficava. */
    .replace(/^\s*(?:olá|ola|oi|bom dia|boa tarde|boa noite)(?=[\s,!.]|$)[\s,!.]*/i, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/*
  Um acento de UTF-8 lido como Latin-1 vira dois caracteres: o primeiro entre
  Â e ô, o segundo entre 0x80 e 0xBF. Montado por código de caractere para o
  arquivo não depender de escape.
*/
const INICIO_QUEBRADO = `${String.fromCharCode(0xc2)}-${String.fromCharCode(0xf4)}`;
const CONTINUACAO = `${String.fromCharCode(0x80)}-${String.fromCharCode(0xbf)}`;
const ACENTO_QUEBRADO = new RegExp(`[${INICIO_QUEBRADO}][${CONTINUACAO}]{1,3}`, "g");

/**
 * "nÃ£o estÃ¡" → "não está".
 *
 * A automação que avisa no canal do Slack manda o texto com a codificação
 * trocada (out/2026): os atendimentos nasciam com "Minha impressora nÃ£o
 * estÃ¡ funcionando". Cada trecho quebrado é decodificado de volta; o que
 * não for UTF-8 válido fica como estava — texto certo nunca é mexido.
 */
export function consertarAcentos(texto: string) {
  return texto.replace(ACENTO_QUEBRADO, (trecho) => {
    try {
      const bytes = Uint8Array.from(trecho, (c) => c.charCodeAt(0));
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return trecho;
    }
  });
}

/**
 * Uma mensagem do Slack vira item: o texto inteiro é o relato, e rede,
 * perfil, link e seguidores saem de dentro dele.
 */
export function itemDoSlack(entrada: { canal: string; ts: string; texto: string; autor?: string; quando?: string; links?: string[]; mencoes?: string[] }): ItemCapturado {
  const bruto = consertarAcentos(entrada.texto.trim());
  const texto = semMencoesDoSlack(bruto, entrada.mencoes) || bruto;
  const links = [...(entrada.links ?? []), ...(texto.match(/https?:\/\/\S+/g) ?? [])].map((l) => l.replace(/[>)\]]+$/, ""));
  const link = links.find((l) => /instagram\.com|facebook\.com|fb\.com|wa\.me|manychat/i.test(l)) ?? links[0] ?? "";
  const seguidores = texto.match(/(\d+(?:[.,]\d+)*\s*(?:mil|k|mi|m)?)\s*seguidores/i);
  /* "Cliente: Joana Souza" ou, como a automação escreve, "Cliente Janaina entrou em contato". */
  const nome =
    texto.match(/(?:cliente|nome)\s*[:\-–]\s*([^\n,;|]{2,60})/i) ??
    texto.match(/\b[Cc]liente\s+([A-ZÀ-Ú][\wÀ-ú'-]+(?:\s+(?:d[aeo]s?\s+)?[A-ZÀ-Ú][\wÀ-ú'-]+){0,3})/);
  const telefone = texto.match(/(?:\+?55\s*)?\(?\d{2}\)?\s*9?\d{4}[\s.-]?\d{4}/);
  return {
    origem: "slack",
    chave: `slack:${entrada.canal}:${entrada.ts}`,
    referencia: /^\d{4}-\d{2}-\d{2}T/.test(entrada.quando ?? "")
      ? `mensagem de ${new Date(entrada.quando!).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
      : "mensagem",
    rede: redeDoTexto(texto, link),
    perfil: perfilDoTexto(texto.match(/(?<![\w.])@[A-Za-z0-9._]{2,40}/)?.[0] ?? "", link),
    /* "Cliente Outras" é o que a automação escreve quando não sabe o nome. */
    nome: nome && !/^(outr[oa]s?|n[ãa]o informado|desconhecido)$/i.test(nome[1].trim()) ? nome[1].trim() : "",
    seguidores: seguidores ? seguidoresDoTexto(seguidores[1]) : null,
    telefone: telefone ? telefone[0].replace(/\D/g, "") : "",
    link,
    texto,
    assunto: "",
    quando: entrada.quando && /^\d{4}-\d{2}-\d{2}T/.test(entrada.quando) ? entrada.quando : "",
  };
}

export type EstadoDaCaptura = "nova" | "existente" | "duplicada" | "sem-rede";

/**
 * Nova, já no CW, duplicada na própria leitura ou sem rede reconhecida.
 *
 * Duplicada é a segunda ocorrência da mesma chave: a primeira continua
 * valendo como nova (ou existente).
 */
export function classificarItens(itens: ItemCapturado[], jaNoCw: { chaves: Set<string>; links: Set<string> }): { item: ItemCapturado; estado: EstadoDaCaptura }[] {
  const vistas = new Set<string>();
  return itens.map((item) => {
    if (vistas.has(item.chave)) return { item, estado: "duplicada" as const };
    vistas.add(item.chave);
    if (jaNoCw.chaves.has(item.chave) || (item.link && jaNoCw.links.has(item.link))) return { item, estado: "existente" as const };
    if (!item.rede) return { item, estado: "sem-rede" as const };
    return { item, estado: "nova" as const };
  });
}

/** O prefixo do protocolo pela rede, como o formulário já fazia com o IG-. */
export function protocoloDaCaptura(item: Pick<ItemCapturado, "rede" | "chave">) {
  const prefixo = item.rede === "Facebook" ? "FB" : item.rede === "WhatsApp" ? "WA" : item.rede === "ManyChat" ? "MC" : "IG";
  return `${prefixo}-${resumoEstavel(item.chave).toUpperCase()}`;
}

/** O título do cartão: a primeira frase do relato, curta. */
export function tituloDaCaptura(item: Pick<ItemCapturado, "texto" | "perfil" | "rede">) {
  const frase = item.texto.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s/)[0] ?? "";
  const curto = frase.length > 90 ? `${frase.slice(0, 87).trimEnd()}…` : frase;
  return curto || `Menção${item.perfil ? ` de @${item.perfil}` : ""}${item.rede ? ` no ${item.rede}` : ""}`;
}
