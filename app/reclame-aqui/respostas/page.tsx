"use client";

import Link from "next/link";

import { useEffect, useMemo, useState } from "react";

import { ArrowUpRight, ChevronDown, CircleAlert, Lightbulb } from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";
import PageHeading from "@/components/shared/PageHeading";
import SurfaceCard from "@/components/shared/SurfaceCard";
import ModuleNav from "@/components/reclame-aqui/ModuleNav";

import { lerRespostasAnalisadas, type RespostaAnalisada } from "@/lib/actions/analistaDeRespostas";
import type { ProblemaDaResposta } from "@/lib/models/analistaDeRespostas";
import { descreverRegistro } from "@/lib/services/horasUteis";

const ROTULO: Record<ProblemaDaResposta, string> = {
  "sem-nome": "Sem o nome",
  "sem-validacao": "Sem acolhimento",
  "dado-pessoal": "Dado pessoal",
  "parece-macro": "Texto repetido",
  "promete-prazo": "Prazo prometido",
  "sem-caminho": "Sem o próximo passo",
  "sem-convite": "Sem convite a avaliar",
  "sem-assinatura": "Sem assinatura",
  curta: "Curta demais",
  longa: "Longa demais",
  defensiva: "Tom defensivo",
  "resolvido-sem-validar": "Resolvido sem o cliente confirmar",
};

const PERIODOS = [30, 90, 180] as const;

/**
 * O analista de respostas públicas, depois de publicar (Fase 35, 1.94).
 *
 * Cada resposta do período com uma nota de 0 a 100 e o que o documento
 * pediria diferente — a pior primeiro. Em cima, o que mais se repete:
 * é o hábito da equipe, e não a resposta isolada, que move a média. As
 * regras são as mesmas do aviso antes de publicar (ficha e extensão).
 */
export default function RespostasPage() {
  const [dias, setDias] = useState<(typeof PERIODOS)[number]>(90);
  const [dados, setDados] = useState<{ respostas: RespostaAnalisada[]; semTexto: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<ProblemaDaResposta | null>(null);

  useEffect(() => {
    let vivo = true;
    lerRespostasAnalisadas(dias).then((r) => {
      if (!vivo) return;
      if (r.ok) {
        setDados({ respostas: r.respostas, semTexto: r.semTexto });
        setErro(null);
      } else setErro(r.erro);
    });
    return () => {
      vivo = false;
    };
  }, [dias]);

  const resumo = useMemo(() => {
    if (!dados) return null;
    const conta = new Map<ProblemaDaResposta, { n: number; erro: boolean }>();
    for (const r of dados.respostas) for (const a of r.achados) {
      const atual = conta.get(a.tipo) ?? { n: 0, erro: a.tom === "perigo" };
      conta.set(a.tipo, { n: atual.n + 1, erro: atual.erro || a.tom === "perigo" });
    }
    const media = dados.respostas.length ? Math.round(dados.respostas.reduce((s, r) => s + r.nota, 0) / dados.respostas.length) : null;
    return {
      media,
      comErro: dados.respostas.filter((r) => r.achados.some((a) => a.tom === "perigo")).length,
      limpas: dados.respostas.filter((r) => r.achados.length === 0).length,
      problemas: [...conta.entries()].sort((a, b) => b[1].n - a[1].n),
    };
  }, [dados]);

  const lista = useMemo(
    () => (dados?.respostas ?? []).filter((r) => !filtro || r.achados.some((a) => a.tipo === filtro)),
    [dados, filtro]
  );

  return (
    <MainLayout>
      <div className="space-y-5">
        <PageHeading
          eyebrow="Reclame Aqui"
          title="Respostas públicas"
          description="O analista lê cada resposta publicada e aponta os erros e o que melhorar, pelas regras do documento. As mesmas regras avisam antes de publicar, na ficha e na extensão."
        />

        <ModuleNav />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl bg-zinc-100 p-1" role="tablist" aria-label="Período">
            {PERIODOS.map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={dias === p}
                onClick={() => setDias(p)}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${dias === p ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}
              >
                {p} dias
              </button>
            ))}
          </div>
          {dados && dados.semTexto > 0 && (
            <p className="text-xs text-zinc-500">{dados.semTexto} respondida(s) sem o texto ainda — ele chega na próxima leitura do portal.</p>
          )}
        </div>

        {erro && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</p>}

        {!dados && !erro && <p className="py-12 text-center text-sm text-zinc-400">Lendo as respostas…</p>}

        {dados && resumo && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Numero rotulo="Respostas analisadas" valor={String(dados.respostas.length)} />
              <Numero rotulo="Nota média" valor={resumo.media === null ? "—" : String(resumo.media)} detalhe="de 0 a 100" />
              <Numero rotulo="Com erro" valor={String(resumo.comErro)} tom={resumo.comErro ? "perigo" : undefined} detalhe="não deviam ter ido assim" />
              <Numero rotulo="Sem nada a apontar" valor={String(resumo.limpas)} tom="ok" />
            </div>

            <SurfaceCard title="O que mais se repete" description="Clique para ver só as respostas com aquele ponto. É o hábito que move a média.">
              {resumo.problemas.length === 0 ? (
                <p className="text-sm text-emerald-700">Nenhum ponto no período.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {resumo.problemas.map(([tipo, { n, erro: ehErro }]) => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setFiltro(filtro === tipo ? null : tipo)}
                      aria-pressed={filtro === tipo}
                      className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
                        filtro === tipo
                          ? "bg-violet-700 text-white ring-violet-700"
                          : ehErro
                            ? "bg-rose-50 text-rose-700 ring-rose-200 hover:bg-rose-100"
                            : "bg-zinc-50 text-zinc-700 ring-zinc-200 hover:bg-zinc-100"
                      }`}
                    >
                      {ROTULO[tipo]} · {n}
                    </button>
                  ))}
                </div>
              )}
            </SurfaceCard>

            <SurfaceCard title={filtro ? `${ROTULO[filtro]} — ${lista.length} resposta(s)` : "Cada resposta, a pior primeiro"}>
              <ul className="divide-y divide-zinc-100">
                {lista.map((r) => (
                  <li key={r.id} className="py-2.5">
                    <button type="button" onClick={() => setAberta(aberta === r.id ? null : r.id)} className="flex w-full items-center gap-3 text-left" aria-expanded={aberta === r.id}>
                      <span
                        className={`flex h-9 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-semibold tabular-nums ${
                          r.nota >= 85 ? "bg-emerald-50 text-emerald-700" : r.nota >= 60 ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-700"
                        }`}
                        title="Nota do analista, de 0 a 100"
                      >
                        {r.nota}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-zinc-800">
                          {r.protocolo} · {r.cliente}
                        </span>
                        <span className="block truncate text-xs text-zinc-500">
                          {descreverRegistro(r.publicadaEm)} · {r.achados.length ? r.achados.map((a) => ROTULO[a.tipo]).join(", ") : "nada a apontar"}
                        </span>
                      </span>
                      <ChevronDown size={15} className={`shrink-0 text-zinc-400 transition-transform ${aberta === r.id ? "rotate-180" : ""}`} />
                    </button>

                    {aberta === r.id && (
                      <div className="mt-2 grid gap-3 pl-14 lg:grid-cols-2">
                        <p className="whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-[13px] leading-relaxed text-zinc-700">{r.texto}</p>
                        <div className="space-y-2">
                          {r.achados.length === 0 ? (
                            <p className="text-sm text-emerald-700">Segue o documento.</p>
                          ) : (
                            r.achados.map((a) => (
                              <p key={a.tipo} className={`flex items-start gap-2 text-sm ${a.tom === "perigo" ? "text-rose-700" : "text-zinc-700"}`}>
                                {a.tom === "perigo" ? <CircleAlert size={14} className="mt-0.5 shrink-0" /> : <Lightbulb size={14} className="mt-0.5 shrink-0 text-amber-600" />}
                                {a.texto}
                              </p>
                            ))
                          )}
                          <Link href={`/reclame-aqui/${r.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 hover:underline">
                            Abrir a reclamação <ArrowUpRight size={12} />
                          </Link>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
                {lista.length === 0 && <li className="py-8 text-center text-sm text-zinc-400">Nenhuma resposta publicada no período.</li>}
              </ul>
            </SurfaceCard>
          </>
        )}
      </div>
    </MainLayout>
  );
}

function Numero({ rotulo, valor, detalhe, tom }: { rotulo: string; valor: string; detalhe?: string; tom?: "perigo" | "ok" }) {
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{rotulo}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tom === "perigo" ? "text-rose-700" : tom === "ok" ? "text-emerald-700" : "text-zinc-900"}`}>{valor}</p>
      {detalhe && <p className="text-xs text-zinc-500">{detalhe}</p>}
    </div>
  );
}
