"use server";

import { requireRole, SemPermissao } from "@/lib/auth/guard";
import type { TermometroView } from "@/lib/models/termometro";
import { medirTermometro, termometroAtual } from "@/lib/services/termometro.service";

/**
 * O termômetro do cliente, pela tela (09/10/2026) — ver `lib/models/termometro.ts`.
 * A ficha do caso pede pelo protocolo; a do NPS, pelo id da resposta.
 */

type Resultado<T> = ({ ok: true } & T) | { ok: false; erro: string };

async function contexto() {
  try {
    return await requireRole("AGENTE");
  } catch (erro) {
    if (erro instanceof SemPermissao) return null;
    throw erro;
  }
}

async function alvo(prisma: NonNullable<Awaited<ReturnType<typeof contexto>>>["prisma"], quem: { protocolo?: string; npsId?: string }) {
  if (quem.protocolo) {
    const c = await prisma.case.findUnique({ where: { protocol: quem.protocolo }, select: { id: true } });
    return c ? { caseId: c.id } : null;
  }
  return quem.npsId ? { npsResponseId: quem.npsId } : null;
}

export async function lerTermometro(quem: { protocolo?: string; npsId?: string }): Promise<Resultado<{ termometro: TermometroView | null }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: true, termometro: null };
  try {
    const a = await alvo(ctx.prisma, quem);
    return { ok: true, termometro: a ? await termometroAtual(ctx.prisma, a) : null };
  } catch {
    return { ok: false, erro: "Não deu para ler o termômetro." };
  }
}

export async function medirTermometroAgora(quem: { protocolo?: string; npsId?: string }): Promise<Resultado<{ termometro: TermometroView }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sem permissão para medir." };
  try {
    const a = await alvo(ctx.prisma, quem);
    if (!a) return { ok: false, erro: "Esse caso ou NPS não existe mais." };
    const r = await medirTermometro(ctx.prisma, a);
    return r.ok ? { ok: true, termometro: r.termometro } : r;
  } catch {
    return { ok: false, erro: "Não deu para medir agora. Tente de novo em instantes." };
  }
}
