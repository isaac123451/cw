"use client";

import Link from "next/link";

import { useEffect, useMemo, useState } from "react";

import { ClipboardCopy, Flame, TrendingUp } from "lucide-react";

import { useCases } from "@/lib/context/CaseContext";
import { useNps } from "@/lib/context/NpsContext";
import { useToast } from "@/lib/context/ToastContext";
import { useAgora } from "@/lib/hooks/useAgora";
import { oQueMoveANota, placarDaSemana, textoDoResumoDaSemana, type NumerosDaJanela } from "@/lib/models/motivacaoDoDia";

import type { useMeuDia } from "@/components/rotina/useMeuDia";

type MeuDia = ReturnType<typeof useMeuDia>;

const um = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

interface Casa {
  chave: keyof NumerosDaJanela;
  rotulo: string;
  href: string;
  /** O "de quantos", quando existe. */
  de?: keyof NumerosDaJanela;
}

const CASAS: Casa[] = [
  { chave: "avaliacoes", rotulo: "avaliações positivas", href: "/reclame-aqui/avaliacoes", de: "avaliadas" },
  { chave: "respondidas", rotulo: "respondidas no RA", href: "/reclame-aqui" },
  { chave: "npsNoPrazo", rotulo: "1º contato NPS no prazo", href: "/nps", de: "npsContatados" },
  { chave: "revertidos", rotulo: "detratores revertidos", href: "/nps" },
  { chave: "encerrados", rotulo: "ciclos de NPS encerrados", href: "/nps" },
];

const CHAVE_VISTA = "cw:placar-visto";

/**
 * O placar da semana, no topo do Meu dia.
 *
 * O Isaac: "parte de conquistas nunca vi". O cartão existia — texto
 * corrido no canto de uma fileira de três. Aqui os números ficam no
 * topo, cada um contra a semana passada até o mesmo dia; a sequência de
 * dias com a rotina inteira; o próximo passo que mexe na nota; e o
 * resumo da semana pronto para colar no Slack, editável.
 *
 * Quando um número sobe enquanto a tela está aberta (ou desde a última
 * visita), um aviso pequeno diz o que foi conquistado — uma vez.
 */
export default function PlacarDaSemana({ dia }: { dia: MeuDia }) {

  const { cases } = useCases();
  const { responses } = useNps();
  const { notify } = useToast();
  const agora = useAgora();

  const [resumoAberto, setResumoAberto] = useState(false);
  const [texto, setTexto] = useState("");

  const calculado = useMemo(() => {
    if (!agora || dia.carregando) return null;
    const placar = placarDaSemana({ casos: cases, nps: responses, agora });
    const acao = oQueMoveANota(cases, agora)[0] ?? null;
    return { placar, acao };
  }, [agora, cases, responses, dia.carregando]);

  /* O que subiu desde a última vez que o placar foi visto nesta semana: um aviso, uma vez. */
  useEffect(() => {
    if (!calculado) return;
    const { placar } = calculado;
    let visto: { desde: string; numeros: NumerosDaJanela } | null = null;
    try {
      visto = JSON.parse(localStorage.getItem(CHAVE_VISTA) ?? "null");
    } catch {
      visto = null;
    }
    if (visto && visto.desde === placar.desde) {
      const subiu = CASAS.filter((c) => placar.agora[c.chave] > (visto!.numeros[c.chave] ?? 0));
      if (subiu.length) {
        notify({
          tone: "success",
          title: "Conquista da semana",
          detail: subiu.map((c) => `+${placar.agora[c.chave] - (visto!.numeros[c.chave] ?? 0)} ${c.rotulo}`).join(" · "),
        });
      }
    }
    try {
      localStorage.setItem(CHAVE_VISTA, JSON.stringify({ desde: placar.desde, numeros: placar.agora }));
    } catch {
      /* Sem armazenamento: só não avisa na próxima visita. */
    }
  }, [calculado, notify]);

  if (!calculado) {
    return <div className="h-[92px] animate-pulse rounded-xl border border-zinc-200/80 bg-white motion-reduce:animate-none" aria-hidden />;
  }

  const { placar, acao } = calculado;
  const diaDaSemana = new Date(`${placar.hoje}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", timeZone: "UTC" });

  function abrirResumo() {
    setTexto(textoDoResumoDaSemana(placar, { sequencia: dia.sequencia, nota: acao ? um(acao.notaAntes) : undefined }));
    setResumoAberto(true);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      notify({ tone: "success", title: "Resumo da semana copiado.", detail: "Cole no Slack da gestão." });
    } catch {
      notify({ tone: "error", title: "Não deu para copiar.", detail: "Selecione o texto e copie com Ctrl+C." });
    }
  }

  return (
    <section aria-label="Placar da semana" data-tour="placar" className="rounded-xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">

      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-zinc-100 px-4 py-2">
        <p className="text-[13px] font-semibold text-zinc-900">Placar da semana</p>
        <p className="text-xs text-zinc-500">
          desde {placar.desde.split("-").reverse().slice(0, 2).join("/")} · comparado com a semana passada até {diaDaSemana}
        </p>
        <button
          type="button"
          onClick={() => (resumoAberto ? setResumoAberto(false) : abrirResumo())}
          aria-expanded={resumoAberto}
          className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
        >
          <ClipboardCopy size={13} /> Resumo da semana
        </button>
      </header>

      <ul className="grid grid-cols-2 gap-px bg-zinc-100 sm:grid-cols-3 lg:grid-cols-6">
        {CASAS.map((c) => {
          const agoraN = placar.agora[c.chave];
          const antesN = placar.antes[c.chave];
          const diferenca = agoraN - antesN;
          return (
            <li key={c.chave} className="bg-white">
              <Link href={c.href} className="block px-4 py-2.5 transition-colors hover:bg-zinc-50">
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[22px] font-semibold leading-none tabular-nums text-zinc-900">{agoraN}</span>
                  {c.de && placar.agora[c.de] > 0 && <span className="text-xs tabular-nums text-zinc-400">de {placar.agora[c.de]}</span>}
                </span>
                <span className="mt-1 block text-[11px] leading-tight text-zinc-600">{c.rotulo}</span>
                <span
                  className={`mt-0.5 block text-[11px] tabular-nums ${diferenca > 0 ? "text-emerald-700" : diferenca < 0 ? "text-rose-700" : "text-zinc-400"}`}
                >
                  {diferenca === 0 ? "igual à semana passada" : `${diferenca > 0 ? "+" : "−"}${Math.abs(diferenca)} que a semana passada`}
                </span>
              </Link>
            </li>
          );
        })}
        <li className="bg-white px-4 py-2.5">
          <span className="flex items-baseline gap-1.5">
            <Flame size={16} className={`self-center ${dia.sequencia > 0 ? "text-amber-500" : "text-zinc-300"}`} />
            <span className="text-[22px] font-semibold leading-none tabular-nums text-zinc-900">{dia.sequencia}</span>
          </span>
          <span className="mt-1 block text-[11px] leading-tight text-zinc-600">dias seguidos com a rotina inteira</span>
          <span className="mt-0.5 block text-[11px] text-zinc-400">{dia.sequencia > 0 ? "marque e salve hoje para somar" : "comece hoje: marque e salve a rotina"}</span>
        </li>
      </ul>

      {acao && (
        <Link href={acao.href} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-zinc-100 px-4 py-2 text-xs hover:bg-zinc-50">
          <TrendingUp size={13} className="shrink-0 text-emerald-600" />
          <span className="font-medium text-zinc-800">Próximo passo para a nota: {acao.titulo.charAt(0).toLowerCase()}{acao.titulo.slice(1)}</span>
          <span className="text-zinc-500">
            {um(acao.notaAntes)} → <strong className="font-semibold text-emerald-700">{um(acao.notaDepois)}</strong>
          </span>
        </Link>
      )}

      {resumoAberto && (
        <div className="border-t border-zinc-100 px-4 py-3">
          <label htmlFor="resumo-da-semana" className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Resumo para a gestão — dá para editar antes de copiar
          </label>
          <textarea
            id="resumo-da-semana"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={Math.min(10, texto.split("\n").length + 1)}
            className="mt-1.5 w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-xs leading-relaxed text-zinc-800 outline-none focus:border-violet-400"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={abrirResumo} className="rounded-lg px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100">
              Refazer o texto
            </button>
            <button type="button" onClick={copiar} className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800">
              <ClipboardCopy size={13} /> Copiar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
