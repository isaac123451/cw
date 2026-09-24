import type { Situacao } from "@/lib/models/resumoQueSitua";
import { normalizarTexto } from "@/lib/models/sugestaoPorTexto";

/**
 * As respostas em três tons (Fase 28).
 *
 * "Melhore as sugestões de resposta." O mesmo recado — o nome, a
 * pendência real, o que foi combinado — dito de três jeitos, porque o
 * cliente irritado pede acolhimento, o dono de restaurante na correria
 * pede a frase curta e o gerente que entende de sistema pede o detalhe:
 *
 * - **acolhedora**: reconhece o transtorno antes de qualquer coisa;
 * - **objetiva**: o que está sendo feito e quando, em duas frases;
 * - **técnica**: o que foi verificado e o que falta, com os termos certos.
 *
 * Nenhum dos três promete o que não está registrado: prazo só entra se a
 * conversa já tem a promessa com data (`Situacao.prometido`). E o texto
 * aprende com o que a pessoa editou antes de enviar (`estiloAprendido`).
 */

export type Tom = "acolhedora" | "objetiva" | "tecnica";

export const TONS: { id: Tom; rotulo: string; quando: string }[] = [
  { id: "acolhedora", rotulo: "Acolhedora", quando: "Cliente chateado ou que esperou demais: reconhecer antes de explicar." },
  { id: "objetiva", rotulo: "Objetiva", quando: "Cliente na correria: o que está sendo feito e quando, sem rodeio." },
  { id: "tecnica", rotulo: "Técnica", quando: "Quem entende do sistema: o que foi verificado e o que falta, com os termos." },
];

export interface RespostaEmTom {
  tom: Tom;
  rotulo: string;
  quando: string;
  texto: string;
}

/* ============================================================
   O ESTILO APRENDIDO
============================================================ */

export interface EdicaoFeita {
  tom?: string;
  original: string;
  editada: string;
}

export interface Estilo {
  /** A abertura que a pessoa sempre põe ("Oi,", "Olá,", "Bom dia,"). */
  saudacao?: string;
  /** A linha que ela sempre acrescenta no fim ("Qualquer coisa, estou por aqui!"). */
  despedida?: string;
  /** As últimas edições, para a IA ver o jeito — original e como foi enviada. */
  exemplos: EdicaoFeita[];
}

/* Comparada sem acento: "Olá" e "Ola" são a mesma saudação. */
const SAUDACOES: Record<string, string> = { oi: "Oi", ola: "Olá", "bom dia": "Bom dia", "boa tarde": "Boa tarde", "boa noite": "Boa noite", "e ai": "E aí", opa: "Opa" };
const SAUDACAO = /^(oi|ola|bom dia|boa tarde|boa noite|e ai|opa)(?![a-z])/;

const primeiraPalavraDeSaudacao = (t: string) => normalizarTexto(t.trim()).match(SAUDACAO)?.[1];
const ultimaLinha = (t: string) => t.trim().split(/\n+/).map((l) => l.trim()).filter(Boolean).pop() ?? "";

/**
 * O que se repete nas edições: a saudação trocada e a despedida
 * acrescentada. Só vira estilo o que aparece em pelo menos duas das
 * últimas cinco — uma edição sozinha é o caso, não o jeito.
 */
export function estiloAprendido(edicoes: EdicaoFeita[]): Estilo {
  const ultimas = edicoes.filter((e) => e.editada.trim() && e.editada.trim() !== e.original.trim()).slice(0, 5);
  const conta = <T,>(lista: (T | undefined)[]) => {
    const m = new Map<T, number>();
    for (const x of lista) if (x !== undefined) m.set(x, (m.get(x) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0];
  };

  const saudacoes = conta(ultimas.map((e) => {
    const nova = primeiraPalavraDeSaudacao(e.editada);
    return nova && nova !== primeiraPalavraDeSaudacao(e.original) ? nova : undefined;
  }));
  const despedidas = conta(ultimas.map((e) => {
    const nova = ultimaLinha(e.editada);
    return nova && !normalizarTexto(e.original).includes(normalizarTexto(nova)) && nova.length <= 120 ? nova : undefined;
  }));

  return {
    saudacao: saudacoes && saudacoes[1] >= 2 ? SAUDACOES[saudacoes[0]] : undefined,
    despedida: despedidas && despedidas[1] >= 2 ? despedidas[0] : undefined,
    exemplos: ultimas.slice(0, 3),
  };
}

/** Aplica o estilo a um texto das regras: troca a saudação e acrescenta a despedida. */
export function aplicarEstilo(texto: string, estilo: Estilo): string {
  let saida = texto;
  if (estilo.saudacao) saida = saida.replace(/^(Oi|Olá|Ola|Bom dia|Boa tarde|Boa noite)(?![A-Za-zÀ-ú])/, estilo.saudacao);
  if (estilo.despedida && !normalizarTexto(saida).includes(normalizarTexto(estilo.despedida))) saida = `${saida}\n\n${estilo.despedida}`;
  return saida;
}

/** As edições em linhas, para a IA — o jeito de quem vai enviar. */
export function exemplosParaIA(estilo: Estilo) {
  if (!estilo.exemplos.length) return "";
  return [
    "Como esta pessoa costuma ajustar os rascunhos antes de enviar (siga o mesmo jeito):",
    ...estilo.exemplos.map((e, i) => `${i + 1}. Sugerido: "${e.original.slice(0, 300)}"\n   Enviado: "${e.editada.slice(0, 300)}"`),
  ].join("\n");
}

/* ============================================================
   OS TRÊS TONS SEM IA
============================================================ */

const minusculaInicial = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
const semPonto = (t: string) => t.trim().replace(/[.!…]+$/, "");

/**
 * Os três tons pelas regras, com o nome e a pendência real.
 *
 * O prazo só aparece se a conversa já tem a promessa com data — e vencida
 * ela vira pedido de desculpa pelo atraso, não uma data nova inventada.
 */
export function tonsSemIA(entrada: { nome?: string; assunto: string; situacao: Situacao; estilo?: Estilo }): RespostaEmTom[] {
  const primeiro = entrada.nome?.trim().split(/\s+/)[0];
  const nome = primeiro && !/^n[ãa]o$/i.test(primeiro) ? primeiro.charAt(0).toUpperCase() + primeiro.slice(1) : "";
  const oi = nome ? `Oi, ${nome}!` : "Oi!";
  const quer = semPonto(entrada.situacao.quer.texto);
  const assunto = entrada.assunto.toLowerCase();
  const promessa = entrada.situacao.prometido.find((p) => p.quando);
  const feito = entrada.situacao.feito[entrada.situacao.feito.length - 1];

  const quando = promessa
    ? promessa.vencida
      ? `Te devo o retorno que combinamos para ${promessa.quando} — desculpe o atraso; estou cuidando disso agora e te dou notícia hoje mesmo.`
      : `Como combinamos, te retorno até ${promessa.quando}.`
    : "Te retorno assim que tiver a posição da equipe.";

  const textos: Record<Tom, string> = {
    acolhedora: `${oi} Entendo como isso atrapalha o seu dia, e sinto muito pelo transtorno com ${assunto}. Li tudo o que você mandou e já estou cuidando pessoalmente disso. ${quando}`,
    objetiva: `${oi} Entendo a urgência. Sobre ${assunto}: ${feito ? `${minusculaInicial(semPonto(feito.texto))}, e ` : ""}estou seguindo com o seu pedido. ${quando}`,
    tecnica: `${oi} Entendo o impacto na operação. Sobre o seu pedido — "${quer.length > 90 ? `${quer.slice(0, 89)}…` : quer}": ${feito ? `${semPonto(feito.texto)}. ` : ""}Agora estou verificando ${assunto} a fundo para resolver de vez. ${quando}`,
  };

  return TONS.map((t) => ({ tom: t.id, rotulo: t.rotulo, quando: t.quando, texto: entrada.estilo ? aplicarEstilo(textos[t.id], entrada.estilo) : textos[t.id] }));
}

/* ============================================================
   NÃO PROMETER O QUE NÃO ESTÁ REGISTRADO
============================================================ */

const PRAZO_NO_TEXTO = /\b(ate|até)\s+(amanha|amanhã|hoje|segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|domingo|o fim do dia|\d{1,2}\/\d{1,2}|\d{1,2}h|\d{1,2}:\d{2})|\bem\s+\d+\s*(h|horas?|dias?|minutos?)\b|\bamanh[ãa]\b|\b\d{1,2}\/\d{1,2}\b/i;

/**
 * O texto fala em prazo que a conversa não registra?
 *
 * Vale para a IA e para quem editou: prazo só com a promessa já feita na
 * conversa. O que está lá (a data da promessa, o trecho dela) pode ser
 * repetido; o resto é promessa nova — que tem de ser feita de propósito,
 * não por um rascunho.
 */
export function prometeSemRegistro(texto: string, situacao: Pick<Situacao, "prometido">): boolean {
  const achado = texto.match(PRAZO_NO_TEXTO)?.[0];
  if (!achado) return false;
  const registrado = situacao.prometido.flatMap((p) => [p.quando ?? "", p.citacao ?? "", p.texto]).map((x) => normalizarTexto(x));
  const alvo = normalizarTexto(achado).replace(/^(ate|em)\s+/, "");
  return !registrado.some((r) => r && r.includes(alvo));
}
