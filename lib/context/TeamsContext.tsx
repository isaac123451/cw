"use client";

import {
  createContext,
  useContext,
  useMemo,
  ReactNode,
} from "react";

import { Team, TeamMember } from "@/lib/models/team";

import {
  assignTeamMember,
  removeTeamRecord,
  saveTeam,
  unassignTeamMember,
} from "@/lib/actions/registry";

import { useWorkspaceSlice } from "@/lib/context/useWorkspace";
import { sincronizar } from "@/lib/context/sync";

export type TeamDraft = Omit<Team, "id" | "members">;
export type MemberDraft = Omit<TeamMember, "id">;

interface TeamsContextType {
  teams: Team[];

  /** Carga inicial ainda em andamento. */
  loading: boolean;

  /**
   * Quem recebe atendimentos — alimenta os seletores de responsável.
   *
   * Eram todas as pessoas de todos os times; desde 07/10/2026 é só quem
   * está marcado em Permissões ("tem que ter algo marcado para deixar
   * ativo receber coisas"). Os times são as áreas (Suporte, Financeiro…),
   * não quem atende.
   */
  people: TeamMember[];

  createTeam: (data: TeamDraft) => void;
  updateTeam: (id: string, data: TeamDraft) => void;
  removeTeam: (id: string) => void;

  addMember: (teamId: string, data: MemberDraft) => void;
  updateMember: (
    teamId: string,
    member: TeamMember
  ) => void;
  removeMember: (teamId: string, memberId: string) => void;
  /** Transfere alguém de um time para outro. */
  moveMember: (
    fromTeamId: string,
    toTeamId: string,
    memberId: string
  ) => void;
}

const TeamsContext =
  createContext<TeamsContextType | null>(null);

export function TeamsProvider({
  children,
}: {
  children: ReactNode;
}) {

  const [teams, setTeams, loading] = useWorkspaceSlice(
    (dados) => dados.teams,
    [] as Team[]
  );

  const [quemRecebe] = useWorkspaceSlice(
    (dados) => dados.quemRecebe,
    [] as { id: string; name: string; email: string; role: string }[]
  );

  const people = useMemo<TeamMember[]>(
    () =>
      quemRecebe.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        email: p.email,
        online: false,
        openCases: 0,
      })),
    [quemRecebe]
  );

  const value = useMemo<TeamsContextType>(
    () => ({
      teams,
      people,
      loading,

      createTeam: (data) => {

        const novo: Team = {
          ...data,
          id: crypto.randomUUID(),
          members: [],
        };

        setTeams((prev) => [...prev, novo]);
        sincronizar(() => saveTeam(novo));
      },

      updateTeam: (id, data) => {

        const atual = teams.find(
          (team) => team.id === id
        );

        if (!atual) return;

        const alterado = { ...atual, ...data };

        setTeams((prev) =>
          prev.map((team) =>
            team.id === id ? alterado : team
          )
        );

        sincronizar(() => saveTeam(alterado));
      },

      removeTeam: (id) => {
        setTeams((prev) =>
          prev.filter((team) => team.id !== id)
        );
        sincronizar(() => removeTeamRecord(id));
      },

      addMember: (teamId, data) => {

        const membro: TeamMember = {
          ...data,
          id: crypto.randomUUID(),
        };

        setTeams((prev) =>
          prev.map((team) =>
            team.id === teamId
              ? {
                  ...team,
                  members: [...team.members, membro],
                }
              : team
          )
        );

        sincronizar(() =>
          assignTeamMember(teamId, membro)
        );
      },

      updateMember: (teamId, member) => {
        setTeams((prev) =>
          prev.map((team) =>
            team.id === teamId
              ? {
                  ...team,
                  members: team.members.map((item) =>
                    item.id === member.id ? member : item
                  ),
                }
              : team
          )
        );

        sincronizar(() =>
          assignTeamMember(teamId, member)
        );
      },

      removeMember: (teamId, memberId) => {

        const pessoa = teams
          .find((team) => team.id === teamId)
          ?.members.find(
            (item) => item.id === memberId
          );

        setTeams((prev) =>
          prev.map((team) =>
            team.id === teamId
              ? {
                  ...team,
                  members: team.members.filter(
                    (item) => item.id !== memberId
                  ),
                }
              : team
          )
        );

        if (pessoa) {
          sincronizar(() =>
            unassignTeamMember(pessoa.email)
          );
        }
      },

      moveMember: (fromTeamId, toTeamId, memberId) => {

        const origem = teams.find(
          (team) => team.id === fromTeamId
        );

        const pessoa = origem?.members.find(
          (item) => item.id === memberId
        );

        if (!pessoa || fromTeamId === toTeamId) return;

        setTeams((prev) =>
          prev.map((team) => {

            if (team.id === fromTeamId) {
              return {
                ...team,
                members: team.members.filter(
                  (item) => item.id !== memberId
                ),
              };
            }

            if (team.id === toTeamId) {
              return {
                ...team,
                members: [...team.members, pessoa],
              };
            }

            return team;
          })
        );

        // Trocar de time é reatribuir a pessoa ao novo time.
        sincronizar(() =>
          assignTeamMember(toTeamId, pessoa)
        );
      },
    }),
    [teams, people, loading, setTeams]
  );

  return (
    <TeamsContext.Provider value={value}>
      {children}
    </TeamsContext.Provider>
  );
}

export function useTeams() {
  const context = useContext(TeamsContext);

  if (!context) {
    throw new Error(
      "useTeams deve estar dentro de TeamsProvider."
    );
  }

  return context;
}
