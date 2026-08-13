"use client";

import Link from "next/link";

import { useState } from "react";

import {
  Bell,
  ChevronDown,
  KeyRound,
  LogOut,
  ShieldCheck,
  User,
  UserRound,
} from "lucide-react";

import { signOut } from "@/lib/auth/actions";

interface Props {
  name: string;
  email: string;
  authenticated: boolean;
  admin?: boolean;
}

const atalhos = [
  {
    href: "/conta?aba=perfil",
    label: "Meu perfil",
    icon: UserRound,
    hint: "Nome exibido nos casos e registros que você criar.",
  },
  {
    href: "/conta?aba=senha",
    label: "Alterar senha",
    icon: KeyRound,
    hint: "Trocar a senha de acesso à plataforma.",
  },
  {
    href: "/conta?aba=notificacoes",
    label: "Notificações",
    icon: Bell,
    hint: "Escolher quais alertas aparecem no sino.",
  },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function UserMenu({
  name,
  email,
  authenticated,
  admin = false,
}: Props) {

  const [open, setOpen] = useState(false);

  return (
    <div className="relative">

      <button
        onClick={() => setOpen((value) => !value)}
        title={email}
        className="flex items-center gap-2.5 rounded-xl border border-zinc-200 py-1.5 pl-1.5 pr-2.5 transition-colors hover:bg-zinc-50"
      >

        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-800 text-[11px] font-semibold text-white">
          {initials(name)}
        </span>

        <span className="hidden text-sm font-medium text-zinc-700 sm:block">
          {name.split(" ")[0]}
        </span>

        <ChevronDown
          size={14}
          className={`text-zinc-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />

      </button>

      {open && (

        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_12px_32px_-12px_rgba(16,24,40,0.25)]">

            <div className="border-b border-zinc-100 px-4 py-3">

              <p className="truncate text-sm font-semibold text-zinc-900">
                {name}
              </p>

              <p className="truncate text-xs text-zinc-500">
                {email}
              </p>

            </div>

            <div className="p-1.5">

              {atalhos.map((item) => {

                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    title={item.hint}
                    className="flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
                  >
                    <Icon
                      size={15}
                      className="text-zinc-400"
                    />
                    {item.label}
                  </Link>
                );
              })}

              {admin && (
                <Link
                  href="/conta?aba=acessos"
                  onClick={() => setOpen(false)}
                  title="Liberar e-mails e administrar contas da plataforma."
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
                >
                  <ShieldCheck
                    size={15}
                    className="text-zinc-400"
                  />
                  Administrar acessos
                </Link>
              )}

            </div>

            {authenticated ? (

              <form
                action={signOut}
                className="border-t border-zinc-100"
              >
                <button
                  type="submit"
                  className="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
                >
                  <LogOut size={15} />
                  Sair da conta
                </button>
              </form>

            ) : (

              <p className="flex items-start gap-2 border-t border-zinc-100 px-4 py-3 text-xs leading-relaxed text-zinc-500">
                <User size={13} className="mt-0.5 shrink-0" />
                Modo demonstração — configure o banco para
                habilitar o login.
              </p>

            )}

          </div>
        </>

      )}

    </div>
  );
}
