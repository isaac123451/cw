"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";

import { Team, TeamMember } from "@/lib/models/team";
import { mockTeams } from "@/lib/data/mockTeams";

export type TeamDraft = Omit<Team, "id" | "members">;
export type MemberDraft = Omit<TeamMember, "id">;

interface TeamsContextType {
  teams: Team[];

  /** Todas as pessoas, de todos os times — alimenta os seletores de responsável. */
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

  const [teams, setTeams] = useState<Team[]>(mockTeams);

  const people = useMemo(() => {

    const map = new Map<string, TeamMember>();

    for (const team of teams) {
      for (const member of team.members) {
        // Mesma pessoa pode estar em mais de um time.
        map.set(member.email, member);
      }
    }

    return [...map.values()].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

  }, [teams]);

  const value = useMemo<TeamsContextType>(
    () => ({
      teams,
      people,

      createTeam: (data) =>
        setTeams((prev) => [
          ...prev,
          {
            ...data,
            id: crypto.randomUUID(),
            members: [],
          },
        ]),

      updateTeam: (id, data) =>
        setTeams((prev) =>
          prev.map((team) =>
            team.id === id ? { ...team, ...data } : team
          )
        ),

      removeTeam: (id) =>
        setTeams((prev) =>
          prev.filter((team) => team.id !== id)
        ),

      addMember: (teamId, data) =>
        setTeams((prev) =>
          prev.map((team) =>
            team.id === teamId
              ? {
                  ...team,
                  members: [
                    ...team.members,
                    { ...data, id: crypto.randomUUID() },
                  ],
                }
              : team
          )
        ),

      updateMember: (teamId, member) =>
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
        ),

      removeMember: (teamId, memberId) =>
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
        ),

      moveMember: (fromTeamId, toTeamId, memberId) =>
        setTeams((prev) => {

          const origem = prev.find(
            (team) => team.id === fromTeamId
          );

          const pessoa = origem?.members.find(
            (item) => item.id === memberId
          );

          if (!pessoa || fromTeamId === toTeamId) {
            return prev;
          }

          return prev.map((team) => {

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
          });
        }),
    }),
    [teams, people]
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
