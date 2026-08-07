"use client";

import { useState } from "react";

import Toolbar from "@/components/reclame-aqui/toolbar/Toolbar";
import MetricsBar from "@/components/reclame-aqui/dashboard/MetricsBar";

import KanbanView from "@/components/reclame-aqui/kanban/KanbanView";
import ListView from "@/components/reclame-aqui/list/ListView";

import MainLayout from "@/components/layout/MainLayout";
import PageHeading from "@/components/shared/PageHeading";

export default function ReclameAquiPage() {
  const [view, setView] = useState<"kanban" | "list">("kanban");

  return (
    <MainLayout>
      <div className="flex flex-col gap-5">

        <PageHeading
          eyebrow="Módulo"
          title="Reclame Aqui"
          description="Gestão das reclamações registradas e da tratativa com o consumidor."
        />

        <MetricsBar />

        <Toolbar
          view={view}
          onChangeView={setView}
        />

        {/* Altura definida: sem isso as colunas ou espremem ou esticam
            a página inteira em vez de rolarem por dentro. */}
        <div className="h-[calc(100vh-330px)] min-h-[460px]">

          {view === "kanban" ? (
            <KanbanView />
          ) : (
            <ListView />
          )}

        </div>

      </div>
    </MainLayout>
  );
}
