import { Case } from "@/lib/models/case";
import {
  isOpen,
  isReclameAqui,
  isSocial,
} from "@/lib/services/case.service";
import { parseElapsed } from "@/lib/services/reputation.service";

export interface OwnerLoad {
  owner: string;
  total: number;
  open: number;
  resolved: number;
  resolutionRate: number;
  averageScore: number;
}

/** Produtividade por responsável — quem carrega o quê. */
export function byOwner(cases: Case[]): OwnerLoad[] {

  const map = new Map<string, Case[]>();

  for (const item of cases) {
    const owner = item.owner?.trim() || "Sem responsável";
    map.set(owner, [...(map.get(owner) ?? []), item]);
  }

  return [...map.entries()]
    .map(([owner, items]) => {

      const resolved = items.filter(
        (entry) => entry.resolved
      ).length;

      const scored = items.filter(
        (entry) => typeof entry.score === "number"
      );

      return {
        owner,
        total: items.length,
        open: items.filter(isOpen).length,
        resolved,
        resolutionRate:
          items.length === 0
            ? 0
            : Math.round(
                (resolved / items.length) * 100
              ),
        averageScore:
          scored.length === 0
            ? 0
            : Math.round(
                (scored.reduce(
                  (sum, entry) => sum + (entry.score ?? 0),
                  0
                ) /
                  scored.length) *
                  10
              ) / 10,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export interface ChannelSummary {
  channel: string;
  total: number;
  open: number;
  resolved: number;
  averageScore: number;
  responseMinutes: number;
}

/** Comparação entre os canais que a operação atende. */
export function byChannelSummary(
  cases: Case[]
): ChannelSummary[] {

  const grupos: [string, Case[]][] = [
    ["Reclame Aqui", cases.filter(isReclameAqui)],
    ["Redes Sociais", cases.filter(isSocial)],
  ];

  return grupos
    .filter(([, items]) => items.length > 0)
    .map(([channel, items]) => {

      const scored = items.filter(
        (item) => typeof item.score === "number"
      );

      const tempos = items
        .map((item) => parseElapsed(item.responseTime))
        .filter(
          (value): value is number => value !== null
        );

      return {
        channel,
        total: items.length,
        open: items.filter(isOpen).length,
        resolved: items.filter((item) => item.resolved)
          .length,
        averageScore:
          scored.length === 0
            ? 0
            : Math.round(
                (scored.reduce(
                  (sum, item) => sum + (item.score ?? 0),
                  0
                ) /
                  scored.length) *
                  10
              ) / 10,
        responseMinutes:
          tempos.length === 0
            ? 0
            : Math.round(
                tempos.reduce((s, v) => s + v, 0) /
                  tempos.length
              ),
      };
    });
}

export interface RegionRow {
  label: string;
  value: number;
  percent: number;
  averageScore: number;
}

/** Concentração geográfica — de onde vem a insatisfação. */
export function byRegion(
  cases: Case[],
  field: "state" | "city",
  limit = 10
): RegionRow[] {

  const map = new Map<string, Case[]>();

  for (const item of cases) {
    const key = (item[field] ?? "").trim() || "—";
    map.set(key, [...(map.get(key) ?? []), item]);
  }

  return [...map.entries()]
    .map(([label, items]) => {

      const scored = items.filter(
        (item) => typeof item.score === "number"
      );

      return {
        label,
        value: items.length,
        percent:
          cases.length === 0
            ? 0
            : Math.round(
                (items.length / cases.length) * 100
              ),
        averageScore:
          scored.length === 0
            ? 0
            : Math.round(
                (scored.reduce(
                  (sum, item) => sum + (item.score ?? 0),
                  0
                ) /
                  scored.length) *
                  10
              ) / 10,
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

export interface ResolutionBucket {
  label: string;
  value: number;
  percent: number;
}

/** Quanto tempo a operação leva para responder. */
export function responseBuckets(
  cases: Case[]
): ResolutionBucket[] {

  const faixas = [
    { label: "Até 1 dia", max: 1440 },
    { label: "1 a 3 dias", max: 4320 },
    { label: "3 a 7 dias", max: 10080 },
    { label: "7 a 30 dias", max: 43200 },
    { label: "Mais de 30 dias", max: Infinity },
  ];

  const tempos = cases
    .map((item) => parseElapsed(item.responseTime))
    .filter((value): value is number => value !== null);

  let anterior = 0;

  return faixas.map((faixa) => {

    const value = tempos.filter(
      (tempo) => tempo > anterior && tempo <= faixa.max
    ).length;

    anterior = faixa.max;

    return {
      label: faixa.label,
      value,
      percent:
        tempos.length === 0
          ? 0
          : Math.round((value / tempos.length) * 100),
    };
  });
}
