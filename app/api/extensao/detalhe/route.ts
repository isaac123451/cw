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
import { enderecoNaAreaDaEmpresa } from "@/lib/models/linksDoRa";
import { slaStatus } from "@/lib/services/sla.service";
import { contatosDoCaso } from "@/lib/services/tratativa.service";
import { trilhaDoCaso } from "@/lib/models/trilha";
import { pedidoDeAvaliacao } from "@/lib/models/cadencia";
import {
  AREAS_INTERNAS,
  mensagemDeAcionamento,
  mensagemDeAtualizacao,
  mensagemDePedidoDeAvaliacao,
  mensagemPublicaTransparente,
} from "@/lib/models/mensagens";
import { custoDoModelo, mensagemDeOferta, ofertaSugerida } from "@/lib/models/negociacao";

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
    { expediente: workspace.expediente }
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

  /*
    O que a extensão precisa para **agir**, e não só para ler (Fase 8.2).

    O passo da vez sai da mesma trilha da ficha (`trilhaDoCaso`), e os
    textos saem dos mesmos modelos das telas — pedido de avaliação com o
    lembrete certo da cadência, acionamento no formato do #incidentes,
    atualização para quem está esperando e a mensagem pública
    transparente da 5ª tentativa. Um texto montado no painel, por cópia,
    divergiria do que a aplicação escreve no dia seguinte.
  */
  /*
    O id do modelo é o do portal ("ZzTelaFase1"), não o do banco: os
    contatos se buscam pela linha do Postgres, achada pelo protocolo.
  */
  const linhaDoCaso = await prisma.case.findUnique({ where: { protocol: caso.protocol }, select: { id: true } });
  const contatos = linhaDoCaso ? await contatosDoCaso(prisma, linhaDoCaso.id).catch(() => []) : [];
  const passos = trilhaDoCaso(caso, {});
  const atual = passos.find((p) => p.estado === "atual") ?? null;
  const cadencia = pedidoDeAvaliacao(caso);
  const oferta = ofertaSugerida(caso.priority);
  const quemAssina = usuario?.nome;

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
      autor: item.author?.name ?? item.authorName ?? "—",
      quando: item.createdAt.toISOString(),
    })),

    urlPortal: caso.raUrl,
    urlEmpresa: enderecoNaAreaDaEmpresa(caso.protocol) ?? undefined,
    url: `${origem}/reclame-aqui/${caso.id}`,

    /** O passo da vez, para o painel oferecer a ação dele. */
    trilha: atual
      ? { id: atual.id, numero: atual.numero, titulo: atual.titulo, detalhe: atual.detalhe ?? "", acao: atual.acao ?? "" }
      : null,

    /** O que já foi registrado — o painel não oferece o que já está feito. */
    contatos: {
      primeiroContatoEm: caso.primeiroContatoEm ?? null,
      validadoEm: caso.validadoEm ?? null,
      tentativasSemResposta: caso.tentativasSemResposta ?? 0,
      pedidosDeAvaliacao: contatos.filter((c) => c.tipo === "pedido-avaliacao").length,
      ultimoEm: contatos[0]?.em ?? null,
    },

    /** Os textos prontos, dos mesmos modelos das telas. */
    textos: {
      pedidoAvaliacao: mensagemDePedidoDeAvaliacao({
        nome: caso.customer,
        numero: Math.max(1, cadencia.numero),
        raUrl: caso.raUrl,
        agente: quemAssina,
      }),
      atualizacao: mensagemDeAtualizacao({ nome: caso.customer }),
      publicaTransparente: mensagemPublicaTransparente({ nome: caso.customer }),
      acionamento: mensagemDeAcionamento({
        area: AREAS_INTERNAS[0].nome,
        cliente: caso.customer,
        estabelecimento: caso.company ?? undefined,
        assunto: caso.title,
        tratativa: "contato e solução",
        prioridade: caso.priority,
        prazo: sla.label,
        telefone: caso.phone ?? undefined,
        raUrl: caso.raUrl ?? undefined,
      }),
      oferta: oferta ? mensagemDeOferta({ nome: caso.customer, oferta: oferta.titulo, agente: quemAssina }) : "",
    },

    /** A oferta que a criticidade permite — quem registra é a aplicação. */
    oferta: oferta
      ? { id: oferta.id, titulo: oferta.titulo, custo: custoDoModelo(oferta, null) }
      : null,

    cadencia: { ativo: cadencia.ativo, numero: cadencia.numero, resumo: cadencia.resumo },
  });
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
