"use client";

import { useEffect, useMemo, useState } from "react";

import { ClipboardCopy, Quote } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { lerVozDoCliente } from "@/lib/actions/vozDoCliente";
import { useToast } from "@/lib/context/ToastContext";
import { textoDaVoz, type VozDoMes } from "@/lib/models/vozDoCliente";
import { hojeNaOperacao } from "@/lib/services/reputation.service";
import { pluralDe } from "@/lib/plural";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const um = (n: number) => n.toFixed(1).replace(".", ",");

/**
 * A voz do cliente para o Produto (Fase 31, 1.104): as causas que mais
 * pesaram no mês, com as frases de quem reclamou e o efeito na nota — e o
 * texto pronto para a reunião.
 */
export default function VozDoCliente() {
  const { notify } = useToast();
  const meses = useMemo(() => {
    const hoje = hojeNaOperacao();
    const [a, m] = hoje.split("-").map(Number);
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(Date.UTC(a, m - 1 - i, 1));
      return d.toISOString().slice(0, 7);
    });
  }, []);
  const [mes, setMes] = useState(meses[0]);
  const [voz, setVoz] = useState<VozDoMes | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    lerVozDoCliente(mes).then((r) => {
      if (!vivo) return;
      if (r.ok) {
        setVoz(r.voz);
        setErro(null);
      } else setErro(r.erro);
    });
    return () => {
      vivo = false;
    };
  }, [mes]);

  async function copiar() {
    if (!voz) return;
    await navigator.clipboard?.writeText(textoDaVoz(voz));
    notify({ tone: "success", title: "Voz do cliente copiada.", detail: "Cole na pauta da reunião com Produto." });
  }

  return (
    <SurfaceCard
      title="Voz do cliente para o Produto"
      description="As causas que mais pesaram no mês, somando Reclame Aqui, Redes e NPS — com as frases de quem reclamou e o efeito na nota. Sem causa marcada, vale o tema reconhecido pelo texto."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <select value={mes} onChange={(e) => { setVoz(null); setMes(e.target.value); }} className="h-9 rounded-xl border border-zinc-200 bg-white px-2 text-sm" aria-label="Mês">
            {meses.map((m) => (
              <option key={m} value={m}>
                {MESES[Number(m.slice(5)) - 1]}/{m.slice(2, 4)}
              </option>
            ))}
          </select>
          <button type="button" onClick={copiar} disabled={!voz} className="flex h-9 items-center gap-1.5 rounded-xl bg-violet-700 px-3 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50">
            <ClipboardCopy size={14} /> Copiar para a reunião
          </button>
        </div>
      }
    >
      {erro && <p className="text-sm text-rose-700">{erro}</p>}
      {!voz && !erro && <p className="py-6 text-center text-sm text-zinc-400">Lendo o mês…</p>}
      {voz && voz.causas.length === 0 && <p className="text-sm text-zinc-500">Nenhuma causa reconhecida neste mês.</p>}
      {voz && voz.causas.length > 0 && (
        <ol className="space-y-3">
          {voz.causas.map((c, i) => (
            <li key={c.causa} className="rounded-xl bg-zinc-50 px-3.5 py-3">
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-semibold text-zinc-900">
                  {i + 1}. {c.causa}
                </span>
                <span className="text-zinc-500">
                  {c.total} · {[c.porFrente["reclame-aqui"] ? `${c.porFrente["reclame-aqui"]} no RA` : null, c.porFrente.redes ? `${c.porFrente.redes} nas Redes` : null, c.porFrente.nps ? `${c.porFrente.nps} no NPS` : null].filter(Boolean).join(", ")}
                </span>
                {c.notaDoRA != null && (
                  <span className={`text-xs font-medium ${voz.notaGeralDoRA != null && c.notaDoRA < voz.notaGeralDoRA - 0.5 ? "text-rose-700" : "text-zinc-600"}`}>
                    nota do RA {um(c.notaDoRA)} ({c.avaliacoes})
                  </span>
                )}
                {c.detratores > 0 && <span className="text-xs font-medium text-rose-700">{c.detratores} {pluralDe(c.detratores, "detrator", "detratores")}</span>}
              </p>
              {c.citacoes.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {c.citacoes.map((q) => (
                    <li key={q} className="flex items-start gap-1.5 text-xs italic text-zinc-600">
                      <Quote size={11} className="mt-0.5 shrink-0 text-zinc-300" />
                      {q}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </SurfaceCard>
  );
}
