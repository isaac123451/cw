import { Case } from "@/lib/models/case";

/**
 * As regras que valem para qualquer reclamação que venha do portal —
 * pela planilha ou pelo vigia da extensão.
 *
 * Moram aqui, e não no leitor da planilha, porque aquele carrega a
 * biblioteca de `.xlsx` inteira, e o vigia não tem planilha nenhuma.
 * Duas cópias destas regras seriam a garantia de o quadro tratar a
 * mesma reclamação de dois jeitos conforme a porta por onde entrou.
 */

/** Diferença entre duas datas, no formato que as telas exibem. */
export function decorrido(de: Date | null, ate: Date | null) {
  if (!de || !ate) return "-";

  const minutos = Math.round(
    (ate.getTime() - de.getTime()) / 60000
  );

  if (!Number.isFinite(minutos) || minutos < 0) return "-";
  if (minutos < 60) return `${minutos}min`;

  const horas = Math.round(minutos / 60);
  if (horas < 48) return `${horas}h`;

  return `${Math.round(horas / 24)} dias`;
}

/**
 * Prioridade pelo que o portal diz da reclamação.
 *
 * Sem resposta é o mais urgente que existe: cada dia conta contra o
 * índice de resposta. Avaliada como não resolvida, ou com nota baixa,
 * vem logo depois — já está pesando na nota.
 */
export function prioridadePeloPortal(info: {
  score: number | null;
  resolved: boolean;
  evaluated: boolean;
  answered: boolean;
}): Case["priority"] {

  if (!info.answered) return "Crítica";
  if (info.evaluated && !info.resolved) return "Alta";

  if (
    info.evaluated &&
    info.score !== null &&
    info.score <= 4
  ) {
    return "Alta";
  }

  if (!info.evaluated) return "Média";

  return "Baixa";
}
