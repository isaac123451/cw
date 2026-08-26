"use client";

import { useState } from "react";

import Toolbar from "@/components/reclame-aqui/toolbar/Toolbar";
import MetricsBar from "@/components/reclame-aqui/dashboard/MetricsBar";

import KanbanView from "@/components/reclame-aqui/kanban/KanbanView";
import ListView from "@/components/reclame-aqui/list/ListView";

import MainLayout from "@/components/layout/MainLayout";
import PageHeading from "@/components/shared/PageHeading";
import LoadingPanel from "@/components/shared/LoadingPanel";

import { useCases } from "@/lib/context/CaseContext";
import ModuleNav from "@/components/reclame-aqui/ModuleNav";

export default function ReclameAquiPage() {
  const [view, setView] = useState<"kanban" | "list">("kanban");

  const { loading } = useCases();

  return (
    <MainLayout>
      <div className="flex flex-col gap-5">

        <PageHeading
          eyebrow="Módulo"
          title="Reclame Aqui"
          description="Gestão das reclamações registradas e da tratativa com o consumidor."
        />

        {/*
          A barra de navegação do módulo estava só em três das cinco
          telas — analytics, gráficos e calculadora. Quem estava no
          quadro não tinha como saber que as outras existiam, e o Isaac
          cobrou: "ou você melhora para todas as partes ou então tira,
          por que só tem na parte de analytics".
        */}
        <ModuleNav />

        <MetricsBar />

        <Toolbar
          view={view}
          onChangeView={setView}
        />

        {/* Altura definida: sem isso as colunas ou espremem ou esticam
            a página inteira em vez de rolarem por dentro. */}
        <div className="h-[calc(100vh-330px)] min-h-[460px]">

          {loading ? (
            <LoadingPanel />
          ) : view === "kanban" ? (
            <KanbanView />
          ) : (
            <ListView />
          )}

        </div>

      </div>
    </MainLayout>
  );
}
