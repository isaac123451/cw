import { combinadoNaMensagem } from "@/lib/models/lembretesAutomaticos";
import { instanteDoCarimbo, rajadaDoCliente } from "@/lib/models/oQueFazerAgora";
import { CRITERIOS_NO_TEXTO, normalizarTexto } from "@/lib/models/sugestaoPorTexto";
import { instanteDe, paredeDe } from "@/lib/services/horasUteis";
import { estadoDaConversa, humorDaConversa } from "@/lib/services/motorProprio";

/**
 * O resumo que situa (Fase 28).
 *
 * "Melhore os resumos." O resumo de antes dizia o problema e em que pé
 * estava — bom para ler, pouco para agir. Quem pega a conversa no meio
 * precisa de cinco respostas: o que o cliente quer, o que já foi feito,
 * o que prometemos e para quando, o que falta e qual é o risco. Cada
 * ponto cita a mensagem de onde saiu, e toda citação é conferida contra
 * a conversa — a que não está lá, sai.
 *
 * Com IA, a IA escreve e isto confere; sem IA, `situarSemIA` preenche
 * pelas regras, só com o que as mensagens dizem.
 */

export interface PontoCitado {
  texto: string;
  /** O trecho literal da mensagem de onde o ponto saiu. */
  citacao?: string;
}

export interface Promessa extends PontoCitado {
  /** "25/09 às 10:00" — quando há dia ou hora na promessa. */
  quando?: string;
  /** O dia prometido já passou. */
  vencida?: boolean;
}

export interface Situacao {
  quer: PontoCitado;
  feito: PontoCitado[];
  prometido: Promessa[];
  falta: string;
  risco: { nivel: "baixo" | "medio" | "alto"; porque: string };
}

export interface MensagemParaSituar {
  de: "cliente" | "nos";
  texto: string;
  carimbo?: string;
}

/** "No tamanho que a conversa pede": quantos itens por lista. */
export function itensPorLista(totalDeMensagens: number) {
  return totalDeMensagens <= 6 ? 2 : totalDeMensagens <= 20 ? 3 : 5;
}

const frasesDe = (texto: string) =>
  texto
    .split(/(?<=[.!?\n])\s+/)
    .map((f) => f.trim())
    .filter((f) => f.length >= 4);

const curto = (t: string, n = 140) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

const PEDIDO = /\b(quero|queria|preciso|precisamos|gostaria|pode(m|ria)?|consegue(m)?|como (faco|faz|fazer)|por que|porque nao|cade|quando (vai|vao)|me (ajuda|ajudem|explica))\b|\?/;

const FEITO = /\b(ja|acabei de|acabamos de)\s+(fiz|fizemos|foi|foram|ajustei|ajustamos|corrigi|corrigimos|encaminhei|encaminhamos|abri|abrimos|enviei|enviamos|liberei|liberamos|estornei|estornamos|verifiquei|verificamos|atualizei|atualizamos|configurei|configuramos|cadastrei|cadastramos|reativei|reativamos)\b|\b(esta|ficou|foi) (resolvid|corrigid|liberad|ajustad|estornad|reativad)/;

const PROMESSA_SEM_DATA = /\b(vou|vamos|irei|iremos)\s+(verificar|ver|checar|analisar|retornar|te retornar|resolver|encaminhar|enviar|te enviar|mandar|te mandar|ligar|te ligar|acompanhar)\b/;

const dataDoCarimbo = (m: MensagemParaSituar, agora: Date) => {
  const t = instanteDoCarimbo(m.carimbo);
  return paredeDe(t ?? agora).dia;
};

function descreverQuando(dueDate: string, time?: string) {
  const [, mes, dia] = dueDate.split("-");
  return `${dia}/${mes}${time ? ` às ${time}` : ""}`;
}

/** As promessas nossas que têm dia ou hora, lidas das mensagens — as datas valem mais que as da IA. */
export function promessasDatadas(mensagens: MensagemParaSituar[], agora: Date): Promessa[] {
  const saida: Promessa[] = [];
  for (const m of mensagens) {
    if (m.de !== "nos") continue;
    const combinado = combinadoNaMensagem(m.texto, dataDoCarimbo(m, agora));
    if (!combinado) continue;
    const [h, min] = (combinado.time ?? "18:00").split(":").map(Number);
    const vence = instanteDe(combinado.dueDate, h * 60 + min);
    saida.push({ texto: combinado.trecho, citacao: combinado.trecho, quando: descreverQuando(combinado.dueDate, combinado.time), vencida: vence.getTime() < agora.getTime() });
  }
  return saida;
}

function riscoDaConversa(mensagens: MensagemParaSituar[], prometido: Promessa[]): Situacao["risco"] {
  const doCliente = normalizarTexto(mensagens.filter((m) => m.de === "cliente").map((m) => m.texto).join("\n"));
  const acesos = CRITERIOS_NO_TEXTO.filter((c) => ["juridico", "exposicao", "cancelamento", "operacao-parada", "prejuizo", "cobranca-pos-cancelamento"].includes(c.criterio) && c.padrao.test(doCliente));
  const humor = humorDaConversa(mensagens);
  const vencidas = prometido.filter((p) => p.vencida).length;
  const rajada = rajadaDoCliente(mensagens);

  const motivos = [
    ...acesos.map((c) => `o cliente ${c.motivo}`),
    ...(humor <= 2 ? ["o humor está baixo"] : []),
    ...(vencidas ? [`${vencidas} promessa(s) nossa(s) com o prazo vencido`] : []),
    ...(rajada >= 3 ? [`${rajada} mensagens seguidas sem resposta`] : []),
  ];
  const alto = acesos.some((c) => ["juridico", "exposicao", "cancelamento", "operacao-parada"].includes(c.criterio)) || (humor === 1 && (vencidas > 0 || acesos.length > 0));
  const nivel = alto ? "alto" : motivos.length ? "medio" : "baixo";
  return { nivel, porque: motivos.length ? motivos.join("; ") : "nenhum sinal de risco na conversa" };
}

/** A situação pelas regras — só com o que as mensagens dizem. */
export function situarSemIA(mensagens: MensagemParaSituar[], agora: Date): Situacao {
  const limite = itensPorLista(mensagens.length);
  const doCliente = mensagens.filter((m) => m.de === "cliente");

  /* O que quer: o último pedido do cliente — é o que está valendo agora. */
  let quer: PontoCitado = { texto: "A conversa não deixa claro o que o cliente pede." };
  for (const m of [...doCliente].reverse()) {
    const frase = frasesDe(m.texto).reverse().find((f) => PEDIDO.test(normalizarTexto(f)));
    if (frase) {
      quer = { texto: curto(frase), citacao: curto(frase, 200) };
      break;
    }
  }
  if (!quer.citacao && doCliente[0]) quer = { texto: curto(doCliente[0].texto), citacao: curto(doCliente[0].texto, 200) };

  const feito: PontoCitado[] = [];
  for (const m of mensagens) {
    if (m.de !== "nos") continue;
    for (const f of frasesDe(m.texto)) if (FEITO.test(normalizarTexto(f))) feito.push({ texto: curto(f), citacao: curto(f, 200) });
  }

  const datadas = promessasDatadas(mensagens, agora);
  const semData: Promessa[] = [];
  for (const m of mensagens) {
    if (m.de !== "nos") continue;
    for (const f of frasesDe(m.texto)) {
      if (PROMESSA_SEM_DATA.test(normalizarTexto(f)) && !datadas.some((d) => d.citacao && f.includes(d.citacao.replace(/…$/, "")))) semData.push({ texto: curto(f), citacao: curto(f, 200) });
    }
  }
  const prometido = [...datadas, ...semData].slice(-limite);

  const estado = estadoDaConversa(mensagens);
  return {
    quer,
    feito: feito.slice(-limite),
    prometido,
    falta: estado.resolvido ? "Nada pendente — confirmar com o cliente que ficou resolvido." : estado.pendencia,
    risco: riscoDaConversa(mensagens, prometido),
  };
}

/* ============================================================
   CONFERIR A SITUAÇÃO DA IA
============================================================ */

const chave = (t: string) => normalizarTexto(t).replace(/…$/, "").replace(/\s+/g, " ").trim();

/** A citação existe numa mensagem? Sem caixa, acento e espaço de diferença; a reticência do corte vale. */
export function citacaoExiste(citacao: string | undefined, mensagens: MensagemParaSituar[]) {
  if (!citacao?.trim()) return false;
  const c = chave(citacao);
  if (c.length < 4) return false;
  return mensagens.some((m) => chave(m.texto).includes(c));
}

function conferirPonto<T extends PontoCitado>(p: T, mensagens: MensagemParaSituar[]): T {
  return citacaoExiste(p.citacao, mensagens) ? p : { ...p, citacao: undefined };
}

/**
 * A situação que a IA escreveu, conferida.
 *
 * A citação que não está na conversa sai (o ponto fica, sem a aspa); o
 * prometido com data vem das mensagens — a data é nossa, não da IA —, e
 * as listas respeitam o tamanho que a conversa pede. O risco nunca fica
 * abaixo do que as regras veem: a IA pode achar mais risco, não menos.
 */
export function conferirSituacao(bruta: Partial<Situacao> | undefined, mensagens: MensagemParaSituar[], agora: Date): Situacao {
  const regras = situarSemIA(mensagens, agora);
  if (!bruta || typeof bruta !== "object") return regras;
  const limite = itensPorLista(mensagens.length);
  const lista = <T extends PontoCitado>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]).filter((p) => p && typeof p.texto === "string" && p.texto.trim()) : []);

  const datadas = promessasDatadas(mensagens, agora);
  const daIA = lista<Promessa>(bruta.prometido)
    .map((p) => conferirPonto(p, mensagens))
    .filter((p) => !datadas.some((d) => p.citacao && d.citacao && (chave(d.citacao).includes(chave(p.citacao)) || chave(p.citacao).includes(chave(d.citacao)))))
    .map((p) => ({ texto: p.texto, citacao: p.citacao, quando: p.quando }));

  const ordem = { baixo: 0, medio: 1, alto: 2 } as const;
  const nivelDaIA = bruta.risco?.nivel && bruta.risco.nivel in ordem ? bruta.risco.nivel : "baixo";
  const risco = ordem[nivelDaIA] >= ordem[regras.risco.nivel] && bruta.risco?.porque ? { nivel: nivelDaIA, porque: bruta.risco.porque } : regras.risco;

  return {
    quer: bruta.quer?.texto ? conferirPonto(bruta.quer, mensagens) : regras.quer,
    feito: lista<PontoCitado>(bruta.feito).map((p) => conferirPonto(p, mensagens)).slice(0, limite),
    prometido: [...datadas, ...daIA].slice(0, limite),
    falta: typeof bruta.falta === "string" && bruta.falta.trim() ? bruta.falta : regras.falta,
    risco,
  };
}
