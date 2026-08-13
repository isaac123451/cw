import { checkToken } from "@/lib/api/auth";
import { getApiCases } from "@/lib/api/source";

import {
  displayBand,
  getRange,
  getReputation,
  hasRA1000,
  PeriodKey,
  PeriodMode,
  periodLabels,
  RA1000_TARGETS,
  inRange,
} from "@/lib/services/reputation.service";

export const runtime = "nodejs";

const PERIODOS: PeriodKey[] = [
  "30d",
  "3m",
  "6m",
  "12m",
];

/**
 * Nota do Reclame Aqui e os quatro indicadores que a compõem.
 *
 * `periodo` aceita 30d, 3m, 6m e 12m; `modo` aceita vigente (janela que
 * vale hoje) e proximo (a janela do mês que vem, o diferencial sobre a
 * calculadora do Hugme). O padrão é 6m/vigente, que é o recorte da nota
 * pública.
 */
export async function GET(request: Request) {

  const barrado = checkToken(request);
  if (barrado) return barrado;

  const url = new URL(request.url);

  const periodo = (url.searchParams.get("periodo") ??
    "6m") as PeriodKey;

  const modo = (url.searchParams.get("modo") ??
    "vigente") as PeriodMode;

  if (!PERIODOS.includes(periodo)) {
    return Response.json(
      {
        error: `Período inválido. Use um de: ${PERIODOS.join(", ")}.`,
      },
      { status: 400 }
    );
  }

  if (modo !== "vigente" && modo !== "proximo") {
    return Response.json(
      { error: "Modo inválido. Use vigente ou proximo." },
      { status: 400 }
    );
  }

  const range = getRange(periodo, modo);

  const cases = (
    await getApiCases("reclame-aqui")
  ).filter((item) =>
    inRange(item, range.start, range.end)
  );

  const summary = getReputation(cases);

  const band = displayBand(summary);

  return Response.json({
    periodo: {
      chave: periodo,
      rotulo: periodLabels[periodo],
      modo,
      inicio: range.start,
      fim: range.end,
      parcial: range.partial,
    },

    nota: summary.raScore,

    faixa: band.label,

    ra1000: hasRA1000(summary),

    /** Indisponível quando nenhum indicador teve base no período. */
    notaIndisponivel: summary.scoreUnavailable,

    indicadores: {
      resposta: {
        valor: summary.responseIndex,
        meta: RA1000_TARGETS.resposta,
      },
      consumidor: {
        valor: summary.consumerScore,
        meta: RA1000_TARGETS.consumidor,
      },
      solucao: {
        valor: summary.solutionIndex,
        meta: RA1000_TARGETS.solucao,
      },
      novosNegocios: {
        valor: summary.wouldReturnIndex,
        meta: RA1000_TARGETS["novos-negocios"],
      },
    },

    tempoMedioRespostaMinutos: summary.responseMinutes,

    contagens: {
      recebidas: summary.received,
      respondidas: summary.answered,
      semResposta: summary.unanswered,
      avaliadas: summary.evaluated,
      resolvidas: summary.resolved,
      voltariam: summary.wouldReturn,
    },
  });
}
