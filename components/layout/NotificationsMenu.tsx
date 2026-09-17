"use client";

import Link from "next/link";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { AppWindow, Bell, Check, CheckCheck, Settings2 } from "lucide-react";

import { useAgenda } from "@/lib/context/AgendaContext";
import { useCases } from "@/lib/context/CaseContext";
import { useGoogleEvents } from "@/lib/context/GoogleEventsContext";
import { useJanelas } from "@/lib/context/JanelasContext";
import { useMovements } from "@/lib/context/MovementsContext";
import { useNps } from "@/lib/context/NpsContext";
import { usePreferences } from "@/lib/context/PreferencesContext";
import { useSession } from "@/lib/context/SessionContext";
import { useSla } from "@/lib/context/SlaContext";
import { useToast } from "@/lib/context/ToastContext";
import { useAvaliacoesGoogle } from "@/lib/context/useAvaliacoesGoogle";
import { useAgora } from "@/lib/hooks/useAgora";

import {
  assinaturaDoAviso,
  buildNotifications,
  ROTULO_DA_FRENTE_DO_AVISO,
  type FrenteDoAviso,
  type Notification,
  type NotificationTone,
} from "@/lib/services/notifications.service";

/**
 * O sino (roadmap 2.0, Fase 11).
 *
 * Antes: uma lista solta de alertas só do Reclame Aqui e da agenda, com
 * um número que nunca baixava. Agora:
 *
 * - **todas as frentes** — NPS fora do prazo, detrator novo, Google
 *   negativo sem resposta, Redes atrasadas, crise e cliente sem notícia;
 * - **agrupado por frente**, com a ação no próprio aviso: abrir a tela, ou
 *   abrir o caso direto na mini-janela quando o aviso é de um caso só;
 * - **visto por pessoa**: o número do sino conta só o que é novo. Visto
 *   vale para aquele texto — "3 sem resposta" visto não esconde o "4";
 * - **pop-up do que muda com a tela aberta**: um aviso novo e grave
 *   aparece como toast pequeno. Na abertura, nada pula na tela — foi o
 *   que o Isaac pediu ("algo tão grande é feio").
 */

const VISTOS_KEY = "cw:avisos-vistos";
const ouvintes = new Set<() => void>();

function lerVistos(): string[] {
  try {
    const lista = JSON.parse(localStorage.getItem(VISTOS_KEY) ?? "[]");
    return Array.isArray(lista) ? lista.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function gravarVistos(lista: string[]) {
  try {
    /* Só as assinaturas que ainda existem: a lista não cresce para sempre. */
    localStorage.setItem(VISTOS_KEY, JSON.stringify(lista.slice(-200)));
  } catch {
    /* Sem armazenamento, "visto" vale até recarregar. */
  }
  ouvintes.forEach((o) => o());
}

function useVistosBrutos() {
  return useSyncExternalStore(
    (ouvir) => {
      ouvintes.add(ouvir);
      return () => ouvintes.delete(ouvir);
    },
    () => {
      try {
        return localStorage.getItem(VISTOS_KEY) ?? "[]";
      } catch {
        return "[]";
      }
    },
    () => "[]"
  );
}

const ORDEM_DAS_FRENTES: FrenteDoAviso[] = ["reclame-aqui", "redes", "nps", "google", "agenda", "operacao"];

const PONTO: Record<NotificationTone, string> = {
  danger: "bg-rose-500",
  warning: "bg-amber-500",
  info: "bg-sky-500",
};

export default function NotificationsMenu() {
  const { cases } = useCases();
  const { tasks } = useAgenda();
  const { movements } = useMovements();
  const session = useSession();
  const { prefs } = usePreferences();
  const { events: googleEvents } = useGoogleEvents();
  const { expediente, rules } = useSla();
  const { responses } = useNps();
  const { avaliacoes } = useAvaliacoesGoogle();
  const { abrir: abrirJanela } = useJanelas();
  const { notify } = useToast();
  const agora = useAgora();

  const [open, setOpen] = useState(false);
  const [filtro, setFiltro] = useState<"novas" | "todas">("novas");

  const items = useMemo(
    () =>
      agora
        ? buildNotifications(
            cases,
            tasks,
            prefs.notifications,
            prefs.somenteMinhas ? session?.name : undefined,
            movements,
            googleEvents,
            expediente,
            { nps: responses, avaliacoesGoogle: avaliacoes, regras: rules, agora }
          )
        : [],
    [cases, tasks, prefs, session, movements, googleEvents, expediente, responses, avaliacoes, rules, agora]
  );

  const vistosBrutos = useVistosBrutos();
  const vistos = useMemo(() => new Set<string>(JSON.parse(vistosBrutos)), [vistosBrutos]);
  const novos = items.filter((n) => !vistos.has(assinaturaDoAviso(n)));
  const graves = novos.filter((n) => n.tone === "danger").length;

  /*
    O pop-up do que aparece com a tela aberta. A primeira leitura só
    registra o que já existia: abrir a plataforma não dispara nada.
  */
  /*
    Os dados chegam em partes na abertura (casos, NPS, Google, regras): cada
    parte faria aparecer avisos "novos". Nos primeiros 20 s tudo só é
    registrado — senão abrir a plataforma virava uma enxurrada de pop-ups.
  */
  const conhecidos = useRef<Set<string>>(new Set());
  const [montadoEm] = useState(() => Date.now());
  useEffect(() => {
    const agoraConhecidos = new Set(items.map(assinaturaDoAviso));
    if (Date.now() - montadoEm < 20_000) {
      conhecidos.current = agoraConhecidos;
      return;
    }
    for (const n of items) {
      const assinatura = assinaturaDoAviso(n);
      if (!conhecidos.current.has(assinatura) && n.tone !== "info" && !vistos.has(assinatura)) {
        notify({ tone: n.tone === "danger" ? "error" : "info", title: n.title, detail: n.detail, href: n.href, hrefLabel: "Ver" });
      }
    }
    conhecidos.current = agoraConhecidos;
  }, [items, notify, vistos, montadoEm]);

  const lista = filtro === "novas" ? novos : items;

  const grupos = useMemo(() => {
    const mapa = new Map<FrenteDoAviso, Notification[]>();
    for (const n of lista) mapa.set(n.frente ?? "operacao", [...(mapa.get(n.frente ?? "operacao") ?? []), n]);
    /* Ordem fixa das frentes: o lugar de cada grupo não pula entre uma olhada e outra. */
    return ORDEM_DAS_FRENTES.filter((f) => mapa.has(f)).map((f) => [f, mapa.get(f)!] as const);
  }, [lista]);

  function marcarVisto(n: Notification) {
    gravarVistos([...lerVistos(), assinaturaDoAviso(n)]);
  }

  function marcarTudo() {
    const atuais = new Set(items.map(assinaturaDoAviso));
    gravarVistos([...lerVistos().filter((a) => atuais.has(a)), ...items.map(assinaturaDoAviso)]);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-tour="sino"
        aria-label={novos.length ? `Notificações: ${novos.length} nova(s)` : "Notificações"}
        aria-expanded={open}
        title={novos.length === 0 ? "Nada novo" : `${novos.length} aviso(s) novo(s)`}
        className="relative rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
      >
        <Bell size={18} />
        {novos.length > 0 && (
          <span
            className={`absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white ${
              graves > 0 ? "bg-rose-500" : "bg-zinc-700"
            }`}
          >
            {novos.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div
            role="dialog"
            aria-label="Notificações"
            className="absolute right-0 top-[calc(100%+6px)] z-50 flex max-h-[min(560px,80vh)] w-[380px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_16px_40px_-16px_rgba(16,24,40,0.3)]"
          >
            <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2">
              <div className="flex rounded-md bg-zinc-100 p-0.5 text-xs">
                {(["novas", "todas"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={filtro === f}
                    onClick={() => setFiltro(f)}
                    className={`rounded px-2 py-1 font-medium transition-colors ${filtro === f ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}
                  >
                    {f === "novas" ? `Novas${novos.length ? ` · ${novos.length}` : ""}` : `Todas · ${items.length}`}
                  </button>
                ))}
              </div>

              <div className="ml-auto flex items-center gap-0.5">
                {novos.length > 0 && (
                  <button
                    type="button"
                    onClick={marcarTudo}
                    title="Marcar tudo como visto"
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                  >
                    <CheckCheck size={13} /> Tudo visto
                  </button>
                )}
                <Link
                  href="/conta?aba=notificacoes"
                  onClick={() => setOpen(false)}
                  title="Escolher o que avisar"
                  aria-label="Preferências de notificação"
                  className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                >
                  <Settings2 size={14} />
                </Link>
              </div>
            </div>

            <div className="rolagem-fina flex-1 overflow-y-auto">
              {lista.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <p className="text-sm font-medium text-zinc-700">{filtro === "novas" ? "Nada novo desde a última olhada." : "Nenhum aviso agora."}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {filtro === "novas" && items.length > 0 ? (
                      <button type="button" onClick={() => setFiltro("todas")} className="font-medium text-violet-700 hover:underline">
                        Ver os {items.length} avisos já vistos
                      </button>
                    ) : (
                      "Operação em dia."
                    )}
                  </p>
                </div>
              ) : (
                grupos.map(([frente, avisos]) => (
                  <section key={frente} className="border-b border-zinc-100 last:border-0">
                    <p className="px-3 pb-1 pt-2.5 text-[11px] font-medium text-zinc-400">{ROTULO_DA_FRENTE_DO_AVISO[frente]}</p>
                    <ul>
                      {avisos.map((n) => {
                        const visto = vistos.has(assinaturaDoAviso(n));
                        return (
                          <li key={n.id} className="group flex gap-2.5 px-3 py-2 hover:bg-zinc-50">
                            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${visto ? "bg-zinc-300" : PONTO[n.tone]}`} />
                            <div className="min-w-0 flex-1">
                              <Link
                                href={n.href}
                                onClick={() => {
                                  marcarVisto(n);
                                  setOpen(false);
                                }}
                                className={`block text-[13px] leading-snug hover:text-violet-700 ${visto ? "text-zinc-500" : "font-medium text-zinc-900"}`}
                              >
                                {n.title}
                              </Link>
                              <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-zinc-500">{n.detail}</p>
                            </div>
                            <div className="flex shrink-0 items-start gap-0.5 pt-0.5">
                              {n.janela && (
                                <button
                                  type="button"
                                  title="Abrir numa mini-janela"
                                  aria-label={`Abrir ${n.janela.titulo} numa mini-janela`}
                                  onClick={() => {
                                    marcarVisto(n);
                                    abrirJanela(n.janela!);
                                    setOpen(false);
                                  }}
                                  className="rounded p-1 text-zinc-400 hover:bg-white hover:text-violet-700"
                                >
                                  <AppWindow size={14} />
                                </button>
                              )}
                              {!visto && (
                                <button
                                  type="button"
                                  title="Marcar como visto"
                                  aria-label={`Marcar "${n.title}" como visto`}
                                  onClick={() => marcarVisto(n)}
                                  className="rounded p-1 text-zinc-400 opacity-0 hover:bg-white hover:text-emerald-700 focus-visible:opacity-100 group-hover:opacity-100"
                                >
                                  <Check size={14} />
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
