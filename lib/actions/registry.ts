"use server";

import { updateTag } from "next/cache";
import { WORKSPACE_TAG } from "@/lib/actions/tags";

import { requireRole, Role } from "@/lib/auth/guard";

import {
  CategoryOption,
  ChecklistItem,
  SubcategoryOption,
  TeamOption,
} from "@/lib/models/settings";
import { WorkflowStatus } from "@/lib/models/workflow";
import { CaseTag } from "@/lib/data/mockTags";
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
import { Team, TeamMember } from "@/lib/models/team";
import {
  ClientEnrichment,
  ManualClient,
} from "@/lib/models/client";
import type { Playbook } from "@/lib/data/mockPlaybooks";

/**
 * Gravação dos cadastros da operação.
 *
 * Cada função é um "salvar isto" idempotente: a tela já tem o registro
 * inteiro em mãos, então não há PATCH parcial. Sem banco, tudo vira
 * no-op e o estado fica só na tela — é o modo demonstração.
 *
 * Autorização mora aqui; o acesso ao Postgres, nas chamadas do Prisma
 * logo abaixo. A separação que existe em `case.repository` não se
 * justificou aqui: são gravações diretas, sem regra de negócio.
 */
/**
 * Sessão **e** papel mínimo.
 *
 * Antes só exigia sessão: quem estivesse logado como "somente leitura"
 * podia chamar qualquer gravação daqui direto, porque esconder o botão
 * na tela não impede ninguém de invocar a server action.
 *
 * Padrão AGENTE (opera a rotina); os cadastros que definem como a
 * operação funciona pedem ADMIN.
 */
async function autorizado(minimo: Role = "AGENTE") {

  const ctx = await requireRole(minimo);

  return ctx?.prisma ?? null;
}

function dia(value?: string | null) {
  return value ? new Date(`${value}T00:00:00Z`) : null;
}

/* ============================================================
   FLUXO E CLASSIFICAÇÃO
============================================================ */

export async function saveWorkflowStatus(
  item: WorkflowStatus
) {
  const prisma = await autorizado("ADMIN");
  if (!prisma) return;

  const dados = {
    name: item.name,
    color: item.color,
    order: item.order,
    active: item.active,
    wipLimit: item.limit ?? null,
    reminderMinutes: item.reminderMinutes ?? null,
  };

  await prisma.workflowStatus.upsert({
    where: { id: item.id },
    update: dados,
    create: { id: item.id, ...dados },
  });

  updateTag(WORKSPACE_TAG);
}

export async function removeWorkflowStatus(id: string) {
  const prisma = await autorizado("ADMIN");
  if (!prisma) return;

  await prisma.workflowStatus.delete({ where: { id } });

  updateTag(WORKSPACE_TAG);
}

export async function saveCategory(
  item: CategoryOption
) {
  const prisma = await autorizado("ADMIN");
  if (!prisma) return;

  const dados = {
    name: item.name,
    description: item.description,
    order: item.order,
    active: item.active,
    ceilingHours: item.ceilingHours ?? null,
  };

  await prisma.category.upsert({
    where: { id: item.id },
    update: dados,
    create: { id: item.id, ...dados },
  });

  updateTag(WORKSPACE_TAG);
}

export async function removeCategory(id: string) {
  const prisma = await autorizado("ADMIN");
  if (!prisma) return;

  await prisma.category.delete({ where: { id } });

  updateTag(WORKSPACE_TAG);
}

export async function saveSubcategory(
  item: SubcategoryOption
) {
  const prisma = await autorizado("ADMIN");
  if (!prisma) return;

  const categoria = await prisma.category.findUnique({
    where: { name: item.category },
    select: { id: true },
  });

  if (!categoria) {
    throw new Error(
      `Categoria "${item.category}" não existe.`
    );
  }

  const dados = {
    categoryId: categoria.id,
    name: item.name,
    description: item.description,
    order: item.order,
    active: item.active,
  };

  await prisma.subcategory.upsert({
    where: { id: item.id },
    update: dados,
    create: { id: item.id, ...dados },
  });

  updateTag(WORKSPACE_TAG);
}

export async function removeSubcategory(id: string) {
  const prisma = await autorizado("ADMIN");
  if (!prisma) return;

  await prisma.subcategory.delete({ where: { id } });

  updateTag(WORKSPACE_TAG);
}

export async function saveTag(item: CaseTag) {
  const prisma = await autorizado("ADMIN");
  if (!prisma) return;

  const dados = {
    name: item.name,
    color: item.color,
    description: item.description,
    order: item.order,
    active: item.active,
  };

  await prisma.tag.upsert({
    where: { id: item.id },
    update: dados,
    create: { id: item.id, ...dados },
  });

  updateTag(WORKSPACE_TAG);
}

export async function removeTag(id: string) {
  const prisma = await autorizado("ADMIN");
  if (!prisma) return;

  await prisma.tag.delete({ where: { id } });

  updateTag(WORKSPACE_TAG);
}

export async function saveChecklistItem(
  item: ChecklistItem
) {
  const prisma = await autorizado("ADMIN");
  if (!prisma) return;

  const dados = {
    label: item.label,
    key: item.key,
    required: item.required,
    order: item.order,
    active: item.active,
  };

  await prisma.checklistItem.upsert({
    where: { id: item.id },
    update: dados,
    create: { id: item.id, ...dados },
  });

  updateTag(WORKSPACE_TAG);
}

export async function removeChecklistItem(id: string) {
  const prisma = await autorizado("ADMIN");
  if (!prisma) return;

  await prisma.checklistItem.delete({ where: { id } });

  updateTag(WORKSPACE_TAG);
}

/* ============================================================
   PRAZOS
============================================================ */

export async function saveSlaRule(item: SlaRule) {
  const prisma = await autorizado("ADMIN");
  if (!prisma) return;

  const dados = {
    category: item.category,
    priority: item.priority ?? null,
    responseHours: item.responseHours,
    solutionHours: item.solutionHours,
    team: item.team ?? null,
    note: item.note ?? null,
    active: item.active,
  };

  await prisma.slaRule.upsert({
    where: { id: item.id },
    update: dados,
    create: { id: item.id, ...dados },
  });

  updateTag(WORKSPACE_TAG);
}

export async function removeSlaRule(id: string) {
  const prisma = await autorizado("ADMIN");
  if (!prisma) return;

  await prisma.slaRule.delete({ where: { id } });

  updateTag(WORKSPACE_TAG);
}

export async function saveMovementRule(
  item: MovementRule
) {
  const prisma = await autorizado("ADMIN");
  if (!prisma) return;

  const dados = {
    destination: item.destination,
    hours: item.hours,
    note: item.note ?? null,
    active: item.active,
  };

  await prisma.movementRule.upsert({
    where: { id: item.id },
    update: dados,
    create: { id: item.id, ...dados },
  });

  updateTag(WORKSPACE_TAG);
}

export async function removeMovementRule(id: string) {
  const prisma = await autorizado("ADMIN");
  if (!prisma) return;

  await prisma.movementRule.delete({ where: { id } });

  updateTag(WORKSPACE_TAG);
}

export async function saveMovement(item: CaseMovement) {
  const prisma = await autorizado();
  if (!prisma) return;

  // A tela endereça o caso pelo id do portal; o banco usa cuid.
  const caso = await prisma.case.findFirst({
    where: {
      OR: [
        { externalId: item.caseId },
        { id: item.caseId },
      ],
    },
    select: { id: true },
  });

  if (!caso) {
    throw new Error("Caso não encontrado.");
  }

  const dados = {
    caseId: caso.id,
    destination: item.destination,
    reason: item.reason,
    actor: item.actor,
    startedAt: dia(item.startedAt) as Date,
    dueHours: item.dueHours,
    returnedAt: dia(item.returnedAt),
    outcome: item.outcome ?? null,
  };

  await prisma.caseMovement.upsert({
    where: { id: item.id },
    update: dados,
    create: { id: item.id, ...dados },
  });

  updateTag(WORKSPACE_TAG);
}

export async function removeMovement(id: string) {
  const prisma = await autorizado();
  if (!prisma) return;

  await prisma.caseMovement.delete({ where: { id } });

  updateTag(WORKSPACE_TAG);
}

/* ============================================================
   CADASTROS
============================================================ */

export async function saveEstablishment(
  item: Establishment
) {
  const prisma = await autorizado();
  if (!prisma) return;

  const dados = {
    slug: item.slug,
    name: item.name,
    cnpj: item.cnpj ?? null,
    segment: item.segment ?? null,
    city: item.city ?? null,
    state: item.state ?? null,
    plan: item.plan,
    status: item.status,
    mrrCents:
      item.mrr === undefined
        ? null
        : Math.round(item.mrr * 100),
    owner: item.owner ?? null,
    startedAt: dia(item.startedAt),
    phone: item.phone ?? null,
    email: item.email ?? null,
    notes: item.notes ?? null,
  };

  await prisma.establishment.upsert({
    where: { id: item.id },
    update: dados,
    create: { id: item.id, ...dados },
  });

  updateTag(WORKSPACE_TAG);
}

export async function removeEstablishment(id: string) {
  const prisma = await autorizado();
  if (!prisma) return;

  await prisma.establishment.delete({ where: { id } });

  updateTag(WORKSPACE_TAG);
}

export async function saveProject(item: Project) {
  const prisma = await autorizado();
  if (!prisma) return;

  const dados = {
    title: item.title,
    description: item.description,
    stage: item.stage,
    owner: item.owner,
    impact: item.impact,
    progress: item.progress,
    tags: item.tags,
  };

  await prisma.project.upsert({
    where: { id: item.id },
    update: dados,
    create: { id: item.id, ...dados },
  });

  updateTag(WORKSPACE_TAG);
}

export async function removeProject(id: string) {
  const prisma = await autorizado();
  if (!prisma) return;

  await prisma.project.delete({ where: { id } });

  updateTag(WORKSPACE_TAG);
}

export async function saveMacro(item: Macro) {
  const prisma = await autorizado();
  if (!prisma) return;

  const dados = {
    title: item.title,
    body: item.body,
    category: item.category,
    owner: item.owner,
    tags: item.tags,
    uses: item.uses,
  };

  await prisma.macro.upsert({
    where: { id: item.id },
    update: dados,
    create: { id: item.id, ...dados },
  });

  updateTag(WORKSPACE_TAG);
}

export async function removeMacro(id: string) {
  const prisma = await autorizado();
  if (!prisma) return;

  await prisma.macro.delete({ where: { id } });

  updateTag(WORKSPACE_TAG);
}

export async function savePlaybook(item: Playbook) {
  const prisma = await autorizado();
  if (!prisma) return;

  const dados = {
    slug: item.slug,
    title: item.title,
    summary: item.summary,
    scope: item.scope,
    owner: item.owner,
    version: item.version,
    steps: item.steps as never,
    rules: item.rules ?? [],
    confluenceUrl: item.confluenceUrl ?? null,
  };

  await prisma.playbook.upsert({
    where: { id: item.id },
    update: dados,
    create: { id: item.id, ...dados },
  });

  updateTag(WORKSPACE_TAG);
}

export async function removePlaybook(id: string) {
  const prisma = await autorizado();
  if (!prisma) return;

  await prisma.playbook.delete({ where: { id } });

  updateTag(WORKSPACE_TAG);
}

/* ============================================================
   AGENDA E IMPACTO
============================================================ */

export async function saveAgendaTask(item: AgendaTask) {
  const prisma = await autorizado();
  if (!prisma) return;

  // Responsável é texto na tela e relação no banco.
  const dono = item.owner
    ? await prisma.user.findFirst({
        where: { name: item.owner },
        select: { id: true },
      })
    : null;

  const caso = item.relatedCase
    ? await prisma.case.findFirst({
        where: { externalId: item.relatedCase },
        select: { id: true },
      })
    : null;

  const dados = {
    title: item.title,
    type: item.type,
    priority: item.priority,
    done: item.done,
    dueDate: dia(item.dueDate) as Date,
    time: item.time ?? null,
    ownerId: dono?.id ?? null,
    caseId: caso?.id ?? null,
  };

  await prisma.agendaTask.upsert({
    where: { id: item.id },
    update: dados,
    create: { id: item.id, ...dados },
  });

  updateTag(WORKSPACE_TAG);
}

export async function removeAgendaTask(id: string) {
  const prisma = await autorizado();
  if (!prisma) return;

  await prisma.agendaTask.delete({ where: { id } });

  updateTag(WORKSPACE_TAG);
}

export async function saveImpactRecord(
  item: ImpactRecord
) {
  const prisma = await autorizado();
  if (!prisma) return;

  const caso = item.relatedCase
    ? await prisma.case.findFirst({
        where: { externalId: item.relatedCase },
        select: { id: true },
      })
    : null;

  const dados = {
    type: item.type,
    companyName: item.company,
    description: item.description || null,
    // Centavos no banco: reais em ponto flutuante acumulam erro.
    amountCents: Math.round(item.amount * 100),
    owner: item.owner || null,
    date: dia(item.date) as Date,
    establishmentId: item.establishmentId ?? null,
    clientSlug: item.clientSlug ?? null,
    caseId: caso?.id ?? null,
  };

  await prisma.impactRecord.upsert({
    where: { id: item.id },
    update: dados,
    create: { id: item.id, ...dados },
  });

  updateTag(WORKSPACE_TAG);
}

export async function removeImpactRecord(id: string) {
  const prisma = await autorizado();
  if (!prisma) return;

  await prisma.impactRecord.delete({ where: { id } });

  updateTag(WORKSPACE_TAG);
}

export async function saveImpactType(
  item: ImpactTypeOption
) {
  const prisma = await autorizado("ADMIN");
  if (!prisma) return;

  const dados = {
    name: item.name,
    direction: item.direction,
    description: item.description ?? null,
    order: item.order,
    active: item.active,
  };

  await prisma.impactType.upsert({
    where: { id: item.id },
    update: dados,
    create: { id: item.id, ...dados },
  });

  updateTag(WORKSPACE_TAG);
}

/**
 * Exclui um tipo. Os lançamentos existentes não são apagados: o tipo é
 * gravado como texto no registro, então o histórico segue legível mesmo
 * sem o tipo no cadastro.
 */
export async function removeImpactType(id: string) {
  const prisma = await autorizado("ADMIN");
  if (!prisma) return;

  await prisma.impactType.delete({ where: { id } });

  updateTag(WORKSPACE_TAG);
}

/* ============================================================
   TIMES
============================================================ */

export async function saveTeam(item: Team) {
  const prisma = await autorizado("ADMIN");
  if (!prisma) return;

  const dados = {
    name: item.name,
    description: item.description || null,
    department: item.department || null,
    leader: item.leader || null,
    active: item.active,
  };

  await prisma.team.upsert({
    where: { id: item.id },
    update: dados,
    create: { id: item.id, ...dados },
  });

  updateTag(WORKSPACE_TAG);
}

/**
 * O time como **rótulo** — a aba Times do módulo Reclame Aqui.
 *
 * Mesma linha do banco que `saveTeam` grava, campos diferentes: aquela
 * tela cadastra descrição, departamento, líder e integrantes; esta
 * cadastra o nome que aparece nos seletores, o nome legado das
 * planilhas antigas, a ordem e se está ativo.
 *
 * **Por que existem duas.** Uma só teria de receber o registro inteiro,
 * e cada tela só conhece a metade que edita — a que gravasse por último
 * apagaria a metade da outra. Este `update` toca exclusivamente nos
 * quatro campos desta aba.
 *
 * Até 21/08/2026 esta função não existia: a aba Times aplicava a
 * mudança na tela e não gravava nada. O que se cadastrava ali sumia no
 * recarregamento.
 */
export async function saveTeamOption(item: TeamOption) {
  const prisma = await autorizado("ADMIN");
  if (!prisma) return;

  const dados = {
    name: item.name,
    legacyName: item.legacyValue || null,
    order: item.order,
    active: item.active,
  };

  await prisma.team.upsert({
    where: { id: item.id },
    update: dados,
    create: { id: item.id, ...dados },
  });

  updateTag(WORKSPACE_TAG);
}

/* ============================================================
   CLIENTES
============================================================ */

/** Campos comuns ao enriquecimento e ao cadastro manual. */
function camposDeCliente(
  item: ClientEnrichment
) {
  return {
    kind: item.kind ?? null,
    establishmentId: item.establishmentId || null,
    document: item.document || null,
    notes: item.notes || null,
    tags: item.tags ?? [],
  };
}

/**
 * O que a operação preenche por cima de um cliente vindo do export.
 *
 * O cliente derivado **não tem linha** até alguém enriquecê-lo — a
 * identidade dele é a reclamação. Este upsert cria a linha na primeira
 * edição e atualiza depois, sempre com `manual` falso: o registro existe
 * para complementar a reclamação, não para substituí-la.
 *
 * `AGENTE` e não `ADMIN`: preencher o tipo de relação ou uma nota sobre
 * o cliente é rotina de quem atende, não configuração da ferramenta.
 */
export async function saveClientEnrichment(
  slug: string,
  patch: ClientEnrichment
) {
  const prisma = await autorizado("AGENTE");
  if (!prisma) return;

  const dados = camposDeCliente(patch);

  await prisma.clientProfile.upsert({
    where: { slug },
    update: dados,
    create: { slug, manual: false, ...dados },
  });

  updateTag(WORKSPACE_TAG);
}

/** Cliente cadastrado à mão, sem reclamação de origem. */
export async function saveManualClient(
  item: ManualClient
) {
  const prisma = await autorizado("AGENTE");
  if (!prisma) return;

  const dados = {
    ...camposDeCliente(item),
    manual: true,
    name: item.name,
    email: item.email || null,
    phone: item.phone || null,
    city: item.city || null,
    state: item.state || null,
  };

  await prisma.clientProfile.upsert({
    where: { slug: item.slug },
    update: dados,
    create: { slug: item.slug, ...dados },
  });

  updateTag(WORKSPACE_TAG);
}

/**
 * Apaga um cadastro manual.
 *
 * `manual: true` no filtro é a trava: um cliente que veio de uma
 * reclamação real não some da base — a reclamação existe, e apagar a
 * linha de enriquecimento por engano perderia o vínculo com o
 * estabelecimento sem tirar ninguém da lista.
 */
export async function removeManualClient(slug: string) {
  const prisma = await autorizado("AGENTE");
  if (!prisma) return;

  await prisma.clientProfile.deleteMany({
    where: { slug, manual: true },
  });

  updateTag(WORKSPACE_TAG);
}

/* ============================================================
   METAS DOS INDICADORES
============================================================ */

/**
 * Meta de um indicador da reputação.
 *
 * As metas nascem nos critérios públicos do RA1000 (90 % de resposta,
 * nota 7, 90 % de solução, 70 % de novos negócios) e a operação pode
 * apertá-las. Só grava o que **difere** do padrão: uma linha por
 * indicador ajustado, e nenhuma para quem está no valor de fábrica.
 *
 * Isso importa na leitura: se o Reclame Aqui mudar um critério público,
 * quem nunca mexeu passa a seguir o critério novo, em vez de ficar
 * preso a uma cópia congelada do antigo.
 *
 * A tabela `ReputationGoal` existia no schema desde o começo e nunca
 * era escrita — as metas viviam em memória e voltavam ao padrão em todo
 * recarregamento.
 */
export async function saveReputationGoal(
  indicator: string,
  target: number,
  padrao: number
) {
  const prisma = await autorizado("ADMIN");
  if (!prisma) return;

  if (target === padrao) {
    await prisma.reputationGoal.deleteMany({
      where: { indicator },
    });
  } else {
    await prisma.reputationGoal.upsert({
      where: { indicator },
      update: { target },
      create: { indicator, target },
    });
  }

  updateTag(WORKSPACE_TAG);
}

/** Devolve todos os indicadores aos critérios do RA1000. */
export async function resetReputationGoals() {
  const prisma = await autorizado("ADMIN");
  if (!prisma) return;

  await prisma.reputationGoal.deleteMany({});

  updateTag(WORKSPACE_TAG);
}

export async function removeTeamRecord(id: string) {
  const prisma = await autorizado("ADMIN");
  if (!prisma) return;

  // Integrantes não são apagados junto: a pessoa continua existindo,
  // só deixa de pertencer ao time.
  await prisma.user.updateMany({
    where: { teamId: id },
    data: { teamId: null },
  });

  await prisma.team.delete({ where: { id } });

  updateTag(WORKSPACE_TAG);
}

/**
 * Vincula um integrante ao time.
 *
 * A pessoa é um `User` — quem entra na plataforma. O cadastro de Times
 * não cria acesso: se o e-mail ainda não tem conta, o vínculo fica
 * pendente até alguém se cadastrar com ele.
 */
export async function assignTeamMember(
  teamId: string,
  member: TeamMember
) {
  const prisma = await autorizado("ADMIN");
  if (!prisma) return;

  const existente = await prisma.user.findUnique({
    where: { email: member.email.toLowerCase() },
    select: { id: true },
  });

  /**
   * Sem conta? Cria uma **sem senha**.
   *
   * Antes isto recusava: "a pessoa precisa se cadastrar antes de entrar
   * no time". O efeito era pior do que a proteção — não havia como
   * cadastrar responsável nenhum, e o Kanban só oferecia quem já tinha
   * login. Quem cuida da operação nem sempre é quem usa a ferramenta.
   *
   * `passwordHash` vazio **não** é uma senha em branco: o login exige um
   * hash bcrypt válido (`isBcryptHash`) e recusa qualquer coisa fora
   * disso. A pessoa existe para receber caso e tarefa, e não entra até
   * se cadastrar — quando o fizer, o autocadastro **adota esta mesma
   * linha**, e tudo que já estava no nome dela continua lá.
   */
  const id =
    existente?.id ??
    (
      await prisma.user.create({
        data: {
          name: member.name,
          email: member.email.toLowerCase(),
          passwordHash: "",
          role: "LEITURA",
        },
        select: { id: true },
      })
    ).id;

  await prisma.user.update({
    where: { id },
    data: {
      name: member.name,
      jobTitle: member.role || null,
      teamId,
    },
  });

  updateTag(WORKSPACE_TAG);
}

export async function unassignTeamMember(
  email: string
) {
  const prisma = await autorizado("ADMIN");
  if (!prisma) return;

  await prisma.user.updateMany({
    where: { email: email.toLowerCase() },
    data: { teamId: null },
  });

  updateTag(WORKSPACE_TAG);
}

/* ============================================================
   JORNADA
============================================================ */

export async function saveJourneyStage(
  item: JourneyStage
) {
  const prisma = await autorizado("ADMIN");
  if (!prisma) return;

  const dados = {
    name: item.name,
    color: item.color,
    description: item.description,
    order: item.order,
    active: item.active,
  };

  await prisma.journeyStage.upsert({
    where: { id: item.id },
    update: dados,
    create: { id: item.id, ...dados },
  });

  updateTag(WORKSPACE_TAG);
}

export async function removeJourneyStage(id: string) {
  const prisma = await autorizado("ADMIN");
  if (!prisma) return;

  await prisma.journeyStage.delete({ where: { id } });

  updateTag(WORKSPACE_TAG);
}

export async function saveJourneyTopic(
  item: JourneyTopic
) {
  const prisma = await autorizado("ADMIN");
  if (!prisma) return;

  const dados = {
    name: item.name,
    icon: item.icon,
    color: item.color,
    order: item.order,
  };

  await prisma.journeyTopic.upsert({
    where: { id: item.id },
    update: dados,
    create: { id: item.id, ...dados },
  });

  updateTag(WORKSPACE_TAG);
}

export async function removeJourneyTopic(id: string) {
  const prisma = await autorizado("ADMIN");
  if (!prisma) return;

  await prisma.journeyTopic.delete({ where: { id } });

  updateTag(WORKSPACE_TAG);
}

export async function saveJourneyEntry(
  item: JourneyEntry
) {
  const prisma = await autorizado();
  if (!prisma) return;

  const dados = {
    topicId: item.topicId,
    company: item.company,
    text: item.text,
    author: item.author,
  };

  await prisma.journeyEntry.upsert({
    where: { id: item.id },
    update: dados,
    create: { id: item.id, ...dados },
  });

  updateTag(WORKSPACE_TAG);
}

export async function removeJourneyEntry(id: string) {
  const prisma = await autorizado();
  if (!prisma) return;

  await prisma.journeyEntry.delete({ where: { id } });

  updateTag(WORKSPACE_TAG);
}

/**
 * Etapa da jornada de um cliente.
 *
 * Antes vivia só na sessão: arrastar a empresa para outra etapa se
 * perdia no reload. A chave é o nome da empresa, como em
 * `JourneyEntry`.
 */
export async function saveJourneyPlacement(
  company: string,
  stageId: string
) {
  const prisma = await autorizado();
  if (!prisma) return;

  await prisma.journeyPlacement.upsert({
    where: { company },
    update: { stageId },
    create: { company, stageId },
  });

  updateTag(WORKSPACE_TAG);
}
