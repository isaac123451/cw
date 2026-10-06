/**
 * A palavra no número certo: `${n} ${pluralDe(n, "reclamação", "reclamações")}`.
 *
 * Substituiu o "reclamação(ões)" que aparecia em mais de 400 lugares —
 * texto de formulário, não de quem conversa. Devolve só a palavra para o
 * número continuar formatado como cada tela já formata (tabular, negrito,
 * `toLocaleString`).
 *
 * Um é singular; zero e qualquer outro número, plural ("0 reclamações").
 * Aceita texto também, porque algumas telas já recebem o número formatado.
 */
export function pluralDe(n: number | string | null | undefined, um: string, varios: string) {
  const numero = typeof n === "number" ? n : Number(String(n ?? "").replace(/\./g, "").replace(",", "."));
  return Math.abs(numero) === 1 ? um : varios;
}

/**
 * O botão de lote: "Mostrar mais 40 · faltam 253", ou, no último lote,
 * "Mostrar os 9 restantes".
 *
 * Era "Mostrar mais 40 de 253" em sete telas — lido como "40 de um total
 * de 253", quando 253 era o que ainda faltava.
 */
export function mostrarMais(lote: number, restantes: number) {
  if (restantes <= 1) return "Mostrar o último";
  if (restantes <= lote) return `Mostrar os ${restantes} restantes`;
  return `Mostrar mais ${lote} · faltam ${restantes}`;
}
