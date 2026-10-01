"use server";

import { apagarCookieDoDispositivo, idDesteDispositivo } from "@/lib/auth/dispositivo";
import { requireRole } from "@/lib/auth/guard";

/**
 * Os dispositivos lembrados da própria pessoa (1.120), em Minha conta.
 *
 * Cada um só vê e esquece os seus: o id da pessoa vem da sessão, nunca da
 * tela. `requireRole("LEITURA")` porque toda conta ativa, de qualquer
 * papel, cuida dos próprios acessos — e ele confere no banco que a conta
 * ainda está ativa.
 */

export interface DispositivoLembrado {
  id: string;
  nome: string;
  criadoEm: string;
  ultimoUsoEm: string;
  validoAte: string;
  /** É o navegador de onde a pessoa está olhando. */
  este: boolean;
}

async function contexto() {
  try {
    return await requireRole("LEITURA");
  } catch {
    return null;
  }
}

export async function listarMeusDispositivos(): Promise<{ ok: true; dispositivos: DispositivoLembrado[] } | { ok: false; erro: string }> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Entre de novo para ver seus dispositivos." };
  const [linhas, este] = await Promise.all([
    ctx.prisma.dispositivoConfiavel.findMany({
      where: { userId: ctx.userId, revogadoEm: null, validoAte: { gt: new Date() } },
      orderBy: { ultimoUsoEm: "desc" },
    }),
    idDesteDispositivo(),
  ]);
  return {
    ok: true,
    dispositivos: linhas.map((l) => ({
      id: l.id,
      nome: l.nome,
      criadoEm: l.criadoEm.toISOString(),
      ultimoUsoEm: l.ultimoUsoEm.toISOString(),
      validoAte: l.validoAte.toISOString(),
      este: l.id === este,
    })),
  };
}

/** Esquece um dispositivo — o próximo login nele volta a pedir o código. */
export async function esquecerDispositivo(id: string): Promise<{ erro?: string }> {
  const ctx = await contexto();
  if (!ctx) return { erro: "Entre de novo para esquecer o dispositivo." };
  const feito = await ctx.prisma.dispositivoConfiavel.updateMany({
    where: { id: String(id), userId: ctx.userId, revogadoEm: null },
    data: { revogadoEm: new Date() },
  });
  if (feito.count === 0) return { erro: "Esse dispositivo já tinha sido esquecido." };
  if ((await idDesteDispositivo()) === id) await apagarCookieDoDispositivo();
  return {};
}

/** Esquece todos os dispositivos da pessoa, este inclusive. */
export async function esquecerTodosOsDispositivos(): Promise<{ erro?: string; quantos?: number }> {
  const ctx = await contexto();
  if (!ctx) return { erro: "Entre de novo para esquecer os dispositivos." };
  const feito = await ctx.prisma.dispositivoConfiavel.updateMany({
    where: { userId: ctx.userId, revogadoEm: null },
    data: { revogadoEm: new Date() },
  });
  await apagarCookieDoDispositivo();
  return { quantos: feito.count };
}
