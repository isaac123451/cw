"use client";

import { useEffect, useState } from "react";

import { Gauge, Loader2, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";

import { lerTermometro, medirTermometroAgora } from "@/lib/actions/termometro";
import { useToast } from "@/lib/context/ToastContext";
import type { TermometroView } from "@/lib/models/termometro";

const COR = {
  promotor: { texto: "text-emerald-700", fundo: "bg-emerald-500", anel: "ring-emerald-200 bg-emerald-50" },
  neutro: { texto: "text-amber-700", fundo: "bg-amber-500", anel: "ring-amber-200 bg-amber-50" },
  detrator: { texto: "text-rose-700", fundo: "bg-rose-500", anel: "ring-rose-200 bg-rose-50" },
} as const;

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * O termômetro do cliente na ficha (09/10/2026): a satisfação de 0 a 10 —
 * a régua do NPS —, a nota que ele daria hoje, as chances de "resolvido" e
 * "voltaria", o porquê e a evolução das medições. "Medir agora" grava uma
 * leitura nova; a IA do dia mede sozinha quando a conversa anda.
 */
export default function CartaoDoTermometro({ protocolo, npsId }: { protocolo?: string; npsId?: string }) {
  const { notify } = useToast();
  const [t, setT] = useState<TermometroView | null | undefined>(undefined);
  const [medindo, setMedindo] = useState(false);

  useEffect(() => {
    let ativo = true;
    lerTermometro({ protocolo, npsId })
      .then((r) => ativo && setT(r.ok ? r.termometro : null))
      .catch(() => ativo && setT(null));
    return () => {
      ativo = false;
    };
  }, [protocolo, npsId]);

  async function medir() {
    setMedindo(true);
    const r = await medirTermometroAgora({ protocolo, npsId }).catch(() => ({ ok: false as const, erro: "Sem conexão agora." }));
    setMedindo(false);
    if (!r.ok) {
      notify({ tone: "error", title: "Não deu para medir.", detail: r.erro });
      return;
    }
    setT(r.termometro);
    notify({ tone: "success", title: `Satisfação ${r.termometro.satisfacao}/10`, detail: "Guardada na ficha." });
  }

  const cor = t ? COR[t.faixa] : null;

  return (
    <section aria-label="Termômetro do cliente" className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <header className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-zinc-900">
          <Gauge size={14} className="text-violet-600" /> Termômetro do cliente
        </p>
        <button
          type="button"
          onClick={() => void medir()}
          disabled={medindo}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50"
        >
          {medindo ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {medindo ? "Medindo…" : t ? "Medir de novo" : "Medir agora"}
        </button>
      </header>

      {t === undefined ? (
        <p className="mt-3 text-xs text-zinc-400">Lendo…</p>
      ) : t === null ? (
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          Ainda não medido. A satisfação de 0 a 10 (a régua do NPS) e a nota que o cliente daria hoje saem da conversa guardada, do relato e do histórico de avaliações dele e da operação.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex items-end gap-3">
            <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl ring-1 ring-inset ${cor!.anel}`}>
              <span className={`text-xl font-bold tabular-nums leading-none ${cor!.texto}`}>{t.satisfacao}</span>
              <span className="text-[9px] text-zinc-500">de 10</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className={`flex items-center gap-1 text-[13px] font-semibold capitalize ${cor!.texto}`}>
                {t.faixa}
                {t.tendencia === "melhorando" && <TrendingUp size={13} aria-label="melhorando" />}
                {t.tendencia === "piorando" && <TrendingDown size={13} aria-label="piorando" />}
              </p>
              <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-100">
                <div className={`h-1.5 rounded-full ${cor!.fundo}`} style={{ width: `${t.satisfacao * 10}%` }} />
              </div>
            </div>
          </div>

          {t.notaPrevista !== null && (
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                ["Avaliaria", `${t.notaPrevista}`],
                ["Resolvido", `${t.chanceResolvido}%`],
                ["Voltaria", `${t.chanceVoltaria}%`],
              ].map(([rotulo, valor]) => (
                <div key={rotulo} className="rounded-lg bg-zinc-50 px-1.5 py-1.5">
                  <dt className="text-[10px] uppercase tracking-wide text-zinc-500">{rotulo}</dt>
                  <dd className="text-sm font-semibold tabular-nums text-zinc-800">{valor}</dd>
                </div>
              ))}
            </dl>
          )}

          <p className="text-xs leading-relaxed text-zinc-700">{t.motivo}</p>
          {t.sinais.length > 0 && (
            <ul className="space-y-0.5 text-[11px] text-zinc-500">
              {t.sinais.slice(0, 5).map((s) => (
                <li key={s}>• {s}</li>
              ))}
            </ul>
          )}

          {t.historico.length > 1 && (
            <div aria-label="Evolução da satisfação" className="flex h-8 items-end gap-0.5">
              {t.historico.map((h) => (
                <span
                  key={h.em}
                  title={`${h.satisfacao}/10 em ${quando(h.em)}`}
                  className="w-2 rounded-sm bg-violet-300"
                  style={{ height: `${Math.max(8, h.satisfacao * 10)}%` }}
                />
              ))}
            </div>
          )}

          <p className="text-[10.5px] text-zinc-400">
            Medido em {quando(t.em)} {t.fonte === "ia" ? "pela IA" : "pelos sinais da conversa"}, calibrado pelas avaliações reais.
          </p>
        </div>
      )}
    </section>
  );
}
