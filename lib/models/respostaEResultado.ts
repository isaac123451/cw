import { normalizarTexto } from "@/lib/models/sugestaoPorTexto";
import { tomDoTexto } from "@/lib/services/motorProprio";

/**
 * Resposta e resultado (Fase 29, 1.109).
 *
 * - **Resposta ligada ao resultado.** Cada resposta pública, com o que veio
 *   depois: avaliou, em quantos dias, resolveu, que nota, voltaria. Cada
 *   mensagem nossa no WhatsApp, com o que o cliente fez: respondeu em
 *   quanto tempo, e o humor melhorou ou piorou.
 * - **O que funciona, em número.** Os traços de cada resposta (prazo
 *   concreto × "vamos verificar", contar o contato feito, descrever a
 *   solução, tamanho, tempo até responder; no WhatsApp, áudio × texto e
 *   horário), com o retorno medido de quem tem e de quem não tem — por
 *   tipo de problema.
 * - **As suas melhores viram modelo.** As que levaram a "resolvido" com
 *   nota alta sobem como sugestão; as que não funcionaram, e as mensagens
 *   depois das quais o humor piorou, ficam marcadas.
 *
 * **Diferença não é causa.** A tela mostra quantas respostas sustentam
 * cada número e só chama de "sinal" o que tem base (10 ou mais avaliadas
 * de cada lado). Com menos, o número aparece, mas como "pouca base".
 */

/* ------------------------------------------------------------------ */
/* Os traços de uma resposta                                           */
/* ------------------------------------------------------------------ */

export interface TracosDaResposta {
  prazoConcreto: boolean;
  /** "Vamos verificar", "em breve" — sem dizer quando. */
  vago: boolean;
  contatoFeito: boolean;
  solucaoDescrita: boolean;
  desculpa: boolean;
  conviteAvaliar: boolean;
  tamanho: "curta" | "media" | "longa";
}

const PRAZO_CONCRETO = /\b(ate|em|no prazo de)\s+(\d{1,2}\/\d{1,2}|\d+\s*(h\b|horas?|dias?|minutos?|semanas?))|\b(hoje|amanha)\b|\b(ate|na|nesta|nessa|proxima)\s+(segunda|terca|quarta|quinta|sexta)/;
const VAGO = /\b(vamos|iremos|estamos|vou|irei|seguimos)\s+(verificar|analisar|averiguar|apurar|checar|investigar|acompanhar)|\b(em breve|o quanto antes|assim que possivel|o mais breve)\b/;
const CONTATO_FEITO = /\b(entramos|entrei|fizemos|realizamos|tentamos|tentei|efetuamos)\s+(em\s+)?(contato|ligac|uma ligac)|\b(conversamos|falamos|conversei|falei|alinhamos)\s+com\s+(voce|o senhor|a senhora|vc)|\bconforme\s+(conversado|combinado|alinhado|falado)/;
const SOLUCAO = /\b(foi|esta|ja esta|ficou|ja foi)\s+(corrigid|resolvid|ajustad|normalizad|estabilizad|reativad|restabelecid|estornad|reembolsad|liberad|cancelad)|\b(corrigimos|resolvemos|ajustamos|reativamos|estornamos|reembolsamos|liberamos|normalizamos|cancelamos)\b/;
const DESCULPA = /\b(desculp|lamentamos|lamento|sentimos muito|pedimos perdao)/;
const CONVITE = /\bavali(e|ar|acao)\b/;

export function tracosDaResposta(texto: string): TracosDaResposta {
  const t = normalizarTexto(texto);
  const prazoConcreto = PRAZO_CONCRETO.test(t);
  return {
    prazoConcreto,
    vago: VAGO.test(t) && !prazoConcreto,
    contatoFeito: CONTATO_FEITO.test(t),
    solucaoDescrita: SOLUCAO.test(t),
    desculpa: DESCULPA.test(t),
    conviteAvaliar: CONVITE.test(t),
    tamanho: texto.length <= 600 ? "curta" : texto.length <= 900 ? "media" : "longa",
  };
}

/* ------------------------------------------------------------------ */
/* A resposta pública com o que veio depois                            */
/* ------------------------------------------------------------------ */

export interface EntradaDaResposta {
  id: string;
  protocolo: string;
  cliente: string;
  categoria: string;
  texto: string;
  /** Dia da reclamação (AAAA-MM-DD). */
  reclamadaEm: string;
  respondidaEm: string | null;
  avaliada: boolean;
  resolvida: boolean;
  nota: number | null;
  voltaria: boolean;
  avaliadaEm: string | null;
}

export interface RespostaComResultado extends EntradaDaResposta {
  tracos: TracosDaResposta;
  diasAteResponder: number | null;
  diasAteAvaliar: number | null;
  /** "funcionou": resolvida com nota 7 ou mais; "nao": não resolvida ou nota 4 ou menos. */
  resultado: "funcionou" | "nao" | "meio" | "sem-avaliacao";
}

const DIA_MS = 86_400_000;
const dias = (de: string, ate: string) => Math.max(0, Math.floor((Date.parse(ate.slice(0, 10)) - Date.parse(de.slice(0, 10))) / DIA_MS));

export function comResultado(r: EntradaDaResposta): RespostaComResultado {
  const resultado = !r.avaliada ? "sem-avaliacao" : r.resolvida && (r.nota ?? 0) >= 7 ? "funcionou" : !r.resolvida || (r.nota ?? 10) <= 4 ? "nao" : "meio";
  return {
    ...r,
    tracos: tracosDaResposta(r.texto),
    diasAteResponder: r.respondidaEm ? dias(r.reclamadaEm, r.respondidaEm) : null,
    diasAteAvaliar: r.respondidaEm && r.avaliadaEm ? dias(r.respondidaEm, r.avaliadaEm) : null,
    resultado,
  };
}

/* ------------------------------------------------------------------ */
/* O que funciona, em número                                           */
/* ------------------------------------------------------------------ */

export interface Retorno {
  respostas: number;
  avaliadas: number;
  /** Das avaliadas, quantas % resolvidas. */
  resolvidoPct: number | null;
  notaMedia: number | null;
  voltariaPct: number | null;
}

export const BASE_MINIMA = 10;

export function retornoDe(lista: RespostaComResultado[]): Retorno {
  const av = lista.filter((r) => r.avaliada);
  const notas = av.map((r) => r.nota).filter((n): n is number => n !== null);
  const pct = (n: number) => (av.length ? Math.round((n / av.length) * 1000) / 10 : null);
  return {
    respostas: lista.length,
    avaliadas: av.length,
    resolvidoPct: pct(av.filter((r) => r.resolvida).length),
    notaMedia: notas.length ? Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10 : null,
    voltariaPct: pct(av.filter((r) => r.voltaria).length),
  };
}

export interface Padrao {
  chave: string;
  rotulo: string;
  /** Os grupos comparados — dois (com × sem) ou três (tamanho, tempo). */
  grupos: { rotulo: string; retorno: Retorno }[];
  /** Diferença de resolvido entre o melhor e o pior grupo, em pontos. */
  diferenca: number | null;
  /** Todos os grupos com base mínima de avaliadas. */
  temBase: boolean;
}

function padrao(chave: string, rotulo: string, grupos: { rotulo: string; lista: RespostaComResultado[] }[]): Padrao {
  const g = grupos.map((x) => ({ rotulo: x.rotulo, retorno: retornoDe(x.lista) }));
  const pcts = g.map((x) => x.retorno.resolvidoPct).filter((p): p is number => p !== null);
  return {
    chave,
    rotulo,
    grupos: g,
    diferenca: pcts.length >= 2 ? Math.round((Math.max(...pcts) - Math.min(...pcts)) * 10) / 10 : null,
    temBase: g.every((x) => x.retorno.avaliadas >= BASE_MINIMA),
  };
}

const dividir = (lista: RespostaComResultado[], f: (r: RespostaComResultado) => boolean) => [lista.filter(f), lista.filter((r) => !f(r))];

/** Os padrões com retorno medido. Com `categoria`, só as respostas daquele tipo de problema. */
export function padroesQueFuncionam(respostas: RespostaComResultado[], categoria?: string): Padrao[] {
  const lista = categoria ? respostas.filter((r) => r.categoria === categoria) : respostas;
  const par = (chave: string, rotulo: string, com: string, sem: string, f: (r: RespostaComResultado) => boolean) => {
    const [a, b] = dividir(lista, f);
    return padrao(chave, rotulo, [
      { rotulo: com, lista: a },
      { rotulo: sem, lista: b },
    ]);
  };
  const comTempo = lista.filter((r) => r.diasAteResponder !== null);
  return [
    par("prazo", "Prazo concreto", "diz quando", "não diz quando", (r) => r.tracos.prazoConcreto),
    par("vago", "\"Vamos verificar\" sem prazo", "promete verificar", "não", (r) => r.tracos.vago),
    par("contato", "Conta o contato feito", "conta", "não conta", (r) => r.tracos.contatoFeito),
    par("solucao", "Descreve a solução", "descreve", "não descreve", (r) => r.tracos.solucaoDescrita),
    par("desculpa", "Pede desculpas", "pede", "não pede", (r) => r.tracos.desculpa),
    par("convite", "Convida a avaliar", "convida", "não convida", (r) => r.tracos.conviteAvaliar),
    padrao("tamanho", "Tamanho", [
      { rotulo: "até 600 letras", lista: lista.filter((r) => r.tracos.tamanho === "curta") },
      { rotulo: "600 a 900", lista: lista.filter((r) => r.tracos.tamanho === "media") },
      { rotulo: "longa (mais de 900)", lista: lista.filter((r) => r.tracos.tamanho === "longa") },
    ]),
    padrao("tempo", "Tempo até responder", [
      { rotulo: "até 1 dia", lista: comTempo.filter((r) => r.diasAteResponder! <= 1) },
      { rotulo: "2 a 3 dias", lista: comTempo.filter((r) => r.diasAteResponder! >= 2 && r.diasAteResponder! <= 3) },
      { rotulo: "4 dias ou mais", lista: comTempo.filter((r) => r.diasAteResponder! >= 4) },
    ]),
  ];
}

/** Os tipos de problema com respostas suficientes para filtrar. */
export function categoriasComBase(respostas: RespostaComResultado[], minimo = 5) {
  const conta = new Map<string, number>();
  for (const r of respostas) if (r.avaliada) conta.set(r.categoria, (conta.get(r.categoria) ?? 0) + 1);
  return [...conta.entries()].filter(([, n]) => n >= minimo).sort((a, b) => b[1] - a[1]).map(([c, n]) => ({ categoria: c, avaliadas: n }));
}

/* ------------------------------------------------------------------ */
/* As suas melhores viram modelo                                       */
/* ------------------------------------------------------------------ */

/**
 * O texto sem o nome do cliente: vira `{nome}`, para servir de modelo sem
 * levar o nome de outra pessoa junto. Só o primeiro nome e o nome inteiro
 * — o resto do texto fica como foi publicado. Quem assina ("Sou o
 * Wesley") não é trocado, mesmo com o mesmo nome do cliente.
 */
export function anonimizar(texto: string, cliente: string) {
  const partes = cliente.trim().split(/\s+/).filter((p) => p.length >= 3);
  let saida = texto;
  for (const alvo of [cliente.trim(), partes[0]].filter(Boolean) as string[]) {
    const escapado = alvo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    saida = saida.replace(new RegExp(`(^|[^\\p{L}])${escapado}(?![\\p{L}])`, "giu"), (achado: string, antes: string, onde: number, tudo: string) =>
      /(sou [oa]|me chamo|aqui (é|e) [oa]?)\s*$/i.test(tudo.slice(Math.max(0, onde - 14), onde + antes.length)) ? achado : `${antes}{nome}`
    );
  }
  return saida;
}

/** As que levaram a resolvido com nota alta — a maior nota primeiro, a mais curta desempata. */
export function melhoresRespostas(respostas: RespostaComResultado[], categoria?: string, quantas = 8) {
  return respostas
    .filter((r) => (!categoria || r.categoria === categoria) && r.avaliada && r.resolvida && (r.nota ?? 0) >= 8 && r.texto.trim().length >= 120)
    .sort((a, b) => (b.nota ?? 0) - (a.nota ?? 0) || Number(b.voltaria) - Number(a.voltaria) || a.texto.length - b.texto.length)
    .slice(0, quantas);
}

/** As que não funcionaram: não resolvida ou nota 4 ou menos. */
export function respostasQueNaoFuncionaram(respostas: RespostaComResultado[], categoria?: string) {
  return respostas.filter((r) => (!categoria || r.categoria === categoria) && r.resultado === "nao");
}

/* ------------------------------------------------------------------ */
/* WhatsApp: cada mensagem nossa, com o que o cliente fez depois       */
/* ------------------------------------------------------------------ */

export interface MensagemGuardada {
  de: string;
  texto: string;
  em: string | null;
}

export interface VezComResultado {
  conversaId: string;
  contato: string;
  /** O texto da nossa vez (mensagens seguidas nossas viram uma vez só). */
  texto: string;
  em: string;
  audio: boolean;
  periodo: "manha" | "tarde" | "noite";
  respondeuEmMin: number | null;
  mudou: "melhorou" | "piorou" | "igual" | null;
}

const AUDIO = /^transcri[cç][aã]o do [aá]udio/i;

function periodoDe(iso: string): VezComResultado["periodo"] {
  const h = Number(new Date(iso).toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" })) % 24;
  return h < 12 ? "manha" : h < 18 ? "tarde" : "noite";
}

/**
 * As vezes em que falamos, com o que veio depois. O humor de antes é o
 * tom das duas últimas mensagens do cliente antes da nossa vez; o de
 * depois, o das duas primeiras depois. Sem mensagem do cliente depois,
 * não há o que medir: fica `null`, e não "igual".
 */
export function vezesComResultado(conversas: { id: string; contato: string; mensagens: MensagemGuardada[] }[]): VezComResultado[] {
  const saida: VezComResultado[] = [];
  for (const c of conversas) {
    const msgs = c.mensagens.filter((m) => m.em).sort((a, b) => Date.parse(a.em!) - Date.parse(b.em!));
    let i = 0;
    while (i < msgs.length) {
      if (msgs[i].de !== "nos") {
        i++;
        continue;
      }
      const inicio = i;
      while (i < msgs.length && msgs[i].de === "nos") i++;
      const nossas = msgs.slice(inicio, i);
      const antes = msgs.slice(0, inicio).filter((m) => m.de === "cliente").slice(-2);
      const depois = msgs.slice(i).filter((m) => m.de === "cliente").slice(0, 2);
      const ultima = nossas[nossas.length - 1];
      const tom = (l: MensagemGuardada[]) => l.reduce((s, m) => s + tomDoTexto(m.texto), 0);
      const delta = depois.length ? tom(depois) - tom(antes) : null;
      saida.push({
        conversaId: c.id,
        contato: c.contato,
        texto: nossas.map((m) => m.texto).join("\n").slice(0, 600),
        em: ultima.em!,
        audio: nossas.some((m) => AUDIO.test(m.texto.trim())),
        periodo: periodoDe(ultima.em!),
        respondeuEmMin: depois.length ? Math.max(0, Math.round((Date.parse(depois[0].em!) - Date.parse(ultima.em!)) / 60_000)) : null,
        mudou: delta === null ? null : delta >= 1 ? "melhorou" : delta <= -1 ? "piorou" : "igual",
      });
    }
  }
  return saida.sort((a, b) => Date.parse(b.em) - Date.parse(a.em));
}

export interface RetornoNoWhatsapp {
  vezes: number;
  /** Quantas % tiveram resposta do cliente. */
  respondeuPct: number | null;
  /** Mediana, em minutos, até o cliente responder. */
  medianaMin: number | null;
  pioraPct: number | null;
}

export function retornoNoWhatsapp(lista: VezComResultado[]): RetornoNoWhatsapp {
  const resp = lista.filter((v) => v.respondeuEmMin !== null).map((v) => v.respondeuEmMin!).sort((a, b) => a - b);
  const medidas = lista.filter((v) => v.mudou !== null);
  return {
    vezes: lista.length,
    respondeuPct: lista.length ? Math.round((resp.length / lista.length) * 1000) / 10 : null,
    medianaMin: resp.length ? resp[Math.floor(resp.length / 2)] : null,
    pioraPct: medidas.length ? Math.round((medidas.filter((v) => v.mudou === "piorou").length / medidas.length) * 1000) / 10 : null,
  };
}

export function padroesNoWhatsapp(vezes: VezComResultado[]) {
  return [
    {
      chave: "audio",
      rotulo: "Áudio × texto",
      grupos: [
        { rotulo: "áudio", retorno: retornoNoWhatsapp(vezes.filter((v) => v.audio)) },
        { rotulo: "texto", retorno: retornoNoWhatsapp(vezes.filter((v) => !v.audio)) },
      ],
    },
    {
      chave: "horario",
      rotulo: "Horário da nossa mensagem",
      grupos: [
        { rotulo: "manhã", retorno: retornoNoWhatsapp(vezes.filter((v) => v.periodo === "manha")) },
        { rotulo: "tarde", retorno: retornoNoWhatsapp(vezes.filter((v) => v.periodo === "tarde")) },
        { rotulo: "noite", retorno: retornoNoWhatsapp(vezes.filter((v) => v.periodo === "noite")) },
      ],
    },
    {
      chave: "tamanho",
      rotulo: "Tamanho da mensagem",
      grupos: [
        { rotulo: "curta (até 200)", retorno: retornoNoWhatsapp(vezes.filter((v) => v.texto.length <= 200)) },
        { rotulo: "longa", retorno: retornoNoWhatsapp(vezes.filter((v) => v.texto.length > 200)) },
      ],
    },
  ];
}
