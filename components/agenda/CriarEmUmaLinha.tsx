"use client";

import { useMemo, useState } from "react";

import { Check, CornerDownLeft, Undo2 } from "lucide-react";

import { useAgenda } from "@/lib/context/AgendaContext";
import { useCases } from "@/lib/context/CaseContext";
import { useSession } from "@/lib/context/SessionContext";
import { useAgora } from "@/lib/hooks/useAgora";

import { atividadeDaLinha, entenderLinha } from "@/lib/models/linhaDaAgenda";
import { diaCurtoDaMarca } from "@/lib/models/meuDia";
import { paredeDe } from "@/lib/services/horasUteis";

/**
 * "amanhã 10h ligar RA-123" — uma atividade em uma linha (Fase 25).
 *
 * Enquanto se escreve, a prévia mostra o que foi entendido (o dia, a
 * hora, o tipo, o caso); Enter cria, e o aviso ao lado oferece desfazer.
 * O formulário completo continua em "Nova atividade".
 */
export default function CriarEmUmaLinha() {

  const agora = useAgora();
  const { createTask, removeTask } = useAgenda();
  const { cases } = useCases();
  const sessao = useSession();

  const [texto, setTexto] = useState("");
  const [criada, setCriada] = useState<{ id: string; titulo: string; dia: string } | null>(null);

  const protocolos = useMemo(() => new Set(cases.map((c) => c.protocol)), [cases]);
  const hoje = agora ? paredeDe(agora).dia : null;
  const linha = hoje && texto.trim() ? entenderLinha(texto, hoje, protocolos) : null;

  function criar() {
    if (!linha) return;
    const id = createTask(atividadeDaLinha(linha, sessao?.name ?? "Operação"));
    setCriada({ id, titulo: linha.title, dia: linha.dueDate });
    setTexto("");
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          criar();
        }}
        className="flex items-center gap-2"
      >
        <label htmlFor="agenda-uma-linha" className="sr-only">
          Nova atividade em uma linha
        </label>
        <input
          id="agenda-uma-linha"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setCriada(null);
          }}
          placeholder="Nova em uma linha: amanhã 10h ligar RA-123"
          autoComplete="off"
          className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
        />
        <button type="submit" disabled={!linha} className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-zinc-900 px-2.5 text-xs font-semibold text-white disabled:opacity-30">
          Criar <CornerDownLeft size={12} />
        </button>
      </form>
      <p aria-live="polite" className="flex min-h-5 flex-wrap items-center gap-1.5 text-xs text-zinc-500">
        {criada ? (
          <>
            <Check size={12} strokeWidth={2.5} className="text-emerald-600" />
            <span className="text-emerald-800">
              Criada para {criada.dia === hoje ? "hoje" : diaCurtoDaMarca(criada.dia)}: <strong className="font-medium">{criada.titulo}</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                removeTask(criada.id);
                setCriada(null);
              }}
              className="flex items-center gap-0.5 rounded px-1 font-semibold text-zinc-700 hover:bg-zinc-100"
            >
              <Undo2 size={11} /> desfazer
            </button>
          </>
        ) : linha ? (
          <>
            <span className="rounded bg-zinc-100 px-1.5 py-px font-medium text-zinc-700">{linha.dueDate === hoje ? "hoje" : diaCurtoDaMarca(linha.dueDate)}</span>
            {linha.time && <span className="rounded bg-zinc-100 px-1.5 py-px font-medium tabular-nums text-zinc-700">{linha.time}</span>}
            <span className="rounded bg-violet-50 px-1.5 py-px font-medium text-violet-700">{linha.type}</span>
            {linha.relatedCase && <span className="rounded bg-zinc-100 px-1.5 py-px font-mono text-zinc-700">{linha.relatedCase}</span>}
            <span className="truncate">“{linha.title}”</span>
          </>
        ) : texto.trim() ? (
          <span>Diga o que fazer, além do dia e da hora.</span>
        ) : (
          <span>Dia (hoje, amanhã, sexta, 25/09), hora (10h, 14:30) e o protocolo, se tiver.</span>
        )}
      </p>
    </div>
  );
}
