import { diaDeBrasilia } from "@/lib/models/diaADiaDasRedes";
import { isEncerrado, quandoRespondeu } from "@/lib/models/nps";

/**
 * O dia a dia do NPS (09/11/2026) — no molde da tabela das Redes e da Nota
 * do Índice do Reclame Aqui.
 *
 * Cada coluna conta pela data em que a coisa aconteceu, não pela da
 * pesquisa (26/10/2026: "o importante é a data que foi realizado o contato"):
 *
 * - **Chegaram:** pesquisas respondidas no Wootric no dia (`respondedAt`);
 *   **detratores** é a parte delas com nota 0 a 6.
 * - **Contatados:** ciclos com a primeira tentativa de contato no dia.
 * - **Responderam:** ciclos em que o cliente respondeu ao contato no dia
 *   (`quandoRespondeu`: tentativa "respondeu", "Falei com o cliente" ou
 *   encerramento com retorno).
 * - **Encerrados:** ciclos fechados no dia (`closedAt`); **sem contato** é a
 *   parte deles que fechou sem nenhuma tentativa — a rotina da noite encerra
 *   como Sem Retorno quem passa 30 dias sem resposta, mesmo sem contato
 *   (regra do guia, mantida por decisão dele em 09/11/2026). Separado para o
 *   número não parecer trabalho feito.
 */

export interface CicloDoDia {
  score: number;
  status: string;
  respondedAt: string;
  firstContactAt?: string | null;
  postContactAt?: string | null;
  closedAt?: string | null;
  attempts?: { resultado?: string | null; createdAt: string }[];
}

export interface LinhaDoNps {
  dia: string;
  chegaram: number;
  detratores: number;
  contatados: number;
  responderam: number;
  encerrados: number;
  encerradosSemContato: number;
  emCurso: boolean;
}

const menos = (dia: string, n: number) => new Date(Date.parse(`${dia}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

/** O primeiro contato: a tentativa mais antiga, senão o 1º contato registrado. */
export function primeiroContato(c: CicloDoDia): string | undefined {
  const datas = [...(c.attempts ?? []).map((a) => a.createdAt), c.firstContactAt].filter((d): d is string => Boolean(d)).sort();
  return datas[0];
}

export function diaADiaDoNps(ciclos: CicloDoDia[], hoje: string, dias = 14): LinhaDoNps[] {
  const linhas = new Map<string, LinhaDoNps>();
  for (let i = 0; i < dias; i += 1) {
    const dia = menos(hoje, i);
    linhas.set(dia, { dia, chegaram: 0, detratores: 0, contatados: 0, responderam: 0, encerrados: 0, encerradosSemContato: 0, emCurso: i === 0 });
  }
  const somar = (iso: string | null | undefined, campo: Exclude<keyof LinhaDoNps, "dia" | "emCurso">) => {
    const linha = linhas.get(diaDeBrasilia(iso) ?? "");
    if (linha) linha[campo] += 1;
  };
  for (const c of ciclos) {
    somar(c.respondedAt, "chegaram");
    if (c.score <= 6) somar(c.respondedAt, "detratores");
    somar(primeiroContato(c), "contatados");
    somar(quandoRespondeu({ ...c, postContactAt: c.postContactAt ?? undefined, closedAt: c.closedAt ?? undefined }), "responderam");
    if (isEncerrado(c.status)) {
      somar(c.closedAt, "encerrados");
      if (!primeiroContato(c) && !c.postContactAt) somar(c.closedAt, "encerradosSemContato");
    }
  }
  return [...linhas.values()];
}
