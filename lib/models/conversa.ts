import { instanteDe, paredeDe } from "@/lib/services/horasUteis";

/**
 * Conversas de WhatsApp guardadas.
 *
 * Duas portas de entrada: a extensão, que lê as mensagens visíveis da
 * conversa aberta quando alguém clica em "Guardar a conversa", e o
 * arquivo que o próprio WhatsApp gera em "Exportar conversa". As duas
 * chegam aqui na mesma forma — `MensagemRecebida` — e o servidor junta
 * sem repetir: pela chave de cada uma e, entre as duas portas, pela
 * assinatura (quem, minuto e texto).
 */

export type Lado = "cliente" | "nos" | "sistema";

export interface MensagemRecebida {
  /** O id da mensagem no WhatsApp (extensão); o arquivo não tem — a chave sai do conteúdo. */
  chave?: string;
  de: Lado;
  autor?: string | null;
  texto: string;
  /** ISO. O arquivo sempre traz; a extensão, quando o carimbo existe. */
  em?: string | null;
}

export interface MensagemView {
  id: string;
  de: Lado;
  autor?: string;
  texto: string;
  em?: string;
  origem: "extensao" | "arquivo";
}

export interface ConversaResumo {
  id: string;
  contatoNome: string;
  telefone?: string;
  mensagens: number;
  ultimaEm?: string;
  ultimoTexto?: string;
  caso?: { id: string; protocolo: string; frente: "Reclame Aqui" | "Redes Sociais" };
  nps?: { id: string; cliente: string; nota: number };
  estabelecimento?: { id: string; nome: string; slug: string };
  temResumo: boolean;
  guardadaPor: string;
  atualizadoEm: string;
}

export interface ConversaView extends ConversaResumo {
  nosNome?: string;
  resumo?: string;
  resumoEm?: string;
  resumoPor?: string;
  lista: MensagemView[];
}

/* ============================================================
   O ARQUIVO "EXPORTAR CONVERSA"
============================================================ */

/*
  Os dois formatos em português:

    Android  14/09/2026 10:32 - Fulano: texto
             14/09/26 10:32 - Fulano: texto
    iPhone   [14/09/2026, 10:32:15] Fulano: texto
             [14/09/26 10:32:15] Fulano: texto

  O iPhone põe marcas de direção invisíveis (U+200E) no começo das
  linhas de sistema e de mídia. Linha que não começa com data continua a
  mensagem de cima — é assim que o WhatsApp exporta texto com Enter.
*/
const ANDROID = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(?:[aApP]\.?\s?[mM]\.?)?\s+-\s+(.*)$/;
const IPHONE = /^\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(?:[aApP]\.?\s?[mM]\.?)?\]\s+(.*)$/;
/* Marcas de formatação invisíveis (U+200E, U+200F, U+202A–U+202E, U+FEFF): a categoria Cf inteira. */
const INVISIVEIS = /\p{Cf}/gu;

export interface MensagemDoArquivo {
  autor: string | null;
  texto: string;
  em: string;
}

export interface LeituraDoArquivo {
  /** O nome do contato, pelo nome do arquivo ("Conversa do WhatsApp com Fulano.txt"). */
  contato: string | null;
  /** Quem escreveu, e quantas vezes — para a pessoa dizer qual é o nosso lado. */
  autores: { nome: string; mensagens: number }[];
  mensagens: MensagemDoArquivo[];
  /** Linhas que não viraram nada (cabeçalho estranho): para a prévia avisar. */
  ignoradas: number;
}

function ano(a: string) {
  return a.length === 2 ? `20${a}` : a;
}

export function contatoDoNomeDoArquivo(nome?: string | null) {
  const base = String(nome ?? "").replace(/\.(txt|zip)$/i, "").trim();
  const m = base.match(/(?:conversa do whatsapp com|whatsapp chat with|chat de whatsapp con)\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export function lerExportDoWhatsApp(texto: string, nomeDoArquivo?: string | null): LeituraDoArquivo {
  const linhas = texto.replace(/\r/g, "").split("\n");
  const mensagens: MensagemDoArquivo[] = [];
  let ignoradas = 0;

  for (const bruta of linhas) {
    const linha = bruta.replace(INVISIVEIS, "");
    const m = linha.match(IPHONE) ?? linha.match(ANDROID);
    if (!m) {
      /* Continuação da mensagem de cima (texto com Enter). */
      if (mensagens.length > 0 && linha.trim()) mensagens[mensagens.length - 1].texto += `\n${linha}`;
      else if (linha.trim()) ignoradas += 1;
      continue;
    }
    const [, d, mes, a, h, min, resto] = m;
    const dia = `${ano(a)}-${mes.padStart(2, "0")}-${d.padStart(2, "0")}`;
    const em = instanteDe(dia, Number(h) * 60 + Number(min)).toISOString();

    /* "Fulano: texto" — sem os dois-pontos é aviso do sistema. O nome não tem ":" de hora. */
    const autor = resto.match(/^([^:]{1,80}?):\s([\s\S]*)$/);
    mensagens.push(autor ? { autor: autor[1].trim(), texto: autor[2], em } : { autor: null, texto: resto, em });
  }

  for (const msg of mensagens) msg.texto = limparTextoDoArquivo(msg.texto);

  const contagem = new Map<string, number>();
  for (const msg of mensagens) if (msg.autor) contagem.set(msg.autor, (contagem.get(msg.autor) ?? 0) + 1);

  return {
    contato: contatoDoNomeDoArquivo(nomeDoArquivo),
    autores: [...contagem.entries()].map(([nome, n]) => ({ nome, mensagens: n })).sort((a, b) => b.mensagens - a.mensagens),
    mensagens: mensagens.filter((msg) => msg.texto.trim()),
    ignoradas,
  };
}

/** A mídia que não veio no arquivo vira um marcador curto, e não o nome do arquivo de foto. */
function limparTextoDoArquivo(texto: string) {
  const t = texto.trim();
  if (/^<\s*m[íi]dia oculta\s*>$/i.test(t) || /^<media omitted>$/i.test(t)) return "[mídia não incluída]";
  if (/\(arquivo anexado\)$/i.test(t) || /^<anexado:.*>$/i.test(t)) return "[anexo]";
  if (/^(esta mensagem foi apagada|mensagem apagada)\.?$/i.test(t)) return "[mensagem apagada]";
  return t;
}

/**
 * Qual autor é o nosso lado.
 *
 * O contato do arquivo é o cliente; quem não é ele é a conta de
 * Reputação. Sem o nome no arquivo, o palpite é o autor que não é o
 * primeiro a falar — mas a prévia sempre deixa trocar.
 */
export function palpiteDoNosso(leitura: LeituraDoArquivo): string | null {
  if (leitura.autores.length === 0) return null;
  if (leitura.contato) {
    const outro = leitura.autores.find((a) => a.nome.toLowerCase() !== leitura.contato!.toLowerCase());
    if (outro) return outro.nome;
  }
  if (leitura.autores.length === 1) return null;
  const primeiro = leitura.mensagens.find((m) => m.autor)?.autor;
  return leitura.autores.find((a) => a.nome !== primeiro)?.nome ?? null;
}

/** As mensagens do arquivo na forma comum, com o lado de cada uma. */
export function mensagensDoArquivo(leitura: LeituraDoArquivo, nosNome: string | null): MensagemRecebida[] {
  return leitura.mensagens.map((m) => ({
    de: m.autor === null ? "sistema" : m.autor === nosNome ? "nos" : "cliente",
    autor: m.autor,
    texto: m.texto,
    em: m.em,
  }));
}

/* ============================================================
   JUNTAR SEM REPETIR
============================================================ */

/** FNV-1a de 64 bits: a mesma impressão no navegador e no servidor, sem depender de `crypto`. */
export function impressao(texto: string) {
  let h = BigInt("0xcbf29ce484222325");
  const primo = BigInt("0x100000001b3");
  const mascara = BigInt("0xffffffffffffffff");
  for (const ch of texto) {
    h ^= BigInt(ch.codePointAt(0)!);
    h = (h * primo) & mascara;
  }
  return h.toString(16).padStart(16, "0");
}

/** A chave de uma mensagem que veio sem id (arquivo): quem, quando e o quê. */
export function chaveDoConteudo(m: MensagemRecebida) {
  return `arq:${impressao(`${m.de}|${m.autor ?? ""}|${m.em ?? ""}|${m.texto}`)}`;
}

/**
 * A assinatura que junta as duas portas: o mesmo lado, o mesmo minuto de
 * Brasília e o mesmo começo de texto. A extensão lê "10:32, 14/09/2026"
 * e o arquivo "14/09/2026 10:32" — o minuto é o que os dois têm.
 */
export function assinatura(m: { de: string; em?: string | null; texto: string }) {
  let minuto = "";
  if (m.em) {
    const { dia, min } = paredeDe(new Date(m.em));
    minuto = `${dia} ${min}`;
  }
  return `${m.de}|${minuto}|${m.texto.replace(/\s+/g, " ").trim().slice(0, 160)}`;
}

/** O carimbo da extensão ("10:32, 14/09/2026") como instante de Brasília. */
export function instanteDoCarimbo(carimbo?: string | null): string | null {
  const m = String(carimbo ?? "").match(/(\d{1,2}):(\d{2})(?::\d{2})?,?\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  const [, h, min, d, mes, a] = m;
  return instanteDe(`${ano(a)}-${mes.padStart(2, "0")}-${d.padStart(2, "0")}`, Number(h) * 60 + Number(min)).toISOString();
}

/* ============================================================
   O QUE NÃO SE GUARDA
============================================================ */

/**
 * Dados bancários e de cartão saem antes de gravar.
 *
 * A regra da renegociação vale aqui também: dado bancário não fica na
 * plataforma. Numa conversa ele aparece colado pelo cliente — a chave
 * Pix, "agência 1234 conta 56789-0", o número do cartão. O texto guardado
 * troca o trecho por "[dado bancário omitido]" e diz quantos saíram; o
 * original continua só no WhatsApp.
 */
export function omitirDadosBancarios(texto: string): { texto: string; omitidos: number } {
  let omitidos = 0;
  const marca = "[dado bancário omitido]";
  let t = texto;

  /* Cartão: 13 a 19 dígitos (com espaço ou traço) que passam no Luhn. */
  t = t.replace(/\b(?:\d[ -]?){12,18}\d\b/g, (trecho) => {
    const digitos = trecho.replace(/\D/g, "");
    if (digitos.length < 13 || digitos.length > 19 || !luhn(digitos)) return trecho;
    omitidos += 1;
    return marca;
  });

  /* "Chave pix: …" — o que vem depois até o fim da linha. */
  t = t.replace(/(chave\s*(?:do\s*)?pix\s*(?:é|e|:|-)?\s*)([^\n]{3,120})/gi, (_, rotulo: string) => {
    omitidos += 1;
    return `${rotulo}${marca}`;
  });

  /* "pix: 11999998888" — a chave logo depois, sem espaço. "Pagar via pix hoje" não tem separador e fica. */
  t = t.replace(/(\bpix\s*(?::|é|-)\s*)(?!\[)([^\s,;]{5,80})/gi, (_, rotulo: string) => {
    omitidos += 1;
    return `${rotulo}${marca}`;
  });

  /* "ag 1234 c/c 56789-0", "agência: 0001 conta: 12345-6". */
  t = t.replace(/\b(ag(?:[êe]ncia)?\.?\s*:?\s*)\d{3,5}(?:-\d)?(\s*(?:,|e|\/)?\s*(?:c\/?c|conta(?:\s*corrente|\s*poupan[çc]a)?)\.?\s*:?\s*)[\d.]{3,12}-?[\dxX]?/gi, (_, a: string, c: string) => {
    omitidos += 1;
    return `${a}${marca}${c}${marca}`;
  });

  /* "conta 12345-6" sozinha, e o código de segurança do cartão. */
  t = t.replace(/\b(conta(?:\s*corrente|\s*poupan[çc]a)?\s*:?\s*)(\d{4,12}-[\dxX])\b/gi, (_, c: string) => {
    omitidos += 1;
    return `${c}${marca}`;
  });
  t = t.replace(/\b(cvv|cvc|c[óo]digo de seguran[çc]a)\s*:?\s*\d{3,4}\b/gi, (_, r: string) => {
    omitidos += 1;
    return `${r} ${marca}`;
  });

  return { texto: t, omitidos };
}

function luhn(digitos: string) {
  let soma = 0;
  let dobra = false;
  for (let i = digitos.length - 1; i >= 0; i--) {
    let n = Number(digitos[i]);
    if (dobra) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    soma += n;
    dobra = !dobra;
  }
  return soma % 10 === 0;
}
