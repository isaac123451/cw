import { Case } from "@/lib/models/case";
import {
  ClientEnrichment,
  ClientKind,
  ManualClient,
} from "@/lib/models/client";

import {
  isOpen,
  isReclameAqui,
  isSocial,
} from "@/lib/services/case.service";

import { slugify } from "@/lib/services/slug";

export interface ClientProfile {
  /** Slug do nome — chave de rota e de enriquecimento. */
  slug: string;

  name: string;

  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  document?: string;

  kind: ClientKind;

  establishmentId?: string;

  notes?: string;
  tags: string[];

  /** true quando a pessoa foi cadastrada à mão, sem reclamação. */
  manual: boolean;

  total: number;
  open: number;
  resolved: number;
  unresolved: number;
  churnRisk: number;

  reclameAqui: number;
  social: number;

  /** Média das notas que a pessoa deu, entre as reclamações avaliadas. */
  averageScore: number;
  evaluated: number;

  /** Quantas vezes disse que voltaria a fazer negócio. */
  wouldReturn: number;

  firstCase?: string;
  lastCase?: string;

  topCategory?: string;

  cases: Case[];
}

/** Primeiro valor não vazio, olhando do caso mais recente para o mais antigo. */
function pick(
  items: Case[],
  field: "email" | "phone" | "city" | "state"
) {
  for (const item of items) {
    const value = item[field];
    if (value && value.trim() !== "") return value;
  }
  return undefined;
}

export function buildClients(
  cases: Case[],
  enrichment: Record<string, ClientEnrichment> = {},
  manual: ManualClient[] = []
): ClientProfile[] {

  const map = new Map<string, Case[]>();

  for (const item of cases) {
    const key = slugify(item.customer);
    if (!key) continue;

    map.set(key, [...(map.get(key) ?? []), item]);
  }

  const derived: ClientProfile[] = [...map.entries()].map(
    ([slug, items]) => {

      // Mais recentes primeiro: é a ordem que a tela usa e também
      // a que define qual contato é o mais atual.
      const sorted = [...items].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );

      const extra = enrichment[slug] ?? {};

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

      const topCategory = [...categories.entries()].sort(
        (a, b) => b[1] - a[1]
      )[0]?.[0];

      return {
        slug,
        name: sorted[0].customer,

        email: pick(sorted, "email"),
        phone: pick(sorted, "phone"),
        city: pick(sorted, "city"),
        state: pick(sorted, "state"),
        document: extra.document,

        kind: extra.kind ?? "Consumidor",
        establishmentId: extra.establishmentId,
        notes: extra.notes,
        tags: extra.tags ?? [],

        manual: false,

        total: items.length,
        open: items.filter(isOpen).length,
        resolved: items.filter((item) => item.resolved)
          .length,
        unresolved: items.filter(
          (item) => item.evaluated && !item.resolved
        ).length,
        churnRisk: items.filter((item) => item.churnRisk)
          .length,

        reclameAqui: items.filter(isReclameAqui).length,
        social: items.filter(isSocial).length,

        averageScore:
          Math.round(averageScore * 10) / 10,
        evaluated: scored.length,

        wouldReturn: items.filter(
          (item) => item.wouldDoBusiness
        ).length,

        firstCase:
          sorted[sorted.length - 1]?.createdAt,
        lastCase: sorted[0]?.createdAt,

        topCategory,

        cases: sorted,
      };
    }
  );

  const manualProfiles: ClientProfile[] = manual
    // Se a pessoa cadastrada à mão também aparece nas reclamações,
    // o registro derivado já cobre — evita cliente duplicado na lista.
    .filter((item) => !map.has(item.slug))
    .map((item) => ({
      slug: item.slug,
      name: item.name,

      email: item.email,
      phone: item.phone,
      city: item.city,
      state: item.state,
      document: item.document,

      kind: item.kind ?? "Consumidor",
      establishmentId: item.establishmentId,
      notes: item.notes,
      tags: item.tags ?? [],

      manual: true,

      total: 0,
      open: 0,
      resolved: 0,
      unresolved: 0,
      churnRisk: 0,

      reclameAqui: 0,
      social: 0,

      averageScore: 0,
      evaluated: 0,
      wouldReturn: 0,

      firstCase: item.createdAt,
      lastCase: undefined,

      topCategory: undefined,

      cases: [],
    }));

  return [...manualProfiles, ...derived].sort(
    (a, b) =>
      b.total - a.total || a.name.localeCompare(b.name)
  );
}
