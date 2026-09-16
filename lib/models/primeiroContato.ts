import type { Case } from "@/lib/models/case";
import type { NpsResponseView } from "@/lib/models/nps";
import type { SlaRule } from "@/lib/models/sla";

import {
  EXPEDIENTE_PADRAO,
  minutosUteisEntre,
  prazoUtil,
  type Expediente,
} from "@/lib/services/horasUteis";
import {
  INICIO_DO_REGISTRO_DE_CONTATO,
  inicioDoRelogio,
  resolveRule,
} from "@/lib/services/sla.service";

/**
 * Tempo até o 1º contato como indicador ("Ideias além" do roadmap).
 *
 * O documento define a meta — 4h úteis para Urgente, 8h para Alta, 24h
 * para Normal; o prazo do segmento no NPS — e ninguém media se ela era
 * cumprida. Aqui a medida sai dos registros, com o mesmo relógio dos
 * prazos:
 *
 * - **mediana** em minutos úteis, da publicação (ou da resposta do NPS)
 *   até o 1º contato registrado. Mediana e não média: um caso esquecido
 *   por duas semanas não pode esconder que o resto foi atendido em 2h;
 * - **no prazo**: entre os que já se decidiram — contatados, e os sem
 *   contato cujo prazo já venceu —, quantos foram contatados a tempo. Um
 *   caso de ontem, ainda dentro do prazo, não conta nem a favor nem
 *   contra.
 *
 * O que chegou antes de a plataforma registrar contato
 * (`INICIO_DO_REGISTRO_DE_CONTATO`) e não tem registro fica de fora e é
 * contado à parte: cobrar 1º contato dele seria cobrar o impossível.
 */

export interface ItemDoPrimeiroContato {
  inicio: Date;
  contatoEm?: Date | null;
  prazo?: Date | null;
}

export interface IndicadorDoPrimeiroContato {
  /** Itens medidos (com relógio começando no período). */
  total: number;
  contatados: number;
  noPrazo: number;
  /** Sem contato e com o prazo já vencido. */
  vencidosSemContato: number;
  /** `noPrazo` sobre os já decididos (contatados com prazo + vencidos sem contato). */
  percentualNoPrazo: number | null;
  medianaMin: number | null;
  /** Anteriores ao registro de contato, sem registro: fora da conta. */
  semRegistro: number;
}

function mediana(xs: number[]) {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

export function medirPrimeiroContato(
  itens: ItemDoPrimeiroContato[],
  agora: Date,
  expediente: Expediente = EXPEDIENTE_PADRAO,
  semRegistro = 0
): IndicadorDoPrimeiroContato {
  const tempos: number[] = [];
  let contatados = 0;
  let noPrazo = 0;
  let decididos = 0;
  let vencidosSemContato = 0;

  for (const item of itens) {
    if (item.contatoEm) {
      contatados += 1;
      tempos.push(Math.max(0, minutosUteisEntre(item.inicio, item.contatoEm, expediente)));
      if (item.prazo) {
        decididos += 1;
        if (item.contatoEm.getTime() <= item.prazo.getTime()) noPrazo += 1;
      }
    } else if (item.prazo && item.prazo.getTime() < agora.getTime()) {
      decididos += 1;
      vencidosSemContato += 1;
    }
  }

  return {
    total: itens.length,
    contatados,
    noPrazo,
    vencidosSemContato,
    percentualNoPrazo: decididos ? Math.round((noPrazo / decididos) * 100) : null,
    medianaMin: mediana(tempos),
    semRegistro,
  };
}

/** Os casos (Reclame Aqui ou redes) cujo relógio começou em `[de, ate]`, dias de Brasília. */
export function primeiroContatoDosCasos(
  casos: Case[],
  regras: SlaRule[],
  periodo: { de: string; ate: string },
  agora: Date,
  expediente: Expediente = EXPEDIENTE_PADRAO
): IndicadorDoPrimeiroContato {
  const itens: ItemDoPrimeiroContato[] = [];
  let semRegistro = 0;

  for (const c of casos) {
    const dia = c.createdAt.slice(0, 10);
    if (dia < periodo.de || dia > periodo.ate) continue;

    const contatoEm = c.primeiroContatoEm ? new Date(c.primeiroContatoEm) : null;

    if (!contatoEm && dia < INICIO_DO_REGISTRO_DE_CONTATO) {
      semRegistro += 1;
      continue;
    }

    const { inicio } = inicioDoRelogio(c, expediente);
    const regra = resolveRule(c, regras);

    itens.push({
      inicio,
      contatoEm,
      prazo: regra ? prazoUtil(inicio, regra.responseHours, expediente) : null,
    });
  }

  return medirPrimeiroContato(itens, agora, expediente, semRegistro);
}

/** Os ciclos do NPS que chegaram em `[de, ate]`. Encerrado sem contato (sem tratativa) não entra. */
export function primeiroContatoDoNps(
  respostas: NpsResponseView[],
  periodo: { de: string; ate: string },
  agora: Date,
  diaDe: (iso: string) => string,
  expediente: Expediente = EXPEDIENTE_PADRAO
): IndicadorDoPrimeiroContato {
  const itens: ItemDoPrimeiroContato[] = [];

  for (const r of respostas) {
    const dia = diaDe(r.respondedAt);
    if (dia < periodo.de || dia > periodo.ate) continue;
    if (!r.firstContactAt && r.closedAt) continue;

    itens.push({
      inicio: new Date(r.respondedAt),
      contatoEm: r.firstContactAt ? new Date(r.firstContactAt) : null,
      prazo: r.firstContactDueAt ? new Date(r.firstContactDueAt) : null,
    });
  }

  return medirPrimeiroContato(itens, agora, expediente);
}

/** "2h10 (mediana) · 85% no prazo" — ou o porquê de não haver número. */
export function descreverIndicadorDoPrimeiroContato(
  ind: IndicadorDoPrimeiroContato,
  formatar: (min: number) => string
) {
  if (ind.total === 0) return ind.semRegistro ? `sem registro (${ind.semRegistro} de antes do registro de contato)` : "nada no período";
  const partes = [
    ind.medianaMin !== null ? `mediana ${formatar(ind.medianaMin)}` : "nenhum contato registrado",
    ind.percentualNoPrazo !== null ? `${ind.percentualNoPrazo}% no prazo` : null,
    `${ind.contatados}/${ind.total} contatados`,
  ];
  return partes.filter(Boolean).join(" · ");
}
