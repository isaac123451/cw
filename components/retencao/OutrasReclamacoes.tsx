"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Search } from "lucide-react";

import MarcaDeCancelamento from "@/components/retencao/MarcaDeCancelamento";
import type { ReclamacaoForaDaConta } from "@/lib/services/cancelamento.service";

const POR_PAGINA = 15;
const dia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;

/**
 * Toda reclamação que ainda não está na conta (20/10/2026): "qualquer
 * reclamação ser vista e adicionada aos casos caso faça sentido".
 *
 * Abre nas que parecem cancelamento — a régua da chance de cancelar, com o
 * porquê ao lado —, e a busca alcança todas. O botão de cada linha é o
 * mesmo da ficha: "O cliente solicitou o cancelamento?" e o desfecho;
 * marcada, a reclamação entra na conta e some daqui.
 */
export default function OutrasReclamacoes({ reclamacoes, onMudou }: { reclamacoes: ReclamacaoForaDaConta[]; onMudou: () => void }) {
  const sugeridas = useMemo(() => reclamacoes.filter((r) => r.sugestao), [reclamacoes]);
  const [aba, setAba] = useState<"sugeridas" | "todas">("sugeridas");
  const [busca, setBusca] = useState("");
  const [limite, setLimite] = useState(POR_PAGINA);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const base = termo ? reclamacoes : aba === "sugeridas" ? sugeridas : reclamacoes;
    if (!termo) return base;
    return base.filter((r) => `${r.protocolo} ${r.cliente} ${r.titulo} ${r.assunto}`.toLowerCase().includes(termo));
  }, [reclamacoes, sugeridas, aba, busca]);

  if (!reclamacoes.length) return null;

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]" aria-label="Outras reclamações">
      <header className="flex flex-wrap items-center gap-3 border-b border-zinc-100 px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">Outras reclamações</h2>
          <p className="text-xs text-zinc-500">As que ainda não estão na conta. Se o cliente pediu para cancelar, marque — ela entra na hora.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-zinc-100 p-0.5" role="tablist" aria-label="Quais reclamações">
            {(
              [
                ["sugeridas", `Parecem cancelamento · ${sugeridas.length}`],
                ["todas", `Todas · ${reclamacoes.length}`],
              ] as const
            ).map(([id, nome]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={aba === id && !busca}
                onClick={() => {
                  setAba(id);
                  setBusca("");
                  setLimite(POR_PAGINA);
                }}
                className={`rounded-md px-2.5 py-1 text-sm transition-colors ${aba === id && !busca ? "bg-white font-medium text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}
              >
                {nome}
              </button>
            ))}
          </div>
          <label className="flex w-56 items-center gap-2 rounded-lg border border-zinc-200 px-2.5 py-1.5">
            <Search size={14} className="text-zinc-400" />
            <input
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setLimite(POR_PAGINA);
              }}
              placeholder="Buscar em todas"
              className="w-full bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-400"
            />
          </label>
        </div>
      </header>

      {lista.length === 0 ? (
        <p className="px-5 py-8 text-sm text-zinc-500">{busca ? "Nenhuma reclamação com isso." : "Nenhuma reclamação parece cancelamento fora da conta."}</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {lista.slice(0, limite).map((r) => (
            <li key={r.protocolo} className="flex items-start gap-3 px-5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <Link href={r.frente === "reclame-aqui" ? `/reclame-aqui/${r.id}` : `/redes-sociais/${r.id}`} className="truncate text-sm font-medium text-zinc-900 hover:text-violet-700">
                    {r.cliente}
                  </Link>
                  <span className="text-xs text-zinc-400">
                    {r.protocolo} · {dia(r.chegouEm)} · {r.status}
                  </span>
                </p>
                <p className="truncate text-sm text-zinc-600" title={r.titulo}>
                  {r.titulo}
                </p>
                {r.sugestao && <p className="mt-0.5 text-xs text-amber-800">Por que parece: {r.sugestao}</p>}
              </div>
              <MarcaDeCancelamento protocolo={r.protocolo} inicial={null} onMudou={onMudou} />
            </li>
          ))}
        </ul>
      )}
      {lista.length > limite && (
        <button
          type="button"
          onClick={() => setLimite((l) => l + POR_PAGINA)}
          className="w-full border-t border-zinc-100 px-5 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
        >
          Mostrar mais {Math.min(POR_PAGINA, lista.length - limite)} de {lista.length - limite}
        </button>
      )}
    </section>
  );
}
