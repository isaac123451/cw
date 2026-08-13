"use client";

import { useState } from "react";

import {
  Bell,
  KeyRound,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";
import StateForm from "@/components/conta/StateForm";
import NotificationPrefs from "@/components/conta/NotificationPrefs";
import AccessAdmin from "@/components/conta/AccessAdmin";

import {
  AccessData,
  changePassword,
  updateProfile,
} from "@/lib/auth/account";

import { SessionUser } from "@/lib/context/SessionContext";

type Tab =
  | "perfil"
  | "senha"
  | "notificacoes"
  | "acessos";

const input =
  "h-11 w-full rounded-xl border border-zinc-200 px-3.5 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400";

const label =
  "text-[11px] font-semibold uppercase tracking-wide text-zinc-500";

interface Props {
  session: SessionUser | null;
  hasDatabase: boolean;
  access: AccessData;
  initialTab: Tab;
}

export default function AccountTabs({
  session,
  hasDatabase,
  access,
  initialTab,
}: Props) {

  const [tab, setTab] = useState<Tab>(initialTab);

  const admin = session?.role === "ADMIN";

  // Sem banco não há sessão real — mas a aba de acessos precisa aparecer
  // para explicar por que está indisponível.
  const tabs: {
    id: Tab;
    label: string;
    icon: typeof UserRound;
  }[] = [
    { id: "perfil", label: "Perfil", icon: UserRound },
    { id: "senha", label: "Senha", icon: KeyRound },
    {
      id: "notificacoes",
      label: "Notificações",
      icon: Bell,
    },
    ...(admin || !hasDatabase
      ? [
          {
            id: "acessos" as Tab,
            label: "Acessos",
            icon: ShieldCheck,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">

      <div className="overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">

        <div className="flex min-w-max">

          {tabs.map((item) => {

            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`relative flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
                  tab === item.id
                    ? "text-violet-800"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >

                <Icon size={15} />
                {item.label}

                {tab === item.id && (
                  <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-violet-800" />
                )}

              </button>
            );
          })}

        </div>

      </div>

      {tab === "perfil" && (

        <SurfaceCard
          title="Seus dados"
          description="Nome exibido nos casos, atividades e registros que você criar."
        >

          <StateForm
            action={updateProfile}
            submitLabel="Salvar perfil"
            disabled={!hasDatabase}
          >

            <div className="grid gap-4 sm:grid-cols-2">

              <div>

                <label htmlFor="name" className={label}>
                  Nome completo
                </label>

                <input
                  id="name"
                  name="name"
                  required
                  defaultValue={session?.name ?? ""}
                  placeholder="Seu nome"
                  className={`mt-1.5 ${input}`}
                />

              </div>

              <div>

                <label className={label}>
                  E-mail corporativo
                </label>

                <input
                  value={
                    session?.email ??
                    "modo demonstração"
                  }
                  disabled
                  title="O e-mail identifica a conta e não pode ser alterado."
                  className={`mt-1.5 ${input} cursor-not-allowed bg-zinc-50 text-zinc-500`}
                />

                <p className="mt-1.5 text-xs text-zinc-400">
                  O e-mail identifica a conta e não muda.
                </p>

              </div>

            </div>

            <div>

              <label className={label}>Papel</label>

              <p className="mt-1.5 text-sm text-zinc-700">
                {session?.role === "ADMIN"
                  ? "Administrador — acesso total, incluindo a gestão de acessos."
                  : session?.role === "LEITURA"
                  ? "Leitura — visualiza sem alterar."
                  : session
                  ? "Agente — trabalha os casos e registra tratativas."
                  : "Sem sessão ativa (modo demonstração)."}
              </p>

            </div>

          </StateForm>

        </SurfaceCard>

      )}

      {tab === "senha" && (

        <SurfaceCard
          title="Alterar senha"
          description="Precisamos da senha atual para confirmar que é você."
          hint="A senha é guardada como hash bcrypt — nem o banco nem esta tela têm acesso ao texto original."
        >

          <StateForm
            action={changePassword}
            submitLabel="Alterar senha"
            disabled={!hasDatabase}
          >

            <div>

              <label htmlFor="current" className={label}>
                Senha atual
              </label>

              <input
                id="current"
                name="current"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className={`mt-1.5 ${input} max-w-sm`}
              />

            </div>

            <div className="grid max-w-2xl gap-4 sm:grid-cols-2">

              <div>

                <label
                  htmlFor="password"
                  className={label}
                >
                  Nova senha
                </label>

                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={`mt-1.5 ${input}`}
                />

                <p className="mt-1.5 text-xs text-zinc-400">
                  Mínimo de 8 caracteres.
                </p>

              </div>

              <div>

                <label
                  htmlFor="confirm"
                  className={label}
                >
                  Confirmar nova senha
                </label>

                <input
                  id="confirm"
                  name="confirm"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={`mt-1.5 ${input}`}
                />

              </div>

            </div>

          </StateForm>

        </SurfaceCard>

      )}

      {tab === "notificacoes" && <NotificationPrefs />}

      {tab === "acessos" && (
        <AccessAdmin
          data={access}
          hasDatabase={hasDatabase}
          currentUserId={session?.id ?? ""}
        />
      )}

    </div>
  );
}
