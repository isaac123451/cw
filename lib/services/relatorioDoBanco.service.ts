import type { PrismaClient } from "@prisma/client";

import type { Ciclo } from "@/lib/models/ciclo";
import { slaRuleDoBanco } from "@/lib/models/sla";
import { fetchCases } from "@/lib/services/case.repository";
import { lerRespostasDoNps } from "@/lib/services/npsLista.service";
import { lerExpediente } from "@/lib/services/operacao.service";
import { lerPaineis } from "@/lib/services/painelDoPortal.service";
import { montarRelatorio, type GoogleDoRelatorio } from "@/lib/services/relatorio.service";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

/**
 * O relatório de um ciclo montado direto do banco (1.105) — sem sessão, para
 * a tela (que confere o acesso antes) e para a rotina da madrugada, que
 * manda o relatório sozinho.
 */
export async function montarRelatorioDoBanco(prisma: PrismaClient, ciclo: Ciclo) {
  const [cases, nps, google, regras, expediente, paineis] = await Promise.all([
    fetchCases(prisma),
    lerRespostasDoNps(prisma),
    prisma.avaliacaoGoogle.findMany({
      select: { id: true, estrelas: true, classificacao: true, publicadaEm: true, respondidaEm: true, notaAtualizada: true, status: true },
    }),
    /* As regras e o expediente: é com eles que o 1º contato vira "no prazo". */
    prisma.slaRule.findMany().then((linhas) => linhas.map(slaRuleDoBanco)),
    lerExpediente(prisma),
    lerPaineis(prisma).then((p) => p.atuais).catch(() => ({})),
  ]);

  const doGoogle: GoogleDoRelatorio[] = google.map((g) => ({
    id: g.id,
    estrelas: g.estrelas,
    classificacao: g.classificacao as GoogleDoRelatorio["classificacao"],
    publicadaEm: g.publicadaEm.toISOString(),
    respondidaEm: g.respondidaEm?.toISOString(),
    notaAtualizada: g.notaAtualizada ?? undefined,
    status: g.status as GoogleDoRelatorio["status"],
  }));

  return montarRelatorio({ cases, nps, google: doGoogle, ciclo, hoje: hojeNaOperacao(), regras, expediente, paineis });
}
