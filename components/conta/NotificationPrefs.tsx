"use client";

import { RotateCcw } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { usePreferences } from "@/lib/context/PreferencesContext";

import {
  NotificationPrefs as Prefs,
  prefLabels,
} from "@/lib/services/notifications.service";

export default function NotificationPrefs() {

  const {
    prefs,
    setNotification,
    setSomenteMinhas,
    reset,
  } = usePreferences();

  const keys = Object.keys(
    prefLabels
  ) as (keyof Prefs)[];

  return (
    <div className="space-y-6">

      <SurfaceCard
        title="Alertas que você recebe"
        description="Aparecem no sino do topo, calculados a partir dos dados reais da operação."
        hint="Não existe um feed separado de notificações: os alertas leem os casos e a agenda direto, então nunca ficam desatualizados."
        action={
          <button
            onClick={reset}
            title="Voltar às preferências padrão"
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
          >
            <RotateCcw size={13} />
            Restaurar padrão
          </button>
        }
      >

        <div className="space-y-2">

          {keys.map((key) => (

            <label
              key={key}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200/80 p-4 transition-colors hover:bg-zinc-50/70"
            >

              <input
                type="checkbox"
                checked={prefs.notifications[key]}
                onChange={(e) =>
                  setNotification(key, e.target.checked)
                }
                className="mt-0.5 h-4 w-4 accent-violet-700"
              />

              <span className="min-w-0 flex-1">

                <span className="block text-sm font-medium text-zinc-800">
                  {prefLabels[key].label}
                </span>

                <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">
                  {prefLabels[key].hint}
                </span>

              </span>

            </label>

          ))}

        </div>

      </SurfaceCard>

      <SurfaceCard
        title="Escopo"
        description="Define o que entra na sua contagem de alertas."
      >

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200/80 p-4 transition-colors hover:bg-zinc-50/70">

          <input
            type="checkbox"
            checked={prefs.somenteMinhas}
            onChange={(e) =>
              setSomenteMinhas(e.target.checked)
            }
            className="mt-0.5 h-4 w-4 accent-violet-700"
          />

          <span className="min-w-0 flex-1">

            <span className="block text-sm font-medium text-zinc-800">
              Somente atividades atribuídas a mim
            </span>

            <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">
              Filtra os alertas da agenda pelo seu nome. Os
              alertas de reclamação continuam mostrando toda
              a operação, porque a nota é da empresa inteira.
            </span>

          </span>

        </label>

      </SurfaceCard>

      <p className="text-xs leading-relaxed text-zinc-400">
        As preferências ficam salvas neste navegador e
        sobrevivem ao recarregar a página.
      </p>

    </div>
  );
}
