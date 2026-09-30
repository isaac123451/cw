import { requireRole, SemPermissao } from "@/lib/auth/guard";
import { montarBackup } from "@/lib/services/backup.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * O botão "Baixar backup" (1.99): a cópia da base de agora, compactada,
 * só para administrador. Senhas, chaves e códigos ficam de fora.
 */
export async function GET() {
  let ctx;
  try {
    ctx = await requireRole("ADMIN");
  } catch (erro) {
    return Response.json({ error: erro instanceof SemPermissao ? erro.message : "Entre como administrador." }, { status: 403 });
  }
  if (!ctx) return Response.json({ error: "Sem banco configurado." }, { status: 503 });

  const b = await montarBackup(ctx.prisma);
  return new Response(new Uint8Array(b.gz), {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="${b.nome}"`,
      "Cache-Control": "no-store",
      "X-Backup-Linhas": String(b.linhas),
      "X-Backup-Tabelas": String(b.tabelas),
    },
  });
}
