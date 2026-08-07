"use client";

import { useState } from "react";

import { ChevronDown, LogOut, User } from "lucide-react";

import { signOut } from "@/lib/auth/actions";

interface Props {
  name: string;
  email: string;
  authenticated: boolean;
}

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

            {authenticated ? (

              <form action={signOut}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
                >
                  <LogOut size={15} />
                  Sair da conta
                </button>
              </form>

            ) : (

              <p className="flex items-start gap-2 px-4 py-3 text-xs leading-relaxed text-zinc-500">
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
