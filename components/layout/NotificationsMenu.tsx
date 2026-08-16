"use client";

import Link from "next/link";

import { useMemo, useState } from "react";

import {
  Bell,
  BellOff,
  Settings2,
  TriangleAlert,
} from "lucide-react";

import { useCases } from "@/lib/context/CaseContext";
import { useAgenda } from "@/lib/context/AgendaContext";
import { useMovements } from "@/lib/context/MovementsContext";
import { useSession } from "@/lib/context/SessionContext";
import { usePreferences } from "@/lib/context/PreferencesContext";
import { useGoogleEvents } from "@/lib/context/GoogleEventsContext";

import {
  buildNotifications,
  NotificationTone,
} from "@/lib/services/notifications.service";

const tone: Record<
  NotificationTone,
  { dot: string; chip: string }
> = {
  danger: {
    dot: "bg-rose-500",
    chip: "bg-rose-50 text-rose-700 ring-rose-100",
  },
  warning: {
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-700 ring-amber-100",
  },
  info: {
    dot: "bg-sky-500",
    chip: "bg-sky-50 text-sky-700 ring-sky-100",
  },
};

export default function NotificationsMenu() {

  const { cases } = useCases();
  const { tasks } = useAgenda();
  const { movements } = useMovements();
  const session = useSession();
  const { prefs } = usePreferences();
  const { events: googleEvents } = useGoogleEvents();

  const [open, setOpen] = useState(false);

  const items = useMemo(
    () =>
      buildNotifications(
        cases,
        tasks,
        prefs.notifications,
        prefs.somenteMinhas
          ? session?.name
          : undefined,
        movements,
        googleEvents
      ),
    [
      cases,
      tasks,
      prefs,
      session,
      movements,
      googleEvents,
    ]
  );

  const criticos = items.filter(
    (item) => item.tone === "danger"
  ).length;

  return (
    <div className="relative">

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Notificações"
        title={
          items.length === 0
            ? "Nenhum alerta no momento"
            : `${items.length} alerta(s) da operação`
        }
        className="relative rounded-xl border border-zinc-200 p-2.5 text-zinc-600 transition-colors hover:bg-zinc-50"
      >

        <Bell size={17} />

        {items.length > 0 && (
          <span
            className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white ${
              criticos > 0 ? "bg-rose-500" : "bg-amber-500"
            }`}
          >
            {items.length}
          </span>
        )}

      </button>

      {open && (

        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_12px_32px_-12px_rgba(16,24,40,0.25)]">

            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">

              <p className="text-sm font-semibold text-zinc-900">
                Notificações
              </p>

              <Link
                href="/conta?aba=notificacoes"
                onClick={() => setOpen(false)}
                title="Escolher quais alertas você quer receber"
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-violet-700"
              >
                <Settings2 size={13} />
                Preferências
              </Link>

            </div>

            {items.length === 0 ? (

              <div className="px-4 py-10 text-center">

                <BellOff
                  size={24}
                  className="mx-auto text-zinc-300"
                />

                <p className="mt-2.5 text-sm text-zinc-500">
                  Nenhum alerta no momento.
                </p>

                <p className="mt-1 text-xs text-zinc-400">
                  Tudo em dia na operação.
                </p>

              </div>

            ) : (

              <ul className="max-h-[380px] overflow-y-auto">

                {items.map((item) => (

                  <li key={item.id}>

                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="flex gap-3 border-b border-zinc-100 px-4 py-3 transition-colors last:border-0 hover:bg-violet-50/50"
                    >

                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          tone[item.tone].dot
                        }`}
                      />

                      <span className="min-w-0 flex-1">

                        <span className="block text-sm font-medium leading-snug text-zinc-800">
                          {item.title}
                        </span>

                        <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">
                          {item.detail}
                        </span>

                      </span>

                    </Link>

                  </li>

                ))}

              </ul>

            )}

            {criticos > 0 && (

              <p className="flex items-center gap-2 border-t border-zinc-100 bg-rose-50/50 px-4 py-2.5 text-[11px] font-medium text-rose-700">
                <TriangleAlert size={12} />
                {criticos} alerta(s) crítico(s) afetando a
                nota.
              </p>

            )}

          </div>
        </>

      )}

    </div>
  );
}
