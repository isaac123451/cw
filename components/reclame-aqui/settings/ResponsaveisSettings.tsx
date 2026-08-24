"use client";

import { useMemo, useState } from "react";

import {
  ArrowRightLeft,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";

import { useTeams } from "@/lib/context/TeamsContext";

import SurfaceCard from "@/components/shared/SurfaceCard";
import { ConfirmDelete } from "@/components/shared/Modal";

const campo =
  "h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400";

/**
 * Quem atende reclamação, e em que time.
 *
 * **Isto morava numa aba própria, "Meu time", e essa era a queixa.**
 * Havia dois cadastros de time em paralelo: o do fluxo de reclamações
 * (ao lado) e o daquela aba, que não conversava com reclamação, NPS
 * nem ManyChat. Duas listas com o mesmo nome e conteúdo diferente é
 * como uma operação passa a discutir qual das duas está certa.
 *
 * Agora é um lugar só, aqui dentro do fluxo — o time que classifica a
 * reclamação é o mesmo que tem gente dentro.
 *
 * **E-mail é opcional de propósito.** Uma pessoa pode receber caso sem
 * ter login: o servidor gera um endereço em `@sem-acesso.local`, que é
 * domínio reservado e não roteia. Exigir e-mail obrigaria a inventar
 * um, e endereço inventado é pior do que nenhum — no dia em que a
 * pessoa se cadastrasse de verdade, o endereço dela já estaria ocupado
 * por uma linha que não é dela.
 */
export default function ResponsaveisSettings() {

  const {
    teams,
    addMember,
    removeMember,
    moveMember,
    loading,
  } = useTeams();

  const [novo, setNovo] = useState<{
    teamId: string;
    name: string;
    role: string;
  }>({ teamId: "", name: "", role: "" });

  const [apagando, setApagando] = useState<{
    teamId: string;
    memberId: string;
    name: string;
  } | null>(null);

  const ativos = useMemo(
    () => teams.filter((t) => t.active !== false),
    [teams]
  );

  const total = useMemo(
    () =>
      new Set(
        teams.flatMap((t) =>
          t.members.map((m) => m.email)
        )
      ).size,
    [teams]
  );

  function adicionar() {

    const nome = novo.name.trim();

    if (!nome || !novo.teamId) return;

    /**
     * O e-mail vai vazio, sempre.
     *
     * O servidor gera um endereço em `@sem-acesso.local` — domínio
     * reservado, que não roteia, e que o autocadastro recusa porque
     * exige `@cardapioweb.com`. A linha existe para a reclamação ter
     * para onde apontar; ela não abre porta nenhuma.
     */
    addMember(novo.teamId, {
      name: nome,
      email: "",
      role: novo.role.trim() || "Atendimento",
      online: false,
    } as never);

    setNovo({
      teamId: novo.teamId,
      name: "",
      role: "",
    });
  }

  if (loading) {
    return (
      <SurfaceCard
        title="Responsáveis"
        description="Quem pode receber uma reclamação."
      >
        <p className="py-8 text-center text-sm text-zinc-400">
          Carregando…
        </p>
      </SurfaceCard>
    );
  }

  return (
    <>
      <SurfaceCard
        title="Responsáveis"
        description="Quem pode receber uma reclamação, e em que time. É a mesma lista que aparece no seletor de responsável do caso."
        action={
          <span className="shrink-0 rounded-xl bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600">
            {total} pessoa(s)
          </span>
        }
      >

        {ativos.length === 0 ? (

          <p className="rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-700 ring-1 ring-inset ring-amber-100">
            Cadastre um time acima antes de acrescentar
            pessoas — toda pessoa pertence a um time.
          </p>

        ) : (

          <>
            {/* ---- acrescentar ---- */}

            <div className="rounded-2xl border border-zinc-200/80 p-4">

              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Acrescentar pessoa
              </p>

              <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">

                <select
                  value={novo.teamId}
                  onChange={(e) =>
                    setNovo({
                      ...novo,
                      teamId: e.target.value,
                    })
                  }
                  className={campo}
                >
                  <option value="">Time…</option>
                  {ativos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>

                <input
                  value={novo.name}
                  onChange={(e) =>
                    setNovo({
                      ...novo,
                      name: e.target.value,
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") adicionar();
                  }}
                  placeholder="Nome do responsável"
                  className={campo}
                />

                <div className="flex gap-2">

                  <input
                    value={novo.role}
                    onChange={(e) =>
                      setNovo({
                        ...novo,
                        role: e.target.value,
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") adicionar();
                    }}
                    placeholder="Função (opcional)"
                    className={campo}
                  />

                  <button
                    onClick={adicionar}
                    disabled={
                      !novo.name.trim() || !novo.teamId
                    }
                    className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-violet-800 px-3.5 text-sm font-medium text-white transition-colors hover:bg-violet-900 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus size={15} />
                    Incluir
                  </button>

                </div>

              </div>

              {/*
                Não há campo de e-mail, e é decisão, não esquecimento.

                Responsável é cadastro, como um time é cadastro: um nome
                que a reclamação pode apontar. Não é conta de acesso —
                pedir e-mail aqui faria parecer que criar responsável
                cria login, e alguém acabaria inventando um endereço só
                para preencher o campo. Quem precisa entrar na
                plataforma se cadastra pelo login e recebe papel em
                Configurações › Permissões, que é outro assunto.
              */}
              <p className="mt-2.5 text-xs text-zinc-400">
                Só nome e time. Responsável é cadastro, não
                conta de acesso — quem precisa entrar na
                plataforma se cadastra pelo login.
              </p>

            </div>

            {/* ---- as pessoas, por time ---- */}

            <div className="mt-5 space-y-4">

              {ativos.map((time) => (

                <div key={time.id}>

                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-800">
                    {time.name}
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500">
                      {time.members.length}
                    </span>
                  </p>

                  {time.members.length === 0 ? (

                    <p className="rounded-xl border border-dashed border-zinc-200 px-3.5 py-3 text-sm text-zinc-400">
                      Ninguém neste time ainda.
                    </p>

                  ) : (

                    <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200/80">

                      {time.members.map((pessoa) => (

                        <li
                          key={pessoa.id}
                          className="group flex items-center gap-3 px-3.5 py-2.5"
                        >

                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-700">
                            <UserRound size={14} />
                          </span>

                          <span className="min-w-0 flex-1">

                            <span className="block truncate text-sm font-medium text-zinc-800">
                              {pessoa.name}
                            </span>

                            {/*
                              Só a função.

                              O endereço gerado não é informação para
                              ninguém: mostrar "@sem-acesso.local" faria
                              parecer que há um e-mail errado no
                              cadastro, e alguém tentaria "corrigir".
                            */}
                            <span className="block truncate text-xs text-zinc-500">
                              {pessoa.role}
                            </span>

                          </span>

                          {/* Transferir de time. */}
                          {ativos.length > 1 && (
                            <select
                              value=""
                              onChange={(e) => {
                                if (!e.target.value) return;
                                moveMember(
                                  time.id,
                                  e.target.value,
                                  pessoa.id
                                );
                              }}
                              title="Transferir para outro time"
                              className="h-8 rounded-lg border border-zinc-200 px-2 text-xs text-zinc-600 opacity-0 outline-none transition-opacity focus:border-violet-400 focus:opacity-100 group-hover:opacity-100"
                            >
                              <option value="">
                                mover…
                              </option>
                              {ativos
                                .filter(
                                  (t) => t.id !== time.id
                                )
                                .map((t) => (
                                  <option
                                    key={t.id}
                                    value={t.id}
                                  >
                                    {t.name}
                                  </option>
                                ))}
                            </select>
                          )}

                          <button
                            onClick={() =>
                              setApagando({
                                teamId: time.id,
                                memberId: pessoa.id,
                                name: pessoa.name,
                              })
                            }
                            aria-label={`Remover ${pessoa.name}`}
                            className="rounded-lg p-1.5 text-zinc-400 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                          >
                            <Trash2 size={15} />
                          </button>

                        </li>

                      ))}

                    </ul>

                  )}

                </div>

              ))}

            </div>

            <p className="mt-4 flex items-start gap-2 text-xs text-zinc-400">
              <ArrowRightLeft
                size={13}
                className="mt-0.5 shrink-0"
              />
              Incluir, mover e remover valem na hora — não
              passam pelo botão Salvar dos times, porque
              mexem em pessoas e não no cadastro do time.
            </p>
          </>

        )}

      </SurfaceCard>

      <ConfirmDelete
        open={apagando !== null}
        label={apagando?.name ?? ""}
        onConfirm={() => {
          if (apagando) {
            removeMember(
              apagando.teamId,
              apagando.memberId
            );
          }
          setApagando(null);
        }}
        onCancel={() => setApagando(null)}
      />
    </>
  );
}
