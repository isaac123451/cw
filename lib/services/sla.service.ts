import { Case } from "@/lib/models/case";
import { ANY_CATEGORY, SlaRule } from "@/lib/models/sla";

import { hojeNaOperacao } from "@/lib/services/reputation.service";

/**
 * Escolhe a regra que vale para um caso.
 *
 * A mais específica ganha: categoria + prioridade, depois categoria,
 * depois prioridade sozinha, e por último o padrão. Sem isso, uma regra
 * genérica cadastrada depois passaria por cima de uma específica.
 */
export function resolveRule(
  item: Case,
  rules: SlaRule[]
): SlaRule | undefined {

  const ativas = rules.filter((rule) => rule.active);

  const especifica = ativas.find(
    (rule) =>
      rule.category === item.category &&
      rule.priority === item.priority
  );

  if (especifica) return especifica;

  const porCategoria = ativas.find(
    (rule) =>
      rule.category === item.category && !rule.priority
  );

  if (porCategoria) return porCategoria;

  const porPrioridade = ativas.find(
    (rule) =>
      rule.category === ANY_CATEGORY &&
      rule.priority === item.priority
  );

  if (porPrioridade) return porPrioridade;

  return ativas.find(
    (rule) =>
      rule.category === ANY_CATEGORY && !rule.priority
  );
}

export type SlaSituation =
  | "dentro"
  | "atencao"
  | "estourado"
  | "concluido"
  | "sem-regra";

export interface SlaStatus {
  rule?: SlaRule;
  situation: SlaSituation;

  /** Horas decorridas desde a publicação da reclamação. */
  elapsedHours: number;

  /** Horas restantes até o prazo. Negativo quando estourou. */
  remainingHours: number;

  label: string;
}

const situationTone: Record<SlaSituation, string> = {
  dentro: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  atencao: "bg-amber-50 text-amber-700 ring-amber-100",
  estourado: "bg-rose-50 text-rose-700 ring-rose-100",
  concluido: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  "sem-regra":
    "bg-zinc-100 text-zinc-500 ring-zinc-200",
};

export function toneOfSla(situation: SlaSituation) {
  return situationTone[situation];
}

/**
 * Situação do caso frente ao SLA.
 *
 * Enquanto não há resposta pública, o relógio é o de resposta; depois
 * dela, passa a valer o prazo de solução.
 */
export function slaStatus(
  item: Case,
  rules: SlaRule[],
  today = hojeNaOperacao()
): SlaStatus {

  const rule = resolveRule(item, rules);

  const elapsedHours = Math.max(
    0,
    Math.round(
      (Date.parse(`${today}T00:00:00Z`) -
        Date.parse(`${item.createdAt}T00:00:00Z`)) /
        3600000
    )
  );

  if (!rule) {
    return {
      situation: "sem-regra",
      elapsedHours,
      remainingHours: 0,
      label: "Sem regra",
    };
  }

  if (item.resolved) {
    return {
      rule,
      situation: "concluido",
      elapsedHours,
      remainingHours: 0,
      label: "Encerrado",
    };
  }

  const respondido =
    (item.publicResponse ?? "").trim() !== "";

  const prazo = respondido
    ? rule.solutionHours
    : rule.responseHours;

  const remainingHours = prazo - elapsedHours;

  if (remainingHours < 0) {
    return {
      rule,
      situation: "estourado",
      elapsedHours,
      remainingHours,
      label: respondido
        ? "Solução atrasada"
        : "Resposta atrasada",
    };
  }

  // Últimos 25% do prazo já pedem atenção.
  const atencao = remainingHours <= prazo * 0.25;

  return {
    rule,
    situation: atencao ? "atencao" : "dentro",
    elapsedHours,
    remainingHours,
    label: respondido
      ? "Solução no prazo"
      : "Resposta no prazo",
  };
}

export interface RuleCoverage {
  rule: SlaRule;
  total: number;
  dentro: number;
  atencao: number;
  estourado: number;
  concluido: number;
}

/** Quantos casos abertos cada regra está governando hoje. */
export function coverage(
  cases: Case[],
  rules: SlaRule[]
): RuleCoverage[] {

  const map = new Map<string, RuleCoverage>();

  for (const rule of rules) {
    map.set(rule.id, {
      rule,
      total: 0,
      dentro: 0,
      atencao: 0,
      estourado: 0,
      concluido: 0,
    });
  }

  for (const item of cases) {

    const status = slaStatus(item, rules);

    if (!status.rule) continue;

    const row = map.get(status.rule.id);

    if (!row) continue;

    row.total += 1;

    if (status.situation === "dentro") row.dentro += 1;
    if (status.situation === "atencao") row.atencao += 1;
    if (status.situation === "estourado") {
      row.estourado += 1;
    }
    if (status.situation === "concluido") {
      row.concluido += 1;
    }
  }

  return [...map.values()];
}
