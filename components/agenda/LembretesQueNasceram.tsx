"use client";

import { useEffect, useState } from "react";

import { CalendarPlus, Loader2, Sparkles, Undo2, X } from "lucide-react";

import { gerarLembretesAutomaticos } from "@/lib/actions/lembretesAutomaticos";
import { pushTaskToGoogle } from "@/lib/actions/google";
import { useAgenda } from "@/lib/context/AgendaContext";
import type { AgendaTask } from "@/lib/models/agenda";
import { diaCurtoDaMarca } from "@/lib/models/meuDia";

/**
 * O aviso dos lembretes que nasceram sozinhos (Fase 25).
 *
 * Ao abrir a Agenda, o servidor cria os lembretes das áreas sem retorno
 * e dos retornos combinados nas conversas. O que nasceu agora aparece
 * aqui, um por linha, com desfazer — que conclui o lembrete em vez de
 * apagar, para ele não nascer de novo na próxima vez.
 */
export default function LembretesQueNasceram() {

  const { receberDoServidor, toggleTask } = useAgenda();
  const [nascidos, setNascidos] = useState<AgendaTask[]>([]);
  const [desfeitos, setDesfeitos] = useState<string[]>([]);

  /*
    A reunião que nasceu da conversa pode ir para a Agenda do Google (1.98)
    — só no clique de quem vê: nenhum evento sai sozinho para a agenda de
    ninguém.
  */
  const [noGoogle, setNoGoogle] = useState<Record<string, "enviando" | "ok" | string>>({});
  async function levarAoGoogle(t: AgendaTask) {
    setNoGoogle((g) => ({ ...g, [t.id]: "enviando" }));
    const r = await pushTaskToGoogle({ title: t.title, date: t.dueDate, time: t.time, description: `CW Reputação — ${[t.type, t.relatedCase].filter(Boolean).join(" · ")}` });
    setNoGoogle((g) => ({ ...g, [t.id]: r.ok ? "ok" : r.error ?? "Não foi possível criar o evento." }));
  }

  useEffect(() => {
    let vivo = true;
    gerarLembretesAutomaticos()
      .then((r) => {
        if (!vivo || !r.ok || r.criados.length === 0) return;
        receberDoServidor(r.criados);
        setNascidos(r.criados);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
    // Uma vez por abertura da Agenda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visiveis = nascidos.filter((t) => !desfeitos.includes(t.id));
  if (visiveis.length === 0) return null;

  async function desfazer(ids: string[]) {
    setDesfeitos((d) => [...d, ...ids]);
    for (const id of ids) await toggleTask(id);
  }

  return (
    <section aria-live="polite" className="rounded-xl border border-violet-200 bg-violet-50/50 px-4 py-3">
      <div className="flex items-start gap-2">
        <Sparkles size={15} className="mt-0.5 shrink-0 text-violet-700" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-violet-900">
            {visiveis.length === 1 ? "Um lembrete nasceu sozinho" : `${visiveis.length} lembretes nasceram sozinhos`}
          </p>
          <ul className="mt-1 space-y-0.5">
            {visiveis.map((t) => (
              <li key={t.id} className="flex min-w-0 items-center gap-2 text-xs text-zinc-700">
                <span className="shrink-0 tabular-nums text-violet-700">
                  {diaCurtoDaMarca(t.dueDate)}
                  {t.time ? ` ${t.time}` : ""}
                </span>
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                {t.type === "Reunião" &&
                  (noGoogle[t.id] === "ok" ? (
                    <span className="shrink-0 font-medium text-emerald-700">na Agenda do Google</span>
                  ) : (
                    <button
                      type="button"
                      disabled={noGoogle[t.id] === "enviando"}
                      onClick={() => levarAoGoogle(t)}
                      title={noGoogle[t.id] && noGoogle[t.id] !== "enviando" ? String(noGoogle[t.id]) : "Criar o evento na sua Agenda do Google"}
                      className={`flex shrink-0 items-center gap-0.5 rounded px-1 font-medium hover:bg-white ${noGoogle[t.id] && noGoogle[t.id] !== "enviando" ? "text-rose-700" : "text-violet-700"}`}
                    >
                      {noGoogle[t.id] === "enviando" ? <Loader2 size={11} className="animate-spin" /> : <CalendarPlus size={11} />}
                      {noGoogle[t.id] && noGoogle[t.id] !== "enviando" ? "tentar de novo" : "levar ao Google"}
                    </button>
                  ))}
                <button type="button" onClick={() => desfazer([t.id])} className="flex shrink-0 items-center gap-0.5 rounded px-1 font-medium text-zinc-600 hover:bg-white">
                  <Undo2 size={11} /> desfazer
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-zinc-500">Das áreas acionadas sem retorno, dos retornos combinados, dos pedidos dos clientes e das reuniões marcadas nas conversas guardadas. Desfazer conclui o lembrete — ele não volta.</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {visiveis.length > 1 && (
            <button type="button" onClick={() => desfazer(visiveis.map((t) => t.id))} className="rounded-md px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-white">
              Desfazer todos
            </button>
          )}
          <button type="button" onClick={() => setNascidos([])} aria-label="Fechar o aviso" className="rounded-md p-1 text-zinc-400 hover:bg-white hover:text-zinc-700">
            <X size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}
