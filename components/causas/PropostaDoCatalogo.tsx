"use client";

import { useState } from "react";

import { Check, Loader2 } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { frente as frenteDaOperacao, FRENTES_DA_OPERACAO } from "@/lib/models/frentes";
import {
  AREAS_DAS_CAUSAS,
  causaDaLinha,
  MINIMO_PARA_PROPOR,
  PRAZOS_DAS_CAUSAS,
  rotuloDoPrazo,
  type CausaAprovada,
  type PropostaDoCatalogo as Proposta,
} from "@/lib/models/catalogoDeCausas";

type Escolha = { marcada: boolean; area: string; prazoHoras: number };

type Resultado = { ok: true; criadas: number; atualizadas: number } | { ok: false; erro: string };

const pct = (parte: number, todo: number) => (todo ? Math.round((parte / todo) * 100) : 0);

/**
 * A proposta de catálogo (Fase 27): as famílias que os registros reais
 * trazem, com a contagem por frente, dois exemplos e a área e o prazo
 * que a pessoa confirma antes de aprovar.
 *
 * Vem marcada a família com pelo menos três registros que ainda não
 * está no catálogo; o resto fica à vista, desmarcado. Nada é gravado
 * antes do botão.
 */
export default function PropostaDoCatalogo({ proposta, aoAprovar }: { proposta: Proposta; aoAprovar: (itens: CausaAprovada[]) => Promise<Resultado> }) {

  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>(() =>
    Object.fromEntries(
      proposta.linhas.map((l) => [l.familia.id, { marcada: l.total >= MINIMO_PARA_PROPOR && !l.jaNoCatalogo, area: l.familia.area, prazoHoras: l.familia.prazoHoras }])
    )
  );
  const [gravando, setGravando] = useState(false);
  const [saida, setSaida] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);

  const cabem = proposta.base - proposta.semFamilia.total;
  const marcadas = proposta.linhas.filter((l) => escolhas[l.familia.id]?.marcada);

  function mudar(id: string, mudanca: Partial<Escolha>) {
    setEscolhas((atual) => ({ ...atual, [id]: { ...atual[id], ...mudanca } }));
    setSaida(null);
  }

  async function aprovar() {
    setGravando(true);
    setSaida(null);
    const r = await aoAprovar(marcadas.map((l) => causaDaLinha(l, escolhas[l.familia.id])));
    setGravando(false);
    if (!r.ok) {
      setSaida({ tom: "erro", texto: r.erro });
      return;
    }
    setSaida({
      tom: "ok",
      texto: [r.criadas ? `${r.criadas} causa(s) nova(s) no catálogo` : "", r.atualizadas ? `${r.atualizadas} com área e prazo atualizados` : ""].filter(Boolean).join(" e ") + ".",
    });
    setEscolhas((atual) => Object.fromEntries(Object.entries(atual).map(([id, e]) => [id, { ...e, marcada: false }])));
  }

  if (proposta.base === 0) {
    return (
      <SurfaceCard title="Catálogo tirado da base" description="A proposta sai dos relatos, comentários e avaliações já registrados.">
        <p className="text-sm text-zinc-500">Ainda não há texto registrado para agrupar — importe os casos do Reclame Aqui e as respostas do NPS primeiro.</p>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard
      title="Catálogo tirado da base"
      description="Os assuntos que se repetem nos relatos, comentários e avaliações — cada um com a área que resolve e o prazo. Confira, ajuste e aprove."
    >
      <p className="text-sm text-zinc-600">
        <strong className="tabular-nums text-zinc-900">{proposta.base}</strong> registros com texto:{" "}
        {FRENTES_DA_OPERACAO.filter((f) => proposta.basePorFrente[f.id]).map((f, i) => (
          <span key={f.id}>
            {i > 0 && " · "}
            {f.curto} <span className="tabular-nums">{proposta.basePorFrente[f.id]}</span>
          </span>
        ))}
        . <strong className="tabular-nums text-zinc-900">{pct(cabem, proposta.base)}%</strong> cabem numa das causas abaixo.
      </p>

      <ul className="mt-4 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
        {proposta.linhas.map((l) => {
          const e = escolhas[l.familia.id];
          const id = `familia-${l.familia.id}`;
          return (
            <li key={l.familia.id} className={`px-3.5 py-3 ${e.marcada ? "bg-violet-50/40" : ""}`}>
              <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                <input id={id} type="checkbox" checked={e.marcada} onChange={(ev) => mudar(l.familia.id, { marcada: ev.target.checked })} className="mt-1 h-4 w-4 accent-violet-600" />
                <div className="min-w-0 flex-1 basis-64">
                  <label htmlFor={id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-semibold text-zinc-900">{l.familia.nome}</span>
                    <span className="tabular-nums text-zinc-500">{l.total} registro(s)</span>
                    {l.total < MINIMO_PARA_PROPOR && <span className="text-xs text-zinc-400">pouco caso para virar causa sozinha</span>}
                    {l.jaNoCatalogo && <span className="rounded bg-emerald-50 px-1.5 text-xs font-medium text-emerald-700">já no catálogo — marcar atualiza área e prazo</span>}
                  </label>
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{l.familia.descricao}</p>
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-500">
                    {FRENTES_DA_OPERACAO.filter((f) => l.porFrente[f.id]).map((f) => (
                      <span key={f.id} className="inline-flex items-center gap-1">
                        <i className="inline-block h-2 w-2 rounded-sm" style={{ background: f.cor }} />
                        {f.curto} <span className="tabular-nums">{l.porFrente[f.id]}</span>
                      </span>
                    ))}
                    {l.detalhaAtuais.length > 0 && <span>detalha: {l.detalhaAtuais.join(", ")}</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs">
                  <label className="sr-only" htmlFor={`${id}-area`}>Área de {l.familia.nome}</label>
                  <select id={`${id}-area`} value={e.area} onChange={(ev) => mudar(l.familia.id, { area: ev.target.value })} className="h-8 rounded-lg border border-zinc-200 bg-white px-2 text-xs text-zinc-700">
                    {AREAS_DAS_CAUSAS.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                  <label className="sr-only" htmlFor={`${id}-prazo`}>Prazo de {l.familia.nome}</label>
                  <select id={`${id}-prazo`} value={e.prazoHoras} onChange={(ev) => mudar(l.familia.id, { prazoHoras: Number(ev.target.value) })} className="h-8 rounded-lg border border-zinc-200 bg-white px-2 text-xs text-zinc-700">
                    {PRAZOS_DAS_CAUSAS.map((h) => (
                      <option key={h} value={h}>
                        {rotuloDoPrazo(h)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {l.exemplos.length > 0 && (
                <ul className="mt-2 space-y-1 pl-7">
                  {l.exemplos.map((x) => (
                    <li key={x.ref} className="text-xs leading-relaxed text-zinc-600">
                      <span className="font-medium" style={{ color: frenteDaOperacao(x.frente).cor }}>
                        {x.ref}
                      </span>
                      : “{x.trecho}”
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {proposta.semFamilia.total > 0 && (
        <div className="mt-4 rounded-xl bg-zinc-50 px-3.5 py-3">
          <p className="text-sm text-zinc-700">
            <strong className="tabular-nums">{proposta.semFamilia.total}</strong> registro(s) não couberam em nenhuma — as palavras que mais se repetem neles são candidatas a causa nova:
          </p>
          {proposta.semFamilia.palavras.length > 0 ? (
            <p className="mt-2 flex flex-wrap gap-1.5">
              {proposta.semFamilia.palavras.map((p) => (
                <span key={p.palavra} className="rounded-md bg-white px-2 py-0.5 text-xs text-zinc-700 ring-1 ring-inset ring-zinc-200">
                  {p.palavra} <span className="tabular-nums text-zinc-400">{p.registros}</span>
                </span>
              ))}
            </p>
          ) : (
            <p className="mt-1 text-xs text-zinc-500">Nenhuma palavra se repete neles — são casos soltos.</p>
          )}
          <ul className="mt-2 space-y-1">
            {proposta.semFamilia.exemplos.map((x) => (
              <li key={x.ref} className="truncate text-xs text-zinc-500">
                {x.ref}: “{x.trecho}”
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex min-h-9 flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={gravando || marcadas.length === 0}
          onClick={aprovar}
          className="flex items-center gap-1.5 rounded-lg bg-violet-700 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
        >
          {gravando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Aprovar {marcadas.length} causa(s)
        </button>
        <p role="status" className={`text-sm ${saida?.tom === "erro" ? "text-rose-700" : "text-emerald-700"}`}>
          {saida?.texto ?? (marcadas.length ? "As causas de antes continuam: os registros antigos apontam para elas." : "")}
        </p>
      </div>
    </SurfaceCard>
  );
}
