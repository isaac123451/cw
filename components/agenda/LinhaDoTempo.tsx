"use client";

import Link from "next/link";

import { useMemo, useState } from "react";

import { ArrowUpRight, CalendarArrowUp, Check, ChevronLeft, ChevronRight } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";
import BotaoAbrirEmJanela from "@/components/janelas/BotaoAbrirEmJanela";

import { useAgenda } from "@/lib/context/AgendaContext";
import { useCases } from "@/lib/context/CaseContext";
import { useGoogleEvents } from "@/lib/context/GoogleEventsContext";
import { useMovements } from "@/lib/context/MovementsContext";
import { useNps } from "@/lib/context/NpsContext";
import { useSla } from "@/lib/context/SlaContext";
import { useAgora } from "@/lib/hooks/useAgora";

import { atrasadosDaAgenda, compromissosEntre, type Compromisso, type OrigemDoCompromisso } from "@/lib/models/compromissos";
import { diaCurtoDaMarca, type ItemDaRotina } from "@/lib/models/meuDia";
import { paredeDe, proximoDiaUtil } from "@/lib/services/horasUteis";
import { isSocial } from "@/lib/services/case.service";

/**
 * O dia e a semana numa linha do tempo (Fase 25).
 *
 * O que tem hora, no horário — atividades, eventos do Google e os prazos
 * que vencem (1º contato, solução, retorno de área, 1º contato do NPS);
 * o resto em "no dia, sem hora"; e, em cima, o que ficou para trás, com
 * concluir e trazer para hoje em um clique. Na semana, os sete dias lado
 * a lado.
 */

const ORIGEM: Record<OrigemDoCompromisso, { rotulo: string; tom: string }> = {
  atividade: { rotulo: "Atividade", tom: "bg-violet-50 text-violet-700 ring-violet-100" },
  google: { rotulo: "Google", tom: "bg-sky-50 text-sky-700 ring-sky-100" },
  "prazo-caso": { rotulo: "Prazo", tom: "bg-rose-50 text-rose-700 ring-rose-100" },
  "prazo-nps": { rotulo: "NPS", tom: "bg-amber-50 text-amber-800 ring-amber-100" },
  area: { rotulo: "Área", tom: "bg-zinc-100 text-zinc-700 ring-zinc-200" },
  ligacao: { rotulo: "Ligação", tom: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
};

const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function somarDias(dia: string, n: number) {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}
const diaDaSemana = (dia: string) => new Date(`${dia}T12:00:00Z`).getUTCDay();
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export default function LinhaDoTempo({ ligacoes }: { ligacoes?: { dia: string; itens: ItemDaRotina[] } }) {

  const agora = useAgora();
  const { tasks, toggleTask, moveTask } = useAgenda();
  const { events } = useGoogleEvents();
  const { cases } = useCases();
  const { movements } = useMovements();
  const { responses } = useNps();
  const { rules, expediente } = useSla();

  const [modo, setModo] = useState<"dia" | "semana">("dia");
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [gravando, setGravando] = useState<string | null>(null);

  const hoje = agora ? paredeDe(agora).dia : null;
  const foco = escolhido ?? hoje;
  const inicioDaSemana = foco ? somarDias(foco, -((diaDaSemana(foco) + 6) % 7)) : null;
  const de = modo === "dia" ? foco : inicioDaSemana;
  const ate = modo === "dia" ? foco : inicioDaSemana ? somarDias(inicioDaSemana, 6) : null;

  const lista = useMemo(
    () =>
      agora && de && ate
        ? compromissosEntre({ de, ate, tarefas: tasks, eventos: events, casos: cases, regras: rules, movimentos: movements, nps: responses, ligacoes, expediente, agora })
        : [],
    [agora, de, ate, tasks, events, cases, rules, movements, responses, ligacoes, expediente]
  );

  const atrasados = useMemo(
    () => (agora && hoje ? atrasadosDaAgenda({ hoje, tarefas: tasks, casos: cases, regras: rules, movimentos: movements, nps: responses, expediente, agora }) : null),
    [agora, hoje, tasks, cases, rules, movements, responses, expediente]
  );

  if (!agora || !hoje || !foco || !inicioDaSemana) return null;

  async function concluir(id: string) {
    setGravando(id);
    await toggleTask(id);
    setGravando(null);
  }
  async function mover(id: string, dia: string) {
    setGravando(id);
    await moveTask(id, dia);
    setGravando(null);
  }

  const passo = modo === "dia" ? 1 : 7;
  const agoraMin = paredeDe(agora).min;

  return (
    <SurfaceCard bodyClassName="p-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-4 py-3 sm:px-6">
        <div role="group" aria-label="Ver" className="flex rounded-lg bg-zinc-100 p-0.5 text-xs font-medium">
          {(["dia", "semana"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={modo === m}
              onClick={() => setModo(m)}
              className={`rounded-md px-2.5 py-1 ${modo === m ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}
            >
              {m === "dia" ? "Dia" : "Semana"}
            </button>
          ))}
        </div>
        <div className="flex items-center">
          <button type="button" onClick={() => setEscolhido(somarDias(foco, -passo))} aria-label={modo === "dia" ? "Dia anterior" : "Semana anterior"} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100">
            <ChevronLeft size={16} />
          </button>
          <p className="min-w-36 text-center text-sm font-semibold text-zinc-900 tabular-nums">
            {modo === "dia"
              ? `${foco === hoje ? "Hoje" : SEMANA[diaDaSemana(foco)]}, ${diaCurtoDaMarca(foco)}`
              : `${diaCurtoDaMarca(inicioDaSemana)} a ${diaCurtoDaMarca(somarDias(inicioDaSemana, 6))}`}
          </p>
          <button type="button" onClick={() => setEscolhido(somarDias(foco, passo))} aria-label={modo === "dia" ? "Próximo dia" : "Próxima semana"} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100">
            <ChevronRight size={16} />
          </button>
        </div>
        {foco !== hoje && (
          <button type="button" onClick={() => setEscolhido(null)} className="rounded-md px-2 py-1 text-xs font-medium text-violet-700 hover:bg-violet-50">
            Voltar a hoje
          </button>
        )}
      </div>

      {/* O que ficou para trás: só olhando hoje, para não misturar com o passado navegado. */}
      {modo === "dia" && foco === hoje && atrasados && (atrasados.atividades.length > 0 || atrasados.prazosEstourados > 0) && (
        <div className="border-b border-rose-100 bg-rose-50/40 px-4 py-2.5 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">Ficou para trás</p>
          <ul className="mt-1 space-y-1">
            {atrasados.atividades.map((t) => (
              <li key={t.id} className="flex min-w-0 items-center gap-2 text-sm">
                <span className="w-12 shrink-0 text-xs tabular-nums text-rose-700">{diaCurtoDaMarca(t.dueDate)}</span>
                <span className="min-w-0 flex-1 truncate text-zinc-800">{t.title}</span>
                <button type="button" disabled={gravando === t.id} onClick={() => concluir(t.id)} className="flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
                  <Check size={13} strokeWidth={2.5} /> Concluir
                </button>
                <button type="button" disabled={gravando === t.id} onClick={() => mover(t.id, hoje)} className="flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-zinc-600 hover:bg-white disabled:opacity-50">
                  <CalendarArrowUp size={13} /> Para hoje
                </button>
              </li>
            ))}
          </ul>
          {atrasados.prazosEstourados > 0 && (
            <Link href="/meu-dia" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-rose-700 hover:underline">
              {atrasados.prazosEstourados} prazo(s) de caso, NPS ou área já estourados — estão no Meu dia <ArrowUpRight size={12} />
            </Link>
          )}
        </div>
      )}

      {modo === "dia" ? (
        <VistaDoDia
          lista={lista}
          agoraMin={foco === hoje ? agoraMin : null}
          gravando={gravando}
          onConcluir={concluir}
          onAdiar={(id) => mover(id, proximoDiaUtil(foco, expediente))}
          casos={cases}
        />
      ) : (
        <div className="grid gap-px bg-zinc-100 sm:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => somarDias(inicioDaSemana, i)).map((dia) => {
            const doDia = lista.filter((c) => c.dia === dia);
            return (
              <button
                key={dia}
                type="button"
                onClick={() => {
                  setEscolhido(dia);
                  setModo("dia");
                }}
                className={`min-w-0 bg-white px-2.5 py-2 text-left align-top hover:bg-zinc-50 sm:min-h-40 ${dia === hoje ? "ring-2 ring-inset ring-violet-300" : ""}`}
              >
                <p className={`text-xs font-semibold ${dia === hoje ? "text-violet-800" : "text-zinc-700"}`}>
                  {SEMANA[diaDaSemana(dia)]} <span className="font-normal tabular-nums text-zinc-400">{diaCurtoDaMarca(dia)}</span>
                </p>
                <ul className="mt-1.5 space-y-1">
                  {doDia.slice(0, 6).map((c) => (
                    <li key={c.id} className={`truncate text-[11px] ${c.feito ? "text-zinc-400 line-through" : "text-zinc-700"}`}>
                      <span className="tabular-nums text-zinc-400">{c.minuto !== undefined ? hhmm(c.minuto) : "·"}</span> {c.titulo}
                    </li>
                  ))}
                  {doDia.length > 6 && <li className="text-[11px] font-medium text-violet-700">+{doDia.length - 6}</li>}
                  {doDia.length === 0 && <li className="text-[11px] text-zinc-300">livre</li>}
                </ul>
              </button>
            );
          })}
        </div>
      )}
    </SurfaceCard>
  );
}

export function VistaDoDia({
  lista,
  agoraMin,
  gravando,
  onConcluir,
  onAdiar,
  casos,
}: {
  lista: Compromisso[];
  agoraMin: number | null;
  gravando: string | null;
  onConcluir: (id: string) => void;
  onAdiar: (id: string) => void;
  casos: ReturnType<typeof useCases>["cases"];
}) {
  const comHora = lista.filter((c) => c.minuto !== undefined);
  const semHora = lista.filter((c) => c.minuto === undefined);
  const indiceDoAgora = agoraMin === null ? -1 : comHora.findIndex((c) => c.minuto! >= agoraMin);

  if (lista.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-zinc-500 sm:px-6">Nada marcado e nenhum prazo vencendo neste dia.</p>;
  }

  const linha = (c: Compromisso) => {
    const caso = c.casoId ? casos.find((x) => x.id === c.casoId) : undefined;
    return (
      <li key={c.id} className="group flex min-w-0 items-start gap-3 px-4 py-2 hover:bg-zinc-50/70 sm:px-6">
        <span className="w-11 shrink-0 pt-0.5 text-xs font-medium tabular-nums text-zinc-500">{c.minuto !== undefined ? hhmm(c.minuto) : ""}</span>
        {c.tarefaId ? (
          <button
            type="button"
            onClick={() => onConcluir(c.tarefaId!)}
            disabled={gravando === c.tarefaId}
            aria-label={c.feito ? `Reabrir ${c.titulo}` : `Concluir ${c.titulo}`}
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${c.feito ? "border-emerald-500 bg-emerald-500 text-white" : "border-zinc-300 hover:border-violet-400"}`}
          >
            {c.feito && <Check size={11} strokeWidth={3} />}
          </button>
        ) : (
          <span className="mt-0.5 h-4 w-4 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className={`flex min-w-0 items-center gap-1.5 text-sm ${c.feito ? "text-zinc-400 line-through" : "text-zinc-800"}`}>
            <span className={`shrink-0 rounded px-1.5 py-px text-[10px] font-semibold ring-1 ring-inset ${ORIGEM[c.origem].tom}`}>{ORIGEM[c.origem].rotulo}</span>
            {c.href ? (
              <Link href={c.href} target={c.origem === "google" ? "_blank" : undefined} className="min-w-0 truncate hover:underline">
                {c.titulo}
              </Link>
            ) : (
              <span className="min-w-0 truncate">{c.titulo}</span>
            )}
          </p>
          {c.detalhe && <p className="truncate text-xs text-zinc-500">{c.detalhe}</p>}
        </div>
        <div className="flex shrink-0 items-center">
          {caso && (
            <BotaoAbrirEmJanela frente={isSocial(caso) ? "redes" : "reclame-aqui"} referencia={caso.id} titulo={`${caso.protocol} · ${caso.customer}`} className="p-1" />
          )}
          {c.tarefaId && !c.feito && (
            <button
              type="button"
              onClick={() => onAdiar(c.tarefaId!)}
              disabled={gravando === c.tarefaId}
              title="Passar para o próximo dia útil"
              className="rounded-md p-1 text-zinc-400 opacity-0 transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:opacity-100 group-hover:opacity-100"
            >
              <CalendarArrowUp size={14} />
            </button>
          )}
        </div>
      </li>
    );
  };

  return (
    <div>
      {comHora.length > 0 && (
        <ul className="py-1">
          {comHora.map((c, i) => (
            <FragmentoComAgora key={c.id} mostrarAgora={i === indiceDoAgora}>
              {linha(c)}
            </FragmentoComAgora>
          ))}
          {agoraMin !== null && indiceDoAgora === -1 && <MarcaDoAgora />}
        </ul>
      )}
      {semHora.length > 0 && (
        <div className="border-t border-zinc-100">
          <p className="px-4 pt-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 sm:px-6">No dia, sem hora</p>
          <ul className="pb-1">{semHora.map(linha)}</ul>
        </div>
      )}
    </div>
  );
}

function MarcaDoAgora() {
  return (
    <li aria-hidden className="flex items-center gap-2 px-4 sm:px-6">
      <span className="w-11 text-[10px] font-semibold uppercase text-rose-600">agora</span>
      <span className="h-px flex-1 bg-rose-300" />
    </li>
  );
}

function FragmentoComAgora({ mostrarAgora, children }: { mostrarAgora: boolean; children: React.ReactNode }) {
  return (
    <>
      {mostrarAgora && <MarcaDoAgora />}
      {children}
    </>
  );
}
