"use server";

import { requireRole, tryRole } from "@/lib/auth/guard";

import {
  ehModulo,
  Modulo,
} from "@/lib/auth/modules";

import type { Role } from "@/lib/auth/guard";

/**
 * Quem pode o quê, por módulo.
 *
 * Administrar exige **ADMIN**, e por um motivo direto: quem edita esta
 * tela pode se dar acesso a qualquer coisa. Deixar isso em AGENTE
 * tornaria o resto da checagem decorativa.
 */

const MODULO: Modulo = "configuracoes";

export interface PessoaComAcesso {
  id: string;
  name: string;
  email: string;
  /** O papel da conta — vale onde não há exceção. */
  role: Role;
  active: boolean;
  /** Só as exceções: módulo → papel. */
  overrides: Record<string, Role>;
}

export async function listAccess(): Promise<{
  pessoas: PessoaComAcesso[];
  permitido: boolean;
}> {

  const ctx = await tryRole("LEITURA", MODULO);

  if (!ctx) return { pessoas: [], permitido: false };

  const linhas = await ctx.prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      moduleRoles: {
        select: { module: true, role: true },
      },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return {
    permitido: ctx.role === "ADMIN",
    pessoas: linhas.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role as Role,
      active: u.active,
      overrides: Object.fromEntries(
        u.moduleRoles.map((m) => [
          m.module,
          m.role as Role,
        ])
      ),
    })),
  };
}

/**
 * Grava — ou apaga — a exceção de um módulo.
 *
 * Escolher o mesmo papel da conta **remove** a linha, em vez de gravar
 * uma cópia do padrão. É o que faz mudar o papel da pessoa continuar
 * valendo em todo módulo onde ninguém mexeu; com a cópia gravada, o
 * módulo ficaria congelado no papel de ontem sem ninguém perceber.
 */
export async function setModuleRole(input: {
  userId: string;
  modulo: string;
  role: Role | "padrao";
}): Promise<{ erro?: string }> {

  const ctx = await requireRole("ADMIN", MODULO);

  if (!ctx) {
    return {
      erro: "Sem banco configurado — não há onde gravar.",
    };
  }

  if (!ehModulo(input.modulo)) {
    return { erro: "Módulo desconhecido." };
  }

  const pessoa = await ctx.prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, role: true },
  });

  if (!pessoa) {
    return { erro: "Essa conta não existe mais." };
  }

  /**
   * Ninguém tira o próprio acesso às Configurações.
   *
   * É a porta pela qual se conserta qualquer outra escolha desta tela.
   * Fechá-la por engano exigiria mexer no banco à mão para voltar.
   */
  if (
    ctx.userId === input.userId &&
    input.modulo === "configuracoes" &&
    input.role !== "ADMIN" &&
    input.role !== "padrao"
  ) {
    return {
      erro: "Você não pode reduzir o próprio acesso às Configurações — é por aqui que se desfaz qualquer engano desta tela.",
    };
  }

  const chave = {
    userId_module: {
      userId: input.userId,
      module: input.modulo,
    },
  };

  if (
    input.role === "padrao" ||
    input.role === pessoa.role
  ) {
    await ctx.prisma.userModuleRole
      .delete({ where: chave })
      .catch(() => {});

    return {};
  }

  await ctx.prisma.userModuleRole.upsert({
    where: chave,
    update: { role: input.role },
    create: {
      userId: input.userId,
      module: input.modulo,
      role: input.role,
    },
  });

  return {};
}
