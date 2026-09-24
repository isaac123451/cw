"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import { AlarmClock, AppWindow, Check, X } from "lucide-react";

import { useAgenda } from "@/lib/context/AgendaContext";
import { useCases } from "@/lib/context/CaseContext";
import { useJanelas } from "@/lib/context/JanelasContext";
import { useSla } from "@/lib/context/SlaContext";
import { useAgora } from "@/lib/hooks/useAgora";

import { adiarLembrete, chaveDoAviso, lembretesNaHora, type AdiamentoDoLembrete } from "@/lib/models/lembretes";
import { isSocial } from "@/lib/services/case.service";

/*
  O que já foi dispensado fica no navegador de quem trabalha — é o aviso
  desta pessoa, nesta máquina. Lido pelo useSyncExternalStore: nada
  diverge entre o servidor e a primeira pintura.
*/
const CHAVE = "cw:lembretes-dispensados";
const EVENTO = "cw:lembretes";
const NENHUM = "[]";

function lerTexto() {
  try {
    return window.localStorage.getItem(CHAVE) ?? NENHUM;
  } catch {
    return NENHUM;
  }
}
function dispensar(chave: string) {
  try {
    const atual: string[] = JSON.parse(lerTexto());
    window.localStorage.setItem(CHAVE, JSON.stringify([...atual.filter((c) => c !== chave), chave].slice(-300)));
  } catch {
    /* sem armazenamento: o aviso some só até recarregar */
  }
  window.dispatchEvent(new Event(EVENTO));
}
function ouvir(avisar: () => void) {
  window.addEventListener(EVENTO, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(EVENTO, avisar);
    window.removeEventListener("storage", avisar);
  };
}

/**
 * Os lembretes que chegaram na hora, em qualquer tela (Fase 25).
 *
 * No alto, à direita, abaixo da barra (embaixo moram os avisos e as janelas), empilhados, no máximo três à vista. Cada um
 * com abrir o caso (quando tem protocolo), adiar 15 min, 1 h ou para o
 * próximo dia útil, concluir, e dispensar. Com a permissão do
 * navegador, avisa também fora da aba.
 */
export default function AvisosDeLembrete() {

  const agora = useAgora();
  const { tasks, updateTask, toggleTask } = useAgenda();
  const { cases } = useCases();
  const { abrir } = useJanelas();
  const { expediente } = useSla();

  const texto = useSyncExternalStore(ouvir, lerTexto, () => NENHUM);
  const dispensados = useMemo(() => {
    try {
      return new Set<string>(JSON.parse(texto));
    } catch {
      return new Set<string>();
    }
  }, [texto]);

  const naHora = useMemo(() => (agora ? lembretesNaHora(tasks, agora, dispensados) : []), [tasks, agora, dispensados]);

  /* O aviso do navegador sai uma vez por lembrete, quando ele aparece. */
  const notificados = useRef(new Set<string>());
  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    for (const t of naHora) {
      const k = chaveDoAviso(t);
      if (notificados.current.has(k)) continue;
      notificados.current.add(k);
      try {
        new Notification(`Lembrete · ${t.time}`, { body: t.title, tag: k });
      } catch {
        /* o navegador recusou: o aviso na tela continua */
      }
    }
  }, [naHora]);

  if (!agora || naHora.length === 0) return null;

  function adiar(id: string, como: AdiamentoDoLembrete) {
    const t = tasks.find((x) => x.id === id);
    if (!t || !agora) return;
    dispensar(chaveDoAviso(t));
    updateTask({ ...t, ...adiarLembrete(t, como, agora, expediente) });
  }

  const podePedirPermissao = typeof Notification !== "undefined" && Notification.permission === "default";

  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 top-[calc(env(safe-area-inset-top,0px)+4.5rem)] z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
      {naHora.slice(0, 3).map((t) => {
        const caso = t.relatedCase ? cases.find((c) => c.protocol === t.relatedCase) : undefined;
        return (
          <section key={t.id} role="alert" className="pointer-events-auto rounded-xl border border-zinc-200 bg-white p-3 shadow-[0_16px_40px_-16px_rgba(16,24,40,0.35)]">
            <div className="flex items-start gap-2">
              <AlarmClock size={16} className="mt-0.5 shrink-0 text-violet-700" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold tabular-nums text-violet-800">Lembrete · {t.time}</p>
                <p className="text-sm font-medium text-zinc-900 [overflow-wrap:anywhere]">{t.title}</p>
                {(t.relatedCase || t.relatedCompany) && <p className="truncate text-xs text-zinc-500">{[t.relatedCase, t.relatedCompany].filter(Boolean).join(" · ")}</p>}
              </div>
              <button type="button" onClick={() => dispensar(chaveDoAviso(t))} aria-label="Dispensar o lembrete" className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
                <X size={14} />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1 pl-6 text-xs">
              {caso && (
                <button
                  type="button"
                  onClick={() => abrir({ frente: isSocial(caso) ? "redes" : "reclame-aqui", ref: caso.id, titulo: `${caso.protocol} · ${caso.customer}` })}
                  className="flex items-center gap-1 rounded-md bg-zinc-900 px-2 py-1 font-semibold text-white hover:bg-zinc-800"
                >
                  <AppWindow size={12} /> Abrir o caso
                </button>
              )}
              <span className="text-zinc-400">Adiar</span>
              {(
                [
                  ["15min", "15 min"],
                  ["1h", "1 h"],
                  ["amanha", "Amanhã"],
                ] as const
              ).map(([como, rotulo]) => (
                <button key={como} type="button" onClick={() => adiar(t.id, como)} className="rounded-md px-1.5 py-1 font-medium text-zinc-700 hover:bg-zinc-100">
                  {rotulo}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  dispensar(chaveDoAviso(t));
                  void toggleTask(t.id);
                }}
                className="ml-auto flex items-center gap-1 rounded-md px-1.5 py-1 font-medium text-emerald-700 hover:bg-emerald-50"
              >
                <Check size={12} strokeWidth={2.5} /> Concluir
              </button>
            </div>
          </section>
        );
      })}
      {naHora.length > 3 && <p className="pointer-events-auto self-end rounded-md bg-white px-2 py-1 text-xs text-zinc-600 shadow">+{naHora.length - 3} lembrete(s) na hora — na Agenda</p>}
      {podePedirPermissao && (
        <button
          type="button"
          onClick={() => void Notification.requestPermission()}
          className="pointer-events-auto self-end rounded-md bg-white px-2 py-1 text-xs font-medium text-violet-700 shadow hover:bg-violet-50"
        >
          Avisar também fora da aba
        </button>
      )}
    </div>
  );
}
