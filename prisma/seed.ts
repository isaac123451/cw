import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import bcrypt from "bcryptjs";

import { ETAPAS_DO_QUADRO } from "../lib/data/padroes/etapas";
import {
  CATEGORIAS,
  CHECKLIST,
  SUBCATEGORIAS,
  TIMES,
} from "../lib/data/padroes/classificacao";
import { ETIQUETAS } from "../lib/data/padroes/etiquetas";
import {
  ETAPAS_DA_JORNADA,
  TOPICOS_DA_JORNADA,
} from "../lib/data/padroes/jornada";
import { TIPOS_DE_IMPACTO } from "../lib/data/padroes/tiposDeImpacto";
import {
  ETAPAS_PADRAO,
  TIPOS_PADRAO,
} from "../lib/models/nps";
import { BOOTSTRAP_EMAILS } from "../lib/auth/access";

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

async function main() {

  // E-mails liberados
  for (const email of BOOTSTRAP_EMAILS) {
    await prisma.allowedEmail.upsert({
      where: { email },
      update: {},
      create: { email, note: "Liberação inicial" },
    });
  }

  /*
    Só as opções de time, que são cadastro: nome e ordem, usados para
    classificar a reclamação. O elenco fictício de times com pessoas
    dentro saiu junto com o resto dos exemplos.
  */
  for (const team of TIMES) {
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
  for (const status of ETAPAS_DO_QUADRO) {
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
  for (const category of CATEGORIAS) {
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

    const subs = SUBCATEGORIAS.filter(
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
  for (const item of CHECKLIST) {
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
  for (const tag of ETIQUETAS) {
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
   * **Este seed não cria reclamação nenhuma.**
   *
   * Ele plantava 334 reclamações de exemplo, e em 23/08/2026 elas foram
   * parar por cima da base de produção — que tinha as 340 reais da
   * planilha do Reclame Aqui. Ninguém foi sobrescrito, mas a base
   * dobrou e todo indicador passou a misturar consumidor de verdade com
   * consumidor inventado.
   *
   * A primeira correção foi uma trava ("só numa base vazia"). A
   * definitiva é esta: o arquivo de exemplos não existe mais. Reclamação
   * entra por `npm run ra:completo`, a partir do export do Reclame
   * Aqui — que é a única fonte que descreve gente real.
   */

  /**
   * Cadastros da operação.
   *
   * Todos por `upsert` ou com verificação de existência: rodar o seed de
   * novo não pode duplicar nem sobrescrever o que a operação editou na
   * tela. Os que têm chave natural (destino, slug, nome) usam-na; os
   * demais só entram quando a tabela ainda está vazia.
   */

  /**
   * **Processos e SLA nascem vazios, de propósito.**
   *
   * O seed plantava seis regras de SLA e cinco prazos de movimentação
   * para a tela não abrir em branco. O Isaac pediu para zerar em 23/08,
   * e a razão é mais forte do que a estética: prazo que ninguém
   * escolheu ainda pinta caso de vermelho. A equipe passa a ver
   * "estourado" por um combinado que nunca foi feito, e o que ela
   * aprende é a ignorar o vermelho — que era o único sinal útil da
   * tela.
   *
   * Não basta apagar no banco: o `movementRule` voltava por `upsert` em
   * **toda** execução do seed, e o `slaRule` voltava sempre que a
   * tabela estivesse vazia — exatamente o estado em que
   * `npm run zerar:processos` a deixa. Sem esta mudança aqui, zerar
   * duraria até o próximo seed.
   *
   * `REGRAS_DE_SLA` e `PRAZOS_DE_MOVIMENTACAO` seguem em `lib/data/` como
   * exemplo do formato — quem quiser recriá-las tem o modelo à mão.
   */

  /**
   * Estabelecimento também não se inventa.
   *
   * Eram três — Pizzaria Itália, Burger Prime, Sushi House — e voltavam
   * a cada execução por `upsert` de slug, mesmo depois de apagados.
   * Numa base de produção eles apareciam no cadastro ao lado dos 239
   * restaurantes reais, e bastava alguém vincular uma reclamação a um
   * deles para o erro virar dado.
   */

  for (const stage of ETAPAS_DA_JORNADA) {
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

  for (const topic of TOPICOS_DA_JORNADA) {
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

  for (const tipo of TIPOS_DE_IMPACTO) {
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
