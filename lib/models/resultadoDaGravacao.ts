/**
 * O que uma gravação responde (Fase 10.4).
 *
 * Mora em `lib/models`, e não no serviço, porque a tela também precisa
 * do tipo — e o serviço importa o Prisma, que não pode ir para o
 * navegador.
 */
export type ResultadoDaGravacao = { ok: true } | { ok: false; erro: string };

/** A resposta é uma recusa com frase? */
export function recusou(
  resposta: unknown
): resposta is { ok: false; erro: string } {
  return (
    typeof resposta === "object" &&
    resposta !== null &&
    (resposta as { ok?: unknown }).ok === false
  );
}
