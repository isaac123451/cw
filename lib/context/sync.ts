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

      const mensagem =
        error instanceof Error
          ? error.message
          : "Falha ao gravar no banco.";

      console.error(
        "[cadastro] gravação falhou",
        error
      );

      /**
       * Avisa na tela, não só no console.
       *
       * O caso mais comum aqui é permissão: quem tem acesso de leitura
       * via a mudança aplicada na tela e ela sumia no reload, sem
       * nenhuma explicação. Agora o motivo aparece — e o texto vem do
       * servidor, que é quem sabe se foi permissão, sessão expirada ou
       * falha de rede.
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
