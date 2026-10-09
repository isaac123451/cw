"use client";

import Link from "next/link";

import { useCallback, useEffect, useState } from "react";

import { BellPlus, CheckCheck, ClipboardCheck, Footprints, NotebookPen, Sparkles, Undo2 } from "lucide-react";

import { desfazerAcaoDaIA, lerAcoesDeHoje } from "@/lib/actions/iaDoDia";
import { useToast } from "@/lib/context/ToastContext";
import { ROTULO_DA_ORIGEM, type AcaoDaIAView, type TipoDeAcao } from "@/lib/models/iaDoDia";

import { EVENTO_DA_IA_DO_DIA } from "@/components/iaDoDia/VigiaDaIaDoDia";

const ICONE: Record<TipoDeAcao, typeof BellPlus> = {
  lembrete: BellPlus,
  anotacao: NotebookPen,
  feito: CheckCheck,
  completou: ClipboardCheck,
  etapa: Footprints,
  aviso: Sparkles,
};

const VERBO: Record<TipoDeAcao, string> = {
  lembrete: "Lembrete",
  anotacao: "Anotou",
  feito: "Fechou",
  completou: "Completou",
  etapa: "Registrou",
  aviso: "Aviso",
};

const MOSTRAR = 6;

const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

/**
 * O que a IA fez hoje, no Meu dia (08/10/2026).
 *
 * Uma linha por ação — o que foi, de onde veio, quando — e o "Desfazer" de
 * cada uma. Some quando ela não fez nada: lista vazia é ruído.
 */
export default function OQueAIaFez() {
  const { notify } = useToast();
  const [acoes, setAcoes] = useState<AcaoDaIAView[] | null>(null);
  const [todas, setTodas] = useState(false);
  const [desfazendo, setDesfazendo] = useState<string | null>(null);

  const carregar = useCallback(() => {
    lerAcoesDeHoje()
      .then((r) => setAcoes(r.ok ? r.acoes : []))
      .catch(() => setAcoes([]));
  }, []);

  useEffect(() => {
    carregar();
    window.addEventListener(EVENTO_DA_IA_DO_DIA, carregar);
    return () => window.removeEventListener(EVENTO_DA_IA_DO_DIA, carregar);
  }, [carregar]);

  if (!acoes || acoes.length === 0) return null;

  const valendo = acoes.filter((a) => !a.desfeita).length;
  const vistas = todas ? acoes : acoes.slice(0, MOSTRAR);

  async function desfazer(a: AcaoDaIAView) {
    setDesfazendo(a.id);
    const r = await desfazerAcaoDaIA(a.id).catch(() => ({ ok: false as const, erro: "Sem conexão agora." }));
    setDesfazendo(null);
    if (!r.ok) {
      notify({ tone: "error", title: "Não deu para desfazer.", detail: r.erro });
      return;
    }
    notify({ tone: "success", title: "Desfeito.", detail: a.titulo });
    carregar();
  }

  return (
    <section id="ia-do-dia" aria-label="O que a IA fez hoje" className="rounded-xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-zinc-100 px-4 py-2">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-zinc-900">
          <Sparkles size={14} className="text-violet-600" /> O que a IA fez hoje
        </p>
        <p className="text-xs text-zinc-500">
          {valendo} {valendo === 1 ? "ação" : "ações"} — lembretes, anotações e o que ela viu que você já fez. Tudo dá para desfazer.
        </p>
      </header>
      <ul className="divide-y divide-zinc-100">
        {vistas.map((a) => {
          const Icone = ICONE[a.tipo];
          return (
            <li key={a.id} className={`flex items-start gap-3 px-4 py-2 ${a.desfeita ? "opacity-50" : ""}`}>
              <Icone size={14} className="mt-0.5 shrink-0 text-violet-600" />
              <div className="min-w-0 flex-1">
                <p className={`text-[13px] text-zinc-800 ${a.desfeita ? "line-through" : ""}`}>
                  <span className="font-medium">{VERBO[a.tipo]}:</span>{" "}
                  {a.href ? (
                    <Link href={a.href} target={a.href.startsWith("http") ? "_blank" : undefined} className="hover:underline">
                      {a.titulo}
                    </Link>
                  ) : (
                    a.titulo
                  )}
                </p>
                {a.detalhe && <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-500">{a.detalhe}</p>}
              </div>
              <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">
                {ROTULO_DA_ORIGEM[a.origem]} · {hora(a.criadaEm)}
              </span>
              {a.desfazivel ? (
                <button
                  type="button"
                  disabled={desfazendo === a.id}
                  onClick={() => void desfazer(a)}
                  className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-50"
                >
                  <Undo2 size={12} /> Desfazer
                </button>
              ) : a.desfeita ? (
                <span className="shrink-0 text-[11px] text-zinc-400">desfeito</span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {acoes.length > MOSTRAR && (
        <button type="button" onClick={() => setTodas((v) => !v)} className="w-full border-t border-zinc-100 px-4 py-1.5 text-left text-xs font-medium text-violet-700 hover:bg-zinc-50">
          {todas ? "Mostrar menos" : `Ver as ${acoes.length}`}
        </button>
      )}
    </section>
  );
}
