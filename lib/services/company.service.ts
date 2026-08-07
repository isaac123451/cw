import { Case } from "@/lib/models/case";
import {
  isOpen,
  isReclameAqui,
  isSocial,
} from "@/lib/services/case.service";
import { getReputation } from "@/lib/services/reputation.service";

export interface CompanyProfile {
  /** Slug estável usado na rota — o nome pode mudar, o vínculo não. */
  slug: string;
  name: string;
  cnpj?: string;
  city?: string;
  state?: string;

  total: number;
  open: number;
  resolved: number;
  churnRisk: number;

  reclameAqui: number;
  social: number;

  averageScore: number;
  raScore: number;
  responseIndex: number;

  firstCase: string;
  lastCase: string;

  topCategory: string;
  owners: string[];
  cases: Case[];
}

export function companySlug(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildCompanies(
  cases: Case[]
): CompanyProfile[] {

  const map = new Map<string, Case[]>();

  for (const item of cases) {
    map.set(item.company, [
      ...(map.get(item.company) ?? []),
      item,
    ]);
  }

  return [...map.entries()]
    .map(([name, items]) => {

      const sorted = [...items].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt)
      );

      const scored = items.filter(
        (item) => typeof item.score === "number"
      );

      const averageScore =
        scored.length === 0
          ? 0
          : scored.reduce(
              (sum, item) => sum + (item.score ?? 0),
              0
            ) / scored.length;

      const categories = new Map<string, number>();

      for (const item of items) {
        categories.set(
          item.category,
          (categories.get(item.category) ?? 0) + 1
        );
      }

      const topCategory =
        [...categories.entries()].sort(
          (a, b) => b[1] - a[1]
        )[0]?.[0] ?? "—";

      const reputation = getReputation(
        items.filter(isReclameAqui)
      );

      const reference = sorted[sorted.length - 1];

      return {
        slug: companySlug(name),
        name,
        cnpj: reference?.cnpj,
        city: reference?.city,
        state: reference?.state,

        total: items.length,
        open: items.filter(isOpen).length,
        resolved: items.filter((item) => item.resolved)
          .length,
        churnRisk: items.filter((item) => item.churnRisk)
          .length,

        reclameAqui: items.filter(isReclameAqui).length,
        social: items.filter(isSocial).length,

        averageScore:
          Math.round(averageScore * 10) / 10,
        raScore: reputation.raScore,
        responseIndex: reputation.responseIndex,

        firstCase: sorted[0]?.createdAt ?? "—",
        lastCase: reference?.createdAt ?? "—",

        topCategory,

        owners: [
          ...new Set(
            items
              .map((item) => item.owner)
              .filter((item): item is string => !!item)
          ),
        ].sort(),

        cases: [...items].sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt)
        ),
      };
    })
    .sort((a, b) => b.total - a.total);
}
