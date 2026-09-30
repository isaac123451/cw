import { respondida, type Case } from "@/lib/models/case";
import { ciclosAte, type Ciclo } from "@/lib/models/ciclo";
import { diaNaOperacao } from "@/lib/services/reputation.service";

/**
 * O Reclame Aqui por ciclo (1.86).
 *
 * "Quando uma avaliação for atualizada … marque a data para ficar
 * registrada na parte de analytics, para eu verificar quantas avaliações
 * tiveram em um ciclo." Cada evento conta no ciclo do **dia em que
 * aconteceu**: a reclamação no dia em que chegou, a resposta no dia da
 * publicação, a avaliação no dia em que o consumidor avaliou (ou em que
 * a plataforma soube dela — ver `carimboDaAvaliacao`).
 *
 * Avaliação sem data (a carga antiga) não entra em ciclo nenhum: não há
 * como saber quando foi, e pô-la em qualquer um seria inventar.
 */
export interface NumerosDoCiclo {
  ciclo: Ciclo;
  novas: number;
  respondidas: number;
  avaliadas: number;
  resolvidas: number;
  voltaria: number;
  notaMedia: number | null;
  semResposta: number;
}

export function numerosPorCiclo(casos: Case[], hoje: string, n = 8): NumerosDoCiclo[] {
  const ciclos = ciclosAte(hoje, n);
  const dentro = (dia: string | null, c: Ciclo) => dia !== null && dia >= c.inicio && dia <= c.fim;

  const eventos = casos.map((c) => ({
    chegou: c.createdAt ? diaNaOperacao(c.createdAt) : null,
    respondeu: respondida(c) && c.publicResponseAt ? diaNaOperacao(c.publicResponseAt) : null,
    avaliou: c.evaluated && c.evaluatedAt ? diaNaOperacao(c.evaluatedAt) : null,
    caso: c,
  }));

  return ciclos.map((ciclo) => {
    const avaliadas = eventos.filter((e) => dentro(e.avaliou, ciclo));
    const naNota = avaliadas.filter((e) => !e.caso.scoreDisregarded && e.caso.score != null);
    const novas = eventos.filter((e) => dentro(e.chegou, ciclo));
    return {
      ciclo,
      novas: novas.length,
      respondidas: eventos.filter((e) => dentro(e.respondeu, ciclo)).length,
      avaliadas: avaliadas.length,
      resolvidas: avaliadas.filter((e) => e.caso.resolved).length,
      voltaria: avaliadas.filter((e) => e.caso.wouldDoBusiness).length,
      notaMedia: naNota.length ? naNota.reduce((s, e) => s + Number(e.caso.score), 0) / naNota.length : null,
      semResposta: novas.filter((e) => !respondida(e.caso)).length,
    };
  });
}
