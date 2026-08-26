"use client";

import { useState } from "react";

import Link from "next/link";

import {
  Bell,
  BellPlus,
  Check,
  ExternalLink,
} from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { Case } from "@/lib/models/case";
import { TaskType } from "@/lib/models/agenda";

import { useAgenda } from "@/lib/context/AgendaContext";
import { useSession } from "@/lib/context/SessionContext";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

const campo =
  "h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400";

const TIPOS: TaskType[] = [
  "Follow-up",
  "Cobrança interna",
  "Solicitação de avaliação",
  "Pendência",
];

/**
 * Os lembretes deste caso, na ficha dele.
 *
 * O Isaac: "lembretes precisam estar nos casos também, além das
 * anotações", e "precisa ter lembrete na reclamação e ser possível ser
 * adicionado pela extensão".
 *
 * A extensão já marcava lembrete com o caso vinculado, e a agenda já os
 * guardava — o que faltava era o caminho de volta. Quem abria a
 * reclamação via as anotações e nenhum sinal de que havia um retorno
 * marcado para quinta; para descobrir, teria de ir à agenda e procurar
 * pelo nome. Na prática, ninguém ia, e o lembrete só reaparecia quando
 * a notificação disparava.
 *
 * **Anotação e lembrete são coisas diferentes.** A anotação é o que
 * aconteceu; o lembrete é o que ainda vai acontecer. Misturá-los numa
 * lista só faria a segunda pergunta — "o que falta aqui?" — precisar de
 * leitura para ser respondida.
 */
export default function LembretesCard({
  data,
}: {
  data: Case;
}) {

  const { tasks, createTask, toggleTask } = useAgenda();
  const session = useSession();

  const [titulo, setTitulo] = useState("");
  const [quando, setQuando] = useState(hojeNaOperacao());
  const [hora, setHora] = useState("");
  const [tipo, setTipo] = useState(TIPOS[0]);
  const [abrindo, setAbrindo] = useState(false);

  const doCaso = tasks
    .filter((item) => item.relatedCase === data.protocol)
    .sort((a, b) => {
      // Pendentes primeiro; dentro de cada grupo, por data.
      if (a.done !== b.done) return a.done ? 1 : -1;
      return a.dueDate.localeCompare(b.dueDate);
    });

  const pendentes = doCaso.filter((item) => !item.done);

  function marcar() {

    if (titulo.trim() === "") return;

    createTask({
      title: titulo.trim(),
      type: tipo,
      priority: "Média",
      done: false,
      dueDate: quando,
      time: hora || undefined,
      owner: session?.name ?? "Operação",
      relatedCase: data.protocol,
    });

    setTitulo("");
    setHora("");
    setAbrindo(false);
  }

  return (
    <SurfaceCard
      title="Lembretes"
      description="O que ainda falta fazer neste caso. Vale para os marcados aqui e pela extensão — é a mesma agenda."
      action={
        <div className="flex shrink-0 items-center gap-2">

          <span className="rounded-xl bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600">
            {pendentes.length} pendente(s)
          </span>

          <button
            type="button"
            onClick={() => setAbrindo((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl border border-violet-200 px-3 py-1.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-50"
          >
            <BellPlus size={13} />
            {abrindo ? "Cancelar" : "Marcar"}
          </button>

        </div>
      }
    >

      {abrindo && (

        <div className="mb-4 rounded-xl border border-violet-100 bg-violet-50/40 p-3.5">

          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: cobrar retorno do time de pagamentos"
            className={campo}
            autoFocus
          />

          <div className="mt-2 grid gap-2 sm:grid-cols-3">

            <input
              type="date"
              value={quando}
              onChange={(e) => setQuando(e.target.value)}
              className={campo}
            />

            {/* Opcional: nem toda pendência tem hora marcada. */}
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              title="Opcional — em branco vale para o dia inteiro"
              className={campo}
            />

            <select
              value={tipo}
              onChange={(e) =>
                setTipo(e.target.value as TaskType)
              }
              className={campo}
            >
              {TIPOS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

          </div>

          <div className="mt-2.5 flex items-center justify-between gap-3">

            <span className="text-[11px] text-zinc-500">
              Entra na agenda já vinculado a{" "}
              {data.protocol}.
            </span>

            <button
              type="button"
              onClick={marcar}
              disabled={titulo.trim() === ""}
              className="rounded-xl bg-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-40"
            >
              Marcar lembrete
            </button>

          </div>

        </div>

      )}

      {doCaso.length === 0 ? (

        <p className="rounded-xl border border-dashed border-zinc-200 py-8 text-center text-sm text-zinc-400">
          Nenhum lembrete marcado para esta reclamação —
          nem aqui, nem pela extensão.
        </p>

      ) : (

        <ul className="space-y-2">

          {doCaso.map((item) => {

            const atrasado =
              !item.done &&
              item.dueDate < hojeNaOperacao();

            return (
              <li
                key={item.id}
                className={`flex items-start gap-3 rounded-xl border p-3 ${
                  item.done
                    ? "border-zinc-100 bg-zinc-50/60"
                    : atrasado
                      ? "border-rose-100 bg-rose-50/40"
                      : "border-zinc-100"
                }`}
              >

                <button
                  type="button"
                  onClick={() => toggleTask(item.id)}
                  title={
                    item.done
                      ? "Reabrir este lembrete"
                      : "Marcar como resolvido"
                  }
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                    item.done
                      ? "border-emerald-500 bg-emerald-500"
                      : "border-zinc-300 hover:border-emerald-500 hover:bg-emerald-50"
                  }`}
                >
                  <Check
                    size={12}
                    className={
                      item.done
                        ? "text-white"
                        : "text-transparent"
                    }
                  />
                </button>

                <span className="min-w-0 flex-1">

                  <span
                    className={`block text-sm font-medium ${
                      item.done
                        ? "text-zinc-400 line-through"
                        : "text-zinc-800"
                    }`}
                  >
                    {item.title}
                  </span>

                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">

                    {atrasado && (
                      <span className="rounded bg-rose-100 px-1.5 py-0.5 font-semibold text-rose-700">
                        atrasado
                      </span>
                    )}

                    <span>
                      {new Date(
                        `${item.dueDate}T00:00:00`
                      ).toLocaleDateString("pt-BR")}
                      {item.time ? ` · ${item.time}` : ""}
                    </span>

                    <span>·</span>

                    <span>{item.type}</span>

                    {item.owner && (
                      <>
                        <span>·</span>
                        <span>{item.owner}</span>
                      </>
                    )}

                  </span>

                </span>

                <Bell
                  size={13}
                  className={`mt-1 shrink-0 ${
                    item.done
                      ? "text-zinc-200"
                      : "text-violet-400"
                  }`}
                />

              </li>
            );
          })}

        </ul>

      )}

      <div className="mt-3 flex justify-end">

        <Link
          href="/agenda"
          className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-violet-700"
        >
          Ver a agenda inteira
          <ExternalLink size={12} />
        </Link>

      </div>

    </SurfaceCard>
  );
}
