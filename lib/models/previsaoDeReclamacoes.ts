import type { Case } from "@/lib/models/case";

/**
 * Quantas reclamações devem chegar em cada mês (1.133).
 *
 * O pedido, de 05/10/2026: "prever com base na média de últimos meses a
 * quantidade de reclamações que podem chegar no mês". Média de quantos
 * meses? A resposta não é escolha de gosto: cada método é testado contra o
 * que já aconteceu — para cada um dos últimos 12 meses fechados, a previsão
 * que ele teria feito com os meses de antes, contra o que chegou — e vale
 * o que errou menos. O erro medido vira a margem: "entre 15 e 25".
 *
 * Medido em 05/10/2026 (fev/2024 a set/2026, volume crescendo): a média
 * de 6 meses errava 4,6 por mês mas ficava sempre abaixo (viés −2); a
 * tendência de 12 meses errava 4,9 com viés de +0,6. A combinação das duas
 * entra na disputa justamente por isso.
 */

export type MesISO = string;

export type MetodoDePrevisao = "ultimo" | "media3" | "media6" | "ponderada3" | "tendencia12" | "combinada";

export const ROTULO_DO_METODO: Record<MetodoDePrevisao, string> = {
  ultimo: "igual ao último mês",
  media3: "média dos últimos 3 meses",
  media6: "média dos últimos 6 meses",
  ponderada3: "média dos últimos 3 meses, com mais peso no mais recente",
  tendencia12: "tendência dos últimos 12 meses",
  combinada: "média de 6 meses e tendência de 12, juntas",
};

const media = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

/** A reta dos mínimos quadrados, projetada um passo adiante. */
function tendencia(xs: number[], passos = 1) {
  const n = xs.length;
  if (n < 2) return media(xs);
  const mx = (n - 1) / 2;
  const my = media(xs);
  let num = 0;
  let den = 0;
  xs.forEach((y, i) => {
    num += (i - mx) * (y - my);
    den += (i - mx) ** 2;
  });
  const b = den ? num / den : 0;
  return Math.max(0, my + b * (n - 1 + passos - mx));
}

/** A previsão de um método para `passos` meses depois do último da série. */
export function prever(serie: number[], metodo: MetodoDePrevisao, passos = 1): number {
  if (serie.length === 0) return 0;
  switch (metodo) {
    case "ultimo":
      return serie[serie.length - 1];
    case "media3":
      return media(serie.slice(-3));
    case "media6":
      return media(serie.slice(-6));
    case "ponderada3": {
      const u = serie.slice(-3);
      const pesos = [1, 2, 3].slice(-u.length);
      return u.reduce((s, x, i) => s + x * pesos[i], 0) / pesos.reduce((s, p) => s + p, 0);
    }
    case "tendencia12":
      return tendencia(serie.slice(-12), passos);
    case "combinada":
      return (media(serie.slice(-6)) + tendencia(serie.slice(-12), passos)) / 2;
  }
}

export const METODOS: MetodoDePrevisao[] = ["ultimo", "media3", "media6", "ponderada3", "tendencia12", "combinada"];

export interface TesteDoMetodo {
  metodo: MetodoDePrevisao;
  /** Erro médio absoluto, em reclamações por mês. */
  erroMedio: number;
  /** 8 em cada 10 meses erraram até isto. */
  erroDe80: number;
  /** Erro médio com sinal: negativo é previsão abaixo do real. */
  vies: number;
  meses: { mes: MesISO; previsto: number; real: number }[];
}

/** Cada método contra os últimos `quantos` meses fechados — a previsão que teria feito, contra o que chegou. */
export function testarMetodos(meses: MesISO[], serie: number[], quantos = 12): TesteDoMetodo[] {
  const inicio = Math.max(3, serie.length - quantos);
  return METODOS.map((metodo) => {
    const ms: TesteDoMetodo["meses"] = [];
    for (let i = inicio; i < serie.length; i++) ms.push({ mes: meses[i], previsto: Math.round(prever(serie.slice(0, i), metodo) * 10) / 10, real: serie[i] });
    const erros = ms.map((m) => m.previsto - m.real);
    const abs = erros.map(Math.abs).sort((a, b) => a - b);
    return {
      metodo,
      erroMedio: Math.round(media(abs) * 10) / 10,
      erroDe80: abs.length ? abs[Math.min(abs.length - 1, Math.ceil(0.8 * abs.length) - 1)] : 0,
      vies: Math.round(media(erros) * 10) / 10,
      meses: ms,
    };
  }).sort((a, b) => a.erroMedio - b.erroMedio || Math.abs(a.vies) - Math.abs(b.vies));
}

/* ============================================================
   MESES
============================================================ */

export function mesDe(dia: string): MesISO {
  return dia.slice(0, 7);
}

export function somarMeses(mes: MesISO, n: number): MesISO {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1 + n, 1)).toISOString().slice(0, 7);
}

export function diasNoMes(mes: MesISO) {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

export function primeiroDia(mes: MesISO) {
  return `${mes}-01`;
}

export function ultimoDia(mes: MesISO) {
  return `${mes}-${String(diasNoMes(mes)).padStart(2, "0")}`;
}

const NOMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function nomeDoMes(mes: MesISO, comAno = false) {
  const [a, m] = mes.split("-").map(Number);
  return comAno ? `${NOMES[m - 1]} de ${a}` : NOMES[m - 1];
}

/* ============================================================
   A PREVISÃO
============================================================ */

export interface MesPrevisto {
  mes: MesISO;
  /** A previsão do método, arredondada. */
  previsto: number;
  min: number;
  max: number;
  /** Número digitado na meta do mês — vence a previsão. */
  manual?: number;
  /** O que vale no plano: o manual, se houver, senão o previsto. */
  usado: number;
}

export interface PrevisaoDeReclamacoes {
  metodo: MetodoDePrevisao;
  testes: TesteDoMetodo[];
  /** Os meses fechados, do mais antigo ao mais recente (até 24). */
  historico: { mes: MesISO; recebidas: number }[];
  /** O mês corrente: o que já chegou e o que se espera até o fim. */
  atual: { mes: MesISO; ateHoje: number; diasPassados: number; dias: number; ritmo: number; previsto: number; usado: number; manual?: number };
  /** O mês corrente e os seguintes. */
  proximos: MesPrevisto[];
}

/**
 * A série mensal (por mês de abertura) e a previsão para o mês corrente e
 * os `horizonte − 1` seguintes. O mês corrente é "o que já chegou + o que
 * costuma chegar no resto do mês".
 */
export function preverReclamacoes(casos: Case[], hoje: string, horizonte = 6, manuais: Record<MesISO, number | null | undefined> = {}): PrevisaoDeReclamacoes {
  const atualMes = mesDe(hoje);
  const porMes = new Map<MesISO, number>();
  for (const c of casos) porMes.set(mesDe(c.createdAt), (porMes.get(mesDe(c.createdAt)) ?? 0) + 1);
  const primeiro = [...porMes.keys()].sort()[0] ?? atualMes;
  const meses: MesISO[] = [];
  for (let m = primeiro; m < atualMes; m = somarMeses(m, 1)) meses.push(m);
  const serie = meses.map((m) => porMes.get(m) ?? 0);

  const testes = testarMetodos(meses, serie);
  const metodo = testes[0]?.metodo ?? "media6";
  const margem = testes[0]?.erroDe80 ?? 0;

  const proximos: MesPrevisto[] = [];
  for (let i = 0; i < horizonte; i++) {
    const mes = somarMeses(atualMes, i);
    const previsto = Math.round(prever(serie, metodo, i + 1));
    const manual = manuais[mes] ?? undefined;
    proximos.push({ mes, previsto, min: Math.max(0, Math.round(previsto - margem)), max: Math.round(previsto + margem), manual: manual ?? undefined, usado: manual ?? previsto });
  }

  const dias = diasNoMes(atualMes);
  const diasPassados = Number(hoje.slice(8, 10));
  const ateHoje = porMes.get(atualMes) ?? 0;
  const doMes = proximos[0];
  /* O resto do mês no ritmo previsto — nunca menos do que já chegou. */
  const previstoAtual = Math.round(ateHoje + (doMes.previsto * (dias - diasPassados)) / dias);
  const usadoAtual = doMes.manual != null ? Math.max(doMes.manual, ateHoje) : previstoAtual;
  proximos[0] = { ...doMes, previsto: previstoAtual, min: Math.max(ateHoje, Math.round(previstoAtual - (margem * (dias - diasPassados)) / dias)), max: Math.round(previstoAtual + (margem * (dias - diasPassados)) / dias), usado: usadoAtual };

  return {
    metodo,
    testes,
    historico: meses.slice(-24).map((m) => ({ mes: m, recebidas: porMes.get(m) ?? 0 })),
    atual: { mes: atualMes, ateHoje, diasPassados, dias, ritmo: Math.round((ateHoje / Math.max(1, diasPassados)) * dias), previsto: previstoAtual, usado: usadoAtual, manual: doMes.manual },
    proximos,
  };
}
