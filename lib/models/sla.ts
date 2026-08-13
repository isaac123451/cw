/**
 * Regra de SLA por tipo de caso.
 *
 * Antes o prazo era a string fixa "48h" gravada em cada reclamação, igual
 * para cobrança indevida e para dúvida de cardápio. Aqui o prazo passa a
 * depender da categoria e da prioridade, e a tela de Processos administra
 * essas regras.
 */
export interface SlaRule {
  id: string;

  /** Categoria do caso. `*` vale como regra padrão. */
  category: string;

  /** Refina a regra para uma prioridade específica. */
  priority?: "Crítica" | "Alta" | "Média" | "Baixa";

  /** Prazo da primeira resposta pública, em horas. */
  responseHours: number;

  /** Prazo para encerrar a tratativa, em horas. */
  solutionHours: number;

  /** Time que responde por este tipo de caso. */
  team?: string;

  note?: string;

  active: boolean;
}

export const ANY_CATEGORY = "*";

/** Formata horas como o painel mostra: 48h, 3 dias, 1h. */
export function formatHours(hours: number) {

  if (hours < 1) return "menos de 1h";

  if (hours < 24) return `${hours}h`;

  const dias = Math.round((hours / 24) * 10) / 10;

  return `${dias
    .toString()
    .replace(".", ",")} ${dias === 1 ? "dia" : "dias"}`;
}
