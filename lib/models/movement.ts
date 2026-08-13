/**
 * Movimentação interna de um caso.
 *
 * O SLA de `lib/models/sla.ts` governa o relógio público do Reclame Aqui:
 * conta da publicação até a primeira resposta e até o encerramento. Ele
 * não enxerga o que acontece dentro da tratativa — um caso pode estar
 * confortável no prazo de solução e, ao mesmo tempo, parado há cinco dias
 * esperando a Adoção responder.
 *
 * A movimentação é esse segundo relógio: curto, um por passagem de
 * bastão, e independente do prazo público.
 */
export interface CaseMovement {
  id: string;

  caseId: string;

  /** Para onde foi: uma área interna ou o próprio cliente. */
  destination: string;

  /** O que se está pedindo para a área (ou para o cliente). */
  reason: string;

  /** Quem encaminhou. */
  actor: string;

  startedAt: string;

  /**
   * Prazo em horas, congelado no momento do encaminhamento.
   *
   * Guardado no registro e não lido da regra: editar a regra depois não
   * pode reescrever o histórico e transformar em atraso o que estava no
   * prazo quando aconteceu.
   */
  dueHours: number;

  returnedAt?: string;

  /** O que a área respondeu. Só existe depois do retorno. */
  outcome?: string;
}

/**
 * Prazo padrão de retorno por destino.
 *
 * A lista de destinos sai daqui, e não do cadastro de Times, porque nem
 * todo destino é um time — "Cliente" é o exemplo óbvio.
 */
export interface MovementRule {
  id: string;

  destination: string;

  /** Prazo de retorno, em horas. */
  hours: number;

  note?: string;

  active: boolean;
}
