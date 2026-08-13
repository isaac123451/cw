"use client";

import Link from "next/link";

import { useMemo } from "react";

import {
  CheckCircle2,
  CircleAlert,
  Inbox,
  Timer,
} from "lucide-react";

import { useScopedCases } from "@/lib/context/useScopedCases";
import { isOpen } from "@/lib/services/case.service";

import StatTile from "@/components/shared/StatTile";

import {
  displayBand,
  formatElapsed,
  formatRange,
  getRange,
  getReputation,
  inRange,
  ptBR,
} from "@/lib/services/reputation.service";

export default function MetricsBar() {

  const { cases } = useScopedCases("reclame-aqui");

  /** Janela oficial de 6 meses — a mesma que define a nota pública. */
  const range = useMemo(() => getRange("6m"), []);

  const noPeriodo = useMemo(
    () =>
      cases.filter((item) =>
        inRange(item, range.start, range.end)
      ),
    [cases, range]
  );

  const reputacao = useMemo(
    () => getReputation(noPeriodo),
    [noPeriodo]
  );

  const band = displayBand(reputacao);

  const abertos = cases.filter(isOpen).length;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">

      {/* Nota de reputação em destaque */}

      <Link
        href="/reclame-aqui/analytics"
        title={`Nota calculada sobre ${formatRange(
          range.start,
          range.end
        )} — clique para ver o detalhamento.`}
        className="group relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-14px_rgba(16,24,40,0.25)]"
      >

        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: band.color }}
        />

        <div className="flex items-start justify-between gap-3">

          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
            Reputação
          </p>

          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
            style={{ background: band.color }}
          >
            {band.label}
          </span>

        </div>

        <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums text-zinc-900">
          {ptBR(reputacao.raScore)}
          <span className="ml-1 text-base font-normal text-zinc-400">
            /10
          </span>
        </p>

        <p className="mt-2 text-xs text-zinc-400">
          últimos 6 meses fechados
        </p>

      </Link>

      <StatTile
        label="Reclamações"
        description="Total recebido na janela de 6 meses que define a nota pública."
        value={reputacao.received}
        hint={`${reputacao.unanswered} sem resposta`}
        icon={CircleAlert}
        tone="danger"
      />

      <StatTile
        label="Índice de resposta"
        description="Percentual respondido publicamente. É o item de maior peso na nota."
        value={`${ptBR(reputacao.responseIndex)}%`}
        hint="meta de 90%"
        icon={CheckCircle2}
        tone={
          reputacao.responseIndex >= 90
            ? "success"
            : "warning"
        }
      />

      <StatTile
        label="Tempo de resposta"
        description="Média entre a reclamação e a primeira resposta pública."
        value={formatElapsed(reputacao.responseMinutes)}
        hint="média do período"
        icon={Timer}
        tone="info"
      />

      <StatTile
        label="Na fila"
        description="Casos que ainda dependem de ação da operação, de qualquer período."
        value={abertos}
        hint={`de ${cases.length} no total`}
        icon={Inbox}
        tone="primary"
      />

    </div>
  );
}
