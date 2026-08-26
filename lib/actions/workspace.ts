"use server";

import { unstable_cache } from "next/cache";

import type { CaseTag } from "@/lib/models/tag";
import type {
  Playbook,
  PlaybookStep,
} from "@/lib/models/playbook";

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
import {
  ClientEnrichment,
  ClientKind,
  ManualClient,
} from "@/lib/models/client";
import { Project } from "@/lib/models/project";
import { Macro } from "@/lib/models/macro";
import {
  PLANOS_PADRAO,
  PlanOption,
} from "@/lib/models/plan";
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
  ETAPAS_PADRAO,
  NpsKindOption,
  NpsStageOption,
  TIPOS_PADRAO,
} from "@/lib/models/nps";


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

  /**
   * As etapas e os tipos do NPS, como cadastro.
   *
   * Entram aqui, e não numa consulta própria da tela, pelo mesmo
   * motivo dos outros doze: a extensão e as duas telas de NPS leem a
   * mesma lista, e uma consulta por leitor seriam mais conexões
   * simultâneas ao pooler do que o plano gratuito sustenta.
   */
  npsStages: NpsStageOption[];
  npsKinds: NpsKindOption[];

  /**
   * Planos e módulos vendidos, com o preço vigente.
   *
   * Entram na carga porque quem os lê é a inserção de macro, no meio
   * da resposta ao consumidor — uma consulta própria ali seria uma ida
   * ao banco no clique que mais precisa ser instantâneo.
   */
  plans: PlanOption[];

  /**
   * Metas dos indicadores que **diferem** do RA1000.
   *
   * Só o que foi ajustado: indicador ausente aqui segue o critério
   * público. Guardar os quatro sempre congelaria uma cópia do critério
   * de hoje, e quem nunca mexeu deixaria de acompanhar uma mudança do
   * Reclame Aqui.
   */
  reputationGoals: Record<string, number>;

  /**
   * O que a operação preencheu por cima do cliente vindo do export —
   * tipo de relação, estabelecimento, documento, notas, etiquetas.
   * Cliente sem nada preenchido não aparece aqui.
   */
  clientEnrichment: Record<string, ClientEnrichment>;

  /** Clientes cadastrados à mão, sem reclamação de origem. */
  manualClients: ManualClient[];
}

/**
 * O espaço de trabalho vazio.
 *
 * Era `DEMONSTRACAO`, e servia os quinze arquivos de `lib/data/mock*`
 * quando não havia banco — ou quando a leitura falhava, que é o caso
 * grave: o `??` abaixo disparava numa queda de conexão de segundos, e
 * a plataforma passava a exibir estabelecimentos, projetos, agenda e
 * movimentações inventados, indistinguíveis dos reais.
 *
 * Agora não há dado de mentira em lugar nenhum. Tela vazia diz "não
 * carregou"; tela cheia de ficção diz "esta é a sua operação", e essa
 * é a diferença entre um problema que alguém percebe e um que ninguém
 * percebe.
 *
 * As listas de estrutura — etapas do quadro, categorias, etiquetas —
 * também saem vazias: elas moram no banco, e o banco já as tem. Quem
 * instala do zero as recebe pelo `db:seed`.
 */
const VAZIO: Workspace = {
  workflow: [],
  categories: [],
  subcategories: [],
  tags: [],
  checklist: [],
  teamOptions: [],
  slaRules: [],
  movementRules: [],
  movements: [],
  establishments: [],
  projects: [],
  macros: [],
  journeyStages: [],
  journeyTopics: [],
  journeyEntries: [],
  journeyPlacements: {},
  agenda: [],
  impact: [],
  playbooks: [],
  teams: [],
  impactTypes: [],
  npsStages: ETAPAS_PADRAO,
  npsKinds: TIPOS_PADRAO,
  plans: PLANOS_PADRAO.map((item, i) => ({
    ...item,
    id: `padrao-plano-${i}`,
  })),
  reputationGoals: {},
  clientEnrichment: {},
  manualClients: [],
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

  if (!getPrisma()) return VAZIO;

  return (await lerWorkspace()) ?? VAZIO;
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
    npsStages,
    npsKinds,
    plans,
    journeyPlacements,
    reputationGoals,
    clientProfiles,
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
    prisma.npsStage.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
    }),
    prisma.npsKind.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
    }),
    prisma.plan.findMany({
      orderBy: [
        { kind: "asc" },
        { order: "asc" },
        { name: "asc" },
      ],
    }),
    prisma.journeyPlacement.findMany(),
    prisma.reputationGoal.findMany(),
    prisma.clientProfile.findMany({
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    workflow: workflow.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      order: r.order,
      active: r.active,
      limit: r.wipLimit ?? undefined,
      reminderMinutes: r.reminderMinutes ?? undefined,
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
      document: r.document ?? undefined,
      externalId: r.externalId ?? undefined,
      portalUrl: r.portalUrl ?? undefined,
      portalId: r.portalId ?? undefined,
      crispUrl: r.crispUrl ?? undefined,
      npsWhatsapp: r.npsWhatsapp ?? undefined,
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
      channel: r.channel as Macro["channel"],
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

    reputationGoals: Object.fromEntries(
      reputationGoals.map((r) => [r.indicator, r.target])
    ),

    /**
     * As duas metades saem da mesma tabela.
     *
     * `ClientProfile` guarda enriquecimento e cadastro manual na mesma
     * linha, separados pela coluna `manual` — a chave é a mesma (o
     * slug) e os campos preenchidos também. A separação acontece aqui,
     * uma vez, em vez de a tela consultar duas tabelas e costurar.
     */
    clientEnrichment: Object.fromEntries(
      clientProfiles.map((r) => [
        r.slug,
        {
          kind: (r.kind as ClientKind) ?? undefined,
          establishmentId:
            r.establishmentId ?? undefined,
          document: r.document ?? undefined,
          notes: r.notes ?? undefined,
          tags: r.tags,
        } satisfies ClientEnrichment,
      ])
    ),

    manualClients: clientProfiles
      .filter((r) => r.manual)
      .map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name ?? r.slug,
        email: r.email ?? undefined,
        phone: r.phone ?? undefined,
        city: r.city ?? undefined,
        state: r.state ?? undefined,
        kind: (r.kind as ClientKind) ?? undefined,
        establishmentId: r.establishmentId ?? undefined,
        document: r.document ?? undefined,
        notes: r.notes ?? undefined,
        tags: r.tags,
        createdAt: dia(r.createdAt) as string,
      })) satisfies ManualClient[],

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
      moodAfter: r.moodAfter ?? undefined,
      wouldHaveChurned: r.wouldHaveChurned ?? undefined,
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

        /**
         * O endereço interno não aparece na tela.
         *
         * Quem foi cadastrado só pelo nome recebe um e-mail
         * `@sem-acesso.local` — inválido de propósito, para ocupar a
         * chave única sem chutar o endereço real de ninguém. Mostrá-lo
         * faria parecer que a pessoa tem um e-mail estranho; o campo
         * vazio diz a verdade, que é "esta pessoa não entra".
         */
        email: m.email.endsWith("@sem-acesso.local")
          ? ""
          : m.email,

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

    /**
     * Banco vazio devolve os valores de partida.
     *
     * Mesma regra da causa raiz: a tela funciona antes de qualquer
     * cadastro, e o formulário não precisa de um caso especial para
     * "ainda não existe nada".
     */
    npsStages:
      npsStages.length === 0
        ? ETAPAS_PADRAO
        : npsStages.map((r) => ({
            id: r.id,
            name: r.name,
            description: r.description ?? undefined,
            color: r.color,
            order: r.order,
            active: r.active,
            final: r.final,
            kinds: r.kinds,
          })),

    npsKinds:
      npsKinds.length === 0
        ? TIPOS_PADRAO
        : npsKinds.map((r) => ({
            id: r.id,
            name: r.name,
            emoji: r.emoji,
            color: r.color,
            action: r.action,
            requiresConfirmation: r.requiresConfirmation,
            requiresRootCause: r.requiresRootCause,
            opensProcessReview: r.opensProcessReview,
            ownDeadlineHours:
              r.ownDeadlineHours ?? undefined,
            order: r.order,
            active: r.active,
          })),

    /**
     * Banco vazio devolve a tabela da central de ajuda.
     *
     * Mesma regra dos outros cadastros: a tela funciona antes de
     * qualquer edição, e o dia em que a tabela mudar quem corrige é a
     * tela — não este arquivo.
     */
    plans:
      plans.length === 0
        ? PLANOS_PADRAO.map((item, i) => ({
            ...item,
            id: `padrao-plano-${i}`,
          }))
        : plans.map((r) => ({
            id: r.id,
            name: r.name,
            description: r.description ?? undefined,
            kind: r.kind as PlanOption["kind"],
            priceCents: r.priceCents,
            features: r.features,
            order: r.order,
            active: r.active,
          })),
  };
}
