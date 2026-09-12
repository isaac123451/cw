import {
  Case,
  prioridadeNormalizada,
  respondida,
} from "@/lib/models/case";
import {
  ANY_CATEGORY,
  canalDoCaso,
  SlaRule,
} from "@/lib/models/sla";

import { CLOSED_STATUS } from "@/lib/services/case.service";
import {
  descreverMinutosUteis,
  EXPEDIENTE_PADRAO,
  Expediente,
  instanteDe,
  minutosUteisEntre,
  paredeDe,
  prazoUtil,
} from "@/lib/services/horasUteis";

/**
 * O dia em que o 1º contato passou a ser registrado.
 *
 * Reclamação anterior a isto que não tem o registro não está atrasada:
 * a plataforma é que não sabia perguntar. O relógio a mostra como "não
 * registrado" — um convite a registrar, e não um vermelho que ninguém
 * teve como evitar.
 */
export const INICIO_DO_REGISTRO_DE_CONTATO = "2026-09-12";

/**
 * Escolhe a regra que vale para um caso.
 *
 * A mais específica ganha: categoria exata pesa mais que prioridade, que
 * pesa mais que alcance, que pesa mais que a frente. Sem isso, uma regra
 * genérica cadastrada depois passaria por cima de uma específica.
 */
export function resolveRule(
  item: Case,
  rules: SlaRule[]
): SlaRule | undefined {

  const canal = canalDoCaso(item.source);
  const prioridade = prioridadeNormalizada(item.priority);
  const seguidores = item.followers ?? 0;

  let melhor: SlaRule | undefined;
  let melhorPeso = -1;

  for (const rule of rules) {

    if (!rule.active) continue;

    const categoriaExata = rule.category === item.category;

    if (!categoriaExata && rule.category !== ANY_CATEGORY) continue;

    if (rule.priority && prioridadeNormalizada(rule.priority) !== prioridade) {
      continue;
    }

    if (rule.canal && rule.canal !== canal) continue;

    if (rule.seguidoresMin && seguidores < rule.seguidoresMin) continue;

    const peso =
      (categoriaExata ? 1_000_000 : 0) +
      (rule.priority ? 100_000 : 0) +
      (rule.seguidoresMin ? 10_000 + Math.min(rule.seguidoresMin / 1000, 9_000) : 0) +
      (rule.canal ? 1 : 0);

    if (peso > melhorPeso) {
      melhor = rule;
      melhorPeso = peso;
    }
  }

  return melhor;
}

export type SlaSituation =
  | "dentro"
  | "atencao"
  | "estourado"
  | "concluido"
  | "sem-regra"
  | "sem-registro";

/** Qual relógio está correndo: o do 1º contato ou o da solução. */
export type FaseDoPrazo = "contato" | "solucao" | "concluido";

export interface SlaStatus {
  rule?: SlaRule;
  situation: SlaSituation;
  fase: FaseDoPrazo;

  /** Quando vence o relógio que está correndo, em ISO. */
  prazo?: string;

  /** Minutos úteis até o prazo. Negativo quando estourou. */
  restanteMin: number;

  /** Horas úteis desde a publicação — para ordenar e para o assistente. */
  elapsedHours: number;

  /** Horas úteis até o prazo. Negativo quando estourou. */
  remainingHours: number;

  /** Curto, para chip: "1º contato em 2h40". */
  label: string;

  /**
   * A reclamação não tem hora gravada e o relógio partiu da abertura do
   * dia útil. A tela avisa em vez de fingir precisão.
   */
  horaEstimada: boolean;
}

const situationTone: Record<SlaSituation, string> = {
  dentro: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  atencao: "bg-amber-50 text-amber-700 ring-amber-100",
  estourado: "bg-rose-50 text-rose-700 ring-rose-100",
  concluido: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  "sem-regra":
    "bg-zinc-100 text-zinc-500 ring-zinc-200",
  "sem-registro":
    "bg-sky-50 text-sky-700 ring-sky-100",
};

export function toneOfSla(situation: SlaSituation) {
  return situationTone[situation];
}

/**
 * O instante em que o relógio do caso começa.
 *
 * A hora da publicação, quando se sabe. Sem ela, a abertura do
 * expediente naquele dia — que é quando alguém poderia tê-la visto.
 */
export function inicioDoRelogio(
  item: Pick<Case, "recebidaEm" | "createdAt">,
  expediente: Expediente = EXPEDIENTE_PADRAO
): { inicio: Date; estimado: boolean } {

  if (item.recebidaEm) {
    const t = new Date(item.recebidaEm);
    if (Number.isFinite(t.getTime())) return { inicio: t, estimado: false };
  }

  return {
    inicio: instanteDe(item.createdAt, expediente.inicioMin),
    estimado: true,
  };
}

/**
 * O 1º contato já aconteceu?
 *
 * Registrado, sim. Sem registro, a resposta pública ou o caso já na
 * mão do consumidor dizem que houve conversa — é o legado anterior ao
 * registro, e cobrar 1º contato dele seria cobrar o impossível.
 */
export function primeiroContatoFeito(item: Case) {
  return (
    Boolean(item.primeiroContatoEm) ||
    respondida(item) ||
    CLOSED_STATUS.includes(item.status)
  );
}

/** A solução já foi entregue, até onde a plataforma sabe. */
export function solucaoEntregue(item: Case) {
  return (
    item.resolved ||
    respondida(item) ||
    CLOSED_STATUS.includes(item.status)
  );
}

export interface OpcoesDoRelogio {
  agora?: Date;
  expediente?: Expediente;
}

/**
 * Situação do caso frente ao prazo.
 *
 * Dois relógios, na ordem da documentação: primeiro o do 1º contato com
 * o cliente; cumprido esse, o da solução. Os dois partem da publicação e
 * contam só tempo útil — sábado, domingo, feriado e a noite não entram.
 *
 * Aceita, no terceiro parâmetro, o "hoje" em texto que as chamadas
 * antigas passavam; ele é ignorado — o relógio agora mede o instante.
 */
export function slaStatus(
  item: Case,
  rules: SlaRule[],
  opcoes: OpcoesDoRelogio | string = {}
): SlaStatus {

  const { agora = new Date(), expediente = EXPEDIENTE_PADRAO } =
    typeof opcoes === "string" ? {} : opcoes;

  const rule = resolveRule(item, rules);

  const { inicio, estimado } = inicioDoRelogio(item, expediente);

  const decorridoMin = Math.max(
    0,
    minutosUteisEntre(inicio, agora, expediente)
  );

  const base = {
    rule,
    elapsedHours: Math.round(decorridoMin / 60),
    horaEstimada: estimado,
  };

  if (!rule) {
    return {
      ...base,
      situation: "sem-regra",
      fase: primeiroContatoFeito(item) ? "solucao" : "contato",
      restanteMin: 0,
      remainingHours: 0,
      label: "Sem prazo",
    };
  }

  const contatoFeito = primeiroContatoFeito(item);

  if (!contatoFeito) {

    const prazo = prazoUtil(inicio, rule.responseHours, expediente);

    /*
      Anterior ao registro e sem nenhum sinal de contato: não é atraso,
      é um registro que a plataforma não pedia.
    */
    if (item.createdAt < INICIO_DO_REGISTRO_DE_CONTATO) {
      return {
        ...base,
        situation: "sem-registro",
        fase: "contato",
        prazo: prazo.toISOString(),
        restanteMin: 0,
        remainingHours: 0,
        label: "1º contato não registrado",
      };
    }

    return medir({
      base,
      fase: "contato",
      rotulo: "1º contato",
      inicio,
      prazo,
      agora,
      expediente,
    });
  }

  if (solucaoEntregue(item) || !(rule.solutionHours > 0)) {
    return {
      ...base,
      situation: "concluido",
      fase: "concluido",
      restanteMin: 0,
      remainingHours: 0,
      label: solucaoEntregue(item) ? "Encerrado" : "1º contato feito",
    };
  }

  return medir({
    base,
    fase: "solucao",
    rotulo: "Solução",
    inicio,
    prazo: prazoUtil(inicio, rule.solutionHours, expediente),
    agora,
    expediente,
  });
}

function medir({
  base,
  fase,
  rotulo,
  inicio,
  prazo,
  agora,
  expediente,
}: {
  base: Pick<SlaStatus, "rule" | "elapsedHours" | "horaEstimada">;
  fase: Exclude<FaseDoPrazo, "concluido">;
  rotulo: string;
  inicio: Date;
  prazo: Date;
  agora: Date;
  expediente: Expediente;
}): SlaStatus {

  const restanteMin = minutosUteisEntre(agora, prazo, expediente);
  const total = Math.max(1, minutosUteisEntre(inicio, prazo, expediente));

  const comum = {
    ...base,
    fase,
    prazo: prazo.toISOString(),
    restanteMin,
    remainingHours: Math.round(restanteMin / 60),
  };

  if (agora.getTime() > prazo.getTime()) {
    return {
      ...comum,
      situation: "estourado",
      label: `${rotulo} ${fase === "solucao" ? "atrasada" : "atrasado"} ${descreverMinutosUteis(restanteMin, expediente)}`,
    };
  }

  /*
    Atenção: o último quarto do prazo, ou o dia em que ele vence — o que
    vier primeiro. Um prazo de 7 dias úteis no último quarto ainda tem
    quase dois dias; um de 4h pede atenção já na terceira hora.
  */
  const venceHoje = paredeDe(prazo).dia === paredeDe(agora).dia;
  const atencao = restanteMin <= total * 0.25 || venceHoje;

  return {
    ...comum,
    situation: atencao ? "atencao" : "dentro",
    label: `${rotulo} em ${descreverMinutosUteis(restanteMin, expediente)}`,
  };
}

export interface RuleCoverage {
  rule: SlaRule;
  total: number;
  dentro: number;
  atencao: number;
  estourado: number;
  concluido: number;
}

/** Quantos casos abertos cada regra está governando hoje. */
export function coverage(
  cases: Case[],
  rules: SlaRule[],
  opcoes: OpcoesDoRelogio = {}
): RuleCoverage[] {

  const map = new Map<string, RuleCoverage>();

  for (const rule of rules) {
    map.set(rule.id, {
      rule,
      total: 0,
      dentro: 0,
      atencao: 0,
      estourado: 0,
      concluido: 0,
    });
  }

  for (const item of cases) {

    const status = slaStatus(item, rules, opcoes);

    if (!status.rule) continue;

    const row = map.get(status.rule.id);

    if (!row) continue;

    row.total += 1;

    if (status.situation === "dentro") row.dentro += 1;
    if (status.situation === "atencao") row.atencao += 1;
    if (status.situation === "estourado") {
      row.estourado += 1;
    }
    if (status.situation === "concluido") {
      row.concluido += 1;
    }
  }

  return [...map.values()];
}
