import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import bcrypt from "bcryptjs";

import { mockWorkflow } from "../lib/data/mockWorkflow";
import {
  mockCategories,
  mockChecklist,
  mockSubcategories,
  mockTeamOptions,
} from "../lib/data/mockSettings";
import { mockTags } from "../lib/data/mockTags";
import { mockCases } from "../lib/data/mockCases";
import { mockSlaRules } from "../lib/data/mockSla";
import {
  mockMovementRules,
  mockMovements,
} from "../lib/data/mockMovements";
import { mockEstablishments } from "../lib/data/mockEstablishments";
import {
  mockJourneyEntries,
  mockJourneyStages,
  mockJourneyTopics,
} from "../lib/data/mockJourney";
import { mockProjects } from "../lib/data/mockProjects";
import { mockPlaybooks } from "../lib/data/mockPlaybooks";
import { mockMacros } from "../lib/data/mockMacros";
import { mockTeams } from "../lib/data/mockTeams";
import { mockImpactTypes } from "../lib/data/mockImpactTypes";
import {
  ETAPAS_PADRAO,
  TIPOS_PADRAO,
} from "../lib/models/nps";
import { BOOTSTRAP_EMAILS } from "../lib/auth/access";
import { parseElapsed } from "../lib/services/reputation.service";
import type { Case } from "../lib/models/case";

/**
 * Prefere a conexão direta (de sessão): o seed grava centenas de
 * registros em sequência, e o pooler em modo transação atrapalha isso.
 */
const url =
  process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!url) {
  console.error(
    "DATABASE_URL não definido — configure o banco antes de rodar o seed."
  );
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

const PRIORIDADES = {
  "Crítica": "CRITICA",
  Alta: "ALTA",
  "Média": "MEDIA",
  Baixa: "BAIXA",
} as const;

const CANAIS: Record<string, string> = {
  "Reclame Aqui": "RECLAME_AQUI",
  Instagram: "INSTAGRAM",
  Facebook: "FACEBOOK",
  WhatsApp: "WHATSAPP",
  ManyChat: "MANYCHAT",
};

/** Data ISO (YYYY-MM-DD) → Date em UTC, sem escorregar de dia por fuso. */
function dia(value?: string) {
  return value
    ? new Date(`${value}T00:00:00Z`)
    : undefined;
}

/**
 * Reclamação do dataset → registro do banco.
 *
 * Categoria e subcategoria viram relação por nome; o que não existir no
 * cadastro é **criada**, não descartada: a base real usa nomes que o
 * cadastro inicial não previa ("Cardápio e pedidos", "Marketplace e
 * integrações") e 24 subcategorias inteiras ficariam de fora. Descartar
 * deixaria o banco mais pobre que a planilha de origem.
 *
 * O que a operação faz depois com essas categorias — renomear, fundir,
 * desativar — é decisão de tela, e `OrphanCategories` já as aponta.
 */
async function seedCase(item: Case) {

  const category = await prisma.category.upsert({
    where: { name: item.category },
    update: {},
    create: {
      name: item.category,
      description:
        "Criada a partir da importação do Reclame Aqui.",
      order: 999,
      active: true,
    },
    select: { id: true },
  });

  // Escopada à categoria do caso: o mesmo nome de subcategoria pode
  // existir sob outra categoria, e a chave única é o par.
  const subcategory = item.subcategory
    ? await prisma.subcategory.upsert({
        where: {
          categoryId_name: {
            categoryId: category.id,
            name: item.subcategory,
          },
        },
        update: {},
        create: {
          categoryId: category.id,
          name: item.subcategory,
          description:
            "Criada a partir da importação do Reclame Aqui.",
          order: 999,
          active: true,
        },
        select: { id: true },
      })
    : null;

  const dados = {
    channel: (CANAIS[item.source] ??
      "OUTRO") as never,
    companyName: item.company,
    customer: item.customer,
    email: item.email ?? null,
    phone: item.phone ?? null,
    city: item.city ?? null,
    state: item.state ?? null,
    categoryId: category.id,
    subcategoryId: subcategory?.id ?? null,
    priority: (PRIORIDADES[item.priority] ??
      "MEDIA") as never,
    status: item.status,
    title: item.title,
    description: item.description,
    publicResponse: item.publicResponse ?? null,
    evaluated: Boolean(item.evaluated),
    score: item.score ?? null,
    scoreDisregarded: Boolean(item.scoreDisregarded),
    resolved: item.resolved,
    wouldDoBusiness: item.wouldDoBusiness,
    evaluatedAt: dia(item.evaluatedAt) ?? null,
    churnRisk: Boolean(item.churnRisk),
    request: item.request ?? null,
    responseMinutes: parseElapsed(item.responseTime),
    solutionMinutes: parseElapsed(item.solutionTime),
    slaTarget: item.sla,
    externalUrl: item.raUrl ?? null,
    externalId: item.id,
    publishedAt: dia(item.createdAt) as Date,
  };

  await prisma.case.upsert({
    where: { protocol: item.protocol },
    update: dados,
    create: { protocol: item.protocol, ...dados },
  });
}

async function main() {

  // E-mails liberados
  for (const email of BOOTSTRAP_EMAILS) {
    await prisma.allowedEmail.upsert({
      where: { email },
      update: {},
      create: { email, note: "Liberação inicial" },
    });
  }

  // Times — o cadastro completo manda; as opções cobrem o resto.
  for (const team of mockTeams) {
    await prisma.team.upsert({
      where: { name: team.name },
      update: {},
      create: {
        name: team.name,
        description: team.description,
        department: team.department,
        leader: team.leader,
        active: team.active,
      },
    });
  }

  for (const team of mockTeamOptions) {
    await prisma.team.upsert({
      where: { name: team.name },
      update: {
        legacyName: team.legacyValue,
        order: team.order,
      },
      create: {
        name: team.name,
        legacyName: team.legacyValue,
        active: team.active,
        order: team.order,
      },
    });
  }

  // Status do fluxo
  for (const status of mockWorkflow) {
    await prisma.workflowStatus.upsert({
      where: { name: status.name },
      update: {
        color: status.color,
        order: status.order,
        active: status.active,
        wipLimit: status.limit ?? null,
      },
      create: {
        name: status.name,
        color: status.color,
        order: status.order,
        active: status.active,
        wipLimit: status.limit ?? null,
      },
    });
  }

  // Categorias e subcategorias
  for (const category of mockCategories) {
    const saved = await prisma.category.upsert({
      where: { name: category.name },
      update: {
        description: category.description,
        order: category.order,
        active: category.active,
      },
      create: {
        name: category.name,
        description: category.description,
        order: category.order,
        active: category.active,
      },
    });

    const subs = mockSubcategories.filter(
      (item) => item.category === category.name
    );

    for (const sub of subs) {
      await prisma.subcategory.upsert({
        where: {
          categoryId_name: {
            categoryId: saved.id,
            name: sub.name,
          },
        },
        update: {
          description: sub.description,
          order: sub.order,
          active: sub.active,
        },
        create: {
          categoryId: saved.id,
          name: sub.name,
          description: sub.description,
          order: sub.order,
          active: sub.active,
        },
      });
    }
  }

  // Checklist de resolução
  for (const item of mockChecklist) {
    await prisma.checklistItem.upsert({
      where: { key: item.key },
      update: {
        label: item.label,
        required: item.required,
        order: item.order,
        active: item.active,
      },
      create: {
        key: item.key,
        label: item.label,
        required: item.required,
        order: item.order,
        active: item.active,
      },
    });
  }

  // Tags operacionais
  for (const tag of mockTags) {
    await prisma.tag.upsert({
      where: { name: tag.name },
      update: {
        color: tag.color,
        description: tag.description,
        order: tag.order,
        active: tag.active,
      },
      create: {
        name: tag.name,
        color: tag.color,
        description: tag.description,
        order: tag.order,
        active: tag.active,
      },
    });
  }

  /**
   * Reclamações.
   *
   * Vai por último porque depende de categoria e subcategoria já
   * existirem. Uma a uma e por `upsert`: rodar o seed de novo atualiza o
   * que mudou em vez de duplicar protocolo.
   */
  let gravados = 0;

  for (const item of mockCases) {
    await seedCase(item);
    gravados++;
  }

  console.log(`Reclamações no banco: ${gravados}`);

  // Etiquetas aplicadas aos casos
  for (const item of mockCases) {

    if (!item.tags || item.tags.length === 0) continue;

    const caso = await prisma.case.findUnique({
      where: { protocol: item.protocol },
      select: { id: true },
    });

    if (!caso) continue;

    for (const nome of item.tags) {

      const tag = await prisma.tag.findUnique({
        where: { name: nome },
        select: { id: true },
      });

      if (!tag) continue;

      await prisma.caseTag.upsert({
        where: {
          caseId_tagId: {
            caseId: caso.id,
            tagId: tag.id,
          },
        },
        update: {},
        create: { caseId: caso.id, tagId: tag.id },
      });
    }
  }

  /**
   * Cadastros da operação.
   *
   * Todos por `upsert` ou com verificação de existência: rodar o seed de
   * novo não pode duplicar nem sobrescrever o que a operação editou na
   * tela. Os que têm chave natural (destino, slug, nome) usam-na; os
   * demais só entram quando a tabela ainda está vazia.
   */

  for (const rule of mockMovementRules) {
    await prisma.movementRule.upsert({
      where: { destination: rule.destination },
      update: {},
      create: {
        destination: rule.destination,
        hours: rule.hours,
        note: rule.note ?? null,
        active: rule.active,
      },
    });
  }

  if ((await prisma.slaRule.count()) === 0) {
    await prisma.slaRule.createMany({
      data: mockSlaRules.map((rule) => ({
        category: rule.category,
        priority: rule.priority ?? null,
        responseHours: rule.responseHours,
        solutionHours: rule.solutionHours,
        team: rule.team ?? null,
        note: rule.note ?? null,
        active: rule.active,
      })),
    });
  }

  for (const item of mockEstablishments) {
    await prisma.establishment.upsert({
      where: { slug: item.slug },
      update: {},
      create: {
        slug: item.slug,
        name: item.name,
        document: item.document ?? null,
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
        startedAt: dia(item.startedAt) ?? null,
        phone: item.phone ?? null,
        email: item.email ?? null,
        notes: item.notes ?? null,
      },
    });
  }

  for (const stage of mockJourneyStages) {
    await prisma.journeyStage.upsert({
      where: { name: stage.name },
      update: {},
      create: {
        name: stage.name,
        color: stage.color,
        description: stage.description,
        order: stage.order,
        active: stage.active,
      },
    });
  }

  const topicos = new Map<string, string>();

  for (const topic of mockJourneyTopics) {
    const row = await prisma.journeyTopic.upsert({
      where: { name: topic.name },
      update: {},
      create: {
        name: topic.name,
        icon: topic.icon,
        color: topic.color,
        order: topic.order,
      },
      select: { id: true },
    });

    topicos.set(topic.id, row.id);
  }

  if ((await prisma.journeyEntry.count()) === 0) {
    await prisma.journeyEntry.createMany({
      data: mockJourneyEntries
        .filter((e) => topicos.has(e.topicId))
        .map((e) => ({
          topicId: topicos.get(e.topicId) as string,
          company: e.company,
          text: e.text,
          author: e.author,
          createdAt: dia(e.createdAt) ?? new Date(),
        })),
    });
  }

  if ((await prisma.project.count()) === 0) {
    await prisma.project.createMany({
      data: mockProjects.map((p) => ({
        title: p.title,
        description: p.description,
        stage: p.stage,
        owner: p.owner,
        impact: p.impact,
        progress: p.progress,
        tags: p.tags,
      })),
    });
  }

  for (const playbook of mockPlaybooks) {
    await prisma.playbook.upsert({
      where: { slug: playbook.slug },
      update: {},
      create: {
        slug: playbook.slug,
        title: playbook.title,
        summary: playbook.summary,
        scope: playbook.scope,
        owner: playbook.owner,
        version: playbook.version,
        steps: playbook.steps as never,
        rules: playbook.rules ?? [],
        confluenceUrl: playbook.confluenceUrl ?? null,
      },
    });
  }

  for (const tipo of mockImpactTypes) {
    await prisma.impactType.upsert({
      where: { name: tipo.name },
      update: {},
      create: {
        name: tipo.name,
        direction: tipo.direction,
        description: tipo.description ?? null,
        order: tipo.order,
        active: tipo.active,
      },
    });
  }

  /**
   * As etapas e os tipos do NPS.
   *
   * `update: {}` de propósito, como no resto do seed: rodar de novo não
   * pode desfazer o que a operação ajustou na tela. Estes são os
   * valores de partida do guia — a mesma lista que a aplicação devolve
   * com a tabela vazia, só que agora gravada, para a tela de cadastro
   * ter o que editar.
   */
  for (const etapa of ETAPAS_PADRAO) {
    await prisma.npsStage.upsert({
      where: { name: etapa.name },
      update: {},
      create: {
        name: etapa.name,
        color: etapa.color,
        order: etapa.order,
        active: etapa.active,
        final: etapa.final,
        kinds: etapa.kinds,
      },
    });
  }

  for (const tipo of TIPOS_PADRAO) {
    await prisma.npsKind.upsert({
      where: { name: tipo.name },
      update: {},
      create: {
        name: tipo.name,
        emoji: tipo.emoji,
        color: tipo.color,
        action: tipo.action,
        requiresConfirmation: tipo.requiresConfirmation,
        requiresRootCause: tipo.requiresRootCause,
        opensProcessReview: tipo.opensProcessReview,
        ownDeadlineHours: tipo.ownDeadlineHours ?? null,
        order: tipo.order,
        active: tipo.active,
      },
    });
  }

  /**
   * As respostas prontas entram uma a uma, e só as que faltam.
   *
   * Era um `createMany` guardado por `count() === 0`, o que funciona
   * para semear um banco vazio e **nunca mais**. Quando as cinco do
   * WhatsApp foram escritas, elas não entraram: já havia cinco no
   * banco, e a guarda pulava o bloco inteiro.
   *
   * Agora a comparação é por título, e quem já existe é deixado em paz:
   * o seed acrescenta, não reescreve. O que a operação editou na tela
   * fica como está.
   */
  for (const m of mockMacros) {

    const existente = await prisma.macro.findFirst({
      where: { title: m.title },
      select: { id: true },
    });

    if (existente) continue;

    await prisma.macro.create({
      data: {
        title: m.title,
        body: m.body,
        category: m.category,
        channel: m.channel,
        owner: m.owner,
        tags: m.tags,
        uses: m.uses,
      },
    });
  }

  /** Movimentações dependem do caso já existir. */
  if ((await prisma.caseMovement.count()) === 0) {

    for (const mov of mockMovements) {

      const caso = await prisma.case.findFirst({
        where: { externalId: mov.caseId },
        select: { id: true },
      });

      if (!caso) continue;

      await prisma.caseMovement.create({
        data: {
          caseId: caso.id,
          destination: mov.destination,
          reason: mov.reason,
          actor: mov.actor,
          startedAt: dia(mov.startedAt) as Date,
          dueHours: mov.dueHours,
          returnedAt: dia(mov.returnedAt) ?? null,
          outcome: mov.outcome ?? null,
        },
      });
    }
  }

  console.log("Cadastros da operação prontos.");

  // Administrador inicial
  const adminEmail = BOOTSTRAP_EMAILS[0];

  const senhaInicial =
    process.env.SEED_ADMIN_PASSWORD ?? "cw-reputacao-2026";

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Carlos Isaac",
      role: "ADMIN",
      passwordHash: await bcrypt.hash(senhaInicial, 10),
    },
  });

  console.log("Seed concluído.");
  console.log(`Admin: ${adminEmail}`);
  console.log(`Senha inicial: ${senhaInicial}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
