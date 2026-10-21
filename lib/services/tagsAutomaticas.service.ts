import type { PrismaClient } from "@prisma/client";

import { mudancasDeTags, type CasoParaTags, type MudancaDeTag } from "@/lib/models/tagsAutomaticas";
import { lerCancelamento, lerReclamacoesComRisco } from "@/lib/services/cancelamento.service";

/**
 * Põe e tira as tags que a IA conhece (ver `lib/models/tagsAutomaticas.ts`),
 * com o motivo no histórico de cada caso. Roda no cron do dia e por
 * `scripts/tags-automaticas.ts` (que simula sem `--aplicar`).
 */
export async function sincronizarTagsAutomaticas(prisma: PrismaClient, opcoes: { aplicar?: boolean } = {}): Promise<{ mudancas: MudancaDeTag[]; aplicadas: number }> {
  const [casos, tags, termometros, cancelamento, risco] = await Promise.all([
    prisma.case.findMany({
      select: {
        id: true,
        protocol: true,
        status: true,
        evaluated: true,
        publicResponse: true,
        publishedAt: true,
        document: true,
        establishmentId: true,
        tags: { select: { tag: { select: { name: true } } } },
      },
    }),
    prisma.tag.findMany({ select: { id: true, name: true } }),
    prisma.termometroDoCliente
      .findMany({ where: { caseId: { not: null } }, orderBy: { criadoEm: "desc" }, select: { caseId: true, satisfacao: true, notaPrevista: true, chanceResolvido: true } })
      .catch(() => []),
    lerCancelamento(prisma),
    lerReclamacoesComRisco(prisma).catch(() => []),
  ]);

  const termometro = new Map<string, { satisfacao: number; notaPrevista: number | null; chanceResolvido: number | null }>();
  for (const t of termometros) if (t.caseId && !termometro.has(t.caseId)) termometro.set(t.caseId, t);

  const paraTags: CasoParaTags[] = casos.map((c) => ({
    id: c.id,
    protocolo: c.protocol,
    status: c.status,
    avaliado: c.evaluated,
    /* O marcador da planilha também conta: ele existe para dizer "foi respondida". */
    respondido: Boolean(c.publicResponse && c.publicResponse.trim()),
    criadoEm: c.publishedAt.toISOString().slice(0, 10),
    documento: c.document,
    contaId: c.establishmentId,
    tags: c.tags.map((t) => t.tag.name),
  }));

  const mudancas = mudancasDeTags(paraTags, {
    /*
      Só a reclamação em que o pedido aparece — no texto dela, na nossa resposta, num
      comentário ou marcada no botão —, ou a única do cliente. Marcar todas as do
      cliente punha a tag numa reclamação de impressão de quem pediu em outra.
    */
    naRetencao: new Set(
      cancelamento.clientes.flatMap((c) =>
        c.protocolos.length === 1 ? c.protocolos : c.sinais.filter((s) => s.tipo !== "retido" && c.protocolos.includes(s.ref)).map((s) => s.ref)
      )
    ),
    riscoAlto: new Set(risco.filter((r) => r.risco.nivel === "alto").map((r) => r.protocolo)),
    termometro,
  });

  if (!opcoes.aplicar) return { mudancas, aplicadas: 0 };

  const idDaTag = new Map(tags.map((t) => [t.name, t.id]));
  let aplicadas = 0;
  for (const m of mudancas) {
    const tagId = idDaTag.get(m.tag);
    if (!tagId) continue;
    if (m.acao === "por") await prisma.caseTag.createMany({ data: [{ caseId: m.caseId, tagId }], skipDuplicates: true });
    else await prisma.caseTag.deleteMany({ where: { caseId: m.caseId, tagId } });
    await prisma.caseEvent.create({
      data: { caseId: m.caseId, kind: "etiqueta", detail: `${m.acao === "por" ? "pôs" : "tirou"} “${m.tag}” — ${m.motivo}`, actor: "IA" },
    });
    aplicadas += 1;
  }
  return { mudancas, aplicadas };
}
