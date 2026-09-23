"use client";

import Link from "next/link";

import { useState } from "react";

import { CalendarClock, CalendarPlus, CircleAlert, Loader2, Sparkles } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";
import IconeDaFrente from "@/components/shared/IconeDaFrente";

import { frente } from "@/lib/models/frentes";
import type { Contagem, PlanoDoDia as Plano } from "@/lib/models/meuDia";
import type { AtividadeDaRotina, ChaveDaRotina } from "@/lib/models/rotina";
import { eventosDoPlano } from "@/lib/models/planoNaAgenda";
import { getGoogleStatus, levarPlanoParaAgenda } from "@/lib/actions/google";
import { useToast } from "@/lib/context/ToastContext";
import { descreverMinutos } from "@/components/rotina/formato";

interface Leitura {
  origem: "ia" | "regras";
  abertura: string;
  conselhos: string[];
  aviso?: string;
}

/**
 * O plano do dia: a rotina que falta, encaixada no expediente que sobra.
 *
 * O Isaac: "preciso de ajuda também para organizar como vou fazer tais
 * atividades conforme a quantidade de demandas e urgências, pode ser
 * algo com IA". O plano em si é conta — minutos por item, ordem do
 * documento, o atrasado sobe —, e por isso é igual com ou sem IA. O que
 * a IA acrescenta, a pedido, é a leitura: por onde começar e o que dá
 * para adiar quando não cabe, com os números que o plano já tem.
 */
export default function PlanoDoDia({
  plano,
  atividades,
  contagens,
  hoje,
}: {
  plano: Plano | null;
  atividades: AtividadeDaRotina[];
  contagens?: Record<ChaveDaRotina, Contagem> | null;
  hoje?: string | null;
}) {

  const { notify } = useToast();
  const [lendo, setLendo] = useState(false);
  const [leitura, setLeitura] = useState<Leitura | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  /*
    A Google Agenda: confere a conexão no clique (não a cada abertura da
    tela), mostra o que vai e só manda na confirmação.
  */
  const [agenda, setAgenda] = useState<null | "conferindo" | "enviando" | { email?: string } | { aviso: string; link?: boolean }>(null);

  if (!plano) {
    return (
      <SurfaceCard tour="plano-do-dia" title="Plano do dia">
        <p className="py-8 text-center text-sm text-zinc-400">Montando o plano…</p>
      </SurfaceCard>
    );
  }

  const sobra = plano.minutosDisponiveis - plano.minutosNecessarios;
  /* Sem expediente e sem nada a fazer (fim de semana), a barra fica vazia — e não cheia. */
  const cheio =
    plano.minutosDisponiveis === 0
      ? plano.minutosNecessarios > 0 ? 100 : 0
      : Math.min(100, Math.round((plano.minutosNecessarios / plano.minutosDisponiveis) * 100));
  const linkDe = (id: string) => atividades.find((a) => a.id === id)?.link;

  async function abrirAgenda() {
    setAgenda("conferindo");
    try {
      const s = await getGoogleStatus();
      if (!s.configurado) setAgenda({ aviso: "A integração com o Google não está ligada neste servidor." });
      else if (!s.conectado) setAgenda({ aviso: "Conecte a sua Google Agenda primeiro, na tela Agenda.", link: true });
      else setAgenda({ email: s.email });
    } catch {
      setAgenda({ aviso: "Não deu para conferir a conexão com o Google agora." });
    }
  }

  async function enviarParaAgenda() {
    if (!plano || !contagens || !hoje) return;
    setAgenda("enviando");
    try {
      const eventos = eventosDoPlano({ plano, atividades, contagens, origem: window.location.origin });
      const r = await levarPlanoParaAgenda({ dia: hoje, eventos });
      if (!r.ok) {
        notify({ tone: "error", title: "O plano não foi para a agenda.", detail: r.error });
        setAgenda(null);
        return;
      }
      notify({
        tone: "success",
        title: "Plano na sua Google Agenda.",
        detail:
          [
            r.criados ? `${r.criados} bloco(s) novo(s)` : null,
            r.atualizados ? `${r.atualizados} atualizado(s)` : null,
            r.removidos ? `${r.removidos} tirado(s) — saíram do plano` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Nada mudou.",
        href: r.link,
        hrefLabel: "Abrir a agenda",
      });
      setAgenda(null);
    } catch {
      notify({ tone: "error", title: "O plano não foi para a agenda.", detail: "Tente de novo em instantes." });
      setAgenda(null);
    }
  }

  async function pedirLeitura() {
    setLendo(true);
    setErro(null);
    try {
      const r = await fetch("/api/assistente/plano-do-dia", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plano }),
      });
      const d = await r.json();
      if (!r.ok || d.erro) {
        setErro(d.erro ?? "Não deu para ler o plano agora.");
        return;
      }
      setLeitura(d);
    } catch {
      setErro("Não deu para falar com o servidor.");
    } finally {
      setLendo(false);
    }
  }

  return (
    <SurfaceCard
      tour="plano-do-dia"
      title="Plano do dia"
      description="O que falta da rotina, no expediente que sobra — na ordem do documento, com o que está fora do prazo na frente."
      action={
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={abrirAgenda}
            disabled={plano.blocos.length === 0 || !contagens || !hoje || agenda === "conferindo" || agenda === "enviando"}
            title="Cada bloco do plano vira um evento na sua Google Agenda. Mandar de novo atualiza, sem duplicar."
            className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:border-violet-300 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {agenda === "conferindo" || agenda === "enviando" ? <Loader2 size={14} className="animate-spin" /> : <CalendarPlus size={14} />}
            Levar para a agenda
          </button>
          <button
            type="button"
            onClick={pedirLeitura}
            disabled={lendo || plano.blocos.length + plano.naoCabe.length === 0}
            className="flex items-center gap-2 rounded-xl border border-violet-200 px-3 py-2 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {lendo ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {lendo ? "Lendo…" : leitura ? "Ler de novo" : "Pedir a leitura da IA"}
          </button>
        </div>
      }
    >

      {agenda && typeof agenda === "object" && (
        <div className="mb-4 rounded-xl bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-700 ring-1 ring-inset ring-zinc-200">
          {"aviso" in agenda ? (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {agenda.aviso}
              {agenda.link && (
                <Link href="/agenda" className="font-semibold text-violet-700 hover:underline">
                  Ir para a Agenda
                </Link>
              )}
              <button type="button" onClick={() => setAgenda(null)} className="ml-auto text-zinc-500 hover:text-zinc-800">
                Fechar
              </button>
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="min-w-0 flex-1 basis-60 leading-relaxed">
                Vão <strong className="text-zinc-900">{plano.blocos.length} bloco(s)</strong>, das {plano.blocos[0]?.inicio} às{" "}
                {plano.blocos[plano.blocos.length - 1]?.fim}, para a agenda{agenda.email ? ` de ${agenda.email}` : ""}. Mandar de novo depois
                atualiza os mesmos blocos, sem duplicar; o que não coube hoje não vai.
              </p>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setAgenda(null)} className="rounded-lg px-2.5 py-1.5 text-zinc-600 hover:bg-zinc-100">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={enviarParaAgenda}
                  className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 font-semibold text-white hover:bg-zinc-800"
                >
                  <CalendarPlus size={13} /> Enviar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mb-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-zinc-600">
          <span>
            O dia pede <strong className="tabular-nums text-zinc-900">{descreverMinutos(plano.minutosNecessarios)}</strong> e o expediente tem{" "}
            <strong className="tabular-nums text-zinc-900">{descreverMinutos(plano.minutosDisponiveis)}</strong>
          </span>
          <span className={`font-semibold ${sobra < 0 ? "text-rose-700" : "text-emerald-700"}`}>
            {sobra < 0 ? `faltam ${descreverMinutos(-sobra)}` : `sobram ${descreverMinutos(sobra)}`}
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-100">
          <div className={`h-full rounded-full ${sobra < 0 ? "bg-rose-500" : "bg-violet-500"}`} style={{ width: `${cheio}%` }} />
        </div>
        <p className="mt-1.5 text-[11px] text-zinc-400">Estimativa: cada item custa alguns minutos (1º contato 15, pedido de avaliação 4…). A duração-base de cada atividade se ajusta em Configurar.</p>
      </div>

      {leitura && (
        <div className="mb-4 rounded-xl bg-violet-50/60 px-3.5 py-3 text-sm leading-relaxed text-zinc-700 ring-1 ring-inset ring-violet-100">
          {leitura.origem === "regras" && (
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
              <CircleAlert size={12} /> Leitura pelas regras, sem a IA{leitura.aviso ? ` — ${leitura.aviso}` : ""}.
            </p>
          )}
          <p>{leitura.abertura}</p>
          {leitura.conselhos.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px]">
              {leitura.conselhos.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {erro && <p className="mb-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 ring-1 ring-inset ring-amber-100">{erro}</p>}

      {plano.blocos.length === 0 && plano.naoCabe.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">Nada da rotina pendente para hoje. Bom trabalho.</p>
      ) : (
        <ol className="space-y-1.5">
          {plano.blocos.map((b) => {
            const link = linkDe(b.atividadeId);
            return (
              <li key={`${b.atividadeId}:${b.frente ?? "-"}`} className="flex items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-zinc-50">
                <span className="w-24 shrink-0 pt-0.5 font-mono text-xs tabular-nums text-zinc-500">
                  {b.inicio}–{b.fim}
                </span>
                <span className="min-w-0 flex-1">
                  {b.frente && (
                    <span className="mr-1.5 inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-zinc-700" title={frente(b.frente).nome}>
                      <IconeDaFrente frente={b.frente} size={10} /> {frente(b.frente).curto}
                    </span>
                  )}
                  {link ? (
                    <Link href={link} className="text-sm font-medium text-zinc-800 hover:text-violet-700 hover:underline">
                      {b.titulo}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium text-zinc-800">{b.titulo}</span>
                  )}
                  <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                    {b.itens > 0 && <span>{b.itens} item(ns) · ~{descreverMinutos(b.minutos)}</span>}
                    {b.atrasados > 0 && <span className="font-semibold text-rose-700">{b.atrasados} fora do prazo</span>}
                    <span className="text-zinc-400">{b.motivo}</span>
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {plano.naoCabe.length > 0 && (
        <div className="mt-3 rounded-xl bg-rose-50/60 px-3.5 py-2.5 ring-1 ring-inset ring-rose-100">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-800">
            <CalendarClock size={13} /> Não cabe no expediente de hoje
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-rose-900">
            {plano.naoCabe.map((b) => (
              <li key={`${b.atividadeId}:${b.frente ?? "-"}`}>
                {b.titulo}{b.frente ? ` (${frente(b.frente).curto})` : ""} — ~{descreverMinutos(b.minutos)}
                {b.atrasados > 0 ? ` · ${b.atrasados} fora do prazo` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] text-rose-800/80">
            O documento pede, com volume alto: Reclame Aqui, depois Redes, NPS e Google. Adie o que tem menos consequência ou divida com alguém do time.
          </p>
        </div>
      )}

    </SurfaceCard>
  );
}
