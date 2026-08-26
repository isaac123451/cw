"use client";

import Link from "next/link";

import { useMemo } from "react";

import {
  ArrowRight,
  CalendarClock,
  Check,
} from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { useAgenda } from "@/lib/context/AgendaContext";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

const priorityTone: Record<string, string> = {
  Alta: "bg-rose-500",
  Média: "bg-amber-500",
  Baixa: "bg-zinc-300",
};

export default function TodayAgenda() {

  const { tasks, toggleTask } = useAgenda();

  const { hoje, atrasadas } = useMemo(() => {

    const pendentes = tasks.filter(
      (item) => !item.done
    );

    return {
      hoje: pendentes.filter(
        (item) => item.dueDate === hojeNaOperacao()
      ),
      atrasadas: pendentes.filter(
        (item) => item.dueDate < hojeNaOperacao()
      ),
    };

  }, [tasks]);

  const lista = [...atrasadas, ...hoje].slice(0, 6);

  return (
    <SurfaceCard
      title="Agenda do dia"
      description={
        atrasadas.length > 0
          ? `${hoje.length} para hoje · ${atrasadas.length} atrasada(s)`
          : `${hoje.length} atividade(s) para hoje`
      }
      action={
        <Link
          href="/agenda"
          className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-violet-700 transition-colors hover:text-violet-900"
        >
          Abrir agenda
          <ArrowRight size={14} />
        </Link>
      }
      bodyClassName="p-0"
    >

      {lista.length === 0 ? (

        <div className="flex flex-col items-center py-10 text-center">

          <CalendarClock
            size={24}
            className="text-emerald-500"
          />

          <p className="mt-2.5 text-sm font-medium text-zinc-700">
            Nada pendente para hoje.
          </p>

        </div>

      ) : (

        <ul className="divide-y divide-zinc-100">

          {lista.map((item) => {

            const atrasada =
              item.dueDate < hojeNaOperacao();

            return (
              <li
                key={item.id}
                className="flex items-start gap-3 px-6 py-3"
              >

                <button
                  onClick={() => toggleTask(item.id)}
                  title="Marcar como resolvida"
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-zinc-300 transition-colors hover:border-emerald-500 hover:bg-emerald-50"
                >
                  <Check
                    size={12}
                    className="text-transparent transition-colors hover:text-emerald-600"
                  />
                </button>

                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    priorityTone[item.priority]
                  }`}
                  title={`Prioridade ${item.priority}`}
                />

                <div className="min-w-0 flex-1">

                  <p className="truncate text-sm font-medium text-zinc-800">
                    {item.title}
                  </p>

                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">

                    {atrasada && (
                      <span className="rounded bg-rose-50 px-1.5 py-0.5 font-semibold text-rose-600">
                        atrasada
                      </span>
                    )}

                    <span>{item.type}</span>

                    <span>·</span>

                    <span>{item.owner}</span>

                  </p>

                </div>

                <span className="shrink-0 text-xs font-medium tabular-nums text-zinc-400">
                  {item.time}
                </span>

              </li>
            );
          })}

        </ul>

      )}

    </SurfaceCard>
  );
}
