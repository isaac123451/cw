import { FRENTES_DA_OPERACAO, type FrenteId } from "@/lib/models/frentes";
import { paredeDe } from "@/lib/services/horasUteis";

/**
 * A causa raiz nas quatro frentes.
 *
 * Desde a Fase 4 a lista é uma só — a do NPS, que o documento do Google
 * e o de reputação repetem: bug, cobrança, atendimento, expectativa não
 * atendida, logística. Com o mesmo nome em todo lugar, a tendência deixa
 * de ser "o NPS diz uma coisa, o Reclame Aqui outra" e passa a responder
 * a pergunta da gestão: o que está fazendo o cliente reclamar, somando
 * tudo?
 */

/** As frentes, na ordem e com as cores do cadastro único — ver lib/models/frentes.ts. */
export type Frente = FrenteId;

export const FRENTES: Frente[] = FRENTES_DA_OPERACAO.map((f) => f.id);

export interface RegistroDeCausa {
  frente: Frente;
  causa: string;
  /** Quando o registro aconteceu (ISO). */
  em: string;
  /** Como o registro aparece numa lista: "RA 1234 — título". */
  rotulo: string;
}

export interface LinhaDaTendencia {
  causa: string;
  total: number;
  porFrente: Record<Frente, number>;
  /** Quantos dos registros caem nos últimos 30 dias. */
  ultimos30: number;
}

const DIA = 86_400_000;

function zerado(): Record<Frente, number> {
  return { "reclame-aqui": 0, redes: 0, nps: 0, google: 0 };
}

/**
 * Registros por causa, na janela, somando as frentes.
 *
 * O nome é comparado sem diferença de caixa e de espaço nas bordas: a
 * lista é fechada, mas "Cobrança " digitado antes da unificação não pode
 * virar uma segunda causa no gráfico.
 */
export function tendenciaCruzada(
  registros: RegistroDeCausa[],
  opcoes: { agora: Date; dias: number }
): LinhaDaTendencia[] {

  const desde = opcoes.agora.getTime() - opcoes.dias * DIA;
  const trinta = opcoes.agora.getTime() - 30 * DIA;

  const mapa = new Map<string, LinhaDaTendencia>();

  for (const r of registros) {
    const causa = r.causa.trim();
    const quando = Date.parse(r.em);
    if (!causa || !Number.isFinite(quando) || quando < desde || quando > opcoes.agora.getTime()) continue;

    const chave = causa.toLowerCase();
    const linha = mapa.get(chave) ?? { causa, total: 0, porFrente: zerado(), ultimos30: 0 };
    linha.total += 1;
    linha.porFrente[r.frente] += 1;
    if (quando >= trinta) linha.ultimos30 += 1;
    mapa.set(chave, linha);
  }

  return [...mapa.values()].sort((a, b) => b.total - a.total || a.causa.localeCompare(b.causa));
}

export interface Reincidencia {
  causa: string;
  registros: RegistroDeCausa[];
  frentes: Frente[];
}

/** O corte da ideia: três no mesmo problema em 30 dias, somando os canais. */
export const REINCIDENCIA_MINIMA = 3;
export const REINCIDENCIA_DIAS = 30;

/**
 * "Três reclamações sobre o mesmo problema em 30 dias, somando os
 * canais, viram um item em Projetos para a área responsável." É o
 * "transformar feedback em melhoria" do documento de reputação: o
 * problema que se repete não é do cliente, é do produto ou do processo.
 */
export function reincidenciasCruzadas(registros: RegistroDeCausa[], agora: Date): Reincidencia[] {

  const desde = agora.getTime() - REINCIDENCIA_DIAS * DIA;
  const mapa = new Map<string, Reincidencia>();

  for (const r of registros) {
    const causa = r.causa.trim();
    const quando = Date.parse(r.em);
    if (!causa || !Number.isFinite(quando) || quando < desde || quando > agora.getTime()) continue;
    const chave = causa.toLowerCase();
    const atual = mapa.get(chave) ?? { causa, registros: [], frentes: [] };
    atual.registros.push(r);
    if (!atual.frentes.includes(r.frente)) atual.frentes.push(r.frente);
    mapa.set(chave, atual);
  }

  return [...mapa.values()]
    .filter((r) => r.registros.length >= REINCIDENCIA_MINIMA)
    .map((r) => ({
      ...r,
      registros: r.registros.sort((a, b) => Date.parse(b.em) - Date.parse(a.em)),
      frentes: FRENTES.filter((f) => r.frentes.includes(f)),
    }))
    .sort((a, b) => b.registros.length - a.registros.length);
}

/**
 * A marca do item em Projetos: uma por causa e por mês de Brasília.
 *
 * O mesmo problema no mês seguinte é outro item — se voltou depois de
 * tratado, é notícia; se o item deste mês ainda está aberto, o botão diz
 * que já existe em vez de criar o segundo.
 */
export function origemDaReincidencia(causa: string, agora: Date) {
  const mes = paredeDe(agora).dia.slice(0, 7);
  const slug = causa
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `reincidencia:${slug}:${mes}`;
}
