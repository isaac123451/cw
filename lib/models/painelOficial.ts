import type { Case } from "@/lib/models/case";
import type { ReputationSummary } from "@/lib/services/reputation.service";
import type { PainelDoPortal } from "@/lib/services/painelDoPortal.service";

/**
 * Os números do painel do Reclame Aqui sobre a conta daqui (22/10/2026).
 *
 * "Está informando que o nosso voltaria a fazer negócio está em 80% mas
 * está em 79,70." Os dois estavam certos, cada um no seu momento: o vigia
 * já tinha lido uma avaliação de 20/10 (nota 10, voltaria) que o painel
 * oficial, lido em 22/10, ainda não tinha contado — o portal atualiza o
 * painel com atraso. Tirando ela, a conta daqui batia número por número
 * (79 avaliadas, 92,4% solução, 79,7% voltaria, 8,43 consumidor).
 *
 * Na janela oficial, a tela mostra o que o portal publica; a diferença vira
 * aviso, com as avaliações que ele ainda não contou. Fora da janela que o
 * painel cobre, ou com um recorte aplicado, vale a conta daqui.
 */
export function resumoComPainel(resumo: ReputationSummary, painel: PainelDoPortal | undefined): ReputationSummary {
  if (!painel) return resumo;
  const n = (v: number | null, outro: number) => (v === null ? outro : v);
  const avaliadas = n(painel.avaliadas, resumo.evaluated);
  const recebidas = n(painel.recebidas, resumo.received);
  const respondidas = n(painel.respondidas, resumo.answered);
  const solucao = n(painel.solucao, resumo.solutionIndex);
  const voltaria = n(painel.voltaria, resumo.wouldReturnIndex);
  return {
    ...resumo,
    received: recebidas,
    answered: respondidas,
    unanswered: Math.max(0, recebidas - respondidas),
    evaluated: avaliadas,
    resolved: Math.round((solucao * avaliadas) / 100),
    wouldReturn: Math.round((voltaria * avaliadas) / 100),
    responseIndex: n(painel.resposta, resumo.responseIndex),
    solutionIndex: solucao,
    wouldReturnIndex: voltaria,
    consumerScore: n(painel.notaConsumidor, resumo.consumerScore),
    evaluationRate: recebidas ? Math.round((avaliadas / recebidas) * 1000) / 10 : resumo.evaluationRate,
  };
}

/**
 * As avaliações que o portal ainda não contou: das reclamações da janela,
 * as `quantas` avaliadas mais recentemente — o painel atrasa pelo fim.
 */
export function avaliacoesAindaNaoContadas(casos: Case[], inicio: string, fim: string, quantas: number): Case[] {
  if (quantas <= 0) return [];
  return casos
    .filter((c) => c.evaluated && !c.scoreDisregarded && c.createdAt >= inicio && c.createdAt <= fim)
    .sort((a, b) => (b.evaluatedAt ?? "").localeCompare(a.evaluatedAt ?? ""))
    .slice(0, quantas);
}
