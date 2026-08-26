"use client";

import Link from "next/link";

import { Suspense, useState } from "react";

import { useSearchParams } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";
import PageHeading from "@/components/shared/PageHeading";

import SettingsTabs, {
  SettingsTab,
} from "@/components/reclame-aqui/settings/SettingsTabs";

import WorkflowSettings from "@/components/reclame-aqui/settings/WorkflowSettings";
import CategoriesSettings from "@/components/reclame-aqui/settings/CategoriesSettings";
import SubcategoriesSettings from "@/components/reclame-aqui/settings/SubcategoriesSettings";
import ResponsaveisSettings from "@/components/reclame-aqui/settings/ResponsaveisSettings";
import TeamsSettings from "@/components/reclame-aqui/settings/TeamsSettings";
import TagsSettings from "@/components/reclame-aqui/settings/TagsSettings";
import ChecklistSettings from "@/components/reclame-aqui/settings/ChecklistSettings";
import ModuleNav from "@/components/reclame-aqui/ModuleNav";

const VALID_TABS: SettingsTab[] = [
  "status",
  "categorias",
  "subcategorias",
  "times",
  "tags",
  "checklist",
];

/**
 * `useSearchParams` isolado num componente próprio, dentro de Suspense:
 * é a forma que o Next recomenda para ler `?tab=` num Client Component
 * sem inicializar o `useState` com `setState` num efeito (cai no aviso
 * `react-hooks/set-state-in-effect` que já é dívida conhecida aqui) nem
 * quebrar a hidratação lendo `window` direto no render.
 */
function ConfiguracoesConteudo() {

  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab");

  const initialTab = VALID_TABS.includes(
    tabParam as SettingsTab
  )
    ? (tabParam as SettingsTab)
    : "status";

  const [tab, setTab] = useState<SettingsTab>(initialTab);

  return (
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

      <ModuleNav />

      <SettingsTabs active={tab} onChange={setTab} />

      {tab === "status" && <WorkflowSettings />}

      {tab === "categorias" && <CategoriesSettings />}

      {tab === "subcategorias" && (
        <SubcategoriesSettings />
      )}

      {tab === "times" && (
        <div className="space-y-6">
          <TeamsSettings />
          {/*
            As pessoas vêm logo abaixo dos times, na mesma aba.

            Estavam numa aba própria no menu — "Meu time" —, o que
            criava dois cadastros de time em paralelo: o que classifica
            a reclamação e o que tinha gente dentro. Duas listas com o
            mesmo nome e conteúdo diferente é como uma operação passa a
            discutir qual das duas está certa.
          */}
          <ResponsaveisSettings />
        </div>
      )}

      {tab === "tags" && <TagsSettings />}

      {tab === "checklist" && <ChecklistSettings />}

    </div>
  );
}

export default function ConfiguracoesPage() {
  return (
    <MainLayout>

      <Suspense fallback={null}>
        <ConfiguracoesConteudo />
      </Suspense>

    </MainLayout>
  );
}
