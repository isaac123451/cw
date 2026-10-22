import type { Case } from "@/lib/models/case";
import { familiaDoTexto } from "@/lib/models/catalogoDeCausas";
import { semelhanca } from "@/lib/services/lgpd";
import { classeDaAvaliacao } from "@/lib/models/classeDaAvaliacao";

/**
 * As reclamações que podem caber em moderação (22/10/2026).
 *
 * O pedido de moderação já era registrado na ficha (motivo, quando, o que o
 * Reclame Aqui decidiu), mas achar a candidata dependia de alguém notar,
 * caso a caso. Moderada, a reclamação sai da conta da nota. Aqui, só o que
 * a plataforma consegue sustentar com fato:
 *
 * - **quem reclama não é cliente**: o consumidor final reclamando do pedido
 *   de comida do restaurante (a família "consumidor-final" das causas — a
 *   mesma que a retenção usa para não contar cancelamento de lojista);
 * - **duplicada**: o mesmo cliente (documento ou e-mail) com outra
 *   reclamação aberta até 30 dias antes. O Reclame Aqui modera duplicata do
 *   mesmo fato, e só quem lê confirma: vai a outra e a semelhança dos
 *   relatos, para conferir.
 *
 * Fica de fora o que não pesa contra: avaliada como positiva (moderar
 * tiraria nota boa da conta) — vale a ainda sem avaliação e a negativa.
 * Precisa do relato: roda no servidor, não na lista da tela (que vem sem).
 *
 * É sugestão, nunca pedido: quem decide é quem atende, no portal.
 */

/** Os motivos do pedido — os mesmos atalhos do registro de moderação. */
export const MOTIVOS_DE_MODERACAO = [
  "Reclamação duplicada de outra já registrada.",
  "Quem reclama não é cliente da Cardápio Web — o problema é de outra empresa.",
  "O problema foi resolvido por outro canal antes da publicação.",
  "Conteúdo ofensivo ou com informação falsa sobre a empresa.",
  "Reclamação trata de terceiro (cliente final do restaurante), não da plataforma.",
] as const;

export interface CandidataAModeracao {
  caso: Case;
  por: "consumidor-final" | "duplicada";
  /** O texto do motivo, pronto para o registro. */
  motivo: (typeof MOTIVOS_DE_MODERACAO)[number];
  /** Por que a plataforma acha isso, em uma frase. */
  explicacao: string;
  /** A outra reclamação, quando é duplicada. */
  outra?: string;
  /** Quanto os relatos se parecem, de 0 a 100 — para conferir se é o mesmo fato. */
  semelhanca?: number;
}

/** Só dentro da janela de 12 meses: moderar fora dela não muda a nota. */
const DIAS = 365;
const DIAS_DA_DUPLICADA = 30;
const SEMELHANCA_MINIMA = 50;

const temaDe = (c: Case) => familiaDoTexto(`${c.title}
${c.description ?? ""}`)?.id;
const mesmoTema = (a: Case, b: Case) => { const t = temaDe(a); return Boolean(t) && t === temaDe(b); };
const digitos = (v?: string) => String(v ?? "").replace(/\D/g, "");
const emailLimpo = (v?: string) => (v && !v.includes("•") ? v.trim().toLowerCase() : "");
const dias = (a: string, b: string) => Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000;

export function candidataAModeracao(caso: Case, todos: Case[], hoje: string): CandidataAModeracao | null {
  if (caso.source !== "Reclame Aqui" || caso.moderacaoPedidaEm || caso.scoreDisregarded) return null;
  /* Avaliada como positiva: moderar tiraria nota boa da conta. */
  if (caso.evaluated && classeDaAvaliacao(caso)?.classe === "positiva") return null;
  if (dias(caso.createdAt, hoje) > DIAS) return null;

  if (familiaDoTexto(`${caso.title}\n${caso.description ?? ""}`)?.id === "consumidor-final") {
    return {
      caso,
      por: "consumidor-final",
      motivo: "Reclamação trata de terceiro (cliente final do restaurante), não da plataforma.",
      explicacao: "O texto é de quem comprou no restaurante (o pedido não chegou, veio errado, foi cancelado pela loja) — não de um cliente da Cardápio Web.",
    };
  }

  const doc = digitos(caso.document);
  const email = emailLimpo(caso.email);
  if (doc.length < 11 && !email) return null;
  const texto = `${caso.title} ${caso.description ?? ""}`;
  const outra = todos.find(
    (o) =>
      o.id !== caso.id &&
      o.source === "Reclame Aqui" &&
      o.createdAt <= caso.createdAt &&
      dias(o.createdAt, caso.createdAt) <= DIAS_DA_DUPLICADA &&
      ((doc.length >= 11 && digitos(o.document) === doc) || (email && emailLimpo(o.email) === email)) &&
      /* Mesmo fato: o mesmo tema pelas causas da plataforma, ou o relato copiado (22/10/2026 — cinco pares do mesmo cliente falavam de coisas diferentes). */
      (mesmoTema(caso, o) || semelhanca(texto, `${o.title} ${o.description ?? ""}`) >= SEMELHANCA_MINIMA)
  );
  if (outra) {
    const parecido = semelhanca(texto, `${outra.title} ${outra.description ?? ""}`);
    const d = Math.round(dias(outra.createdAt, caso.createdAt));
    return {
      caso,
      por: "duplicada",
      motivo: "Reclamação duplicada de outra já registrada.",
      explicacao: `O mesmo cliente abriu ${outra.protocol} ${d === 0 ? "no mesmo dia" : `${d} ${d === 1 ? "dia" : "dias"} antes`} — ${parecido >= SEMELHANCA_MINIMA ? "relato quase igual" : `mesmo tema (${familiaDoTexto(`${caso.title}
${caso.description ?? ""}`)?.nome ?? ""}) — confira se é o mesmo fato`}.`,
      outra: outra.protocol,
      semelhanca: parecido,
    };
  }
  return null;
}

/** Todas as candidatas, das mais novas para as mais antigas. */
export function candidatasAModeracao(casos: Case[], hoje: string): CandidataAModeracao[] {
  return casos
    .map((c) => candidataAModeracao(c, casos, hoje))
    .filter((c): c is CandidataAModeracao => c !== null)
    .sort((a, b) => b.caso.createdAt.localeCompare(a.caso.createdAt));
}
