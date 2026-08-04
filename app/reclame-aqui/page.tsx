"use client";

import { useState } from "react";

import Toolbar from "@/components/reclame-aqui/toolbar/Toolbar";
import MetricsBar from "@/components/reclame-aqui/dashboard/MetricsBar";

import KanbanView from "@/components/reclame-aqui/kanban/KanbanView";
import ListView from "@/components/reclame-aqui/list/ListView";

import MainLayout from "@/components/layout/MainLayout";

export default function ReclameAquiPage() {
  const [view, setView] = useState<"kanban" | "list">("kanban");

  return (
    <MainLayout>
      <div className="flex h-full flex-col gap-5">

        <Toolbar
          view={view}
          onChangeView={setView}
        />

        <MetricsBar />

        <div className="flex-1 overflow-hidden">

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