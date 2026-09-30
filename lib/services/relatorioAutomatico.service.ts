import type { PrismaClient } from "@prisma/client";

import { montarRelatorioDoBanco } from "@/lib/services/relatorioDoBanco.service";
import { enviarEmail } from "@/lib/email/enviar";
import { cicloAnterior, cicloDe } from "@/lib/models/ciclo";
import { textoDoRelatorio } from "@/lib/services/relatorio.service";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

/**
 * O relatório que chega sozinho (Fase 30, 1.105).
 *
 * "O resumo no Slack ou por e-mail, sem abrir a plataforma." A rotina da
 * madrugada, no primeiro dia de cada ciclo, manda o relatório do ciclo que
 * acabou para quem está em `OperacaoConfig.relatorioPara` — uma vez por
 * ciclo (`relatorioEnviadoCiclo`), mesmo que a rotina rode de novo. Sem
 * destinatário, nada sai. O texto é o mesmo do "Copiar para o Slack".
 */
export async function enviarRelatorioDoCiclo(prisma: PrismaClient, hoje = hojeNaOperacao()) {
  const config = await prisma.operacaoConfig.findUnique({ where: { id: "unico" }, select: { relatorioPara: true, relatorioEnviadoCiclo: true } });
  const para = (config?.relatorioPara ?? []).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  if (para.length === 0) return { enviado: false, motivo: "sem destinatário cadastrado" };

  const atual = cicloDe(hoje);
  const ciclo = cicloAnterior(atual);
  if (config?.relatorioEnviadoCiclo === ciclo.id) return { enviado: false, motivo: `o ciclo ${ciclo.rotulo} já foi enviado` };

  const dados = await montarRelatorioDoBanco(prisma, ciclo);
  const texto = textoDoRelatorio(dados).replace(/\*/g, "");
  const resultados = [];
  for (const destino of para) {
    resultados.push(await enviarEmail({ para: destino, assunto: `Relatório de Reputação — ciclo ${ciclo.rotulo}`, texto }));
  }
  const ok = resultados.filter((r) => r.ok).length;
  if (ok > 0) {
    await prisma.operacaoConfig.update({ where: { id: "unico" }, data: { relatorioEnviadoCiclo: ciclo.id } });
  }
  return { enviado: ok > 0, ciclo: ciclo.id, destinatarios: para.length, entregues: ok, erros: resultados.filter((r) => !r.ok).map((r) => r.erro).slice(0, 3) };
}
