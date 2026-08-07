"use client";

import { useMemo, useState } from "react";

import {
  BookOpen,
  Eye,
  FileText,
  Search,
  Sparkles,
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import StatTile from "@/components/shared/StatTile";
import SurfaceCard from "@/components/shared/SurfaceCard";

import { mockArticles } from "@/lib/data/mockKnowledge";

const typeTone: Record<string, string> = {
  Procedimento: "bg-violet-50 text-violet-700 ring-violet-100",
  Macro: "bg-sky-50 text-sky-700 ring-sky-100",
  FAQ: "bg-amber-50 text-amber-700 ring-amber-100",
  Checklist: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Fluxograma: "bg-rose-50 text-rose-700 ring-rose-100",
  Documentação: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

export default function BaseConhecimentoPage() {

  const [search, setSearch] = useState("");
  const [type, setType] = useState("");

  const types = [
    ...new Set(mockArticles.map((item) => item.type)),
  ];

  const visible = useMemo(() => {

    const term = search.trim().toLowerCase();

    return mockArticles.filter((item) => {

      if (type && item.type !== type) return false;

      if (!term) return true;

      return [
        item.title,
        item.summary,
        item.category,
        ...item.tags,
      ].some((field) =>
        field.toLowerCase().includes(term)
      );
    });

  }, [search, type]);

  const totalViews = mockArticles.reduce(
    (sum, item) => sum + item.views,
    0
  );

  return (
    <MainLayout>

      <div className="space-y-6">

        <PageHeading
          eyebrow="Conhecimento"
          title="Base de Conhecimento"
          description="Procedimentos, macros, checklists e documentações da operação."
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <StatTile
            label="Documentos"
            description="Materiais publicados na base de conhecimento."
            value={mockArticles.length}
            hint="publicados"
            icon={FileText}
            tone="primary"
          />

          <StatTile
            label="Tipos de conteúdo"
            value={types.length}
            hint="formatos disponíveis"
            icon={BookOpen}
            tone="info"
          />

          <StatTile
            label="Visualizações"
            value={totalViews}
            hint="acessos acumulados"
            icon={Eye}
            tone="success"
          />

          <StatTile
            label="Mais acessado"
            value={
              [...mockArticles].sort(
                (a, b) => b.views - a.views
              )[0]?.views ?? 0
            }
            hint="roteiro de retenção"
            icon={Sparkles}
            tone="warning"
          />

        </div>

        <SurfaceCard bodyClassName="p-4">

          <div className="flex flex-wrap gap-3">

            <div className="relative min-w-[240px] flex-1">

              <Search
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
              />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar procedimento, macro, assunto..."
                className="h-11 w-full rounded-xl border border-zinc-200 pl-10 pr-3 text-sm outline-none transition-colors focus:border-violet-400"
              />

            </div>

            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-11 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-700 outline-none transition-colors focus:border-violet-400"
            >
              <option value="">Todos os tipos</option>

              {types.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

          </div>

        </SurfaceCard>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

          {visible.map((item) => (

            <article
              key={item.id}
              className="group flex flex-col rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-[0_10px_24px_-14px_rgba(111,66,193,0.4)]"
            >

              <div className="flex items-center justify-between gap-2">

                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset ${
                    typeTone[item.type] ??
                    "bg-zinc-100 text-zinc-600 ring-zinc-200"
                  }`}
                >
                  {item.type}
                </span>

                <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                  <Eye size={11} />
                  {item.views}
                </span>

              </div>

              <h3 className="mt-3 text-sm font-semibold leading-snug text-zinc-900">
                {item.title}
              </h3>

              <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-500">
                {item.summary}
              </p>

              <div className="mt-3 flex flex-wrap gap-1.5">

                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600"
                  >
                    {tag}
                  </span>
                ))}

              </div>

              <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 text-[11px] text-zinc-400">

                <span>
                  {item.owner} · v{item.version}
                </span>

                <span>{item.updatedAt}</span>

              </div>

            </article>

          ))}

        </div>

        {visible.length === 0 && (
          <SurfaceCard>
            <p className="py-10 text-center text-sm text-zinc-400">
              Nenhum documento encontrado para essa busca.
            </p>
          </SurfaceCard>
        )}

      </div>

    </MainLayout>
  );
}
