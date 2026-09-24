import { normalizarTexto } from "@/lib/models/sugestaoPorTexto";

/**
 * O impacto que a conversa mostra (Fase 28).
 *
 * "Identificar descontos, condições dadas para um cliente e abrir um
 * aviso pra adicionar o impacto." O desconto combinado no WhatsApp é
 * dinheiro que a empresa deixou de receber — e, sem registro, some da
 * conta do Impacto no Negócio. A leitura é só das mensagens nossas (é
 * a operação que concede) e o valor sai da mensalidade da conta,
 * quando ela é conhecida.
 */

export type TipoDeCondicao = "percentual" | "meses-gratis" | "valor" | "condicao";

export interface CondicaoNaConversa {
  tipo: TipoDeCondicao;
  /** Como a condição aparece para quem vai registrar: "20% em 1 mensalidade". */
  descricao: string;
  /** A frase da mensagem. */
  trecho: string;
  /** Quantas mensalidades a condição custa: 20% em 3 meses = 0,6. */
  fator?: number;
  /** O custo em centavos, quando dá para calcular. */
  valorCents?: number;
}

const NUMEROS: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, doze: 12 };

const numero = (t?: string) => {
  if (!t) return undefined;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : NUMEROS[t];
};

const PERCENTUAL = /(\d{1,2}(?:[.,]\d)?)\s*%/;
/* Quantas mensalidades o percentual cobre: "por 3 meses", "nas próximas duas faturas"; sem número, uma. */
const MESES_DO_PERCENTUAL = /(\d+|uma|duas|dois|tres|quatro|seis|doze)\s+(?:meses|mensalidades|faturas|proximas (?:faturas|mensalidades))|proximas\s+(\d+|duas|tres|quatro|seis)\s+(?:faturas|mensalidades)/;
const MESES_GRATIS = /(?:(\d+|um|uma|dois|duas|tres|quatro|seis)\s+)?(mes|meses|mensalidades?)\s+(gratis|gratuit[oa]s?|sem (?:custo|cobranca|mensalidade)|de cortesia|de isencao)|isen(?:cao|tamos|tar|to)\s+(?:d[ae]\s+|a\s+)?(?:(\d+|uma|duas|tres)\s+)?(?:proxima\s+)?(mensalidades?|faturas?)/;
const VALOR = /(?:desconto|abatimento|credito|estorno|reembolso|bonus)\s+de\s+r\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)|r\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)\s+de\s+(?:desconto|abatimento|credito|estorno|reembolso)/;
const CONDICAO = /condicao especial|sem custo (?:adicional|nenhum)|nao vamos cobrar|nao sera cobrad|cortesia|vamos (?:abonar|isentar)/;

const reais = (t: string) => Math.round(Number(t.replace(/\./g, "").replace(",", ".")) * 100);
/* O Intl põe espaço não separável depois do "R$"; o texto vai para o banco e para busca — espaço comum. */
const emReais = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\u00a0/g, " ");

const frasesDe = (texto: string) =>
  texto
    .split(/(?<=[.!?\n])\s+/)
    .map((f) => f.trim())
    .filter((f) => f.length >= 6);

/** Uma frase, a condição que ela concede — ou nada. */
export function condicaoDaFrase(frase: string, mensalidadeCents?: number | null): CondicaoNaConversa | null {
  const t = normalizarTexto(frase);
  const custo = (fator: number) => (mensalidadeCents && mensalidadeCents > 0 ? Math.round(mensalidadeCents * fator) : undefined);

  const valor = t.match(VALOR);
  if (valor) {
    const cents = reais(valor[1] ?? valor[2]);
    return { tipo: "valor", descricao: `${emReais(cents)} concedidos`, trecho: frase, valorCents: cents };
  }

  const gratis = t.match(MESES_GRATIS);
  if (gratis) {
    const meses = numero(gratis[1] ?? gratis[4]) ?? 1;
    return { tipo: "meses-gratis", descricao: `${meses} ${meses === 1 ? "mensalidade" : "mensalidades"} sem cobrança`, trecho: frase, fator: meses, valorCents: custo(meses) };
  }

  const pct = t.match(PERCENTUAL);
  if (pct && /desconto|fatura|mensalidade|abat/.test(t)) {
    const p = Number(pct[1].replace(",", "."));
    if (p > 0 && p <= 100) {
      const m = t.match(MESES_DO_PERCENTUAL);
      const meses = numero(m?.[1] ?? m?.[2]) ?? 1;
      const fator = Math.round((p / 100) * meses * 1000) / 1000;
      return { tipo: "percentual", descricao: `${p}% em ${meses} ${meses === 1 ? "mensalidade" : "mensalidades"}`, trecho: frase, fator, valorCents: custo(fator) };
    }
  }

  if (CONDICAO.test(t)) return { tipo: "condicao", descricao: "Condição especial concedida", trecho: frase };
  return null;
}

/**
 * As condições concedidas na conversa, das mensagens nossas.
 *
 * Uma por frase, sem repetir a mesma condição (o "20% na próxima
 * fatura" dito duas vezes é uma condição só) — da mais recente para a
 * mais antiga, que é a que está valendo.
 */
export function condicoesNaConversa(mensagens: { de: "cliente" | "nos"; texto: string }[], mensalidadeCents?: number | null): CondicaoNaConversa[] {
  const vistas = new Set<string>();
  const saida: CondicaoNaConversa[] = [];
  for (const m of [...mensagens].reverse()) {
    if (m.de !== "nos") continue;
    for (const frase of frasesDe(m.texto)) {
      const c = condicaoDaFrase(frase, mensalidadeCents);
      if (!c || vistas.has(c.descricao)) continue;
      vistas.add(c.descricao);
      saida.push(c);
    }
  }
  return saida.slice(0, 3);
}

/** A descrição que vai para o Impacto: o que foi dado e de onde veio. */
export function descricaoDoImpacto(c: Pick<CondicaoNaConversa, "descricao" | "trecho">, dia: string) {
  const trecho = c.trecho.length > 160 ? `${c.trecho.slice(0, 159)}…` : c.trecho;
  return `${c.descricao} — combinado na conversa do WhatsApp em ${dia}: “${trecho}”`;
}
