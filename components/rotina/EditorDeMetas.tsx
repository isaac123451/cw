"use client";

import { useState } from "react";

import { Loader2, RotateCcw, Save } from "lucide-react";

import { salvarAjustesDeMeta } from "@/lib/actions/ajusteDeMeta";
import { useToast } from "@/lib/context/ToastContext";
import type { EscopoDaMeta, OrigemDoAlvo } from "@/lib/models/ajusteDeMeta";

export interface MetaEditavel {
  chave: string;
  titulo: string;
  alvo: number;
  automatico?: number;
  origem?: OrigemDoAlvo;
}

/**
 * O ajuste das metas, na própria faixa (1.114) — sem modal. Cada meta com
 * o número de agora e o automático ao lado; vale só para este período ou
 * daqui para frente. Salvar só confirma depois do servidor.
 */
export default function EditorDeMetas({
  escopo,
  metas,
  onFechar,
  onSalvo,
}: {
  escopo: EscopoDaMeta;
  metas: MetaEditavel[];
  onFechar: () => void;
  onSalvo: () => Promise<unknown> | void;
}) {
  const { notify } = useToast();
  const [valores, setValores] = useState<Record<string, string>>(() => Object.fromEntries(metas.map((m) => [m.chave, String(m.alvo)])));
  const [automaticos, setAutomaticos] = useState<Set<string>>(new Set());
  const [periodo, setPeriodo] = useState<"atual" | "padrao">("atual");
  const [salvando, setSalvando] = useState(false);

  const rotuloAtual = escopo === "dia" ? "Só hoje" : "Só este ciclo";
  const rotuloPadrao = escopo === "dia" ? "Daqui para frente" : "Todo ciclo";

  async function salvar() {
    const alvos: Record<string, number | null> = {};
    for (const m of metas) {
      if (automaticos.has(m.chave)) {
        alvos[m.chave] = null;
        continue;
      }
      const n = Number(valores[m.chave]);
      if (!Number.isFinite(n) || n < 0 || n > 500 || !Number.isInteger(n)) {
        notify({ tone: "error", title: "Número inválido.", detail: `${m.titulo}: use um número inteiro de 0 a 500.` });
        return;
      }
      if (n !== m.alvo) alvos[m.chave] = n;
    }
    if (Object.keys(alvos).length === 0) {
      onFechar();
      return;
    }
    setSalvando(true);
    const r = await salvarAjustesDeMeta({ escopo, periodo, alvos });
    if (!r.ok) {
      setSalvando(false);
      notify({ tone: "error", title: "Não foi salvo.", detail: r.erro });
      return;
    }
    await onSalvo();
    setSalvando(false);
    notify({ tone: "success", title: "Metas ajustadas.", detail: periodo === "padrao" ? `Valem ${escopo === "dia" ? "a partir de hoje" : "em todo ciclo"}.` : `Valem ${escopo === "dia" ? "só hoje" : "só neste ciclo"}.` });
    onFechar();
  }

  return (
    <div className="mt-2.5 space-y-3 border-t border-zinc-100 pt-3">
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {metas.map((m) => {
          const auto = automaticos.has(m.chave);
          return (
            <li key={m.chave} className="rounded-lg bg-zinc-50 px-2.5 py-2">
              <label htmlFor={`meta-${escopo}-${m.chave}`} className="block truncate text-xs font-medium text-zinc-700">
                {m.titulo}
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id={`meta-${escopo}-${m.chave}`}
                  type="number"
                  min={0}
                  max={500}
                  disabled={auto}
                  value={auto ? String(m.automatico ?? m.alvo) : valores[m.chave]}
                  onChange={(e) => setValores((v) => ({ ...v, [m.chave]: e.target.value }))}
                  className="h-8 w-20 rounded-lg border border-zinc-200 bg-white px-2 text-sm tabular-nums outline-none focus:border-violet-400 disabled:opacity-60"
                />
                {m.origem && m.origem !== "automatico" && (
                  <button
                    type="button"
                    onClick={() => setAutomaticos((s) => (s.has(m.chave) ? new Set([...s].filter((x) => x !== m.chave)) : new Set(s).add(m.chave)))}
                    title="Voltar ao número da plataforma"
                    className={`flex items-center gap-1 text-[11px] font-medium ${auto ? "text-violet-700" : "text-zinc-500 hover:text-violet-700"}`}
                  >
                    <RotateCcw size={11} /> {auto ? "automático" : "voltar ao automático"}
                  </button>
                )}
              </div>
              {m.automatico !== undefined && !auto && <p className="mt-1 text-[11px] text-zinc-400">automático: {m.automatico}</p>}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg bg-zinc-100 p-0.5 text-xs" role="radiogroup" aria-label="Por quanto tempo">
          {(
            [
              ["atual", rotuloAtual],
              ["padrao", rotuloPadrao],
            ] as const
          ).map(([v, rotulo]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={periodo === v}
              onClick={() => setPeriodo(v)}
              className={`rounded-md px-2.5 py-1 font-medium ${periodo === v ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}
            >
              {rotulo}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-violet-700 px-3 text-xs font-medium text-white hover:bg-violet-800 disabled:opacity-50"
        >
          {salvando ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          Salvar
        </button>
        <button type="button" onClick={onFechar} className="h-8 px-2 text-xs text-zinc-500 hover:text-zinc-800">
          Cancelar
        </button>
      </div>
    </div>
  );
}
