"use client";

import { useState, useTransition } from "react";

import {
  Database,
  MailCheck,
  ShieldCheck,
  Trash2,
  UserRoundX,
} from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";
import StateForm from "@/components/conta/StateForm";
import { ConfirmDelete } from "@/components/shared/Modal";

import {
  AccessData,
  allowEmail,
  revokeEmail,
  setUserRole,
  toggleUserActive,
} from "@/lib/auth/account";

import { ALLOWED_DOMAIN } from "@/lib/auth/access";

const roleLabel: Record<string, string> = {
  ADMIN: "Administrador",
  AGENTE: "Agente",
  LEITURA: "Leitura",
};

const roleHint: Record<string, string> = {
  ADMIN: "Acesso total, incluindo esta tela de acessos.",
  AGENTE: "Trabalha os casos e registra tratativas.",
  LEITURA: "Só visualiza — não altera nada.",
};

const roleTone: Record<string, string> = {
  ADMIN: "bg-violet-50 text-violet-700 ring-violet-100",
  AGENTE: "bg-sky-50 text-sky-700 ring-sky-100",
  LEITURA: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

const input =
  "h-11 w-full rounded-xl border border-zinc-200 px-3.5 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400";

interface Props {
  data: AccessData;
  hasDatabase: boolean;
  currentUserId: string;
}

export default function AccessAdmin({
  data,
  hasDatabase,
  currentUserId,
}: Props) {

  const [pending, start] = useTransition();

  const [revoking, setRevoking] = useState<{
    id: string;
    email: string;
  }>();

  return (
    <div className="space-y-6">

      {!hasDatabase && (

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/60 px-5 py-4">

          <Database
            size={17}
            className="shrink-0 text-amber-600"
          />

          <p className="flex-1 text-sm leading-relaxed text-amber-900">
            A aplicação está em{" "}
            <strong className="font-semibold">
              modo demonstração
            </strong>
            . Enquanto não houver{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 text-[12px]">
              DATABASE_URL
            </code>{" "}
            configurada, só{" "}
            <strong className="font-semibold">
              carlos.isaac@{ALLOWED_DOMAIN}
            </strong>{" "}
            está liberado e o cadastro fica desativado.
          </p>

        </div>

      )}

      <SurfaceCard
        title="Liberar acesso"
        description={`Só e-mails @${ALLOWED_DOMAIN} liberados aqui conseguem criar conta.`}
        hint="A regra tem duas camadas: o domínio precisa ser corporativo e o e-mail precisa estar nesta lista. Uma coisa não substitui a outra."
      >

        <StateForm
          action={allowEmail}
          submitLabel="Liberar e-mail"
          disabled={!hasDatabase}
        >

          <div className="grid gap-4 sm:grid-cols-2">

            <div>

              <label
                htmlFor="email"
                className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
              >
                E-mail corporativo
              </label>

              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder={`nome@${ALLOWED_DOMAIN}`}
                className={`mt-1.5 ${input}`}
              />

            </div>

            <div>

              <label
                htmlFor="note"
                className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
              >
                Observação
              </label>

              <input
                id="note"
                name="note"
                placeholder="Time, motivo da liberação..."
                className={`mt-1.5 ${input}`}
              />

            </div>

          </div>

        </StateForm>

        <div className="mt-6 border-t border-zinc-100 pt-5">

          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            E-mails liberados ({data.allowed.length})
          </p>

          {data.allowed.length === 0 ? (

            <p className="rounded-xl border border-dashed border-zinc-200 py-8 text-center text-sm text-zinc-400">
              {hasDatabase
                ? "Nenhum e-mail liberado ainda."
                : "A lista aparece depois que o banco for configurado."}
            </p>

          ) : (

            <ul className="space-y-2">

              {data.allowed.map((item) => (

                <li
                  key={item.id}
                  className="group flex items-center gap-3 rounded-xl border border-zinc-200/80 px-4 py-3"
                >

                  <MailCheck
                    size={15}
                    className="shrink-0 text-emerald-600"
                  />

                  <span className="min-w-0 flex-1">

                    <span className="block truncate text-sm font-medium text-zinc-800">
                      {item.email}
                    </span>

                    {item.note && (
                      <span className="block truncate text-xs text-zinc-500">
                        {item.note}
                      </span>
                    )}

                  </span>

                  <button
                    onClick={() =>
                      setRevoking({
                        id: item.id,
                        email: item.email,
                      })
                    }
                    title="Revogar liberação"
                    className="shrink-0 rounded-lg p-2 text-zinc-400 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                  >
                    <Trash2 size={15} />
                  </button>

                </li>

              ))}

            </ul>

          )}

        </div>

      </SurfaceCard>

      <SurfaceCard
        title="Contas da plataforma"
        description="Quem já criou acesso, com papel e situação."
        hint="Revogar o e-mail não derruba quem já criou conta — para isso, desative a conta aqui."
      >

        {data.users.length === 0 ? (

          <p className="rounded-xl border border-dashed border-zinc-200 py-8 text-center text-sm text-zinc-400">
            {hasDatabase
              ? "Nenhuma conta criada ainda."
              : "As contas aparecem depois que o banco for configurado."}
          </p>

        ) : (

          <ul className="space-y-2">

            {data.users.map((user) => {

              const eu = user.id === currentUserId;

              return (
                <li
                  key={user.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200/80 px-4 py-3"
                >

                  <span className="min-w-0 flex-1">

                    <span className="flex items-center gap-2">

                      <span className="truncate text-sm font-medium text-zinc-800">
                        {user.name}
                      </span>

                      {eu && (
                        <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
                          você
                        </span>
                      )}

                      {!user.active && (
                        <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-100">
                          desativada
                        </span>
                      )}

                    </span>

                    <span className="block truncate text-xs text-zinc-500">
                      {user.email}
                    </span>

                  </span>

                  <select
                    value={user.role}
                    disabled={pending || eu}
                    onChange={(e) =>
                      start(() =>
                        setUserRole(
                          user.id,
                          e.target
                            .value as "ADMIN"
                        )
                      )
                    }
                    title={
                      eu
                        ? "Você não pode alterar o próprio papel"
                        : roleHint[user.role]
                    }
                    className={`h-9 shrink-0 rounded-lg px-2.5 text-xs font-semibold ring-1 ring-inset outline-none ${
                      roleTone[user.role]
                    } ${
                      eu
                        ? "cursor-not-allowed opacity-70"
                        : ""
                    }`}
                  >
                    {Object.keys(roleLabel).map((key) => (
                      <option key={key} value={key}>
                        {roleLabel[key]}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() =>
                      start(() =>
                        toggleUserActive(user.id)
                      )
                    }
                    disabled={pending || eu}
                    title={
                      eu
                        ? "Você não pode desativar a própria conta"
                        : user.active
                        ? "Desativar conta"
                        : "Reativar conta"
                    }
                    className="shrink-0 rounded-lg border border-zinc-200 p-2 text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {user.active ? (
                      <UserRoundX size={15} />
                    ) : (
                      <ShieldCheck size={15} />
                    )}
                  </button>

                </li>
              );
            })}

          </ul>

        )}

      </SurfaceCard>

      <ConfirmDelete
        open={Boolean(revoking)}
        label={revoking?.email ?? ""}
        onCancel={() => setRevoking(undefined)}
        onConfirm={() => {
          if (revoking) {
            const id = revoking.id;
            start(() => revokeEmail(id));
          }
          setRevoking(undefined);
        }}
      />

    </div>
  );
}
