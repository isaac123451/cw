import { autenticar, responder, responderPreVoo, semSessao } from "@/lib/api/extensao";
import { loadWorkspace } from "@/lib/actions/workspace";
import { getPrisma } from "@/lib/prisma";
import { fetchCaseByProtocol } from "@/lib/services/case.repository";
import { isOpen, isSocial } from "@/lib/services/case.service";
import { slaStatus } from "@/lib/services/sla.service";
import { CANAL_PARA_ORIGEM } from "@/lib/services/case.mapper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O caso rápido (04/11/2026) — ideia do Isaac: "estender o cw reputação
 * pela extensão, uma forma de abrir um caso de forma rápido pra
 * atualizar". Um atalho em qualquer site abre uma janelinha: acha o caso
 * pelo protocolo, nome, telefone ou CNPJ e mostra o que basta para
 * atualizar — a coluna, o prazo e a última anotação. Mover, anotar e
 * lembrar passam pelas rotas de sempre (`mover`, `anotar`).
 *
 * - `?q=` → até 8 casos, abertos primeiro.
 * - `?protocolo=` → o cartão do caso.
 */
const so = (t: string) => t.replace(/\D/g, "");

export async function GET(request: Request) {
  const { usuario, demonstracao } = await autenticar(request);
  if (!usuario && !demonstracao) return semSessao(request);
  const prisma = getPrisma();
  if (!prisma) return responder(request, { erro: "Sem banco configurado." }, 503);

  const url = new URL(request.url);
  const protocolo = (url.searchParams.get("protocolo") ?? "").trim();
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);

  if (protocolo) {
    const caso = await fetchCaseByProtocol(prisma, protocolo);
    if (!caso) return responder(request, { erro: `Não achei o caso ${protocolo}.` }, 404);
    const workspace = await loadWorkspace();
    const sla = slaStatus(caso, workspace.slaRules, { expediente: workspace.expediente });
    const linha = await prisma.case.findUnique({ where: { protocol: caso.protocol }, select: { id: true, externalId: true } });
    const ultima = linha
      ? await prisma.caseComment.findFirst({ where: { caseId: linha.id }, orderBy: { createdAt: "desc" }, select: { body: true, createdAt: true, authorName: true } })
      : null;
    /* As colunas só valem para o Reclame Aqui: as Redes têm o fluxo delas, e mover ali é pela plataforma. */
    const etapas = isSocial(caso)
      ? []
      : workspace.workflow
          .filter((e) => e.active)
          .sort((a, b) => a.order - b.order)
          .map((e) => e.name);
    const base = url.origin;
    return responder(request, {
      protocolo: caso.protocol,
      cliente: caso.customer,
      empresa: caso.company ?? "",
      titulo: caso.title,
      canal: caso.source,
      status: caso.status,
      aberto: isOpen(caso),
      responsavel: caso.owner ?? "",
      prazo: sla.label,
      prazoSituacao: sla.situation,
      etapas,
      ultimaAnotacao: ultima ? { texto: ultima.body.slice(0, 280), em: ultima.createdAt.toISOString(), por: ultima.authorName ?? "" } : null,
      link: `${base}/${isSocial(caso) ? "redes-sociais" : "reclame-aqui"}/${linha?.externalId ?? caso.protocol}`,
    });
  }

  if (q.length < 2) return responder(request, { casos: [] });

  const digitos = so(q);
  const linhas = await prisma.case.findMany({
    where: {
      OR: [
        { protocol: { contains: q, mode: "insensitive" } },
        { externalId: { contains: q, mode: "insensitive" } },
        { customer: { contains: q, mode: "insensitive" } },
        { companyName: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        ...(digitos.length >= 6 ? [{ phone: { contains: digitos } }, { document: { contains: digitos } }] : []),
      ],
    },
    select: { protocol: true, customer: true, companyName: true, status: true, channel: true, updatedAt: true, encerradoEm: true },
    orderBy: { updatedAt: "desc" },
    take: 30,
  });
  /* Abertos primeiro: é o que se atualiza. Dentro de cada grupo, o mexido por último. */
  const casos = linhas
    .sort((a, b) => Number(Boolean(a.encerradoEm)) - Number(Boolean(b.encerradoEm)))
    .slice(0, 8)
    .map((c) => ({ protocolo: c.protocol, cliente: c.customer, empresa: c.companyName ?? "", status: c.status, canal: CANAL_PARA_ORIGEM[c.channel] ?? "Outro", encerrado: Boolean(c.encerradoEm) }));
  return responder(request, { casos });
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
