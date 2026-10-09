"use client";

import Link from "next/link";

import { useCallback, useEffect, useState } from "react";

import { AppWindow, BellPlus, CheckCheck, ClipboardCheck, Footprints, Loader2, NotebookPen, Sparkles, Undo2 } from "lucide-react";

import { desfazerAcaoDaIA, lerAcoesDeHoje } from "@/lib/actions/iaDoDia";
import { useCases } from "@/lib/context/CaseContext";
import { useJanelas } from "@/lib/context/JanelasContext";
import { useToast } from "@/lib/context/ToastContext";
import { ROTULO_DA_ORIGEM, VERBO_DA_ACAO, type AcaoDaIAView, type TipoDeAcao } from "@/lib/models/iaDoDia";
import type { PedidoDeJanela } from "@/lib/models/janelas";

import { EVENTO_DA_IA_DO_DIA } from "@/components/iaDoDia/VigiaDaIaDoDia";

const ICONE: Record<TipoDeAcao, typeof BellPlus> = {
  lembrete: BellPlus,
  anotacao: NotebookPen,
  feito: CheckCheck,
  completou: ClipboardCheck,
  etapa: Footprints,
  aviso: Sparkles,
};


const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

/**
 * "O que eu fiz hoje", dentro do assistente (09/10/2026).
 *
 * Era uma seção do Meu dia ("O que a IA fez hoje") — e ele pediu: "não
 * quero que a IA apareça dessa forma no meu dia; pode ser na parte do
 * ícone do assistente, e assim ter 'o que eu fiz hoje', depois ser possível
 * abrir uma mini janela". Agora mora numa aba do balão do assistente, na
 * voz dele, e cada linha abre o caso ou o NPS numa mini janela — sem sair
 * da tela — ou desfaz.
 */
export default function OQueEuFizHoje() {
  const { notify } = useToast();
  const { cases } = useCases();
  const { abrir } = useJanelas();
  const [acoes, setAcoes] = useState<AcaoDaIAView[] | null>(null);
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

  /* O endereço da ação vira mini janela: o caso pelo protocolo ou id externo, o NPS pelo id. */
  function janelaDe(a: AcaoDaIAView): PedidoDeJanela | null {
    const href = a.href ?? "";
    const nps = href.match(/^\/nps\/([^/?#]+)/);
    if (nps) return { frente: "nps", ref: decodeURIComponent(nps[1]), titulo: a.titulo.slice(0, 60) };
    const caso = href.match(/^\/(reclame-aqui|redes-sociais)\/([^/?#]+)/);
    if (!caso) return null;
    const chave = decodeURIComponent(caso[2]);
    const achado = cases.find((c) => c.id === chave || c.protocol === chave || c.dbId === chave);
    if (!achado) return null;
    return { frente: caso[1] === "redes-sociais" ? "redes" : "reclame-aqui", ref: achado.id, titulo: `${achado.protocol} · ${achado.customer}` };
  }

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

  if (!acoes) {
    return (
      <p className="flex items-center gap-1.5 px-3.5 py-6 text-xs text-zinc-400">
        <Loader2 size={12} className="animate-spin" /> Lendo o que fiz hoje…
      </p>
    );
  }

  if (acoes.length === 0) {
    return (
      <div className="px-3.5 py-6 text-center">
        <Sparkles size={18} className="mx-auto text-violet-300" />
        <p className="mt-2 text-[13px] font-medium text-zinc-700">Ainda não fiz nada hoje.</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Enquanto a plataforma está aberta, eu lembro do que fica combinado nas conversas e no Slack, anoto o que importa na ficha e fecho o que você já fez. Tudo aparece aqui, com desfazer.
        </p>
      </div>
    );
  }

  const valendo = acoes.filter((a) => !a.desfeita).length;

  return (
    <div>
      <p className="px-3.5 pt-2.5 text-[11px] text-zinc-500">
        {valendo} {valendo === 1 ? "coisa" : "coisas"} hoje — clique para abrir numa mini janela.
      </p>
      <ul className="divide-y divide-zinc-100">
        {acoes.map((a) => {
          const Icone = ICONE[a.tipo];
          const janela = janelaDe(a);
          return (
            <li key={a.id} className={`group flex items-start gap-2.5 px-3.5 py-2 ${a.desfeita ? "opacity-50" : ""}`}>
              <Icone size={14} className="mt-0.5 shrink-0 text-violet-600" />
              <div className="min-w-0 flex-1">
                <p className={`text-[13px] leading-snug text-zinc-800 ${a.desfeita ? "line-through" : ""}`}>
                  <span className="font-medium">{VERBO_DA_ACAO[a.tipo]}:</span>{" "}
                  {janela ? (
                    <button type="button" data-sem-arrasto onClick={() => abrir(janela)} className="text-left hover:text-violet-800 hover:underline">
                      {a.titulo}
                    </button>
                  ) : a.href ? (
                    <Link href={a.href} target={a.href.startsWith("http") ? "_blank" : undefined} className="hover:text-violet-800 hover:underline">
                      {a.titulo}
                    </Link>
                  ) : (
                    a.titulo
                  )}
                </p>
                {a.detalhe && <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-zinc-500">{a.detalhe}</p>}
                <p className="mt-0.5 flex items-center gap-2 text-[10.5px] tabular-nums text-zinc-400">
                  {ROTULO_DA_ORIGEM[a.origem]} · {hora(a.criadaEm)}
                  {janela && (
                    <button
                      type="button"
                      data-sem-arrasto
                      onClick={() => abrir(janela)}
                      className="inline-flex items-center gap-0.5 font-medium text-violet-700 opacity-0 transition-opacity hover:underline focus:opacity-100 group-hover:opacity-100"
                    >
                      <AppWindow size={11} /> mini janela
                    </button>
                  )}
                </p>
              </div>
              {a.desfazivel ? (
                <button
                  type="button"
                  data-sem-arrasto
                  disabled={desfazendo === a.id}
                  onClick={() => void desfazer(a)}
                  aria-label={`Desfazer: ${a.titulo}`}
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
    </div>
  );
}
