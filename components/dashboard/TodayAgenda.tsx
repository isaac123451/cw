"use client";

import Link from "next/link";

import { useMemo } from "react";

import {
  ArrowRight,
  CalendarClock,
  Check,
  ExternalLink,
} from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { useAgenda } from "@/lib/context/AgendaContext";
import { useGoogleEvents } from "@/lib/context/GoogleEventsContext";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

const priorityTone: Record<string, string> = {
  Alta: "bg-rose-500",
  Média: "bg-amber-500",
  Baixa: "bg-zinc-300",
};

/**
 * Uma linha do cartão, venha ela de onde vier.
 *
 * As duas origens têm formatos diferentes e a mesma função na tela —
 * dizer o que ainda falta hoje. Achatar as duas num tipo só é o que
 * permite ordená-las pelo horário: intercaladas por hora, a leitura é
 * "o meu dia"; em duas listas separadas, é "as minhas tarefas e,
 * embaixo, as minhas reuniões", e ninguém planeja assim.
 */
interface Linha {
  id: string;
  titulo: string;
  hora: string;
  atrasada: boolean;
  origem: "cw" | "google";
  /** Só nas tarefas internas: concluir dali mesmo. */
  concluir?: () => void;
  prioridade?: string;
  detalhe?: string;
  link?: string;
}

/**
 * O dia da operação: tarefas do CW e compromissos do Google, juntos.
 *
 * O Isaac pediu "mostre algo como lembretes e agenda do google". O
 * cartão mostrava só as tarefas internas, e o efeito prático era que a
 * pessoa lia "nada pendente para hoje" com três reuniões marcadas — o
 * painel dizia que o dia estava livre e ele não estava.
 *
 * **Ordenados por hora, misturados.** Ver a reunião das 14h entre a
 * cobrança das 11h e o retorno das 16h é o que responde "dá tempo?".
 *
 * **Google entra só como leitura.** Concluir uma tarefa do CW é uma
 * gravação nossa; "concluir" um evento do Google não significa nada —
 * o que se faz com ele é abrir, e por isso o botão é o link.
 */
export default function TodayAgenda() {

  const { tasks, toggleTask } = useAgenda();

  /*
    Quem não conectou a conta não tem eventos, e isso não é erro.

    O contexto falha em silêncio de propósito; aqui isso vira uma lista
    vazia, e o cartão segue exatamente como era antes da integração.
  */
  const { events, error: falhaDoGoogle } =
    useGoogleEvents();

  const { linhas, hoje, atrasadas, doGoogle } =
    useMemo(() => {

      const dia = hojeNaOperacao();

      const pendentes = tasks.filter(
        (item) => !item.done
      );

      const daOperacao = pendentes.filter(
        (item) => item.dueDate <= dia
      );

      /*
        Só o que é de hoje.

        O contexto traz os próximos dias para o sino avisar com
        antecedência; aqui a pergunta é outra — o que ainda falta
        neste dia —, e um compromisso de quinta no cartão de segunda
        só ocupa lugar.
      */
      const eventosDeHoje = events.filter(
        (item) => item.date === dia
      );

      const linhas: Linha[] = [

        ...daOperacao.map((item) => ({
          id: `cw-${item.id}`,
          titulo: item.title,
          hora: item.time ?? "",
          atrasada: item.dueDate < dia,
          origem: "cw" as const,
          concluir: () => toggleTask(item.id),
          prioridade: item.priority,
          detalhe: `${item.type} · ${item.owner}`,
        })),

        ...eventosDeHoje.map((item) => ({
          id: `g-${item.id}`,
          titulo: item.title,
          hora: item.allDay ? "" : (item.time ?? ""),
          atrasada: false,
          origem: "google" as const,
          detalhe: item.allDay
            ? "Google · dia inteiro"
            : `Google${item.endTime ? ` · até ${item.endTime}` : ""}`,
          link: item.link,
        })),

      ].sort((a, b) => {

        // Atrasadas primeiro; depois por hora, e sem hora no fim.
        if (a.atrasada !== b.atrasada) {
          return a.atrasada ? -1 : 1;
        }

        return (a.hora || "99:99").localeCompare(
          b.hora || "99:99"
        );
      });

      return {
        linhas,
        hoje: daOperacao.filter(
          (item) => item.dueDate === dia
        ).length,
        atrasadas: daOperacao.filter(
          (item) => item.dueDate < dia
        ).length,
        doGoogle: eventosDeHoje.length,
      };

    }, [tasks, events, toggleTask]);

  const lista = linhas.slice(0, 7);

  const resumo = [
    `${hoje} atividade(s) para hoje`,
    atrasadas > 0 ? `${atrasadas} atrasada(s)` : null,
    doGoogle > 0
      ? `${doGoogle} compromisso(s) do Google`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <SurfaceCard
      title="Agenda do dia"
      description={resumo}
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

        <div className="flex flex-col items-center px-6 py-10 text-center">

          <CalendarClock
            size={24}
            className="text-emerald-500"
          />

          <p className="mt-2.5 text-sm font-medium text-zinc-700">
            Nada pendente para hoje.
          </p>

          {/*
            "Nada pendente" só é verdade se o Google respondeu.

            Sem este aviso, uma conta desconectada faz o painel afirmar
            que o dia está livre — que é a única coisa pior do que não
            mostrar a agenda.
          */}
          {falhaDoGoogle && (
            <p className="mt-1 text-[11px] text-zinc-400">
              Sem os compromissos do Google:{" "}
              {falhaDoGoogle}
            </p>
          )}

        </div>

      ) : (

        <ul className="divide-y divide-zinc-100">

          {lista.map((item) => (

            <li
              key={item.id}
              className="flex items-start gap-3 px-6 py-3"
            >

              {item.concluir ? (

                <button
                  onClick={item.concluir}
                  title="Marcar como resolvida"
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-zinc-300 transition-colors hover:border-emerald-500 hover:bg-emerald-50"
                >
                  <Check
                    size={12}
                    className="text-transparent transition-colors hover:text-emerald-600"
                  />
                </button>

              ) : (

                /*
                  Evento do Google não tem o que concluir aqui.

                  O espaço é mantido para as linhas não desalinharem, e
                  o ícone diz de onde a linha veio.
                */
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center"
                  title="Compromisso do Google Agenda"
                >
                  <CalendarClock
                    size={14}
                    className="text-sky-500"
                  />
                </span>

              )}

              {item.prioridade && (
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    priorityTone[item.prioridade]
                  }`}
                  title={`Prioridade ${item.prioridade}`}
                />
              )}

              <div className="min-w-0 flex-1">

                <p className="truncate text-sm font-medium text-zinc-800">
                  {item.titulo}
                </p>

                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">

                  {item.atrasada && (
                    <span className="rounded bg-rose-50 px-1.5 py-0.5 font-semibold text-rose-600">
                      atrasada
                    </span>
                  )}

                  <span>{item.detalhe}</span>

                </p>

              </div>

              <span className="flex shrink-0 items-center gap-1.5">

                <span className="text-xs font-medium tabular-nums text-zinc-400">
                  {item.hora || "—"}
                </span>

                {item.link && (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir no Google Agenda"
                    className="rounded-lg p-1 text-zinc-300 transition-colors hover:bg-sky-50 hover:text-sky-600"
                  >
                    <ExternalLink size={13} />
                  </a>
                )}

              </span>

            </li>

          ))}

        </ul>

      )}

    </SurfaceCard>
  );
}
