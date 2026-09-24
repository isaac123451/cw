import { revalidateTag } from "next/cache";

import { autenticar, responder, responderPreVoo, semSessao } from "@/lib/api/extensao";
import { CASES_TAG, WORKSPACE_TAG } from "@/lib/actions/tags";
import { descricaoDoImpacto } from "@/lib/models/impactoNaConversa";
import { getPrisma } from "@/lib/prisma";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** O tipo de custo em Impacto — o mesmo que a oferta aceita usa (`lib/actions/negociacao.ts`). */
const TIPO = "Oferta concedida";

/**
 * POST /api/extensao/impacto — a condição dada na conversa vira
 * lançamento de custo em Impacto no Negócio (Fase 28).
 *
 * Um clique no aviso do painel: o valor e o caso já vêm preenchidos. O
 * valor vai negativo (é dinheiro concedido), ligado ao caso e à conta.
 * A mesma frase no mesmo caso não é lançada duas vezes.
 */
export async function POST(request: Request) {
  const { usuario, demonstracao } = await autenticar(request);
  if (!usuario && !demonstracao) return semSessao(request);
  if (!usuario) return responder(request, { erro: "Entre na aplicação para registrar o impacto." }, 401);
  if (usuario.papel === "LEITURA") return responder(request, { erro: "Seu acesso é somente leitura — não dá para registrar." }, 403);

  const prisma = getPrisma();
  if (!prisma) return responder(request, { erro: "Sem banco configurado." }, 503);

  const e = (await request.json().catch(() => ({}))) as { protocolo?: string; cliente?: string; descricao?: string; trecho?: string; valorCents?: number };
  const trecho = String(e.trecho ?? "").trim().slice(0, 400);
  const descricao = String(e.descricao ?? "").trim().slice(0, 120);
  const valorCents = Number(e.valorCents);
  if (!trecho || !descricao) return responder(request, { erro: "Falta a condição da conversa." }, 400);
  if (!Number.isInteger(valorCents) || valorCents <= 0 || valorCents > 100_000_000) return responder(request, { erro: "Diga o valor concedido, em reais." }, 400);

  try {
    const caso = e.protocolo
      ? await prisma.case.findUnique({
          where: { protocol: String(e.protocolo).slice(0, 40) },
          select: { id: true, customer: true, companyName: true, establishmentId: true, establishment: { select: { name: true } } },
        })
      : null;
    if (e.protocolo && !caso) return responder(request, { erro: `O caso ${e.protocolo} não existe mais.` }, 404);

    if (caso) {
      const ja = await prisma.impactRecord.findFirst({ where: { caseId: caso.id, description: { contains: trecho.slice(0, 60) } }, select: { id: true } });
      if (ja) return responder(request, { ok: true, jaExistia: true });
    }

    /* O tipo de custo existe ou nasce agora — sem trocar a direção de quem já existe. */
    const tipo = await prisma.impactType.findUnique({ where: { name: TIPO }, select: { id: true } });
    if (!tipo) {
      await prisma.impactType.create({ data: { name: TIPO, direction: "custo", description: "Desconto, cortesia ou estorno dado para resolver.", order: 10 }, select: { id: true } });
    }

    const [ano, mes, dia] = hojeNaOperacao().split("-");
    const criado = await prisma.impactRecord.create({
      data: {
        type: TIPO,
        companyName: caso?.establishment?.name ?? caso?.companyName ?? caso?.customer ?? (String(e.cliente ?? "").trim().slice(0, 120) || "Cliente do WhatsApp"),
        description: descricaoDoImpacto({ descricao, trecho }, `${dia}/${mes}/${ano}`),
        amountCents: -Math.abs(valorCents),
        owner: usuario.nome,
        date: new Date(),
        establishmentId: caso?.establishmentId ?? null,
        caseId: caso?.id ?? null,
      },
      select: { id: true },
    });

    revalidateTag(WORKSPACE_TAG, "max");
    revalidateTag(CASES_TAG, "max");
    return responder(request, { ok: true, id: criado.id });
  } catch (erro) {
    console.error("[extensao/impacto]", erro);
    return responder(request, { erro: "O banco não aceitou agora. Tente de novo em instantes." }, 500);
  }
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
