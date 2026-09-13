import {
  CaseMovement,
  MovementRule,
} from "@/lib/models/movement";

import type { SlaSituation } from "@/lib/services/sla.service";
import {
  descreverMinutosUteis,
  EXPEDIENTE_PADRAO,
  Expediente,
  minutosUteisEntre,
  paredeDe,
  prazoUtil,
} from "@/lib/services/horasUteis";

/**
 * O relógio das áreas internas.
 *
 * A documentação do Reclame Aqui dá prazo de retorno às áreas pela
 * criticidade do caso — "Urgente (4 horas), Alta (1 dia útil), Normal
 * (2 dias úteis)" — e manda escalonar ao gestor da área quando vence.
 * O prazo fica congelado no acionamento (`dueHours`): mudar a regra
 * depois não reescreve o compromisso que a área já tinha.
 *
 * Até 12/09/2026 este relógio contava dias corridos a partir da
 * meia-noite. Agora conta tempo útil, do instante do acionamento.
 */

/** Regra ativa de um destino. */
export function ruleFor(
  destination: string,
  rules: MovementRule[]
) {
  return rules.find(
    (rule) => rule.active && rule.destination === destination
  );
}

/** Um instante a partir do que a tela guarda — instante ISO ou dia antigo. */
export function instanteDoMovimento(valor: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor)
    ? new Date(`${valor}T11:00:00Z`)
    : new Date(valor);
}

export interface MovementStatus {
  situation: SlaSituation;

  /** Horas úteis desde o acionamento. */
  elapsedHours: number;

  /** Horas úteis até o prazo. Negativo quando estourou. */
  remainingHours: number;

  /** Minutos úteis até o prazo — a precisão que o chip mostra. */
  restanteMin: number;

  /** Minutos úteis desde o acionamento (até o retorno, se houve). */
  decorridoMin: number;

  /** Quando vence, em ISO. */
  prazo: string;

  label: string;
}

export interface OpcoesDoMovimento {
  agora?: Date;
  expediente?: Expediente;
}

/**
 * Situação de uma movimentação frente ao próprio prazo.
 *
 * Reaproveita o vocabulário de `SlaSituation` para as telas de prazo
 * falarem a mesma língua (e usarem as mesmas cores, via `toneOfSla`).
 * Aceita, no segundo parâmetro, o "hoje" em texto que as chamadas
 * antigas passavam; ele é ignorado.
 */
export function movementStatus(
  movement: CaseMovement,
  opcoes: OpcoesDoMovimento | string = {}
): MovementStatus {

  const { agora = new Date(), expediente = EXPEDIENTE_PADRAO } =
    typeof opcoes === "string" ? {} : opcoes;

  const inicio = instanteDoMovimento(movement.startedAt);
  const prazo = prazoUtil(inicio, movement.dueHours, expediente);
  const fim = movement.returnedAt ? instanteDoMovimento(movement.returnedAt) : agora;

  const decorrido = Math.max(0, minutosUteisEntre(inicio, fim, expediente));
  const restanteMin = minutosUteisEntre(fim, prazo, expediente);

  const base = {
    elapsedHours: Math.round(decorrido / 60),
    remainingHours: Math.round(restanteMin / 60),
    restanteMin,
    decorridoMin: decorrido,
    prazo: prazo.toISOString(),
  };

  if (movement.returnedAt) {
    return {
      ...base,
      situation: "concluido",
      label:
        fim.getTime() > prazo.getTime()
          ? "Retornou fora do prazo"
          : "Retornou no prazo",
    };
  }

  if (agora.getTime() > prazo.getTime()) {
    return {
      ...base,
      situation: "estourado",
      label: `${movement.destination} atrasada ${descreverMinutosUteis(restanteMin, expediente)}`,
    };
  }

  const total = Math.max(1, minutosUteisEntre(inicio, prazo, expediente));
  const venceHoje = paredeDe(prazo).dia === paredeDe(agora).dia;
  const atencao = restanteMin <= total * 0.25 || venceHoje;

  return {
    ...base,
    situation: atencao ? "atencao" : "dentro",
    label: `${movement.destination}: retorno em ${descreverMinutosUteis(restanteMin, expediente)}`,
  };
}

/** Movimentação ainda sem retorno. */
export function isPending(movement: CaseMovement) {
  return !movement.returnedAt;
}

/** Movimentações de um caso, da mais recente para a mais antiga. */
export function movementsOf(
  caseId: string,
  movements: CaseMovement[]
) {
  return movements
    .filter((item) => item.caseId === caseId)
    .sort((a, b) =>
      b.startedAt.localeCompare(a.startedAt)
    );
}

/**
 * A movimentação em aberto do caso.
 *
 * Só uma por vez: acionar de novo sem registrar o retorno anterior
 * deixaria dois relógios correndo sobre o mesmo caso, e nenhum dos dois
 * diria quem está com a bola.
 */
export function openMovementOf(
  caseId: string,
  movements: CaseMovement[]
) {
  return movementsOf(caseId, movements).find(isPending);
}

/** Pendentes fora do prazo, da mais atrasada para a menos. */
export function lateMovements(
  movements: CaseMovement[],
  opcoes: OpcoesDoMovimento | string = {}
) {
  return movements
    .filter(isPending)
    .map((item) => ({
      movement: item,
      status: movementStatus(item, opcoes),
    }))
    .filter((row) => row.status.situation === "estourado")
    .sort(
      (a, b) =>
        a.status.restanteMin - b.status.restanteMin
    );
}

export interface DestinationLoad {
  rule: MovementRule;
  abertas: number;
  atrasadas: number;
  /** Média de horas úteis até o retorno, entre as já concluídas. */
  mediaRetorno?: number;
}

/** Quanto cada destino está segurando hoje. */
export function loadByDestination(
  movements: CaseMovement[],
  rules: MovementRule[],
  opcoes: OpcoesDoMovimento | string = {}
): DestinationLoad[] {

  return rules.map((rule) => {

    const doDestino = movements.filter(
      (item) => item.destination === rule.destination
    );

    const pendentes = doDestino.filter(isPending);

    const atrasadas = pendentes.filter(
      (item) =>
        movementStatus(item, opcoes).situation === "estourado"
    );

    const concluidas = doDestino.filter(
      (item) => item.returnedAt
    );

    const mediaRetorno =
      concluidas.length === 0
        ? undefined
        : Math.round(
            concluidas.reduce(
              (soma, item) => soma + movementStatus(item, opcoes).elapsedHours,
              0
            ) / concluidas.length
          );

    return {
      rule,
      abertas: pendentes.length,
      atrasadas: atrasadas.length,
      mediaRetorno,
    };
  });
}
