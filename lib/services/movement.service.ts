import {
  CaseMovement,
  MovementRule,
} from "@/lib/models/movement";

import { SlaSituation } from "@/lib/services/sla.service";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

/** Regra ativa de um destino. */
export function ruleFor(
  destination: string,
  rules: MovementRule[]
) {
  return rules.find(
    (rule) => rule.active && rule.destination === destination
  );
}

/**
 * Horas entre duas datas ISO.
 *
 * As datas do app têm precisão de dia — o export do Reclame Aqui não
 * traz hora —, então o resultado sempre cai em múltiplos de 24. É a
 * mesma granularidade que `sla.service` usa no relógio público.
 */
export function hoursBetween(from: string, to: string) {
  return Math.max(
    0,
    Math.round(
      (Date.parse(`${to}T00:00:00Z`) -
        Date.parse(`${from}T00:00:00Z`)) /
        3600000
    )
  );
}

export interface MovementStatus {
  situation: SlaSituation;

  /** Horas decorridas desde o encaminhamento. */
  elapsedHours: number;

  /** Horas restantes até o prazo. Negativo quando estourou. */
  remainingHours: number;

  label: string;
}

/**
 * Situação de uma movimentação frente ao próprio prazo.
 *
 * Reaproveita o vocabulário de `SlaSituation` para as duas telas de
 * prazo falarem a mesma língua (e usarem as mesmas cores, via
 * `toneOfSla`). "sem-regra" não acontece aqui: o prazo fica congelado no
 * registro, então toda movimentação tem um.
 */
export function movementStatus(
  movement: CaseMovement,
  today = hojeNaOperacao()
): MovementStatus {

  const fim = movement.returnedAt ?? today;

  const elapsedHours = hoursBetween(
    movement.startedAt,
    fim
  );

  const remainingHours = movement.dueHours - elapsedHours;

  if (movement.returnedAt) {
    return {
      situation: "concluido",
      elapsedHours,
      remainingHours,
      label:
        remainingHours < 0
          ? "Retornou fora do prazo"
          : "Retornou no prazo",
    };
  }

  if (remainingHours < 0) {
    return {
      situation: "estourado",
      elapsedHours,
      remainingHours,
      label: `Atrasada com ${movement.destination}`,
    };
  }

  // Últimos 25% do prazo já pedem atenção — mesmo corte do SLA público.
  const atencao =
    remainingHours <= movement.dueHours * 0.25;

  return {
    situation: atencao ? "atencao" : "dentro",
    elapsedHours,
    remainingHours,
    label: atencao
      ? `Vence logo em ${movement.destination}`
      : `No prazo com ${movement.destination}`,
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
 * Só uma por vez: encaminhar de novo sem registrar o retorno anterior
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
  today = hojeNaOperacao()
) {
  return movements
    .filter(isPending)
    .map((item) => ({
      movement: item,
      status: movementStatus(item, today),
    }))
    .filter((row) => row.status.situation === "estourado")
    .sort(
      (a, b) =>
        a.status.remainingHours - b.status.remainingHours
    );
}

export interface DestinationLoad {
  rule: MovementRule;
  abertas: number;
  atrasadas: number;
  /** Média de horas até o retorno, entre as já concluídas. */
  mediaRetorno?: number;
}

/** Quanto cada destino está segurando hoje. */
export function loadByDestination(
  movements: CaseMovement[],
  rules: MovementRule[],
  today = hojeNaOperacao()
): DestinationLoad[] {

  return rules.map((rule) => {

    const doDestino = movements.filter(
      (item) => item.destination === rule.destination
    );

    const pendentes = doDestino.filter(isPending);

    const atrasadas = pendentes.filter(
      (item) =>
        movementStatus(item, today).situation ===
        "estourado"
    );

    const concluidas = doDestino.filter(
      (item) => item.returnedAt
    );

    const mediaRetorno =
      concluidas.length === 0
        ? undefined
        : Math.round(
            concluidas.reduce(
              (soma, item) =>
                soma +
                hoursBetween(
                  item.startedAt,
                  item.returnedAt as string
                ),
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
