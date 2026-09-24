"use client";

import { useEffect, useState } from "react";

import { Sparkles, Undo2, X } from "lucide-react";

import { gerarLembretesAutomaticos } from "@/lib/actions/lembretesAutomaticos";
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
                <button type="button" onClick={() => desfazer([t.id])} className="flex shrink-0 items-center gap-0.5 rounded px-1 font-medium text-zinc-600 hover:bg-white">
                  <Undo2 size={11} /> desfazer
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-zinc-500">Das áreas acionadas sem retorno e dos retornos combinados nas conversas guardadas. Desfazer conclui o lembrete — ele não volta.</p>
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
