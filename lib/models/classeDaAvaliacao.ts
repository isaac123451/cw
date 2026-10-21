import type { Case } from "@/lib/models/case";

/**
 * Avaliação positiva ou negativa (21/10/2026).
 *
 * "Quando for possível ver, ter uma opção de marcar 'avaliação positiva';
 * também preciso que na parte de Meu dia apareça 'avaliação negativa' e
 * ela seja contabilizada conforme eu marque como negativa ou a IA
 * identifique."
 *
 * A ordem de quem decide:
 *
 * 1. **a marca de quem atende** — vale sempre, e a IA não mexe nela;
 * 2. **a marca da IA** — lida da nota, do resolvido, do "voltaria" e do
 *    comentário final do consumidor;
 * 3. **a regra**, enquanto nenhuma das duas marcou: resolvida ou nota 9–10
 *    é positiva (a regra que o placar já usava); não resolvida e nota até
 *    6 é negativa; o resto (7–8 não resolvida) fica neutra.
 */
export type ClasseDaAvaliacao = "positiva" | "negativa" | "neutra";
export type OrigemDaClasse = "voce" | "ia" | "regra";

export const MARCADO_PELA_IA = "IA";

type Avaliacao = Pick<Case, "evaluated" | "score" | "resolved" | "avaliacaoMarca" | "avaliacaoMarcaPor">;

export function classePelaRegra(c: Pick<Case, "score" | "resolved">): ClasseDaAvaliacao {
  if (c.resolved || (c.score ?? 0) >= 9) return "positiva";
  if (c.score != null && c.score <= 6) return "negativa";
  return "neutra";
}

export function classeDaAvaliacao(c: Avaliacao): { classe: ClasseDaAvaliacao; origem: OrigemDaClasse } | null {
  if (!c.evaluated) return null;
  if (c.avaliacaoMarca) return { classe: c.avaliacaoMarca, origem: c.avaliacaoMarcaPor === MARCADO_PELA_IA ? "ia" : "voce" };
  return { classe: classePelaRegra(c), origem: "regra" };
}

export const ehPositiva = (c: Avaliacao) => classeDaAvaliacao(c)?.classe === "positiva";
export const ehNegativa = (c: Avaliacao) => classeDaAvaliacao(c)?.classe === "negativa";

export const ROTULO_DA_ORIGEM: Record<OrigemDaClasse, string> = {
  voce: "marcada à mão",
  ia: "pela IA",
  regra: "pela nota",
};
