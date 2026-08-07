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
import { BOOTSTRAP_EMAILS } from "../lib/auth/access";

const url = process.env.DATABASE_URL;

if (!url) {
  console.error(
    "DATABASE_URL não definido — configure o banco antes de rodar o seed."
  );
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

async function main() {

  // E-mails liberados
  for (const email of BOOTSTRAP_EMAILS) {
    await prisma.allowedEmail.upsert({
      where: { email },
      update: {},
      create: { email, note: "Liberação inicial" },
    });
  }

  // Times
  for (const team of mockTeamOptions) {
    await prisma.team.upsert({
      where: { name: team.name },
      update: {
        legacyName: team.legacyValue,
        active: team.active,
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
