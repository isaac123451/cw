"use client";

import Link from "next/link";

import { useState } from "react";

import { ArrowLeft } from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";
import PageHeading from "@/components/shared/PageHeading";

import SettingsTabs, {
  SettingsTab,
} from "@/components/reclame-aqui/settings/SettingsTabs";

import WorkflowSettings from "@/components/reclame-aqui/settings/WorkflowSettings";
import CategoriesSettings from "@/components/reclame-aqui/settings/CategoriesSettings";
import SubcategoriesSettings from "@/components/reclame-aqui/settings/SubcategoriesSettings";
import TeamsSettings from "@/components/reclame-aqui/settings/TeamsSettings";
import TagsSettings from "@/components/reclame-aqui/settings/TagsSettings";
import ChecklistSettings from "@/components/reclame-aqui/settings/ChecklistSettings";

export default function ConfiguracoesPage() {

  const [tab, setTab] = useState<SettingsTab>("status");

  return (
    <MainLayout>

      <div className="space-y-5">

        <Link
          href="/reclame-aqui"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-violet-600"
        >
          <ArrowLeft size={16} />
          Voltar para o quadro
        </Link>

        <PageHeading
          eyebrow="Reclame Aqui"
          title="Configurações do módulo"
          description="Gerencie status, categorias, subcategorias, times e checklist usados no fluxo operacional."
        />

        <SettingsTabs active={tab} onChange={setTab} />

        {tab === "status" && <WorkflowSettings />}

        {tab === "categorias" && <CategoriesSettings />}

        {tab === "subcategorias" && (
          <SubcategoriesSettings />
        )}

        {tab === "times" && <TeamsSettings />}

        {tab === "tags" && <TagsSettings />}

        {tab === "checklist" && <ChecklistSettings />}

      </div>

    </MainLayout>
  );
}
