"use client";

import { notifyGlobal } from "@/lib/context/ToastContext";

/**
 * Dispara a gravação sem travar a interface.
 *
 * Os cadastros aplicam a mudança na tela primeiro e gravam depois — o
 * clique precisa responder na hora, e a ida ao Supabase custa dezenas de
 * milissegundos. Quando a gravação falha, o aviso aparece na tela e o
 * valor otimista continua ali; recarregar a página traz de volta o que o
 * banco realmente tem.
 *
 * Sem banco configurado as actions são no-op, então isto também é o
 * caminho do modo demonstração.
 */

export interface Gravacao {
  ok: boolean;
  erro?: string;
}

/**
 * A frase que a pessoa lê quando uma gravação falha.
 *
 * **Em produção o servidor não manda o motivo.** Erro lançado de server
 * action chega ao navegador com uma mensagem genérica, em inglês — "An
 * error occurred in the Server Components render. The specific message
 * is omitted in production builds…" — e um `digest`, que é o código do
 * erro no log do servidor. É proposital: a documentação do Next diz que
 * o texto original pode vazar detalhe interno.
 *
 * Mostrar a frase genérica crua era pior que nada: em inglês, e sem
 * dizer o que fazer. Aqui ela vira as causas que de fato aparecem nesta
 * operação e o código, que é o que acha a falha no log da Vercel.
 *
 * Em desenvolvimento a mensagem original chega, e passa reto.
 */
export function motivoDaFalha(error: unknown): string {

  const digest = (error as { digest?: unknown } | null)?.digest;

  const texto =
    error instanceof Error ? error.message : "";

  const generica =
    typeof digest === "string" &&
    /omitted in production|Server Components render/i.test(texto);

  if (generica) {
    return `O servidor recusou a alteração. As causas mais comuns são sessão expirada (entre de novo) ou conta sem permissão para editar este módulo. Código para o suporte: ${digest}.`;
  }

  return texto || "Falha ao gravar no banco.";
}

/**
 * Devolve o resultado, além de avisar na tela.
 *
 * Quem chama por conta própria continua ignorando o retorno — é o
 * comportamento de sempre. Mas as telas com botão **Salvar** precisam
 * saber se deu certo para poder dizer "salvo": uma confirmação que
 * aparece antes da resposta do servidor confirma o clique, não a
 * gravação, e isso é pior do que não confirmar nada.
 *
 * A promessa **nunca rejeita** — resolve com `ok: false`. Assim quem
 * grava em lote pode usar `Promise.all` sem que a primeira falha
 * cancele o resto: as outras alterações do lote têm de ser gravadas do
 * mesmo jeito.
 */
export function sincronizar(
  executar: () => Promise<unknown>,
  aoFalhar?: (mensagem: string) => void
): Promise<Gravacao> {

  return executar().then(
    (): Gravacao => ({ ok: true }),

    (error: unknown): Gravacao => {

      const mensagem = motivoDaFalha(error);

      console.error(
        "[cadastro] gravação falhou",
        error
      );

      /**
       * Avisa na tela, não só no console.
       *
       * O caso mais comum aqui é permissão: quem tem acesso de leitura
       * via a mudança aplicada na tela e ela sumia no reload, sem
       * nenhuma explicação. Em desenvolvimento o texto vem do servidor;
       * em produção o Next o esconde, e `motivoDaFalha` diz as causas
       * prováveis e o código do log.
       */
      notifyGlobal({
        tone: "error",
        title: "A alteração não foi salva.",
        detail: `${mensagem} Recarregue a página para ver o valor atual.`,
      });

      aoFalhar?.(mensagem);

      return { ok: false, erro: mensagem };
    }
  );
}
