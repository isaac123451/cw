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
 * A prioridade com que uma reclamação do portal **entra**: Normal.
 *
 * Até 12/09/2026 ela saía do estado do portal — sem resposta era
 * Crítica, avaliada como não resolvida era Alta. Isso é urgência de
 * resposta, que já tem indicador próprio ("sem resposta pública"), e não
 * o que a documentação chama de criticidade: esta vem do impacto do caso
 * — risco jurídico, operação parada, cobrança indevida — e quem decide é
 * a triagem do Passo 1. O portal não sabe nada disso.
 *
 * Então toda reclamação nova entra Normal e sem triagem, e aparece na
 * fila "a triar". Reclamação que já existe não é tocada: prioridade não
 * está entre os campos do portal (`DO_PORTAL`).
 */
export function prioridadePeloPortal(): Case["priority"] {
  return "Normal";
}
