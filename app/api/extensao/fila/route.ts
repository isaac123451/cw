import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { getApiCases } from "@/lib/api/source";
import { loadWorkspace } from "@/lib/actions/workspace";
import { getPrisma } from "@/lib/prisma";

import {
  byChannel,
  isOpen,
} from "@/lib/services/case.service";
import { slaStatus } from "@/lib/services/sla.service";
import { REFERENCE_DATE } from "@/lib/services/reputation.service";

import {
  isEncerrado,
  segmentOf,
} from "@/lib/models/nps";
import {
  retratoNps,
  SELECAO_NPS,
} from "@/lib/services/nps.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A fila de um canal — **sem depender de contato nenhum**.
 *
 * O painel nasceu respondendo "quem é esta pessoa?", e por isso tudo
 * nele dependia de haver uma conversa aberta. O efeito colateral
 * apareceu quando o rodapé de canais entrou: os três botões filtravam a
 * mesma busca por contato, e como quase todo cliente tem caso num canal
 * só, os três davam no mesmo resultado. O botão prometia canal e
 * entregava filtro.
 *
 * Aqui a pergunta é outra: "**o que está aberto neste canal agora?**".
 * É a fila de trabalho, ordenada por urgência, e ela existe
 * independentemente de quem está do outro lado da conversa.
 *
 * Somente leitura. Mover é `/api/extensao/mover`.
 */

const TETO = 25;

export async function GET(request: Request) {

  const { usuario, demonstracao } =
    await autenticar(request);

  if (!usuario && !demonstracao) {
    return semSessao(request);
  }

  const url = new URL(request.url);
  const origem = url.origin;

  const canal = url.searchParams.get("canal") ?? "";

  if (canal === "nps") {
    return responder(
      request,
      await filaDoNps(
        origem,
        url.searchParams.get("segmento") ?? ""
      )
    );
  }

  if (canal !== "reclame-aqui" && canal !== "social") {
    return responder(
      request,
      {
        erro: 'Canal inválido. Use "reclame-aqui", "social" ou "nps".',
      },
      400
    );
  }

  const [todos, workspace] = await Promise.all([
    getApiCases("all"),
    loadWorkspace(),
  ]);

  const abertos = byChannel(todos, canal).filter(isOpen);

  /**
   * Quantos há em cada etapa, sobre a fila inteira.
   *
   * Mesmo motivo da contagem por segmento do NPS: filtrar não pode
   * apagar o mapa que serve para escolher o próximo filtro.
   */
  const porEtapa: Record<string, number> = {};

  for (const item of abertos) {
    porEtapa[item.status] =
      (porEtapa[item.status] ?? 0) + 1;
  }

  const etapaPedida = (
    url.searchParams.get("etapa") ?? ""
  ).trim();

  const daEtapa = etapaPedida
    ? abertos.filter(
        (item) => item.status === etapaPedida
      )
    : abertos;

  /**
   * Ordem: prazo estourado primeiro, depois quem vence antes.
   *
   * É a mesma pergunta que o Kanban responde por cor, dita em lista —
   * quem abre a fila quer saber o que pega agora, não o que chegou
   * primeiro.
   */
  const comSla = daEtapa.map((item) => ({
    item,
    sla: slaStatus(item, workspace.slaRules, REFERENCE_DATE),
  }));

  comSla.sort((a, b) => {

    const peso = (s: string) =>
      s === "estourado" ? 0 : s === "atencao" ? 1 : 2;

    const diferenca =
      peso(a.sla.situation) - peso(b.sla.situation);

    if (diferenca !== 0) return diferenca;

    return a.sla.remainingHours - b.sla.remainingHours;
  });

  return responder(request, {
    canal,
    total: daEtapa.length,
    totalGeral: abertos.length,
    etapa: etapaPedida,
    porEtapa,

    itens: comSla.slice(0, TETO).map(({ item, sla }) => ({
      id: item.id,
      protocolo: item.protocol,
      titulo: item.title,
      cliente: item.customer,
      status: item.status,
      prioridade: item.priority,
      responsavel: item.owner,
      canal: item.source,
      criadoEm: item.createdAt,
      sla: {
        situacao: sla.situation,
        rotulo: sla.label,
        horasRestantes: sla.remainingHours,
      },
      url: `${origem}/reclame-aqui/${item.id}`,
    })),

    /** Para o painel rotular os botões de avançar e voltar. */
    etapas: workspace.workflow
      .filter((etapa) => etapa.active)
      .sort((a, b) => a.order - b.order)
      .map((etapa) => etapa.name),
  });
}

/**
 * A fila do NPS: ciclos que ainda pedem ação.
 *
 * Encerrado fica de fora — inclusive o "[Encerrado] Sem tratativa" do
 * promotor calado, que são ~790 por mês e enterrariam os detratores.
 * Ordem por prazo de primeiro contato: quem está fora do prazo primeiro.
 */
async function filaDoNps(
  origem: string,
  segmento: string
) {

  const prisma = getPrisma();

  if (!prisma) {
    return { canal: "nps", total: 0, itens: [] };
  }

  const linhas = await prisma.npsResponse.findMany({
    select: SELECAO_NPS,
    orderBy: { firstContactDueAt: "asc" },
    take: 300,
  });

  const abertos = linhas
    .map(retratoNps)
    .filter((item) => !isEncerrado(item.status));

  /**
   * Quantos há em cada faixa, **antes** de filtrar.
   *
   * A contagem tem de descrever a fila inteira: se ela mudasse junto
   * com o filtro, escolher "Detratores" mostraria "3 detratores, 0
   * passivos, 0 promotores" e a barra deixaria de servir para navegar.
   */
  const porSegmento = {
    Detrator: 0,
    Passivo: 0,
    Promotor: 0,
  } as Record<string, number>;

  for (const item of abertos) {
    porSegmento[segmentOf(item.nota).label] += 1;
  }

  const filtrados = segmento
    ? abertos.filter(
        (item) => segmentOf(item.nota).label === segmento
      )
    : abertos;

  return {
    canal: "nps",
    total: filtrados.length,
    totalGeral: abertos.length,
    segmento,
    porSegmento,
    itens: filtrados.slice(0, TETO).map((item) => ({
      ...item,
      segmento: segmentOf(item.nota).label,
      url: `${origem}/nps`,
    })),
  };
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
