import { NextResponse } from "next/server";

import { requireRole, SemPermissao } from "@/lib/auth/guard";
import { proporLote } from "@/lib/services/propostaDeCategoria.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Um pedido à IA com algumas reclamações cabe folgado; o relógio padrão não. */
export const maxDuration = 60;

/**
 * Classifica as próximas reclamações sem proposta (1.132).
 *
 * Uma rodada por chamada: a tela chama de novo enquanto houver
 * `restantes`, e mostra o andamento. Só grava propostas — a troca da
 * categoria é decidida na tela, por quem aprova.
 */
export async function POST() {
  try {
    const ctx = await requireRole("ADMIN");
    if (!ctx) return NextResponse.json({ ok: false, erro: "Sem banco configurado." }, { status: 503 });
    const r = await proporLote(ctx.prisma);
    return NextResponse.json(r, { status: r.ok ? 200 : 502 });
  } catch (erro) {
    if (erro instanceof SemPermissao) return NextResponse.json({ ok: false, erro: "Só administrador classifica as reclamações." }, { status: 403 });
    return NextResponse.json({ ok: false, erro: erro instanceof Error ? erro.message : "Falha ao classificar." }, { status: 500 });
  }
}
