"use client";

import Link from "next/link";

import { useEffect, useState } from "react";

import { ChevronLeft, ChevronRight, Loader2, ShieldAlert } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import {
  mesDaOperacao,
  reais,
  ROTULO_DO_STATUS,
  type NegociacaoView,
  type ResumoDoMes,
} from "@/lib/models/negociacao";
import { descreverRegistro } from "@/lib/services/horasUteis";

import { resumoDoMes } from "@/lib/actions/negociacao";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function deslocar(mes: string, delta: number) {
  const [a, m] = mes.split("-").map(Number);
  const total = a * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/**
 * Ofertas e renegociações do mês — o contador do documento.
 *
 * "Se você perceber que precisou aplicar mais de uma vez no mês, reveja
 * o que está sendo feito." O número fica aqui, ao lado do custo, com o
 * aviso a partir da segunda renegociação. E o que a concessão comprou:
 * quantos clientes teriam cancelado sem ela.
 */
export default function NegociacoesDoMes() {

  const [mes, setMes] = useState(() => mesDaOperacao(new Date()));
  const [dados, setDados] = useState<(ResumoDoMes & { lista: NegociacaoView[] }) | null>(null);

  useEffect(() => {
    let ativo = true;
    resumoDoMes(mes)
      .then((r) => ativo && setDados(r))
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [mes]);

  const atual = mesDaOperacao(new Date());
  const nome = `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`;
  const carregando = !dados || dados.mes !== mes;

  return (
    <SurfaceCard
      title="Ofertas e renegociações do mês"
      description="Registradas nos casos, com quem validou. Aceitas, entram nos registros de impacto como custo."
      action={
        <div className="flex shrink-0 items-center gap-1 rounded-xl ring-1 ring-inset ring-zinc-200">
          <button type="button" onClick={() => setMes((m) => deslocar(m, -1))} className="rounded-l-xl p-2 text-zinc-500 hover:bg-zinc-50" aria-label="Mês anterior">
            <ChevronLeft size={15} />
          </button>
          <span className="min-w-32 text-center text-xs font-medium text-zinc-700">
            {nome.replace(/^./, (c) => c.toUpperCase())}
          </span>
          <button
            type="button"
            onClick={() => setMes((m) => deslocar(m, 1))}
            disabled={mes >= atual}
            className="rounded-r-xl p-2 text-zinc-500 hover:bg-zinc-50 disabled:opacity-30"
            aria-label="Próximo mês"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      }
    >

      {carregando ? (
        <p className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 size={14} className="animate-spin" /> Carregando…
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ["Ofertas", String(dados.ofertas)],
              ["Renegociações", `${dados.renegociacoes}${dados.aplicadas ? ` · ${dados.aplicadas} aplicada(s)` : ""}`],
              ["Concedido (aceitas)", reais(dados.concedidoCents)],
              ["Clientes retidos", String(dados.retidos)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-zinc-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{k}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">{v}</p>
              </div>
            ))}
          </div>

          {dados.renegociacoes >= 2 && (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-900 ring-1 ring-inset ring-amber-100">
              <ShieldAlert size={15} className="mt-0.5 shrink-0 text-amber-600" />
              <span>
                <strong>{dados.renegociacoes} renegociações em {nome}.</strong> O documento: renegociação é exceção
                máxima — se precisou aplicar mais de uma vez no mês, reveja o que está sendo feito.
              </span>
            </p>
          )}

          {dados.lista.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-zinc-200 py-6 text-center text-sm text-zinc-400">
              Nenhuma oferta ou renegociação registrada em {nome}.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-100">
              {dados.lista.map((n) => (
                <li key={n.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-zinc-800">
                      {n.tipo === "renegociacao" ? "Renegociação" : n.descricao} · {n.cliente}
                    </span>
                    <span className="block text-xs text-zinc-500">
                      {descreverRegistro(n.criadoEm)} · {n.autorNome}
                      {n.validadoPor ? ` · ${n.tipo === "renegociacao" ? "autorizada" : "validada"} por ${n.validadoPor}` : ""}
                      {n.caso ? (
                        <>
                          {" · "}
                          <Link href={`/reclame-aqui/${n.caso.id}`} className="font-medium text-violet-700 hover:underline">
                            {n.caso.protocolo}
                          </Link>
                        </>
                      ) : null}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-zinc-700">{reais(n.valorCents)}</span>
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600">
                    {ROTULO_DO_STATUS[n.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

    </SurfaceCard>
  );
}
