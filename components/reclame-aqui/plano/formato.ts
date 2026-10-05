/** Os números do plano como a tela mostra: vírgula, e a casa decimal que cada métrica usa no portal. */

export const br = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

export function num(v: number, casas = 1) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export const nota = (v: number) => num(v, 2);
export const pct = (v: number) => `${num(v, 1)}%`;
export const inteiro = (v: number) => Math.round(v).toLocaleString("pt-BR");

/** "+0,017" / "−0,097" — o efeito na nota, com sinal. */
export function efeito(v: number, casas = 3) {
  const s = num(Math.abs(v), casas);
  return v > 0 ? `+${s}` : v < 0 ? `−${s}` : s;
}

export function plural(n: number, um: string, varios: string) {
  return `${inteiro(n)} ${Math.round(n) === 1 ? um : varios}`;
}
