import { ciclosAte, type Ciclo } from "@/lib/models/ciclo";
import { isEncerrado, segmentOf, STATUS_SEM_TRATATIVA, type NpsResponseView } from "@/lib/models/nps";
import { diaNaOperacao } from "@/lib/services/reputation.service";

/**
 * O NPS por ciclo (1.90).
 *
 * "Não dá para ver a análise por ciclos." Os ciclos são os do documento
 * (1–7, 8–14, 15–21, 22–28, 29–fim do mês), os mesmos do Analytics do
 * Reclame Aqui e do relatório. Cada resposta conta no ciclo do dia em que
 * o cliente respondeu; o 1º contato, no ciclo em que foi feito; o
 * encerramento, no ciclo em que fechou (o lote "sem tratativa" fica de
 * fora da conta de encerrados: não é trabalho de ninguém).
 */
export interface NpsDoCiclo {
  ciclo: Ciclo;
  respostas: number;
  nps: number | null;
  promotores: number;
  passivos: number;
  detratores: number;
  primeirosContatos: number;
  noPrazo: number;
  encerrados: number;
}

export function npsPorCiclo(respostas: NpsResponseView[], hoje: string, n = 8): NpsDoCiclo[] {
  const dentro = (dia: string | null, c: Ciclo) => dia !== null && dia >= c.inicio && dia <= c.fim;
  const dias = respostas.map((r) => ({
    r,
    respondeu: diaNaOperacao(r.respondedAt),
    contato: r.firstContactAt ? diaNaOperacao(r.firstContactAt) : null,
    fechou: r.closedAt && isEncerrado(r.status) && r.status !== STATUS_SEM_TRATATIVA ? diaNaOperacao(r.closedAt) : null,
  }));

  return ciclosAte(hoje, n).map((ciclo) => {
    const doCiclo = dias.filter((d) => dentro(d.respondeu, ciclo)).map((d) => d.r);
    const conta = (s: string) => doCiclo.filter((r) => segmentOf(r.score).label === s).length;
    const promotores = conta("Promotor");
    const passivos = conta("Passivo");
    const detratores = conta("Detrator");
    const contatos = dias.filter((d) => dentro(d.contato, ciclo)).map((d) => d.r);
    return {
      ciclo,
      respostas: doCiclo.length,
      nps: doCiclo.length ? Math.round(((promotores - detratores) / doCiclo.length) * 100) : null,
      promotores,
      passivos,
      detratores,
      primeirosContatos: contatos.length,
      noPrazo: contatos.filter((r) => r.firstContactAt && Date.parse(r.firstContactAt) <= Date.parse(r.firstContactDueAt)).length,
      encerrados: dias.filter((d) => dentro(d.fechou, ciclo)).length,
    };
  });
}
