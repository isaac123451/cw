"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/guard";
import type { Modulo } from "@/lib/auth/modules";

import { getSession } from "@/lib/auth/session";

import {
  podeEnviarEmail,
  provedorAtivo,
} from "@/lib/email/enviar";

import { lerConfiguracao } from "@/lib/auth/two-factor";

/** O módulo a que estas ações pertencem — ver lib/auth/modules.ts. */
const MODULO: Modulo = "configuracoes";

export interface RetratoDaSeguranca {
  /** Exigência para todo mundo. */
  exigirParaTodos: boolean;
  /** A escolha de quem está olhando a tela. */
  exigirParaMim: boolean;

  minutosDeValidade: number;
  tentativas: number;

  /** Dá para enviar e-mail neste ambiente? */
  podeEnviar: boolean;
  provedor: string;

  /** Quantas pessoas já pediram a segunda etapa para si. */
  pessoasComSegundaEtapa: number;
  totalDePessoas: number;
}

export async function lerSeguranca(): Promise<
  RetratoDaSeguranca | { erro: string }
> {

  const ctx = await requireRole("ADMIN", MODULO);

  if (!ctx) {
    return {
      erro: "Sem banco configurado — não há o que ler.",
    };
  }

  const config = await lerConfiguracao();

  const [comSegundaEtapa, total, eu] = await Promise.all([
    ctx.prisma.user.count({
      where: { twoFactorEnabled: true },
    }),
    ctx.prisma.user.count(),
    ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { twoFactorEnabled: true },
    }),
  ]);

  return {
    exigirParaTodos: config.twoFactorRequired,
    exigirParaMim: eu?.twoFactorEnabled ?? false,
    minutosDeValidade: config.codeTtlMinutes,
    tentativas: config.maxAttempts,
    podeEnviar: podeEnviarEmail(),
    provedor: provedorAtivo(),
    pessoasComSegundaEtapa: comSegundaEtapa,
    totalDePessoas: total,
  };
}

export interface EntradaDeSeguranca {
  exigirParaTodos: boolean;
  minutosDeValidade: number;
  tentativas: number;
}

export async function salvarSeguranca(
  entrada: EntradaDeSeguranca
): Promise<{ erro?: string }> {

  const ctx = await requireRole("ADMIN", MODULO);

  if (!ctx) {
    return {
      erro: "Sem banco configurado — a escolha precisa de onde ser gravada.",
    };
  }

  /**
   * A trava que impede trancar a equipe para fora.
   *
   * Exigir código por e-mail sem provedor de e-mail configurado
   * significa que, na próxima expiração de sessão, **ninguém** entra —
   * inclusive quem acabou de ligar a opção. O conserto exigiria acesso
   * direto ao banco. Por isso a recusa é aqui, no servidor, e não só um
   * botão desabilitado na tela: botão desabilitado se contorna.
   */
  if (entrada.exigirParaTodos && !podeEnviarEmail()) {
    return {
      erro: "Configure o envio de e-mail (RESEND_API_KEY) antes de exigir a verificação em duas etapas — sem ele ninguém receberia o código.",
    };
  }

  const dentro = (
    valor: number,
    padrao: number,
    minimo: number,
    maximo: number
  ) =>
    Number.isFinite(valor)
      ? Math.min(Math.max(Math.round(valor), minimo), maximo)
      : padrao;

  const dados = {
    twoFactorRequired: entrada.exigirParaTodos,
    codeTtlMinutes: dentro(
      entrada.minutosDeValidade,
      10,
      1,
      60
    ),
    maxAttempts: dentro(entrada.tentativas, 5, 1, 10),
    updatedBy: ctx.userId,
  };

  await ctx.prisma.securityConfig.upsert({
    where: { id: "unico" },
    update: dados,
    create: { id: "unico", ...dados },
  });

  revalidatePath("/configuracoes");

  return {};
}

/**
 * A escolha de cada pessoa para a própria conta.
 *
 * Não exige ADMIN — exige **estar logado**, e só mexe na própria linha.
 * Deixar alguém ligar a segunda etapa para si é o oposto de um risco;
 * o que não pode é mexer na de outra pessoa, e é por isso que o id vem
 * da sessão e nunca do formulário.
 */
export async function definirSegundaEtapaPropria(
  ligar: boolean
): Promise<{ erro?: string }> {

  const ctx = await requireRole("AGENTE", MODULO);

  if (!ctx) {
    return { erro: "Sem banco configurado." };
  }

  const sessao = await getSession();

  if (!sessao) {
    return { erro: "Sessão expirada. Entre novamente." };
  }

  if (ligar && !podeEnviarEmail()) {
    return {
      erro: "Configure o envio de e-mail antes de ligar a verificação em duas etapas.",
    };
  }

  await ctx.prisma.user.update({
    where: { id: sessao.id },
    data: { twoFactorEnabled: ligar },
  });

  revalidatePath("/configuracoes");

  return {};
}
