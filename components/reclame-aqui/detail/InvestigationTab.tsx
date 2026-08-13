"use client";

import { useMemo, useState } from "react";

import { Building2, Check } from "lucide-react";

import { Case } from "@/lib/models/case";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { useSettings } from "@/lib/context/SettingsContext";

interface Props {
  data: Case;
  onChange: (patch: Partial<Case>) => void;
}

export default function InvestigationTab({
  data,
  onChange,
}: Props) {

  const { categories, subcategories, teams, checklist } =
    useSettings();

  const active = useMemo(
    () => checklist.filter((item) => item.active),
    [checklist]
  );

  /**
   * Casos encerrados chegam com o checklist cumprido; os demais
   * começam vazios e o agente vai marcando.
   */
  const [done, setDone] = useState<Set<string>>(
    () =>
      new Set(
        data.resolved
          ? active.map((item) => item.id)
          : []
      )
  );

  function toggle(id: string) {
    setDone((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  const required = active.filter((item) => item.required);

  const requiredDone = required.filter((item) =>
    done.has(item.id)
  ).length;

  const progress =
    active.length === 0
      ? 0
      : Math.round((done.size / active.length) * 100);

  const relatedSubcategories = subcategories.filter(
    (item) => item.category === data.category
  );

  return (
    <div className="space-y-5">

      <SurfaceCard
        title="Checklist de resolução"
        description="Etapas configuradas para encerrar esta reclamação com segurança operacional."
        action={
          <div className="shrink-0 rounded-xl bg-zinc-50 px-4 py-2.5 text-right">

            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
              Progresso
            </p>

            <p className="text-sm font-semibold text-zinc-900">
              {done.size} de {active.length} concluídos
            </p>

            <p className="text-[11px] text-zinc-500">
              {requiredDone} de {required.length} obrigatórios
            </p>

          </div>
        }
      >

        <div className="mb-5 h-2 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-violet-700 transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">

          {active.map((item) => {

            const checked = done.has(item.id);

            return (
              <button
                key={item.id}
                onClick={() => toggle(item.id)}
                className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                  checked
                    ? "border-violet-200 bg-violet-50/40"
                    : "border-zinc-200 hover:border-violet-200 hover:bg-zinc-50"
                }`}
              >

                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                    checked
                      ? "border-violet-700 bg-violet-700 text-white"
                      : "border-zinc-300"
                  }`}
                >
                  {checked && <Check size={13} />}
                </span>

                <span className="min-w-0">

                  <span className="flex flex-wrap items-center gap-2">

                    <span className="text-sm font-medium text-zinc-800">
                      {item.label}
                    </span>

                    {item.required && (
                      <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">
                        Obrigatório
                      </span>
                    )}

                  </span>

                  <span className="mt-0.5 block text-[11px] text-zinc-400">
                    {checked
                      ? `Concluído por ${data.owner ?? "—"}`
                      : "Pendente"}
                  </span>

                </span>

              </button>
            );
          })}

        </div>

      </SurfaceCard>

      <SurfaceCard
        title="Investigação e acompanhamento operacional"
        description="Vínculos e classificação usados no diagnóstico da reclamação."
      >

        <div className="rounded-xl bg-violet-50/50 p-4 ring-1 ring-inset ring-violet-100">

          <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600">
            Estabelecimento vinculado
          </p>

          <div className="mt-2 flex items-center gap-3">

            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-violet-600 ring-1 ring-inset ring-violet-100">
              <Building2 size={17} />
            </span>

            <div className="min-w-0">

              <p className="truncate text-sm font-semibold text-zinc-900">
                {data.company}
              </p>

              <p className="text-xs text-zinc-500">
                CNPJ {data.cnpj ?? "—"}
              </p>

            </div>

          </div>

        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">

          <div>

            <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Categoria
            </label>

            <select
              value={data.category}
              onChange={(e) =>
                onChange({
                  category: e.target.value,
                  subcategory: "",
                })
              }
              className="mt-1.5 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none transition-colors focus:border-violet-400"
            >
              {categories.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>

          </div>

          <div>

            <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Subcategoria
            </label>

            <select
              value={data.subcategory ?? ""}
              onChange={(e) =>
                onChange({ subcategory: e.target.value })
              }
              className="mt-1.5 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none transition-colors focus:border-violet-400"
            >
              <option value="">
                Nenhuma selecionada
              </option>

              {relatedSubcategories.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>

          </div>

          <div>

            <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Time envolvido
            </label>

            <select
              value={data.department ?? ""}
              onChange={(e) =>
                onChange({ department: e.target.value })
              }
              className="mt-1.5 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none transition-colors focus:border-violet-400"
            >
              <option value="">Nenhum</option>

              {teams
                .filter((item) => item.active)
                .map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name}
                  </option>
                ))}
            </select>

          </div>

        </div>

      </SurfaceCard>

    </div>
  );
}
