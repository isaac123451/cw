"use client";

import Link from "next/link";

import { useMemo, useState } from "react";

import {
  ChevronLeft,
  History,
  MessageCircle,
  Star,
} from "lucide-react";

import { Case } from "@/lib/models/case";

import { useCases } from "@/lib/context/CaseContext";

import SurfaceCard from "@/components/shared/SurfaceCard";
import TagPicker, { TagChips } from "@/components/shared/TagPicker";

import OverviewTab from "./OverviewTab";
import InvestigationTab from "./InvestigationTab";
import ServiceTab from "./ServiceTab";
import EvaluationTab from "./EvaluationTab";
import CaseSidebar from "./CaseSidebar";

type Tab =
  | "visao-geral"
  | "investigacao"
  | "atendimento"
  | "avaliacao"
  | "historico";

const tabs: { id: Tab; label: string }[] = [
  { id: "visao-geral", label: "Visão geral" },
  { id: "investigacao", label: "Investigação" },
  { id: "atendimento", label: "Atendimento" },
  { id: "avaliacao", label: "Avaliação RA" },
  { id: "historico", label: "Histórico" },
];

interface Props {
  data: Case;
}

export default function CaseDetail({ data }: Props) {

  const { cases, updateCase, toggleTag } = useCases();

  const [tab, setTab] = useState<Tab>("visao-geral");

  const owners = useMemo(
    () =>
      [
        ...new Set(
          cases
            .map((item) => item.owner)
            .filter((item): item is string => !!item)
        ),
      ].sort(),
    [cases]
  );

  function patch(changes: Partial<Case>) {
    updateCase({ ...data, ...changes });
  }

  const whatsapp = (data.phone ?? "").replace(/\D/g, "");

  return (
    <div className="space-y-5">

      {/* Cabeçalho */}

      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">

        <Link
          href="/reclame-aqui"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-violet-700"
        >
          <ChevronLeft size={16} />
          Voltar para Reclame Aqui
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-5">

          <div className="min-w-0 flex-1">

            <h1 className="text-2xl font-semibold leading-snug tracking-tight text-zinc-900">
              {data.title}
            </h1>

            <p className="mt-2 text-sm text-zinc-500">
              {data.company} · {data.customer} ·{" "}
              <span className="font-mono">
                {data.protocol}
              </span>
            </p>

            <div className="mt-3 flex flex-wrap gap-2">

              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
                  data.evaluated
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                    : "bg-zinc-100 text-zinc-600 ring-zinc-200"
                }`}
              >
                {data.evaluated
                  ? "Reclamação avaliada"
                  : "Sem avaliação"}
              </span>

              <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-100">
                <Star size={11} className="fill-amber-400 text-amber-400" />
                Nota {data.evaluated ? data.score ?? 0 : "—"}
              </span>

              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
                  data.wouldDoBusiness
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                    : "bg-rose-50 text-rose-700 ring-rose-100"
                }`}
              >
                Voltaria: {data.wouldDoBusiness ? "Sim" : "Não"}
              </span>

              {data.churnRisk && (
                <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-100">
                  Risco de cancelamento
                </span>
              )}

            </div>

            {data.tags && data.tags.length > 0 && (
              <div className="mt-2.5">
                <TagChips tags={data.tags} limit={6} />
              </div>
            )}

          </div>

          <div className="flex shrink-0 items-center gap-2">

            <TagPicker
              selected={data.tags ?? []}
              onToggle={(tag) => toggleTag(data.id, tag)}
            />

            <a
              href={
                whatsapp
                  ? `https://wa.me/55${whatsapp}`
                  : undefined
              }
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl bg-violet-800 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-900"
            >
              <MessageCircle size={16} />
              Abrir WhatsApp
            </a>

          </div>

        </div>

      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">

        <div className="min-w-0 space-y-5">

          {/* Abas */}

          <div className="overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">

            <div className="flex min-w-max">

              {tabs.map((item) => (

                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`relative px-6 py-4 text-sm font-medium transition-colors ${
                    tab === item.id
                      ? "text-violet-800"
                      : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >

                  {item.label}

                  {tab === item.id && (
                    <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-violet-800" />
                  )}

                </button>

              ))}

            </div>

          </div>

          {tab === "visao-geral" && (
            <OverviewTab data={data} onChange={patch} />
          )}

          {tab === "investigacao" && (
            <InvestigationTab data={data} onChange={patch} />
          )}

          {tab === "atendimento" && (
            <ServiceTab data={data} />
          )}

          {tab === "avaliacao" && (
            <EvaluationTab data={data} onChange={patch} />
          )}

          {tab === "historico" && (

            <SurfaceCard
              title="Histórico da reclamação"
              description="Linha do tempo completa das mudanças registradas."
            >

              <ol className="relative space-y-5 before:absolute before:left-[5px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-zinc-200 before:content-['']">

                {[
                  {
                    titulo: "Reclamação registrada",
                    quando: data.createdAt,
                    detalhe: `Recebida via ${data.source}`,
                    cor: "bg-violet-500",
                  },
                  {
                    titulo: "Responsável definido",
                    quando: data.createdAt,
                    detalhe: data.owner ?? "Sem responsável",
                    cor: "bg-sky-500",
                  },
                  {
                    titulo: "Classificada",
                    quando: data.createdAt,
                    detalhe: `${data.category}${
                      data.subcategory
                        ? ` · ${data.subcategory}`
                        : ""
                    }`,
                    cor: "bg-amber-500",
                  },
                  ...((data.publicResponse ?? "").trim() !== ""
                    ? [
                        {
                          titulo: "Resposta pública publicada",
                          quando: data.updatedAt ?? data.createdAt,
                          detalhe: `Retorno em ${data.responseTime}`,
                          cor: "bg-emerald-500",
                        },
                      ]
                    : []),
                  ...(data.evaluated
                    ? [
                        {
                          titulo: "Cliente avaliou",
                          quando: data.updatedAt ?? data.createdAt,
                          detalhe: `Nota ${data.score ?? 0} · voltaria: ${
                            data.wouldDoBusiness ? "sim" : "não"
                          }`,
                          cor: "bg-violet-500",
                        },
                      ]
                    : []),
                  ...(data.resolved
                    ? [
                        {
                          titulo: "Caso encerrado",
                          quando: data.updatedAt ?? data.createdAt,
                          detalhe: `Solução em ${data.solutionTime}`,
                          cor: "bg-emerald-600",
                        },
                      ]
                    : []),
                ].map((item, index) => (

                  <li
                    key={`${item.titulo}-${index}`}
                    className="relative pl-6"
                  >

                    <span
                      className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${item.cor}`}
                    />

                    <p className="text-sm font-medium text-zinc-800">
                      {item.titulo}
                    </p>

                    <p className="mt-0.5 text-xs text-zinc-500">
                      {item.quando} · {item.detalhe}
                    </p>

                  </li>

                ))}

              </ol>

              <p className="mt-5 flex items-center gap-2 border-t border-zinc-100 pt-4 text-xs text-zinc-400">
                <History size={13} />
                Rastreabilidade completa: origem, classificação,
                resposta, avaliação e encerramento.
              </p>

            </SurfaceCard>

          )}

        </div>

        <CaseSidebar
          data={data}
          owners={owners}
          onChange={patch}
        />

      </div>

    </div>
  );
}
