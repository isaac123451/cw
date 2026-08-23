"use client";

import { useMemo, useState } from "react";

import {
  Mail,
  Pencil,
  Plus,
  Shield,
  Trash2,
  UserRound,
  Users,
  UsersRound,
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import StatTile from "@/components/shared/StatTile";
import SurfaceCard from "@/components/shared/SurfaceCard";
import { ConfirmDelete } from "@/components/shared/Modal";

import TeamForm from "@/components/times/TeamForm";
import MemberForm from "@/components/times/MemberForm";

import {
  MemberDraft,
  TeamDraft,
  useTeams,
} from "@/lib/context/TeamsContext";

import { Team, TeamMember } from "@/lib/models/team";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function TimesPage() {

  const {
    teams,
    people,
    createTeam,
    updateTeam,
    removeTeam,
    addMember,
    updateMember,
    removeMember,
    moveMember,
  } = useTeams();

  const [selectedId, setSelectedId] = useState<string>(
    teams[0]?.id ?? ""
  );

  const [teamForm, setTeamForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team>();
  const [deletingTeam, setDeletingTeam] = useState<Team>();

  const [memberForm, setMemberForm] = useState(false);
  const [editingMember, setEditingMember] =
    useState<TeamMember>();
  const [deletingMember, setDeletingMember] =
    useState<TeamMember>();

  const [dragOver, setDragOver] = useState<string | null>(
    null
  );

  const team =
    teams.find((item) => item.id === selectedId) ??
    teams[0];

  const online = useMemo(
    () => people.filter((item) => item.online).length,
    [people]
  );

  const ativos = teams.filter((item) => item.active);

  function salvarTime(data: TeamDraft) {

    if (editingTeam) updateTeam(editingTeam.id, data);
    else createTeam(data);

    setTeamForm(false);
    setEditingTeam(undefined);
  }

  function salvarMembro(data: MemberDraft) {

    if (!team) return;

    if (editingMember) {
      updateMember(team.id, {
        ...editingMember,
        ...data,
      });
    } else {
      addMember(team.id, data);
    }

    setMemberForm(false);
    setEditingMember(undefined);
  }

  return (
    <MainLayout>

      <div className="space-y-6">

        <PageHeading
          eyebrow="Pessoas"
          title="Times"
          description="Quem atende, em qual time e com qual cargo. Alimenta os responsáveis de toda a plataforma."
        >
          <button
            onClick={() => {
              setEditingTeam(undefined);
              setTeamForm(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800"
          >
            <Plus size={16} />
            Novo time
          </button>
        </PageHeading>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <StatTile
            label="Times"
            description="Times cadastrados, ativos e inativos."
            value={teams.length}
            hint={`${ativos.length} ativo(s)`}
            icon={UsersRound}
            tone="primary"
          />

          <StatTile
            label="Pessoas"
            description="Integrantes distintos somando todos os times."
            value={people.length}
            hint="na operação"
            icon={Users}
            tone="info"
          />

          <StatTile
            label="Disponíveis agora"
            description="Pessoas marcadas como disponíveis."
            value={online}
            hint="prontas para atender"
            icon={UserRound}
            tone="success"
          />

          <StatTile
            label="Cargos distintos"
            description="Variedade de funções na operação."
            value={
              new Set(people.map((item) => item.role)).size
            }
            hint="funções mapeadas"
            icon={Shield}
            tone="warning"
          />

        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">

          {/* Lista de times */}

          <SurfaceCard
            title="Times"
            description="Arraste uma pessoa para transferir de time."
            bodyClassName="p-2"
          >

            <ul className="space-y-1">

              {teams.map((item) => (

                <li key={item.id}>

                  <div
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragOver(item.id);
                    }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragOver(null);

                      const payload =
                        event.dataTransfer.getData(
                          "text/plain"
                        );

                      const [fromTeam, memberId] =
                        payload.split("|");

                      if (fromTeam && memberId) {
                        moveMember(
                          fromTeam,
                          item.id,
                          memberId
                        );
                      }
                    }}
                    className={`group flex items-center gap-2 rounded-xl px-3 py-2.5 transition-colors ${
                      dragOver === item.id
                        ? "bg-violet-100 ring-1 ring-inset ring-violet-300"
                        : team?.id === item.id
                        ? "bg-violet-50 ring-1 ring-inset ring-violet-200"
                        : "hover:bg-zinc-50"
                    }`}
                  >

                    <button
                      onClick={() =>
                        setSelectedId(item.id)
                      }
                      className="min-w-0 flex-1 text-left"
                    >

                      <span className="flex items-center gap-2">

                        <span className="truncate text-sm font-medium text-zinc-800">
                          {item.name}
                        </span>

                        {!item.active && (
                          <span className="shrink-0 rounded bg-zinc-200 px-1.5 text-[10px] font-medium text-zinc-600">
                            inativo
                          </span>
                        )}

                      </span>

                      <span className="mt-0.5 block truncate text-[11px] text-zinc-500">
                        {item.department} ·{" "}
                        {item.members.length} pessoa(s)
                      </span>

                    </button>

                    <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">

                      <button
                        onClick={() => {
                          setEditingTeam(item);
                          setTeamForm(true);
                        }}
                        title="Editar time"
                        className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white hover:text-violet-700"
                      >
                        <Pencil size={13} />
                      </button>

                      <button
                        onClick={() =>
                          setDeletingTeam(item)
                        }
                        title="Excluir time"
                        className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white hover:text-rose-600"
                      >
                        <Trash2 size={13} />
                      </button>

                    </div>

                  </div>

                </li>

              ))}

            </ul>

          </SurfaceCard>

          {/* Detalhe do time */}

          {team ? (

            <div className="space-y-4">

              <div className="rounded-2xl border border-zinc-200/80 bg-gradient-to-br from-violet-50 via-white to-amber-50/60 p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">

                <div className="flex flex-wrap items-start justify-between gap-4">

                  <div className="min-w-0">

                    <div className="flex flex-wrap items-center gap-2">

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
                          team.active
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                            : "bg-zinc-100 text-zinc-500 ring-zinc-200"
                        }`}
                      >
                        {team.active
                          ? "Time ativo"
                          : "Time inativo"}
                      </span>

                    </div>

                    <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">
                      {team.name}
                    </h2>

                    <p className="mt-1.5 max-w-xl text-sm text-zinc-600">
                      {team.description ||
                        "Sem descrição cadastrada."}
                    </p>

                  </div>

                  <button
                    onClick={() => {
                      setEditingTeam(team);
                      setTeamForm(true);
                    }}
                    className="flex shrink-0 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                  >
                    <Pencil size={15} />
                    Editar time
                  </button>

                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">

                  {[
                    {
                      label: "Departamento",
                      value: team.department,
                    },
                    {
                      label: "Responsável",
                      value:
                        team.leader || "Não definido",
                    },
                    {
                      label: "Integrantes",
                      value: `${team.members.length} pessoa(s)`,
                    },
                  ].map((card) => (

                    <div
                      key={card.label}
                      className="rounded-xl bg-white/80 p-3.5 ring-1 ring-inset ring-violet-100"
                    >

                      <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-600">
                        {card.label}
                      </p>

                      <p className="mt-1 truncate text-sm font-semibold text-zinc-900">
                        {card.value}
                      </p>

                    </div>

                  ))}

                </div>

              </div>

              <SurfaceCard
                title="Integrantes"
                description="Arraste um cartão para outro time na lista ao lado."
                bodyClassName="p-0"
                action={
                  <button
                    onClick={() => {
                      setEditingMember(undefined);
                      setMemberForm(true);
                    }}
                    className="flex shrink-0 items-center gap-2 rounded-xl border border-violet-200 px-3.5 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
                  >
                    <Plus size={15} />
                    Adicionar pessoa
                  </button>
                }
              >

                {team.members.length === 0 ? (

                  <div className="flex flex-col items-center py-12 text-center">

                    <Users
                      size={26}
                      className="text-zinc-300"
                    />

                    <p className="mt-3 text-sm font-medium text-zinc-700">
                      Nenhuma pessoa neste time.
                    </p>

                    <button
                      onClick={() => {
                        setEditingMember(undefined);
                        setMemberForm(true);
                      }}
                      className="mt-4 flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800"
                    >
                      <Plus size={15} />
                      Adicionar a primeira
                    </button>

                  </div>

                ) : (

                  <ul className="divide-y divide-zinc-100">

                    {team.members.map((member) => (

                      <li
                        key={member.id}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData(
                            "text/plain",
                            `${team.id}|${member.id}`
                          );
                          event.dataTransfer.effectAllowed =
                            "move";
                        }}
                        className="group flex cursor-grab items-center gap-4 px-6 py-4 transition-colors active:cursor-grabbing hover:bg-zinc-50/70"
                      >

                        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-50 text-xs font-semibold text-violet-700">

                          {initials(member.name)}

                          {member.online && (
                            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                          )}

                        </span>

                        <div className="min-w-0 flex-1">

                          <p className="flex items-center gap-2 truncate text-sm font-medium text-zinc-800">

                            {member.name}

                            {member.name === team.leader && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                                <Shield size={9} />
                                Responsável
                              </span>
                            )}

                          </p>

                          <p className="mt-0.5 truncate text-xs text-zinc-500">
                            {member.role}
                          </p>

                          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-zinc-400">
                            <Mail size={11} />
                            {member.email}
                          </p>

                        </div>

                        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">

                          <button
                            onClick={() => {
                              setEditingMember(member);
                              setMemberForm(true);
                            }}
                            title="Editar integrante"
                            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-violet-50 hover:text-violet-700"
                          >
                            <Pencil size={15} />
                          </button>

                          <button
                            onClick={() =>
                              setDeletingMember(member)
                            }
                            title="Remover do time"
                            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 size={15} />
                          </button>

                        </div>

                      </li>

                    ))}

                  </ul>

                )}

              </SurfaceCard>

            </div>

          ) : (

            <SurfaceCard>
              <p className="py-12 text-center text-sm text-zinc-400">
                Nenhum time cadastrado. Crie o primeiro.
              </p>
            </SurfaceCard>

          )}

        </div>

      </div>

      {teamForm && (
        <TeamForm
          key={editingTeam?.id ?? "novo"}
          open={teamForm}
          editing={editingTeam}
          onClose={() => {
            setTeamForm(false);
            setEditingTeam(undefined);
          }}
          onSave={salvarTime}
        />
      )}

      {memberForm && (
        <MemberForm
          key={editingMember?.id ?? "novo"}
          open={memberForm}
          editing={editingMember}
          teamName={team?.name ?? ""}
          onClose={() => {
            setMemberForm(false);
            setEditingMember(undefined);
          }}
          onSave={salvarMembro}
        />
      )}

      <ConfirmDelete
        open={Boolean(deletingTeam)}
        label={deletingTeam?.name ?? ""}
        onCancel={() => setDeletingTeam(undefined)}
        onConfirm={() => {
          if (deletingTeam) {
            removeTeam(deletingTeam.id);
            if (deletingTeam.id === selectedId) {
              setSelectedId(
                teams.find(
                  (item) => item.id !== deletingTeam.id
                )?.id ?? ""
              );
            }
          }
          setDeletingTeam(undefined);
        }}
      />

      <ConfirmDelete
        open={Boolean(deletingMember)}
        label={deletingMember?.name ?? ""}
        onCancel={() => setDeletingMember(undefined)}
        onConfirm={() => {
          if (deletingMember && team) {
            removeMember(team.id, deletingMember.id);
          }
          setDeletingMember(undefined);
        }}
      />

    </MainLayout>
  );
}
