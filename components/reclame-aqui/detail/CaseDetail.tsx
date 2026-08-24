"use client";

import Link from "next/link";

import { useMemo, useState } from "react";

import {
  ChevronLeft,
  ExternalLink,
  Maximize2,
  MessageCircle,
  Star,
  Timer,
} from "lucide-react";

import { Case } from "@/lib/models/case";

import { useCases } from "@/lib/context/CaseContext";
import { useMovements } from "@/lib/context/MovementsContext";
import { useRascunho } from "@/lib/hooks/useRascunho";

import {
  movementStatus,
  openMovementOf,
} from "@/lib/services/movement.service";

import { toneOfSla } from "@/lib/services/sla.service";

import TagPicker, { TagChips } from "@/components/shared/TagPicker";
import StatusPicker from "@/components/reclame-aqui/shared/StatusPicker";
import BarraDeSalvar from "@/components/shared/BarraDeSalvar";
import CaseActions from "./CaseActions";

import OverviewTab from "./OverviewTab";
import InvestigationTab from "./InvestigationTab";
import ServiceTab from "./ServiceTab";
import EvaluationTab from "./EvaluationTab";
import CaseSidebar from "./CaseSidebar";
import CaseTimeline from "./CaseTimeline";

type Tab =
  | "visao-geral"
  | "investigacao"
  | "atendimento"
  | "avaliacao"
  | "dados"
  | "historico";

const tabs: { id: Tab; label: string; drawerOnly?: boolean }[] =
  [
    { id: "visao-geral", label: "Visão geral" },
    { id: "investigacao", label: "Investigação" },
    { id: "atendimento", label: "Atendimento" },
    { id: "avaliacao", label: "Avaliação RA" },
    // No drawer não cabe a coluna lateral: ela vira uma aba.
    { id: "dados", label: "Dados do caso", drawerOnly: true },
    { id: "historico", label: "Histórico" },
  ];

interface Props {
  data: Case;
  /**
   * "page" é a tela cheia em /reclame-aqui/[id].
   * "drawer" é a prévia lateral aberta pela lista — mesmo conteúdo,
   * só empilhado para caber na largura menor.
   */
  variant?: "page" | "drawer";
}

function br(date?: string) {
  if (!date) return "—";
  return date.split("-").reverse().join("/");
}

export default function CaseDetail({
  data,
  variant = "page",
}: Props) {

  const { cases, updateCase, toggleTag, moveCase } =
    useCases();

  /**
   * A edição vive num rascunho; o botão Salvar grava.
   *
   * Era a tela que mais gravava sem pedir — **uma ida ao banco por
   * tecla**. Escrever a resposta pública, que tem centenas de
   * caracteres, virava centenas de gravações, e nenhuma delas dizia
   * "salvo": não existia um momento em que salvar acontecesse.
   *
   * O rascunho é de lista, e aqui a lista tem um item só. Vale a pena
   * mesmo assim: é o mesmo gancho já provado nos cadastros, com a
   * mesma barra, o mesmo aviso de saída e a mesma regra de não limpar
   * o que o servidor recusou.
   *
   * **Mover etapa e etiquetar continuam imediatos.** São atos com
   * consequência própria — voltar de "Resolvido" apaga a avaliação —,
   * e segurá-los num rascunho faria a coluna do quadro discordar da
   * tela enquanto ninguém clicasse em Salvar.
   */
  const rascunho = useRascunho([data], updateCase);

  /** O caso como está sendo editado, e não como está no banco. */
  const emEdicao = rascunho.itens[0] ?? data;

  const { movements } = useMovements();

  const [tab, setTab] = useState<Tab>("visao-geral");

  /**
   * Movimentação em aberto aparece já no cabeçalho: sem isso, um caso
   * parado há dias com uma área interna só se descobria abrindo a aba
   * Atendimento.
   */
  const movimentacao = openMovementOf(data.id, movements);

  const movimentacaoStatus = movimentacao
    ? movementStatus(movimentacao)
    : undefined;

  const drawer = variant === "drawer";

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
    rascunho.alterar(data.id, changes);
  }

  // Só oferece WhatsApp quando existe telefone de verdade. O import
  // mascara os dígitos do meio, então número mascarado não vira link.
  const digits = (data.phone ?? "").replace(/\D/g, "");

  const whatsapp =
    digits.length >= 10 && !(data.phone ?? "").includes("•")
      ? digits
      : null;

  const visibleTabs = tabs.filter(
    (item) => !item.drawerOnly || drawer
  );

  return (
    <div className="space-y-5">

      {/* Cabeçalho */}

      <div
        className={`border-zinc-200/80 bg-white ${
          drawer
            ? "border-b px-6 pb-5 pt-4"
            : "rounded-2xl border p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
        }`}
      >

        {drawer ? (

          <Link
            href={`/reclame-aqui/${data.id}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-violet-700"
          >
            <Maximize2 size={14} />
            Abrir em tela cheia
          </Link>

        ) : (

          <Link
            href="/reclame-aqui"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-violet-700"
          >
            <ChevronLeft size={16} />
            Voltar para Reclame Aqui
          </Link>

        )}

        <div className="mt-4 flex flex-wrap items-start justify-between gap-5">

          <div className="min-w-0 flex-1">

            <h1
              className={`font-semibold leading-snug tracking-tight text-zinc-900 ${
                drawer ? "text-lg" : "text-2xl"
              }`}
            >
              {data.title}
            </h1>

            <p className="mt-2 text-sm text-zinc-500">
              {data.customer} ·{" "}
              <span className="font-mono">
                {data.protocol}
              </span>{" "}
              · {br(data.createdAt)}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">

              <StatusPicker
                value={data.status}
                onChange={(status) =>
                  moveCase(data.id, status)
                }
              />

              <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-100">
                <Star
                  size={11}
                  className="fill-amber-400 text-amber-400"
                />
                Nota{" "}
                {data.evaluated ? data.score ?? 0 : "—"}
              </span>

              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
                  data.wouldDoBusiness
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                    : "bg-rose-50 text-rose-700 ring-rose-100"
                }`}
              >
                Voltaria:{" "}
                {data.wouldDoBusiness ? "Sim" : "Não"}
              </span>

              {data.churnRisk && (
                <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-100">
                  Risco de cancelamento
                </span>
              )}

              {movimentacao && movimentacaoStatus && (
                <button
                  onClick={() => setTab("atendimento")}
                  title={`${movimentacaoStatus.label}. Clique para ver a movimentação.`}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors hover:brightness-95 ${toneOfSla(movimentacaoStatus.situation)}`}
                >
                  <Timer size={11} />
                  Com {movimentacao.destination}
                </button>
              )}

            </div>

            {data.tags && data.tags.length > 0 && (
              <div className="mt-2.5">
                <TagChips tags={data.tags} limit={6} />
              </div>
            )}

            {/* Atalhos para impacto, agenda, cliente e estabelecimento. */}
            <div className="mt-4">
              <CaseActions data={data} />
            </div>

          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">

            <TagPicker
              selected={data.tags ?? []}
              onToggle={(tag) => toggleTag(data.id, tag)}
            />

            {data.raUrl && (
              <a
                href={data.raUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir esta reclamação no portal"
                className="flex items-center gap-2 rounded-xl border border-violet-200 px-4 py-2.5 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
              >
                <ExternalLink size={15} />
                Reclame Aqui
              </a>
            )}

            {whatsapp && (
              <a
                href={`https://wa.me/55${whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                title={`Conversar com ${data.customer}`}
                className="flex items-center gap-2 rounded-xl bg-violet-800 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-900"
              >
                <MessageCircle size={16} />
                WhatsApp
              </a>
            )}

          </div>

        </div>

      </div>

      <div
        className={
          drawer
            ? "px-6 pb-6"
            : "grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]"
        }
      >

        <div className="min-w-0 space-y-5">

          {/* Abas */}

          <div
            className={`overflow-x-auto bg-white ${
              drawer
                ? "-mx-6 border-b border-zinc-200/80 px-6"
                : "rounded-2xl border border-zinc-200/80 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
            }`}
          >

            <div className="flex min-w-max">

              {visibleTabs.map((item) => (

                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`relative text-sm font-medium transition-colors ${
                    drawer ? "px-4 py-3.5" : "px-6 py-4"
                  } ${
                    tab === item.id
                      ? "text-violet-800"
                      : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >

                  {item.label}

                  {tab === item.id && (
                    <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-violet-800" />
                  )}

                </button>

              ))}

            </div>

          </div>

          {tab === "visao-geral" && (
            <OverviewTab data={emEdicao} onChange={patch} />
          )}

          {tab === "investigacao" && (
            <InvestigationTab
              data={emEdicao}
              onChange={patch}
            />
          )}

          {tab === "atendimento" && <ServiceTab data={data} />}

          {tab === "avaliacao" && (
            <EvaluationTab data={emEdicao} onChange={patch} />
          )}

          {tab === "dados" && (
            <CaseSidebar
              data={emEdicao}
              owners={owners}
              onChange={patch}
              onEditarAvaliacao={() => setTab("avaliacao")}
            />
          )}

          {tab === "historico" && (
            <CaseTimeline data={data} />
          )}

        </div>

        {!drawer && (
          <CaseSidebar
            data={emEdicao}
            owners={owners}
            onChange={patch}
            onEditarAvaliacao={() => setTab("avaliacao")}
          />
        )}

      </div>

      <BarraDeSalvar rascunho={rascunho} nome="caso" />

    </div>
  );
}
