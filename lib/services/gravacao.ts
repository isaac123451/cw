import "server-only";

import { Prisma } from "@prisma/client";

import { SemPermissao } from "@/lib/auth/guard";

import type { ResultadoDaGravacao } from "@/lib/models/resultadoDaGravacao";

/**
 * Toda gravação diz o que aconteceu (Fase 10.4).
 *
 * **O problema.** As ações de cadastro devolviam nada e, quando algo
 * dava errado, lançavam exceção. Em desenvolvimento a mensagem chegava
 * à tela; **em produção o Next a esconde** — o navegador recebe "An
 * error occurred in the Server Components render" e um código. A tela
 * então só podia chutar: "sessão expirada ou sem permissão". Um nome de
 * categoria repetido, uma etiqueta em uso que não pode ser excluída ou
 * um registro que outra pessoa já apagou chegavam todos com a mesma
 * frase errada.
 *
 * **O que isto faz.** Roda a gravação e devolve `{ ok: true }` ou
 * `{ ok: false, erro }` — dado, e não exceção, então a frase atravessa
 * a produção inteira. Os erros **previstos** viram a frase certa; o
 * imprevisto vai para o log com o nome da ação e volta como uma frase
 * honesta, sem detalhe interno.
 */

/**
 * Um erro que a própria ação decide lançar para interromper a gravação
 * com uma frase para a pessoa — "informe o nome", "o prazo não pode
 * ser negativo".
 */
export class ErroPrevisto extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroPrevisto";
  }
}

/** A frase para cada falha que já se sabe que acontece. */
export function traduzirFalha(erro: unknown): string | null {

  if (erro instanceof SemPermissao) return erro.message;

  if (erro instanceof ErroPrevisto) return erro.message;

  if (erro instanceof Prisma.PrismaClientKnownRequestError) {
    switch (erro.code) {
      case "P2002":
        return "Já existe um cadastro com esse nome ou código. Use outro, ou edite o que já existe.";
      case "P2003":
      case "P2014":
        return "Não dá para excluir: este cadastro está em uso em outro lugar da plataforma. Tire-o de uso antes.";
      case "P2025":
        return "Este registro não existe mais — outra pessoa pode tê-lo excluído. Recarregue a página.";
      case "P2000":
        return "Um dos campos passou do tamanho permitido. Encurte o texto e tente de novo.";
    }
  }

  if (erro instanceof Prisma.PrismaClientInitializationError) {
    return "Não consegui falar com o banco agora. Tente de novo em instantes.";
  }

  return null;
}

/**
 * Roda a gravação e devolve o que aconteceu, nunca uma exceção.
 *
 * `acao` é o nome que vai para o log — é o que acha a falha no painel da
 * Vercel sem precisar reproduzir.
 */
export async function comResultado(
  acao: string,
  gravar: () => Promise<unknown>
): Promise<ResultadoDaGravacao> {

  try {
    await gravar();
    return { ok: true };
  } catch (erro) {

    const frase = traduzirFalha(erro);

    if (frase) return { ok: false, erro: frase };

    console.error(`[gravacao] ${acao}`, erro);

    return {
      ok: false,
      erro: "O banco não aceitou a gravação agora. Tente de novo em instantes — se continuar, avise o suporte com a hora do erro.",
    };
  }
}
