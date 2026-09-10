/**
 * Numa atualização vinda de fora, vazio não apaga o que já está aqui.
 *
 * **O defeito que se repetiu em três importações.** O botão Importar do
 * Reclame Aqui, a reimportação do Wootric e a planilha do NPS montavam o
 * registro inteiro a partir da fonte e gravavam por cima — com `?? null`
 * ou `|| null` em cada campo. Campo que a fonte não traz virava nulo, e
 * o que a operação tinha escrito ali sumia: telefone digitado, tipo e
 * causa raiz do NPS, empresa. Achados na revisão de 10/09/2026.
 *
 * A regra é a mesma nos três lugares, então mora num lugar só: nos
 * campos listados, o que vem preenchido grava; o que vem vazio sai do
 * objeto — e o Prisma não toca em campo ausente.
 *
 * Só para **atualização**. Na criação, vazio é o valor certo.
 */
export function semApagarVazios<T extends Record<string, unknown>>(
  dados: T,
  campos: readonly (keyof T & string)[]
): Partial<T> {
  const saida: Partial<T> = { ...dados };

  for (const campo of campos) {
    const valor = saida[campo];

    if (
      valor === null ||
      valor === undefined ||
      (typeof valor === "string" && valor.trim() === "")
    ) {
      delete saida[campo];
    }
  }

  return saida;
}
