"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";

import { Project, ProjectStage } from "@/lib/models/project";
import { mockProjects } from "@/lib/data/mockProjects";

export type ProjectDraft = Omit<Project, "id">;

interface ProjectsContextType {
  projects: Project[];
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

  const [projects, setProjects] =
    useState<Project[]>(mockProjects);

  const value = useMemo<ProjectsContextType>(
    () => ({
      projects,

      createProject: (data) =>
        setProjects((prev) => [
          { ...data, id: crypto.randomUUID() },
          ...prev,
        ]),

      updateProject: (data) =>
        setProjects((prev) =>
          prev.map((item) =>
            item.id === data.id ? data : item
          )
        ),

      removeProject: (id) =>
        setProjects((prev) =>
          prev.filter((item) => item.id !== id)
        ),

      moveProject: (id, stage) =>
        setProjects((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  stage,
                  // Concluir preenche a barra; reabrir devolve ao meio.
                  progress:
                    stage === "Concluído"
                      ? 100
                      : item.progress === 100
                      ? 50
                      : item.progress,
                }
              : item
          )
        ),
    }),
    [projects]
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
