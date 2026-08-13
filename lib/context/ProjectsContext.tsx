"use client";

import {
  createContext,
  useContext,
  useMemo,
  ReactNode,
} from "react";

import {
  Project,
  ProjectStage,
} from "@/lib/models/project";

import {
  removeProject,
  saveProject,
} from "@/lib/actions/registry";

import { useWorkspaceSlice } from "@/lib/context/useWorkspace";
import { sincronizar } from "@/lib/context/sync";

import { REFERENCE_DATE } from "@/lib/services/reputation.service";

export type ProjectDraft = Omit<Project, "id">;

interface ProjectsContextType {
  projects: Project[];

  /** Carga inicial ainda em andamento. */
  loading: boolean;

  createProject: (data: ProjectDraft) => void;
  updateProject: (data: Project) => void;
  removeProject: (id: string) => void;
  moveProject: (id: string, stage: ProjectStage) => void;
}

const ProjectsContext =
  createContext<ProjectsContextType | null>(null);

export function ProjectsProvider({
  children,
}: {
  children: ReactNode;
}) {

  const [projects, setProjects, loading] =
    useWorkspaceSlice(
      (dados) => dados.projects,
      [] as Project[]
    );

  const value = useMemo<ProjectsContextType>(
    () => ({
      projects,
      loading,

      createProject: (data) => {

        const novo: Project = {
          ...data,
          id: crypto.randomUUID(),
        };

        setProjects((prev) => [novo, ...prev]);
        sincronizar(() => saveProject(novo));
      },

      updateProject: (data) => {
        setProjects((prev) =>
          prev.map((item) =>
            item.id === data.id ? data : item
          )
        );
        sincronizar(() => saveProject(data));
      },

      removeProject: (id) => {
        setProjects((prev) =>
          prev.filter((item) => item.id !== id)
        );
        sincronizar(() => removeProject(id));
      },

      moveProject: (id, stage) => {

        const atual = projects.find(
          (item) => item.id === id
        );

        if (!atual) return;

        const movido: Project = {
          ...atual,
          stage,
          // Concluir preenche a barra; reabrir devolve ao meio.
          progress:
            stage === "Concluído"
              ? 100
              : atual.progress === 100
              ? 50
              : atual.progress,
          updatedAt: REFERENCE_DATE,
        };

        setProjects((prev) =>
          prev.map((item) =>
            item.id === id ? movido : item
          )
        );

        sincronizar(() => saveProject(movido));
      },
    }),
    [projects, loading, setProjects]
  );

  return (
    <ProjectsContext.Provider value={value}>
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectsContext);

  if (!context) {
    throw new Error(
      "useProjects deve estar dentro de ProjectsProvider."
    );
  }

  return context;
}
