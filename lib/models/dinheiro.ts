/**
 * Valor em reais digitado num campo: "209,99", "1.234,56", "209.99", "20".
 *
 * **Por que existe (out/2026).** O formulário de estabelecimento abria a
 * mensalidade como "209.99" (o número do JavaScript) e, ao salvar, tirava
 * todo ponto como se fosse milhar: abrir e salvar uma conta, sem mexer na
 * mensalidade, multiplicava o valor por 100. Foi assim que uma conta de
 * R$ 209,99 virou R$ 20.999 e passou a ser toda a "receita recorrente" e
 * toda a "receita em risco" da tela.
 *
 * A regra: com vírgula, ela é o decimal e o ponto é milhar ("1.234,56");
 * sem vírgula, um ponto seguido de uma ou duas casas no fim é decimal
 * ("209.99", "20.5"); os demais pontos são milhar ("1.234"). Devolve
 * `NaN` para o que não é número.
 */
export function lerReais(texto: string): number {
  const t = String(texto ?? "").replace(/\s|R\$/g, "").trim();
  if (!t) return NaN;
  if (t.includes(",")) return Number(t.replace(/\./g, "").replace(",", "."));
  if (/^\d+\.\d{1,2}$/.test(t)) return Number(t);
  return Number(t.replace(/\./g, ""));
}

/** O valor no formato do campo: 209.99 → "209,99". */
export function reaisNoCampo(valor: number | null | undefined): string {
  return typeof valor === "number" && Number.isFinite(valor) ? valor.toFixed(2).replace(".", ",") : "";
}
