import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { getApiCases } from "@/lib/api/source";
import { loadWorkspace } from "@/lib/actions/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Casos parados numa etapa que cobra.
 *
 * O quadro esconde bem o meio do caminho: um caso movido para "Em
 * atendimento" sai da coluna que a pessoa olha e vira um cartão entre
 * outros vinte. A cobrança existe para isso — enquanto ele estiver ali,
 * a extensão avisa de tempos em tempos; no instante em que sai da
 * etapa, para sozinha, sem ninguém precisar dispensar nada.
 *
 * **Quem decide é o fluxo, não esta rota.** O intervalo vem de
 * `WorkflowStatus.reminderMinutes`, configurado na tela de fluxo — o
 * que mantém a regra num lugar só e permite ligar a cobrança em
 * qualquer etapa de qualquer quadro, não só no do ManyChat.
 */
export async function GET(request: Request) {

  const { usuario, demonstracao } =
    await autenticar(request);

  if (!usuario && !demonstracao) {
    return semSessao(request);
  }

  const [casos, workspace] = await Promise.all([
    getApiCases("all"),
    loadWorkspace(),
  ]);

  /** Etapas com cobrança ligada, por nome — é assim que o caso aponta. */
  const cobram = new Map(
    workspace.workflow
      .filter(
        (etapa) =>
          etapa.active &&
          typeof etapa.reminderMinutes === "number" &&
          etapa.reminderMinutes > 0
      )
      .map((etapa) => [etapa.name, etapa])
  );

  if (cobram.size === 0) {
    return responder(request, {
      etapas: [],
      casos: [],
      total: 0,
    });
  }

  const agora = Date.now();
  const origem = new URL(request.url).origin;

  const parados = casos
    .filter((item) => cobram.has(item.status))
    .map((item) => {

      const etapa = cobram.get(item.status);

      /**
       * Há quanto tempo está ali é uma **aproximação**: a última
       * atualização do caso, não a entrada na etapa — o histórico por
       * etapa ainda não é gravado. Serve para ordenar do mais parado
       * para o menos, que é o uso real; não serve para prometer prazo.
       */
      const desde = item.updatedAt ?? item.createdAt;

      const horas = Math.max(
        Math.round(
          (agora - Date.parse(`${desde}T00:00:00Z`)) / 3600000
        ),
        0
      );

      return {
        id: item.id,
        protocolo: item.protocol,
        titulo: item.title,
        cliente: item.customer,
        canal: item.source,
        status: item.status,
        responsavel: item.owner,
        cor: etapa?.color,
        minutos: etapa?.reminderMinutes ?? 10,
        desde,
        horasParado: horas,
        url: `${origem}/reclame-aqui/${item.id}`,
      };
    })
    .sort((a, b) => b.horasParado - a.horasParado);

  return responder(request, {
    etapas: [...cobram.values()].map((etapa) => ({
      nome: etapa.name,
      cor: etapa.color,
      minutos: etapa.reminderMinutes,
      parados: parados.filter(
        (item) => item.status === etapa.name
      ).length,
    })),
    casos: parados,
    total: parados.length,
    quadro: `${origem}/reclame-aqui`,
  });
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
