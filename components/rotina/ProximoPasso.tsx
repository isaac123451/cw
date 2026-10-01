"use client";

import Link from "next/link";

import { AppWindow, ArrowUpRight, ListChecks, SkipForward } from "lucide-react";

import IconeDaFrente from "@/components/shared/IconeDaFrente";
import { useJanelas } from "@/lib/context/JanelasContext";
import type { ItemDaFila } from "@/lib/models/guiaParaFechar";
import { porQueDoItem } from "@/lib/models/proximoPasso";

import { useProximoPasso } from "@/components/rotina/useProximoPasso";
import type { useMeuDia } from "@/components/rotina/useMeuDia";

type MeuDia = ReturnType<typeof useMeuDia>;

/** Abrir o item: a ficha em mini-janela quando há; senão a tela (ou o WhatsApp, em outra aba). */
export function BotaoDeAbrir({ item, compacto = false }: { item: ItemDaFila; compacto?: boolean }) {
  const { abrir } = useJanelas();
  const classe = `flex items-center gap-1.5 rounded-lg bg-violet-800 font-medium text-white transition-colors hover:bg-violet-900 ${compacto ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"}`;
  if (item.janela) {
    const janela = item.janela;
    return (
      <button type="button" onClick={() => abrir(janela)} className={classe}>
        <AppWindow size={compacto ? 12 : 14} /> Abrir
      </button>
    );
  }
  if (/^https?:\/\//.test(item.href)) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer" className={classe}>
        Abrir <ArrowUpRight size={compacto ? 12 : 14} />
      </a>
    );
  }
  return (
    <Link href={item.href} className={classe}>
      Abrir <ArrowUpRight size={compacto ? 12 : 14} />
    </Link>
  );
}

/**
 * O próximo passo, no topo do Meu dia (1.123).
 *
 * "Lembretes curtos e o próximo passo à vista, para quem perde o foco
 * rápido": antes de placar, metas e listas, uma coisa só — o que fazer
 * agora, por quê, e o botão para fazer. É o primeiro da fila do Um por
 * vez; "Pular" passa para o seguinte só nesta tela, e "Um por vez" abre a
 * fila inteira no modo de foco.
 */
export default function ProximoPasso({ dia, marcadas, onUmPorVez }: { dia: MeuDia; marcadas: Set<string>; onUmPorVez: () => void }) {
  const { item, resumo, posicao, pular, carregando } = useProximoPasso(dia, marcadas);

  if (carregando) return null;

  if (!item) {
    return (
      <section className="rounded-2xl border border-emerald-200/70 bg-emerald-50/60 px-5 py-3 text-sm text-emerald-800">
        A fila de hoje está vazia: nada pedindo ação agora.
      </section>
    );
  }

  const porque = porQueDoItem(item);
  const urgente = item.atrasado || item.critico;

  return (
    <section
      aria-label="Próximo passo"
      className={`rounded-2xl border bg-white px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${urgente ? "border-amber-200" : "border-zinc-200/80"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Próximo passo
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal ring-1 ring-inset ${
                urgente ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-zinc-100 text-zinc-600 ring-zinc-200"
              }`}
            >
              {porque}
            </span>
          </p>
          <p className="mt-1.5 flex items-center gap-2 text-base font-semibold text-zinc-900">
            {item.frente && <IconeDaFrente frente={item.frente} size={15} />}
            <span className="truncate">{item.titulo}</span>
          </p>
          {item.detalhe && <p className="mt-0.5 line-clamp-2 text-sm text-zinc-500">{item.detalhe}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BotaoDeAbrir item={item} />
          <button
            type="button"
            onClick={pular}
            title="Passa para o seguinte só nesta tela — nada muda no caso"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-zinc-600 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
          >
            <SkipForward size={14} /> Pular
          </button>
          <button
            type="button"
            onClick={onUmPorVez}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-violet-700 ring-1 ring-inset ring-violet-200 transition-colors hover:bg-violet-50"
          >
            <ListChecks size={14} /> Um por vez
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs tabular-nums text-zinc-500">
        {posicao} de {resumo.total} na fila de hoje
        {resumo.atrasados > 0 && ` · ${resumo.atrasados} fora do prazo`}
        {resumo.criticos > 0 && ` · ${resumo.criticos} crítico(s)`}
      </p>
    </section>
  );
}
