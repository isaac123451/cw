import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { getPrisma } from "@/lib/prisma";
import { loadWorkspace } from "@/lib/actions/workspace";

import { fetchCaseByProtocol } from "@/lib/services/case.repository";
import { isOpen } from "@/lib/services/case.service";
import { slaStatus } from "@/lib/services/sla.service";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O caso inteiro, para ler dentro da extensão.
 *
 * O painel mostrava o cartão — protocolo, título, prazo — e para ler o
 * relato era preciso abrir a aplicação noutra aba. Numa ferramenta cujo
 * propósito é não sair da conversa, isso derrotava metade do ponto: o
 * relato do consumidor é justamente o que se precisa ler antes de
 * responder.
 *
 * Traz o que a gaveta da aplicação traz de leitura — relato, resposta
 * pública, avaliação, prazo e a linha do tempo de anotações. Não traz o
 * que só faz sentido na tela grande: anexos, checklist e o histórico de
 * movimentação entre times.
 */

export async function GET(request: Request) {

  const { usuario, demonstracao } =
    await autenticar(request);

  if (!usuario && !demonstracao) {
    return semSessao(request);
  }

  const url = new URL(request.url);
  const origem = url.origin;

  const protocolo = (
    url.searchParams.get("protocolo") ?? ""
  ).trim();

  if (!protocolo) {
    return responder(
      request,
      { erro: "Faltou o protocolo." },
      400
    );
  }

  const prisma = getPrisma();

  if (!prisma) {
    return responder(
      request,
      {
        erro: "Sem banco configurado — o detalhe vem do Postgres.",
      },
      503
    );
  }

  const caso = await fetchCaseByProtocol(
    prisma,
    protocolo
  );

  if (!caso) {
    return responder(
      request,
      { erro: `Não achei o caso ${protocolo}.` },
      404
    );
  }

  const workspace = await loadWorkspace();

  const sla = slaStatus(
    caso,
    workspace.slaRules,
    hojeNaOperacao()
  );

  /**
   * A linha do tempo, mais recente primeiro.
   *
   * Consulta separada porque `fetchCaseByProtocol` devolve o modelo
   * `Case`, que não tem anotação — e acrescentá-la lá faria toda
   * listagem de casos carregar comentário que ninguém pediu.
   */
  const comentarios = await prisma.caseComment.findMany({
    where: { case: { protocol: protocolo } },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return responder(request, {
    protocolo: caso.protocol,
    id: caso.id,

    titulo: caso.title,
    relato: caso.description ?? "",
    respostaPublica: caso.publicResponse ?? "",

    cliente: caso.customer,
    telefone: caso.phone,
    email: caso.email,
    cidade: caso.city,
    estado: caso.state,

    canal: caso.source,
    categoria: caso.category,
    subcategoria: caso.subcategory,
    prioridade: caso.priority,
    status: caso.status,
    responsavel: caso.owner,

    aberto: isOpen(caso),
    avaliado: caso.evaluated,
    nota: caso.score,
    resolvido: caso.resolved,
    voltaria: caso.wouldDoBusiness,
    risco: caso.churnRisk,

    criadoEm: caso.createdAt,
    atualizadoEm: caso.updatedAt,

    sla: {
      situacao: sla.situation,
      rotulo: sla.label,
      horasRestantes: sla.remainingHours,
    },

    etapas: workspace.workflow
      .filter((etapa) => etapa.active)
      .sort((a, b) => a.order - b.order)
      .map((etapa) => etapa.name),

    anotacoes: comentarios.map((item) => ({
      id: item.id,
      texto: item.body,
      autor: item.author?.name ?? "—",
      quando: item.createdAt.toISOString(),
    })),

    urlPortal: caso.raUrl,
    url: `${origem}/reclame-aqui/${caso.id}`,
  });
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
