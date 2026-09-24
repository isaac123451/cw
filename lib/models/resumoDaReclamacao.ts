import { CRITERIOS, prioridadePelosCriterios, type Prioridade } from "@/lib/models/case";
import { criteriosPeloTexto, normalizarTexto } from "@/lib/models/sugestaoPorTexto";

/**
 * A reclamação em poucas linhas, lida na área da empresa do Reclame Aqui.
 *
 * O Isaac: "dentro da área da empresa, quero algumas iniciativas que a
 * extensão possa fazer — um popup resumindo a reclamação". O relato
 * costuma ter mil caracteres escritos de uma vez, com o pedido no meio.
 * Aqui ele vira quatro coisas, sem IA (instantâneo, e sem inventar):
 *
 * - **aconteceu** — as primeiras frases do relato, que é onde a pessoa
 *   conta o problema;
 * - **quer** — a frase em que ela pede ("quero", "solicito", "exijo"…),
 *   quando existe; sem pedido escrito, fica vazio em vez de adivinhado;
 * - **sinais** — os critérios de criticidade que o relato acende, com o
 *   trecho (a mesma régua da triagem), e o nível que eles sugerem;
 * - **tom** — calmo, irritado ou muito irritado, pelas palavras e pela
 *   pontuação.
 */

export interface SinalDaReclamacao {
  criterio: string;
  texto: string;
  nivel: Prioridade;
  trecho: string;
}

export interface ResumoDaReclamacao {
  aconteceu: string;
  quer: string | null;
  sinais: SinalDaReclamacao[];
  /** O nível que os critérios do relato sugerem — Normal sem sinal. */
  nivel: Prioridade;
  tom: "calmo" | "irritado" | "muito irritado";
  palavras: number;
}

const PEDIDO = /\b(quero|queria|gostaria|solicito|solicitei|peco|pedi|exijo|preciso|desejo|espero|aguardo|requeiro)\b/;
/* "Quero deixar claro", "gostaria de registrar": é o jeito de contar, não o pedido. */
const NAO_E_PEDIDO = /\b(quero|queria|gostaria( de)?|venho|preciso)\s+(deixar claro|registrar|informar|relatar|dizer|ressaltar|destacar|expor|comunicar|esclarecer)\b/;
const IRRITACAO = /\b(absurd|descaso|vergonh|pessim|horrivel|horroros|ridicul|palhacad|lixo|revoltad|indignad|inadmissivel|inaceitavel|desrespeit|enganad|golpe|nunca mais)/g;
const ORDEM: Record<Prioridade, number> = { Urgente: 0, Alta: 1, Normal: 2 };

function frasesDe(texto: string) {
  return texto
    /* O "Título: …" que alguns relatos repetem no começo não é o relato. */
    .replace(/^\s*t[íi]tulo:[^\n]*\n?/i, "")
    .replace(/\s+/g, " ")
    /* "Web.Quero" — ponto colado na próxima frase, comum no portal. */
    .replace(/([.!?])(?=[A-ZÀ-Ý])/g, "$1 ")
    .split(/(?<=[.!?])\s+/)
    .map((f) => f.trim())
    .filter((f) => f.length >= 12);
}

/** Corta no fim de uma palavra, com reticências. */
function aparar(texto: string, maximo: number) {
  if (texto.length <= maximo) return texto;
  const corte = texto.slice(0, maximo);
  return `${corte.slice(0, corte.lastIndexOf(" ") > maximo * 0.6 ? corte.lastIndexOf(" ") : maximo).replace(/[,;:\s]+$/, "")}…`;
}

export function resumoDaReclamacao(titulo: string, relato: string): ResumoDaReclamacao {
  const frases = frasesDe(relato);

  const doPedido = frases.find((f) => {
    const n = normalizarTexto(f);
    return PEDIDO.test(n) && !NAO_E_PEDIDO.test(n);
  });
  const quer = doPedido ? aparar(doPedido, 220) : null;

  const contexto = frases.filter((f) => f !== doPedido).slice(0, 2).join(" ");
  const aconteceu = aparar(contexto || titulo, 260);

  const sinais = criteriosPeloTexto(`${titulo}\n${relato}`)
    .map((s) => {
      const c = CRITERIOS.find((x) => x.id === s.criterio);
      return c ? { criterio: c.id, texto: c.texto, nivel: c.prioridade, trecho: s.trecho } : null;
    })
    .filter((s): s is SinalDaReclamacao => s !== null)
    .sort((a, b) => ORDEM[a.nivel] - ORDEM[b.nivel])
    .slice(0, 3);

  const normal = normalizarTexto(`${titulo} ${relato}`);
  const palavrasFortes = normal.match(IRRITACAO)?.length ?? 0;
  const exclamacoes = (relato.match(/!{2,}/g) ?? []).length;
  const letras = relato.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const maiusculas = letras.length > 40 ? relato.replace(/[^A-ZÀ-Ý]/g, "").length / letras.length : 0;
  const pontos = palavrasFortes + exclamacoes + (maiusculas > 0.3 ? 2 : 0);

  return {
    aconteceu,
    quer,
    sinais,
    nivel: prioridadePelosCriterios(sinais.map((s) => s.criterio)),
    tom: pontos >= 3 ? "muito irritado" : pontos >= 1 ? "irritado" : "calmo",
    palavras: relato.trim() ? relato.trim().split(/\s+/).length : 0,
  };
}
