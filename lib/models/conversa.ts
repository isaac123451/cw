import { EXPEDIENTE_PADRAO, instanteDe, minutosUteisEntre, paredeDe, type Expediente } from "@/lib/services/horasUteis";

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
  /** Transcrição de um áudio (1.82) — guardada com origem "transcricao". */
  transcricao?: boolean;
}

export interface MensagemView {
  id: string;
  de: Lado;
  autor?: string;
  texto: string;
  em?: string;
  origem: "extensao" | "arquivo" | "transcricao";
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
  /** Quem falou por último (sem os avisos do sistema) — "esperando a gente" na lista. */
  ultimaDe?: "cliente" | "nos";
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
  const texto = String(carimbo ?? "");
  /* "10:32, 14/09/2026" (o WhatsApp Web em português) ou "14/09/2026, 10:32". */
  const horaPrimeiro = texto.match(/(\d{1,2}):(\d{2})(?::\d{2})?,?\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  const dataPrimeiro = texto.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})/);
  let partes: [string, string, string, string, string] | null = null;
  if (horaPrimeiro) partes = [horaPrimeiro[1], horaPrimeiro[2], horaPrimeiro[3], horaPrimeiro[4], horaPrimeiro[5]];
  else if (dataPrimeiro) partes = [dataPrimeiro[4], dataPrimeiro[5], dataPrimeiro[1], dataPrimeiro[2], dataPrimeiro[3]];
  if (!partes) return null;
  const [h, min, d, mes, a] = partes;
  return instanteDe(`${ano(a)}-${mes.padStart(2, "0")}-${d.padStart(2, "0")}`, Number(h) * 60 + Number(min)).toISOString();
}

/* ============================================================
   A CONVERSA COMO EVIDÊNCIA
============================================================ */

export interface EvidenciaDaConversa {
  /**
   * A nossa primeira mensagem que teve resposta do cliente depois — o
   * 1º contato "de verdade" que o documento pede (conversa, não
   * tentativa). Mensagem nossa sem resposta nenhuma depois é tentativa.
   */
  primeiroContato: MensagemView | null;
  /**
   * A confirmação provável: a última mensagem do cliente depois de uma
   * nossa, com palavras de "voltou", "funcionou", "resolveu", "obrigado".
   * É sugestão — quem decide que é a validação é a pessoa.
   */
  validacaoSugerida: MensagemView | null;
}

const PARECE_CONFIRMACAO = /\b(voltou|funcionou|funcionando|resolv|deu certo|tudo certo|normalizou|obrigad|valeu|perfeito|consegui)/i;

export function evidenciaDaConversa(lista: MensagemView[]): EvidenciaDaConversa {
  const comHora = lista.filter((m) => m.em && m.de !== "sistema");
  let primeiroContato: MensagemView | null = null;
  for (let i = 0; i < comHora.length; i++) {
    if (comHora[i].de !== "nos") continue;
    if (comHora.slice(i + 1).some((m) => m.de === "cliente")) {
      primeiroContato = comHora[i];
      break;
    }
  }

  let validacaoSugerida: MensagemView | null = null;
  for (let i = comHora.length - 1; i >= 0; i--) {
    const m = comHora[i];
    if (m.de !== "cliente" || !PARECE_CONFIRMACAO.test(m.texto)) continue;
    if (comHora.slice(0, i).some((o) => o.de === "nos")) validacaoSugerida = m;
    break;
  }

  return { primeiroContato, validacaoSugerida };
}

/* ============================================================
   O RETRATO DA CONVERSA — quem espera, e há quanto tempo
============================================================ */

export interface RetratoDaConversa {
  doCliente: number;
  nossas: number;
  primeiraEm?: string;
  /** Quem falou por último, sem contar avisos do sistema. */
  ultimaDe?: "cliente" | "nos";
  /**
   * A primeira mensagem do cliente que ainda não teve resposta nossa.
   * É dela que se conta a espera — não da última: quem mandou três
   * mensagens seguidas está esperando desde a primeira.
   */
  esperandoDesde?: string;
  /** Minutos úteis de espera até `agora`, no relógio do expediente. */
  minutosEsperando?: number;
  /** Quantas vezes respondemos a uma fala do cliente (as que têm hora dos dois lados). */
  respostas: number;
  /** A média, em minutos úteis, entre a fala do cliente e a nossa resposta. */
  respostaMediaMin?: number;
}

/**
 * O que a conversa diz sem ninguém ler tudo: se o cliente está
 * esperando a gente, desde quando, e quanto costumamos demorar.
 *
 * Conta em **minutos úteis** — a mesma régua dos prazos. Uma mensagem
 * de sábado respondida na segunda às 8h05 é uma resposta de 5 minutos,
 * não de dois dias. Mensagem sem hora (a extensão às vezes não acha o
 * carimbo) fica fora das contas de tempo, mas conta nos totais.
 */
export function retratoDaConversa(
  lista: Pick<MensagemView, "de" | "em">[],
  agora: Date,
  expediente: Expediente = EXPEDIENTE_PADRAO
): RetratoDaConversa {
  const falas = lista.filter((m) => m.de !== "sistema");
  const doCliente = falas.filter((m) => m.de === "cliente").length;
  const retrato: RetratoDaConversa = {
    doCliente,
    nossas: falas.length - doCliente,
    primeiraEm: lista.find((m) => m.em)?.em,
    ultimaDe: falas.length ? (falas[falas.length - 1].de as "cliente" | "nos") : undefined,
    respostas: 0,
  };

  let inicioDoBloco: string | undefined;
  let semHoraNoBloco = false;
  let soma = 0;

  for (const m of falas) {
    if (m.de === "cliente") {
      if (!inicioDoBloco && !semHoraNoBloco) {
        if (m.em) inicioDoBloco = m.em;
        else semHoraNoBloco = true;
      }
      continue;
    }
    /* Sem hora de um dos lados, a resposta existiu mas não entra na média. */
    if (inicioDoBloco && m.em) {
      retrato.respostas += 1;
      soma += Math.max(0, minutosUteisEntre(new Date(inicioDoBloco), new Date(m.em), expediente));
    }
    inicioDoBloco = undefined;
    semHoraNoBloco = false;
  }

  if (retrato.respostas > 0) retrato.respostaMediaMin = Math.round(soma / retrato.respostas);

  if (retrato.ultimaDe === "cliente" && inicioDoBloco) {
    retrato.esperandoDesde = inicioDoBloco;
    retrato.minutosEsperando = Math.max(0, minutosUteisEntre(new Date(inicioDoBloco), agora, expediente));
  }

  return retrato;
}

export interface LadosDaConversa {
  /** Os autores dos carimbos, do que mais escreveu para o que menos. */
  autores: { nome: string; mensagens: number; lado: "cliente" | "nos" }[];
  /** Dois autores ou mais, e todas as falas de um lado só: a leitura errou a direção. */
  suspeita: boolean;
  /** Linhas sem autor e sem hora que não estão como aviso — o "1,0×", a criptografia. */
  semAutorESemHora: number;
}

/**
 * Os lados da conversa, pelo autor gravado em cada mensagem.
 *
 * Uma conversa com dois autores e nenhuma fala nossa (ou nenhuma do
 * cliente) não aconteceu assim: é a direção que foi lida errada. A tela
 * mostra a correção aberta nesse caso.
 */
export function ladosDaConversa(lista: Pick<MensagemView, "de" | "autor" | "em">[]): LadosDaConversa {
  const porAutor = new Map<string, { mensagens: number; nos: number }>();
  let semAutorESemHora = 0;

  for (const m of lista) {
    if (m.de === "sistema") continue;
    if (!m.autor) {
      if (!m.em) semAutorESemHora += 1;
      continue;
    }
    const atual = porAutor.get(m.autor) ?? { mensagens: 0, nos: 0 };
    atual.mensagens += 1;
    if (m.de === "nos") atual.nos += 1;
    porAutor.set(m.autor, atual);
  }

  const autores = [...porAutor.entries()]
    .map(([nome, x]) => ({ nome, mensagens: x.mensagens, lado: (x.nos * 2 > x.mensagens ? "nos" : "cliente") as "cliente" | "nos" }))
    .sort((a, b) => b.mensagens - a.mensagens);

  const falas = lista.filter((m) => m.de !== "sistema");
  const umLadoSo = falas.length > 0 && (falas.every((m) => m.de === "cliente") || falas.every((m) => m.de === "nos"));

  return { autores, suspeita: autores.length >= 2 && umLadoSo, semAutorESemHora };
}

/**
 * A chave de um telefone para achar o mesmo número em outro cadastro:
 * DDD + os 8 últimos dígitos.
 *
 * Sem o 55 do país (o WhatsApp põe, o cadastro às vezes não) e sem o 9
 * da frente do celular (as bases antigas não têm). Oito dígitos sozinhos
 * não bastam: o mesmo final em DDDs diferentes é outra pessoa, e sugerir
 * o caso de outra pessoa é pior que não sugerir. Sem DDD, não há chave.
 */
export function chaveDoTelefone(valor?: string | null): string | null {
  let d = String(valor ?? "").replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length < 10 || d.length > 11) return null;
  return d.slice(0, 2) + d.slice(-8);
}

/* ============================================================
   EXPORTAR
============================================================ */

/** "14/09/2026 10:32" — o carimbo do arquivo que o WhatsApp gera. */
function carimboDoExport(iso?: string | null) {
  if (!iso) return "";
  const { dia, min } = paredeDe(new Date(iso));
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)} ${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/**
 * A conversa como arquivo de texto, no formato do "Exportar conversa"
 * do WhatsApp.
 *
 * É de propósito: além de ser o formato que todo mundo já sabe ler e
 * que abre em qualquer lugar, ele **volta para cá** — a mesma tela que
 * importa o arquivo do WhatsApp lê este, e a junção sem repetir
 * reconhece as mensagens que já estão guardadas.
 *
 * O cabeçalho vem antes, separado por uma linha em branco: quem é o
 * contato, os vínculos, o resumo salvo e quem exportou. A leitura do
 * arquivo ignora linhas sem data no começo, então ele não atrapalha a
 * volta.
 */
export function textoDaConversaExportada(
  conversa: ConversaView,
  contexto: { exportadaPor: string; exportadaEm: string }
): string {
  const nosso = conversa.nosNome?.trim() || "Reputação (CW)";
  const doCliente = conversa.contatoNome?.trim() || (conversa.telefone ? `+${conversa.telefone}` : "Cliente");

  const cabecalho = [
    `Conversa do WhatsApp com ${doCliente}${conversa.telefone ? ` (+${conversa.telefone})` : ""}`,
    `${conversa.mensagens} mensagem(ns) · guardada no CW Reputação por ${conversa.guardadaPor}`,
    conversa.caso ? `Caso: ${conversa.caso.protocolo} (${conversa.caso.frente})` : "",
    conversa.nps ? `NPS: ${conversa.nps.cliente} — nota ${conversa.nps.nota}` : "",
    conversa.estabelecimento ? `Estabelecimento: ${conversa.estabelecimento.nome}` : "",
    conversa.resumo ? `Resumo salvo: ${conversa.resumo.replace(/s+/g, " ")}` : "",
    `Exportada por ${contexto.exportadaPor} em ${carimboDoExport(contexto.exportadaEm)}. Dados bancários e de cartão foram omitidos quando a conversa foi guardada.`,
    "",
  ].filter((l) => l !== "");

  const linhas = conversa.lista.map((m) => {
    const quem = m.de === "nos" ? nosso : m.de === "sistema" ? "" : m.autor?.trim() || doCliente;
    const inicio = `${carimboDoExport(m.em) || carimboDoExport(conversa.atualizadoEm)} - `;
    return `${inicio}${quem ? `${quem}: ` : ""}${m.texto}`;
  });

  return [...cabecalho, ...linhas].join("\n");
}

/** As linhas da planilha — uma mensagem por linha, com a hora de Brasília separada. */
export function planilhaDaConversa(conversa: ConversaView) {
  return conversa.lista.map((m) => {
    const carimbo = carimboDoExport(m.em);
    return {
      Data: carimbo.slice(0, 10),
      Hora: carimbo.slice(11),
      Quem: m.de === "nos" ? "Nós" : m.de === "sistema" ? "Sistema" : "Cliente",
      Autor: m.autor ?? "",
      Mensagem: m.texto,
      Origem: m.origem === "arquivo" ? "Arquivo exportado" : "Extensão",
    };
  });
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
