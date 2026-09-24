"use client";

import { useState } from "react";

import { Pencil } from "lucide-react";

import RootCauseManager from "@/components/nps/RootCauseManager";
import SurfaceCard from "@/components/shared/SurfaceCard";

import { removeNpsRootCause, saveNpsRootCause } from "@/lib/actions/nps";
import { sincronizar } from "@/lib/context/sync";
import { useNps } from "@/lib/context/NpsContext";
import { useToast } from "@/lib/context/ToastContext";
import { rotuloDoPrazo } from "@/lib/models/catalogoDeCausas";
import type { RootCauseOption } from "@/lib/models/nps";

/**
 * O catálogo como está, com o dono de cada causa (Fase 27).
 *
 * A causa sem área é a que não diz para quem ligar — aparece primeiro,
 * para ser a próxima a ganhar dono. Editar abre o mesmo cadastro do NPS:
 * a lista é uma só para as quatro frentes.
 */
export default function CatalogoComDonos() {

  const { rootCauses, recarregarCausas } = useNps();
  const { notify } = useToast();
  const [editando, setEditando] = useState(false);

  const ativas = rootCauses.filter((c) => c.active);
  const semDono = ativas.filter((c) => !c.area);
  const ordenadas = [...semDono, ...ativas.filter((c) => c.area).sort((a, b) => (a.area ?? "").localeCompare(b.area ?? "") || a.order - b.order)];

  async function salvar(causa: RootCauseOption) {
    const r = await sincronizar(() => saveNpsRootCause(causa));
    if (r.ok) await recarregarCausas();
    return r;
  }

  async function excluir(causa: RootCauseOption) {
    try {
      const emUso = await removeNpsRootCause(causa.id);
      await recarregarCausas();
      if (emUso) notify({ tone: "info", title: "Causa desativada, não excluída.", detail: `${emUso} registro(s) já usam "${causa.name}".` });
    } catch {
      notify({ tone: "error", title: "A causa não foi excluída.", detail: "Tente de novo em instantes." });
    }
  }

  return (
    <SurfaceCard
      title="O catálogo e os donos"
      description="Cada causa com a área que resolve e o prazo. Classificar mostra o dono embaixo do campo, nas quatro frentes."
      action={
        <button type="button" onClick={() => setEditando(true)} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200 hover:bg-violet-50">
          <Pencil size={12} /> Editar
        </button>
      }
    >
      <p className="text-sm text-zinc-600">
        <strong className="tabular-nums text-zinc-900">{ativas.length}</strong> causas ativas
        {semDono.length > 0 ? (
          <>
            , <strong className="tabular-nums text-amber-700">{semDono.length}</strong> sem dono — não dizem para quem ligar.
          </>
        ) : (
          ", todas com dono."
        )}
      </p>
      <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {ordenadas.map((c) => (
          <li key={c.id} className="flex items-baseline justify-between gap-3 border-b border-zinc-100 py-1.5 text-sm">
            <span className="min-w-0 truncate text-zinc-800">{c.name}</span>
            <span className={`shrink-0 text-xs ${c.area ? "text-zinc-500" : "text-amber-700"}`}>
              {c.area ? `${c.area} · ${rotuloDoPrazo(c.prazoHoras)}` : "sem dono"}
            </span>
          </li>
        ))}
      </ul>
      {editando && <RootCauseManager causas={rootCauses} onClose={() => setEditando(false)} onSave={salvar} onRemove={excluir} />}
    </SurfaceCard>
  );
}
