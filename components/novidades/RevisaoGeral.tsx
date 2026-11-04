"use client";

import Link from "next/link";

import { useMemo, useState } from "react";

import { ArrowUpRight, ChevronDown, Search, Sparkles, TrendingUp, Wrench, X, type LucideIcon } from "lucide-react";

import { MUDANCAS, TIPOS_DE_MUDANCA, buscarMudancas, periodoDaMudanca, type Mudanca, type TipoDeMudanca } from "@/lib/models/mudancas";
import { FRENTES_DAS_NOVIDADES, type FrenteDaNovidade } from "@/lib/models/novidades";
import { cn } from "@/lib/utils";

/**
 * As mudanças da revisão (refeita em 04/11/2026).
 *
 * A versão anterior abria com "247 para você conhecer", quatro números
 * grandes e os itens agrupados por frente, cada um com o parágrafo inteiro
 * aberto. Quem abre Novidades quer saber "o que mudou desde que eu olhei"
 * e "o que eu posso usar agora" — e, com TDAH, uma parede de texto não é
 * lida. Agora:
 *
 * - **Para experimentar:** as três novidades mais recentes, com o link.
 * - **A linha do tempo:** por período (hoje, ontem, esta semana…), um item
 *   por linha; o texto abre no clique.
 * - O que é "por dentro" (conferências, build) fica fora até ser pedido.
 */

const ESTILO_DO_TIPO: Record<TipoDeMudanca, { icone: LucideIcon; selo: string; ponto: string }> = {
  novo: { icone: Sparkles, selo: "bg-violet-50 text-violet-700 ring-violet-200/70", ponto: "bg-violet-500" },
  melhoria: { icone: TrendingUp, selo: "bg-sky-50 text-sky-700 ring-sky-200/70", ponto: "bg-sky-500" },
  correcao: { icone: Wrench, selo: "bg-amber-50 text-amber-800 ring-amber-200/70", ponto: "bg-amber-500" },
};

const nomeDaFrente = (id: FrenteDaNovidade) => FRENTES_DAS_NOVIDADES.find((f) => f.id === id)?.nome ?? id;

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Hoje em Brasília, AAAA-MM-DD — o mesmo no servidor e no navegador. */
function hojeEmBrasilia() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

const dataCurta = (iso: string) => `${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1].slice(0, 3)}`;

/* Quantos períodos aparecem antes do "mostrar mais". */
const PERIODOS_DE_SAIDA = 4;

export default function RevisaoGeral({ novas }: { novas: Set<string> }) {
  const [tipo, setTipo] = useState<TipoDeMudanca | null>(null);
  const [frente, setFrente] = useState<FrenteDaNovidade | "todas">("todas");
  const [termo, setTermo] = useState("");
  const [periodos, setPeriodos] = useState(PERIODOS_DE_SAIDA);
  const [hoje] = useState(hojeEmBrasilia);

  /* "Por dentro" só quando escolhido: é a confiança na plataforma, não o que se usa. */
  const doFiltro = useMemo(
    () =>
      buscarMudancas(MUDANCAS, termo)
        .filter((m) => (frente === "todas" ? m.frente !== "bastidores" : m.frente === frente))
        .filter((m) => !tipo || m.tipo === tipo)
        .sort((a, b) => b.dia.localeCompare(a.dia)),
    [termo, frente, tipo]
  );

  const grupos = useMemo(() => {
    const mapa = new Map<string, Mudanca[]>();
    for (const m of doFiltro) {
      const p = periodoDaMudanca(m.dia, hoje);
      mapa.set(p, [...(mapa.get(p) ?? []), m]);
    }
    return [...mapa.entries()];
  }, [doFiltro, hoje]);

  /* As três para experimentar: novidades com lugar para abrir, as não vistas primeiro. */
  const paraExperimentar = useMemo(() => {
    const novos = MUDANCAS.filter((m) => m.tipo === "novo" && m.frente !== "bastidores" && (m.href || m.onde)).sort((a, b) => b.dia.localeCompare(a.dia));
    return [...novos.filter((m) => novas.has(m.id)), ...novos.filter((m) => !novas.has(m.id))].slice(0, 3);
  }, [novas]);

  const filtrando = Boolean(tipo || frente !== "todas" || termo.trim());
  const frentes = FRENTES_DAS_NOVIDADES.filter((f) => MUDANCAS.some((m) => m.frente === f.id));

  return (
    <section aria-label="Mudanças" className="space-y-8">
      {!filtrando && paraExperimentar.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Para experimentar</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {paraExperimentar.map((m) => (
              <CartaoParaExperimentar key={m.id} mudanca={m} nova={novas.has(m.id)} />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Filtrar por tipo" className="flex rounded-lg border border-zinc-200 bg-white p-0.5">
            {[{ id: null, nome: "Tudo" }, ...TIPOS_DE_MUDANCA.map((t) => ({ id: t.id, nome: t.plural }))].map((t) => (
              <button
                key={t.id ?? "tudo"}
                type="button"
                aria-pressed={tipo === t.id}
                onClick={() => setTipo(t.id)}
                className={cn("flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors", tipo === t.id ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-900")}
              >
                {t.id && <span className={cn("h-1.5 w-1.5 rounded-full", ESTILO_DO_TIPO[t.id].ponto)} aria-hidden />}
                {t.nome}
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor="frente-das-mudancas">
            Frente
          </label>
          <select
            id="frente-das-mudancas"
            value={frente}
            onChange={(e) => setFrente(e.target.value as FrenteDaNovidade | "todas")}
            className="h-8 rounded-lg border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700 outline-none focus:border-violet-300"
          >
            <option value="todas">Todas as frentes</option>
            {frentes.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
          <label className="relative ml-auto w-full sm:w-60">
            <span className="sr-only">Buscar nas mudanças</span>
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden />
            <input
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Buscar: vigia, popup, NPS…"
              className="h-8 w-full rounded-lg border border-zinc-200 bg-white pl-8 pr-7 text-[13px] text-zinc-800 placeholder:text-zinc-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-100"
            />
            {termo && (
              <button type="button" onClick={() => setTermo("")} aria-label="Limpar a busca" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-400 hover:text-zinc-700">
                <X size={13} />
              </button>
            )}
          </label>
        </div>

        {filtrando && (
          <p className="text-xs text-zinc-500">
            {doFiltro.length === 1 ? "1 mudança" : `${doFiltro.length} mudanças`} ·{" "}
            <button
              type="button"
              onClick={() => {
                setTipo(null);
                setFrente("todas");
                setTermo("");
              }}
              className="font-medium text-zinc-700 underline-offset-2 hover:text-violet-700 hover:underline"
            >
              limpar
            </button>
          </p>
        )}

        {grupos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 px-5 py-10 text-center">
            <p className="text-sm font-medium text-zinc-800">Nada com esse filtro.</p>
            <p className="mt-1 text-xs text-zinc-500">Tente outra palavra ou volte para todas as frentes.</p>
          </div>
        ) : (
          <>
            {(filtrando ? grupos : grupos.slice(0, periodos)).map(([periodo, itens]) => (
              <div key={periodo}>
                <h3 className="mb-1.5 flex items-baseline gap-2 text-sm font-semibold text-zinc-900">
                  {periodo}
                  <span className="text-xs font-normal tabular-nums text-zinc-400">{itens.length}</span>
                </h3>
                <ol className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200/80 bg-white">
                  {itens.map((m) => (
                    <LinhaDaMudanca key={m.id} mudanca={m} nova={novas.has(m.id)} />
                  ))}
                </ol>
              </div>
            ))}
            {!filtrando && grupos.length > periodos && (
              <button type="button" onClick={() => setPeriodos((n) => n + 3)} className="flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-violet-700">
                <ChevronDown size={13} aria-hidden />
                Mais antigas
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function CartaoParaExperimentar({ mudanca: m, nova }: { mudanca: Mudanca; nova: boolean }) {
  return (
    <article className="flex flex-col rounded-xl border border-zinc-200/80 bg-white p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-violet-700">
        <Sparkles size={12} aria-hidden />
        {nomeDaFrente(m.frente)} · {dataCurta(m.dia)}
        {nova && <span className="h-1.5 w-1.5 rounded-full bg-violet-500" title="Novo desde a sua última visita" />}
      </p>
      <h3 className="mt-1.5 text-sm font-semibold leading-snug text-zinc-900">{m.titulo}</h3>
      <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-zinc-600">{m.texto}</p>
      <div className="mt-auto pt-3 text-xs">
        {m.href ? (
          <Link href={m.href} className="inline-flex items-center gap-0.5 font-medium text-violet-700 hover:text-violet-900">
            Abrir <ArrowUpRight size={12} />
          </Link>
        ) : (
          <span className="text-zinc-500">{m.onde}</span>
        )}
      </div>
    </article>
  );
}

function LinhaDaMudanca({ mudanca: m, nova }: { mudanca: Mudanca; nova: boolean }) {
  const [aberta, setAberta] = useState(false);
  const estilo = ESTILO_DO_TIPO[m.tipo];
  const nomeDoTipo = TIPOS_DE_MUDANCA.find((t) => t.id === m.tipo)?.nome ?? m.tipo;
  return (
    <li id={m.id} className="scroll-mt-24 target:bg-violet-50/40">
      <button type="button" onClick={() => setAberta((v) => !v)} aria-expanded={aberta} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-50/70">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", estilo.ponto)} title={nomeDoTipo} aria-hidden />
        <span className="sr-only">{nomeDoTipo}:</span>
        <span className="min-w-0 flex-1 truncate text-[13.5px] text-zinc-900">{m.titulo}</span>
        {nova && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" title="Novo desde a sua última visita" />}
        <span className="hidden shrink-0 text-xs text-zinc-400 sm:inline">{nomeDaFrente(m.frente)}</span>
        <ChevronDown size={14} className={cn("shrink-0 text-zinc-400 transition-transform", aberta && "rotate-180")} aria-hidden />
      </button>
      {aberta && (
        <div className="px-4 pb-3.5 pl-9">
          <p className="text-[13px] leading-relaxed text-zinc-600">{m.texto}</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset", estilo.selo)}>{nomeDoTipo}</span>
            <span className="text-zinc-400">{dataCurta(m.dia)} · {nomeDaFrente(m.frente)}</span>
            {m.onde && <span className="text-zinc-400">{m.onde}</span>}
            {m.href && (
              <Link href={m.href} className="flex items-center gap-0.5 font-medium text-zinc-700 hover:text-violet-700">
                Abrir <ArrowUpRight size={12} />
              </Link>
            )}
          </p>
        </div>
      )}
    </li>
  );
}
