"use client";

import Link from "next/link";

import { useMemo, useState } from "react";

import {
  ArrowUpRight,
  Cog,
  LayoutGrid,
  MapPin,
  Megaphone,
  MessageCircle,
  Puzzle,
  Search,
  Sparkles,
  Star,
  TrendingUp,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";

import {
  MUDANCAS,
  REVISAO,
  TIPOS_DE_MUDANCA,
  buscarMudancas,
  contarPorTipo,
  type Mudanca,
  type TipoDeMudanca,
} from "@/lib/models/mudancas";
import { FRENTES_DAS_NOVIDADES, type FrenteDaNovidade } from "@/lib/models/novidades";
import { pluralDe } from "@/lib/plural";
import { cn } from "@/lib/utils";

/**
 * A revisão geral, item por item (out/2026).
 *
 * O alto responde "quanto mudou e de que tipo" em quatro números que são
 * também o filtro; a lista responde "o que, onde e por quê", agrupada pela
 * frente onde a pessoa vai encontrar a mudança. Cada item tem âncora
 * (#id) para ser citado num grupo de trabalho.
 */

const ESTILO_DO_TIPO: Record<TipoDeMudanca, { icone: LucideIcon; selo: string; numero: string }> = {
  novo: { icone: Sparkles, selo: "bg-violet-50 text-violet-700 ring-violet-200/70", numero: "text-violet-700" },
  melhoria: { icone: TrendingUp, selo: "bg-sky-50 text-sky-700 ring-sky-200/70", numero: "text-sky-700" },
  correcao: { icone: Wrench, selo: "bg-amber-50 text-amber-800 ring-amber-200/70", numero: "text-amber-700" },
};

const ICONE_DA_FRENTE: Record<FrenteDaNovidade, LucideIcon> = {
  extensao: Puzzle,
  "reclame-aqui": Megaphone,
  nps: Star,
  redes: MessageCircle,
  google: MapPin,
  plataforma: LayoutGrid,
  bastidores: Cog,
};

/* A extensão primeiro: é o centro da revisão. Depois as frentes, e por último o que é por dentro. */
const ORDEM: FrenteDaNovidade[] = ["extensao", "reclame-aqui", "nps", "redes", "google", "plataforma", "bastidores"];
const FRENTES = ORDEM.map((id) => FRENTES_DAS_NOVIDADES.find((f) => f.id === id)).filter((f): f is (typeof FRENTES_DAS_NOVIDADES)[number] => Boolean(f));

const dataLonga = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", timeZone: "UTC" });

export default function RevisaoGeral({ novas }: { novas: Set<string> }) {

  const [tipo, setTipo] = useState<TipoDeMudanca | null>(null);
  const [frente, setFrente] = useState<FrenteDaNovidade | null>(null);
  const [termo, setTermo] = useState("");

  const total = contarPorTipo(MUDANCAS);

  const visiveis = useMemo(
    () =>
      buscarMudancas(MUDANCAS, termo).filter(
        (m) => (!tipo || m.tipo === tipo) && (!frente || m.frente === frente)
      ),
    [termo, tipo, frente]
  );

  /* As frentes na ordem do cadastro, só as que têm item — com a contagem do filtro de tipo e da busca. */
  const porFrente = useMemo(() => {
    const base = buscarMudancas(MUDANCAS, termo).filter((m) => !tipo || m.tipo === tipo);
    return FRENTES.map((f) => ({ ...f, total: base.filter((m) => m.frente === f.id).length })).filter((f) => f.total > 0);
  }, [termo, tipo]);

  /* O mais novo primeiro; no mesmo dia, a ordem do cadastro (o sort é estável). */
  const grupos = FRENTES.map((f) => ({
    ...f,
    itens: visiveis.filter((m) => m.frente === f.id).sort((a, b) => b.dia.localeCompare(a.dia)),
  })).filter((g) => g.itens.length > 0);

  const filtrando = Boolean(tipo || frente || termo.trim());

  return (
    <section aria-labelledby="revisao" className="space-y-5">

      {/* ---- o alto: o que é a revisão e quanto mudou ---- */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="border-b border-zinc-100 px-5 py-4 sm:px-6">
          <p className="flex items-center gap-2 text-xs font-medium text-violet-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
            </span>
            Em andamento · desde {dataLonga(REVISAO.inicio)}
          </p>
          <h2 id="revisao" className="mt-1 text-lg font-semibold tracking-tight text-zinc-900">{REVISAO.titulo}</h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-zinc-500">{REVISAO.texto}</p>
        </div>

        <div className="grid grid-cols-2 divide-zinc-100 sm:grid-cols-4 sm:divide-x">
          <BotaoDoNumero
            ativo={tipo === null}
            onClick={() => setTipo(null)}
            numero={MUDANCAS.length}
            rotulo={pluralDe(MUDANCAS.length, "mudança", "mudanças")}
            classeDoNumero="text-zinc-900"
          />
          {TIPOS_DE_MUDANCA.map((t) => {
            const Icone = ESTILO_DO_TIPO[t.id].icone;
            return (
              <BotaoDoNumero
                key={t.id}
                ativo={tipo === t.id}
                onClick={() => setTipo(tipo === t.id ? null : t.id)}
                numero={total[t.id]}
                rotulo={t.plural.toLowerCase()}
                icone={<Icone size={13} aria-hidden />}
                classeDoNumero={ESTILO_DO_TIPO[t.id].numero}
              />
            );
          })}
        </div>
      </div>

      {/* ---- filtro por frente e busca ---- */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div role="group" aria-label="Filtrar por frente" className="flex flex-wrap gap-1.5">
          <Chip ativo={frente === null} onClick={() => setFrente(null)} rotulo="Todas as frentes" />
          {porFrente.map((f) => {
            const Icone = ICONE_DA_FRENTE[f.id];
            return (
              <Chip
                key={f.id}
                ativo={frente === f.id}
                onClick={() => setFrente(frente === f.id ? null : f.id)}
                rotulo={f.nome}
                numero={f.total}
                icone={<Icone size={12} aria-hidden />}
              />
            );
          })}
        </div>
        <label className="relative ml-auto w-full sm:w-64">
          <span className="sr-only">Buscar nas mudanças</span>
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden />
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Buscar: popup, plural, caso…"
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
          {visiveis.length} de {MUDANCAS.length} · {" "}
          <button type="button" onClick={() => { setTipo(null); setFrente(null); setTermo(""); }} className="font-medium text-zinc-700 underline-offset-2 hover:text-violet-700 hover:underline">
            ver tudo
          </button>
        </p>
      )}

      {/* ---- os itens, por frente ---- */}
      {grupos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 px-5 py-10 text-center">
          <p className="text-sm font-medium text-zinc-800">Nada com esse filtro.</p>
          <p className="mt-1 text-xs text-zinc-500">Tente outra palavra ou volte para todas as frentes.</p>
        </div>
      ) : (
        grupos.map((g) => {
          const Icone = ICONE_DA_FRENTE[g.id];
          return (
            <div key={g.id}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-zinc-100 text-zinc-600">
                  <Icone size={13} aria-hidden />
                </span>
                {g.nome}
                <span className="text-xs font-normal tabular-nums text-zinc-400">{g.itens.length}</span>
              </h3>
              <ol className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                {g.itens.map((m) => (
                  <ItemDaMudanca key={m.id} mudanca={m} nova={novas.has(m.id)} />
                ))}
              </ol>
            </div>
          );
        })
      )}
    </section>
  );
}

function ItemDaMudanca({ mudanca: m, nova }: { mudanca: Mudanca; nova: boolean }) {
  const estilo = ESTILO_DO_TIPO[m.tipo];
  const Icone = estilo.icone;
  const nomeDoTipo = TIPOS_DE_MUDANCA.find((t) => t.id === m.tipo)?.nome ?? m.tipo;

  return (
    <li id={m.id} className="group grid scroll-mt-24 gap-x-4 gap-y-1.5 px-4 py-3.5 target:bg-violet-50/40 sm:grid-cols-[96px_minmax(0,1fr)] sm:px-5">
      <div className="flex items-center gap-2 sm:flex-col sm:items-start sm:gap-1">
        <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset", estilo.selo)}>
          <Icone size={11} aria-hidden />
          {nomeDoTipo}
        </span>
        {/* O dia da mudança: com mais de cem itens, é o que diz o que entrou hoje (out/2026). */}
        <time dateTime={m.dia} className="text-[11px] tabular-nums text-zinc-400">
          {dataLonga(m.dia)}
        </time>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h4 className="text-[13.5px] font-semibold leading-snug text-zinc-900">{m.titulo}</h4>
          {nova && <span className="h-1.5 w-1.5 rounded-full bg-violet-500" title="Novo desde a sua última visita" />}
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">{m.texto}</p>
        {(m.href || m.onde) && (
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {m.onde && <span className="text-zinc-400">{m.onde}</span>}
            {m.href && (
              <Link href={m.href} className="flex items-center gap-0.5 font-medium text-zinc-700 hover:text-violet-700">
                Onde fica <ArrowUpRight size={12} />
              </Link>
            )}
          </p>
        )}
      </div>
    </li>
  );
}

function BotaoDoNumero({
  ativo,
  onClick,
  numero,
  rotulo,
  icone,
  classeDoNumero,
}: {
  ativo: boolean;
  onClick: () => void;
  numero: number;
  rotulo: string;
  icone?: React.ReactNode;
  classeDoNumero: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "flex flex-col items-start gap-0.5 border-t border-zinc-100 px-5 py-3.5 text-left transition-colors first:border-t-0 sm:border-t-0 sm:px-6 [&:nth-child(2)]:border-t-0 sm:[&:nth-child(2)]:border-t-0",
        ativo ? "bg-zinc-50" : "hover:bg-zinc-50/60"
      )}
    >
      <span className={cn("text-2xl font-semibold tabular-nums tracking-tight", classeDoNumero)}>{numero}</span>
      <span className={cn("flex items-center gap-1 text-xs", ativo ? "font-medium text-zinc-800" : "text-zinc-500")}>
        {icone}
        {rotulo}
      </span>
    </button>
  );
}

function Chip({ ativo, onClick, rotulo, numero, icone }: { ativo: boolean; onClick: () => void; rotulo: string; numero?: number; icone?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
        ativo ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
      )}
    >
      {icone}
      {rotulo}
      {numero !== undefined && <span className={cn("tabular-nums", ativo ? "text-white/60" : "text-zinc-400")}>{numero}</span>}
    </button>
  );
}
