import { NextResponse } from "next/server";

import { tryRole } from "@/lib/auth/guard";

/** A imagem do dossiê, para quem tem sessão — nunca pública. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await tryRole("LEITURA");
  if (!ctx) return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });

  const { id } = await params;
  const imagem = await ctx.prisma.imagemDoDossie.findUnique({ where: { id }, select: { dados: true, tipo: true } });
  if (!imagem) return NextResponse.json({ erro: "Imagem não encontrada." }, { status: 404 });

  return new NextResponse(new Uint8Array(imagem.dados), {
    headers: {
      "Content-Type": imagem.tipo,
      /* Privada: o navegador de quem viu guarda, nenhum cache no meio. */
      "Cache-Control": "private, max-age=86400",
    },
  });
}
