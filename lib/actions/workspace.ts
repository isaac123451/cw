"use server";

import { unstable_cache } from "next/cache";

import { WORKSPACE_TAG } from "@/lib/actions/tags";

import { getPrisma } from "@/lib/prisma";

import {
  CategoryOption,
  ChecklistItem,
  SubcategoryOption,
  TeamOption,
} from "@/lib/models/settings";
import { WorkflowStatus } from "@/lib/models/workflow";
import { SlaRule } from "@/lib/models/sla";
import {
  CaseMovement,
  MovementRule,
} from "@/lib/models/movement";
import { Establishment } from "@/lib/models/establishment";
import { Project } from "@/lib/models/project";
import { Macro } from "@/lib/models/macro";
import {
  JourneyEntry,
  JourneyStage,
  JourneyTopic,
} from "@/lib/models/journey";
import { AgendaTask } from "@/lib/models/agenda";
import {
  ImpactRecord,
  ImpactTypeOption,
} from "@/lib/models/impact";
import { Team } from "@/lib/models/team";

import {
  CaseTag,
  mockTags,
} from "@/lib/data/mockTags";
import { mockWorkflow } from "@/lib/data/mockWorkflow";
import {
  mockCategories,
  mockChecklist,
  mockSubcategories,
  mockTeamOptions,
} from "@/lib/data/mockSettings";
import { mockSlaRules } from "@/lib/data/mockSla";
import {
  mockMovementRules,
  mockMovements,
} from "@/lib/data/mockMovements";
import { mockEstablishments } from "@/lib/data/mockEstablishments";
import { mockProjects } from "@/lib/data/mockProjects";
import { mockMacros } from "@/lib/data/mockMacros";
import {
  mockJourneyEntries,
  mockJourneyStages,
  mockJourneyTopics,
} from "@/lib/data/mockJourney";
import { mockAgenda } from "@/lib/data/mockAgenda";
import { mockImpact } from "@/lib/data/mockImpact";
import { mockTeams } from "@/lib/data/mockTeams";
import { mockImpactTypes } from "@/lib/data/mockImpactTypes";
import {
  mockPlaybooks,
  type Playbook,
  type PlaybookStep,
} from "@/lib/data/mockPlaybooks";

/**
 * Carga única de tudo que os cadastros precisam.
 *
 * São mais de dez contextos na árvore de providers. Se cada um fizesse a
 * própria consulta ao montar, seriam mais de dez conexões simultâneas — e
 * o pooler do Supabase no plano gratuito já derrubou a conexão com menos
 * que isso. Uma chamada só, distribuída no cliente, resolve.
 *
 * Sem banco devolve os dados de demonstração, para o `npm run dev`
 * continuar útil sem infraestrutura.
 */
export interface Workspace {
  workflow: WorkflowStatus[];
  categories: CategoryOption[];
  subcategories: SubcategoryOption[];
  tags: CaseTag[];
  checklist: ChecklistItem[];
  teamOptions: TeamOption[];
  slaRules: SlaRule[];
  movementRules: MovementRule[];
  movements: CaseMovement[];
  establishments: Establishment[];
  projects: Project[];
  macros: Macro[];
  journeyStages: JourneyStage[];
  journeyTopics: JourneyTopic[];
  journeyEntries: JourneyEntry[];
  /** Etapa atual por empresa. Sem registro = primeira etapa. */
  journeyPlacements: Record<string, string>;
  agenda: AgendaTask[];
  impact: ImpactRecord[];
  playbooks: Playbook[];
  teams: Team[];
  impactTypes: ImpactTypeOption[];
}

const DEMONSTRACAO: Workspace = {
  workflow: mockWorkflow,
  categories: mockCategories,
  subcategories: mockSubcategories,
  tags: mockTags,
  checklist: mockChecklist,
  teamOptions: mockTeamOptions,
  slaRules: mockSlaRules,
  movementRules: mockMovementRules,
  movements: mockMovements,
  establishments: mockEstablishments,
  projects: mockProjects,
  macros: mockMacros,
  journeyStages: mockJourneyStages,
  journeyTopics: mockJourneyTopics,
  journeyEntries: mockJourneyEntries,
  journeyPlacements: {},
  agenda: mockAgenda,
  impact: mockImpact,
  playbooks: mockPlaybooks,
  teams: mockTeams,
  impactTypes: mockImpactTypes,
};

function dia(value?: Date | null) {
  return value
    ? value.toISOString().slice(0, 10)
    : undefined;
}

/**
 * Carga dos cadastros, com cache no servidor.
 *
 * São dezessete consultas ao Supabase. Mesmo em paralelo, a ida e volta
 * até São Paulo domina o tempo de abertura da aplicação — e estes dados
 * mudam pouco: fluxo, categorias, times e regras de prazo passam dias
 * iguais. A etiqueta é invalidada em cada gravação de cadastro.
 */
const lerWorkspace = unstable_cache(
  async () => carregarDoBanco(),
  ["workspace-carga"],
  { tags: [WORKSPACE_TAG], revalidate: 120 }
);

export async function loadWorkspace(): Promise<Workspace> {

  if (!getPrisma()) return DEMONSTRACAO;

  return (await lerWorkspace()) ?? DEMONSTRACAO;
}

async function carregarDoBanco(): Promise<Workspace | null> {

  const prisma = getPrisma();

  if (!prisma) return null;

  const [
    workflow,
    categories,
    subcategories,
    tags,
    checklist,
    teams,
    slaRules,
    movementRules,
    movements,
    establishments,
    projects,
    macros,
    journeyStages,
    journeyTopics,
    journeyEntries,
    agenda,
    impact,
    playbooks,
    impactTypes,
    journeyPlacements,
  ] = await Promise.all([
    prisma.workflowStatus.findMany({
      orderBy: { order: "asc" },
    }),
    prisma.category.findMany({
      orderBy: { order: "asc" },
    }),
    prisma.subcategory.findMany({
      include: { category: { select: { name: true } } },
      orderBy: { order: "asc" },
    }),
    prisma.tag.findMany({ orderBy: { order: "asc" } }),
    prisma.checklistItem.findMany({
      orderBy: { order: "asc" },
    }),
    prisma.team.findMany({
      include: {
        members: {
          where: { active: true },
          select: {
            id: true,
            name: true,
            email: true,
            jobTitle: true,
          },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { order: "asc" },
    }),
    prisma.slaRule.findMany(),
    prisma.movementRule.findMany(),
    prisma.caseMovement.findMany({
      include: {
        case: { select: { externalId: true, id: true } },
      },
      orderBy: { startedAt: "desc" },
    }),
    prisma.establishment.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
    }),
    prisma.macro.findMany({ orderBy: { title: "asc" } }),
    prisma.journeyStage.findMany({
      orderBy: { order: "asc" },
    }),
    prisma.journeyTopic.findMany({
      orderBy: { order: "asc" },
    }),
    prisma.journeyEntry.findMany({
      orderBy: { createdAt: "desc" },
    }),
    prisma.agendaTask.findMany({
      include: {
        owner: { select: { name: true } },
        case: { select: { externalId: true } },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.impactRecord.findMany({
      include: { case: { select: { externalId: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.playbook.findMany({
      orderBy: { title: "asc" },
    }),
    prisma.impactType.findMany({
      orderBy: { order: "asc" },
    }),
    prisma.journeyPlacement.findMany(),
  ]);

  return {
    workflow: workflow.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      order: r.order,
      active: r.active,
      limit: r.wipLimit ?? undefined,
      createdAt: dia(r.createdAt),
    })),

    categories: categories.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? "",
      order: r.order,
      active: r.active,
      ceilingHours: r.ceilingHours ?? undefined,
    })),

    subcategories: subcategories.map((r) => ({
      id: r.id,
      category: r.category.name,
      name: r.name,
      description: r.description ?? "",
      order: r.order,
      active: r.active,
    })),

    tags: tags.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      description: r.description ?? "",
      order: r.order,
      active: r.active,
    })),

    checklist: checklist.map((r) => ({
      id: r.id,
      label: r.label,
      key: r.key,
      required: r.required,
      order: r.order,
      active: r.active,
    })),

    teamOptions: teams.map((r) => ({
      id: r.id,
      name: r.name,
      legacyValue: r.legacyName ?? r.name,
      order: r.order,
      active: r.active,
    })),

    slaRules: slaRules.map((r) => ({
      id: r.id,
      category: r.category,
      priority:
        (r.priority as SlaRule["priority"]) ?? undefined,
      responseHours: r.responseHours,
      solutionHours: r.solutionHours,
      team: r.team ?? undefined,
      note: r.note ?? undefined,
      active: r.active,
    })),

    movementRules: movementRules.map((r) => ({
      id: r.id,
      destination: r.destination,
      hours: r.hours,
      note: r.note ?? undefined,
      active: r.active,
    })),

    movements: movements.map((r) => ({
      id: r.id,
      // As telas endereçam o caso pelo id do portal.
      caseId: r.case.externalId ?? r.case.id,
      destination: r.destination,
      reason: r.reason,
      actor: r.actor,
      startedAt: dia(r.startedAt) as string,
      dueHours: r.dueHours,
      returnedAt: dia(r.returnedAt),
      outcome: r.outcome ?? undefined,
    })),

    establishments: establishments.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      cnpj: r.cnpj ?? undefined,
      segment: r.segment ?? undefined,
      city: r.city ?? undefined,
      state: r.state ?? undefined,
      plan: r.plan as Establishment["plan"],
      status: r.status as Establishment["status"],
      // Centavos no banco, reais na tela.
      mrr:
        r.mrrCents === null ? undefined : r.mrrCents / 100,
      owner: r.owner ?? undefined,
      startedAt: dia(r.startedAt),
      phone: r.phone ?? undefined,
      email: r.email ?? undefined,
      notes: r.notes ?? undefined,
    })),

    projects: projects.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      stage: r.stage as Project["stage"],
      owner: r.owner,
      impact: r.impact as Project["impact"],
      progress: r.progress,
      updatedAt: dia(r.updatedAt) as string,
      tags: r.tags,
    })),

    macros: macros.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      category: r.category,
      owner: r.owner,
      tags: r.tags,
      uses: r.uses,
      updatedAt: dia(r.updatedAt) as string,
    })),

    journeyStages: journeyStages.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      description: r.description,
      order: r.order,
      active: r.active,
    })),

    journeyTopics: journeyTopics.map((r) => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      color: r.color,
      order: r.order,
    })),

    journeyEntries: journeyEntries.map((r) => ({
      id: r.id,
      company: r.company,
      topicId: r.topicId,
      text: r.text,
      author: r.author,
      createdAt: dia(r.createdAt) as string,
    })),

    journeyPlacements: Object.fromEntries(
      journeyPlacements.map((r) => [
        r.company,
        r.stageId,
      ])
    ),

    agenda: agenda.map((r) => ({
      id: r.id,
      title: r.title,
      type: r.type as AgendaTask["type"],
      owner: r.owner?.name ?? "",
      dueDate: dia(r.dueDate) as string,
      time: r.time ?? undefined,
      priority: r.priority as AgendaTask["priority"],
      done: r.done,
      relatedCase: r.case?.externalId ?? undefined,
    })),

    impact: impact.map((r) => ({
      id: r.id,
      type: r.type as ImpactRecord["type"],
      company: r.companyName,
      establishmentId: r.establishmentId ?? undefined,
      clientSlug: r.clientSlug ?? undefined,
      description: r.description ?? "",
      // Centavos no banco, reais na tela.
      amount: r.amountCents / 100,
      owner: r.owner ?? "",
      date: dia(r.date) as string,
      relatedCase: r.case?.externalId ?? undefined,
    })),

    playbooks: playbooks.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      summary: r.summary,
      scope: r.scope,
      owner: r.owner,
      version: r.version,
      // Os passos variam de formato; o banco guarda como JSON, e o
      // Prisma tipa isso como JsonValue — daí o duplo cast.
      steps: (r.steps ?? []) as unknown as PlaybookStep[],
      rules: r.rules,
      confluenceUrl: r.confluenceUrl ?? undefined,
      updatedAt: dia(r.updatedAt) as string,
    })),

    teams: teams.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? "",
      department: r.department ?? "",
      leader: r.leader ?? "",
      active: r.active,
      members: r.members.map((m) => ({
        id: m.id,
        name: m.name,
        role: m.jobTitle ?? "",
        email: m.email,
        // Presença e carga são estado de tela, não do cadastro.
        online: false,
        openCases: 0,
      })),
    })),

    impactTypes: impactTypes.map((r) => ({
      id: r.id,
      name: r.name,
      direction:
        r.direction as ImpactTypeOption["direction"],
      description: r.description ?? undefined,
      order: r.order,
      active: r.active,
    })),
  };
}
