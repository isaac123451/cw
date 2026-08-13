"use client";

import Link from "next/link";

import { useMemo, useState } from "react";

import { Check, Plus, TriangleAlert } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { useCases } from "@/lib/context/CaseContext";
import { useSettings } from "@/lib/context/SettingsContext";

/**
 * Categorias que aparecem nas reclamações mas não existem em
 * Configurar fluxo.
 *
 * O import classificou os casos com uma taxonomia própria, então essas
 * categorias não podem receber regra de SLA nem aparecer nos filtros —
 * ficam invisíveis para a configuração. Aqui elas são listadas e podem
 * ser adotadas com um clique.
 */
export default function OrphanCategories() {

  const { cases } = useCases();
  const { categories, saveCategory } = useSettings();

  const [adicionadas, setAdicionadas] = useState<
    string[]
  >([]);

  const orfas = useMemo(() => {

    const configuradas = new Set(
      categories.map((item) => item.name)
    );

    const contagem = new Map<string, number>();

    for (const item of cases) {
      if (configuradas.has(item.category)) continue;

      contagem.set(
        item.category,
        (contagem.get(item.category) ?? 0) + 1
      );
    }

    return [...contagem.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);

  }, [cases, categories]);

  if (orfas.length === 0) return null;

  const casosAfetados = orfas.reduce(
    (sum, item) => sum + item.total,
    0
  );

  function adotar(name: string, order: number) {

    saveCategory({
      id: crypto.randomUUID(),
      name,
      description:
        "Adotada a partir das reclamações importadas.",
      order,
      active: true,
    });

    setAdicionadas((prev) => [...prev, name]);
  }

  function adotarTodas() {

    const base = categories.length;

    orfas.forEach((item, index) => {
      if (adicionadas.includes(item.name)) return;
      adotar(item.name, base + index + 1);
    });
  }

  return (
    <SurfaceCard
      title="Categorias fora da configuração"
      description={`${orfas.length} categoria(s) aparecem nas reclamações mas não existem em Configurar fluxo.`}
      hint="Enquanto não estiverem configuradas, elas não podem receber regra de SLA própria e caem sempre na regra padrão."
      action={
        <button
          onClick={adotarTodas}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-violet-200 px-3.5 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
        >
          <Plus size={15} />
          Adicionar todas
        </button>
      }
    >

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200/70 bg-amber-50/60 px-4 py-3">

        <TriangleAlert
          size={16}
          className="shrink-0 text-amber-600"
        />

        <p className="flex-1 text-sm leading-relaxed text-amber-900">
          <strong className="font-semibold">
            {casosAfetados} reclamações
          </strong>{" "}
          estão classificadas com categorias que a
          configuração não conhece. Elas vieram da
          classificação automática da planilha.
        </p>

        <Link
          href="/reclame-aqui/configuracoes"
          className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100"
        >
          Abrir configuração
        </Link>

      </div>

      <div className="flex flex-wrap gap-2">

        {orfas.map((item, index) => {

          const feita = adicionadas.includes(item.name);

          return (
            <button
              key={item.name}
              onClick={() =>
                !feita &&
                adotar(
                  item.name,
                  categories.length + index + 1
                )
              }
              disabled={feita}
              title={
                feita
                  ? "Já adicionada à configuração"
                  : `Adicionar "${item.name}" às categorias do fluxo`
              }
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition-colors ${
                feita
                  ? "cursor-default border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-zinc-200 text-zinc-700 hover:border-violet-200 hover:bg-violet-50"
              }`}
            >

              {feita ? (
                <Check size={13} />
              ) : (
                <Plus size={13} />
              )}

              {item.name}

              <span className="text-xs text-zinc-400">
                {item.total}
              </span>

            </button>
          );
        })}

      </div>

    </SurfaceCard>
  );
}
