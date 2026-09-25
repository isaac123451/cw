import { NextResponse } from "next/server";

import { tryRole } from "@/lib/auth/guard";
import { BYTES_POR_IMAGEM, IMAGENS_POR_CASO, TIPOS_DE_IMAGEM } from "@/lib/models/dossieTexto";

/**
 * Envia uma imagem ao dossiê do caso (1.77).
 *
 * Por rota, e não por server action: a action tem teto de 1 MB no corpo,
 * e um print passa disso antes de ser comprimido. A tela comprime para
 * JPEG de até 1600 px antes de mandar; aqui só se confere o tipo, o
 * tamanho e o limite por caso. Grava e só então responde.
 */
export async function POST(request: Request) {
  const ctx = await tryRole("AGENTE");
  if (!ctx) return NextResponse.json({ erro: "Sessão expirada ou sem permissão. Entre novamente." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const protocolo = String(form?.get("protocolo") ?? "");
  const legenda = String(form?.get("legenda") ?? "").trim().slice(0, 300);
  const arquivo = form?.get("arquivo");
  if (!protocolo || !(arquivo instanceof Blob)) return NextResponse.json({ erro: "Imagem ausente." }, { status: 400 });
  if (!TIPOS_DE_IMAGEM.includes(arquivo.type)) return NextResponse.json({ erro: "Só imagens JPEG, PNG ou WebP." }, { status: 400 });
  if (arquivo.size > BYTES_POR_IMAGEM) return NextResponse.json({ erro: "A imagem passou de 900 KB mesmo comprimida." }, { status: 400 });

  const caso = await ctx.prisma.case.findFirst({ where: { OR: [{ protocol: protocolo }, { externalId: protocolo }] }, select: { id: true } });
  if (!caso) return NextResponse.json({ erro: "Caso não encontrado." }, { status: 404 });

  const ja = await ctx.prisma.imagemDoDossie.count({ where: { caseId: caso.id } });
  if (ja >= IMAGENS_POR_CASO) return NextResponse.json({ erro: `O dossiê já tem ${IMAGENS_POR_CASO} imagens — tire uma antes.` }, { status: 400 });

  const eu = await ctx.prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } });
  const nome = (arquivo instanceof File && arquivo.name ? arquivo.name : "imagem.jpg").slice(0, 120);
  const dados = Buffer.from(await arquivo.arrayBuffer());

  const salva = await ctx.prisma.imagemDoDossie.create({
    data: { caseId: caso.id, nome, tipo: arquivo.type, bytes: dados.length, dados, legenda: legenda || null, criadoPor: eu?.name ?? null },
    select: { id: true, nome: true, legenda: true, bytes: true, criadoEm: true },
  });

  return NextResponse.json({
    imagem: { id: salva.id, nome: salva.nome, legenda: salva.legenda ?? undefined, bytes: salva.bytes, criadoEm: salva.criadoEm.toISOString() },
  });
}
