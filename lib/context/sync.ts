"use client";

import { notifyGlobal } from "@/lib/context/ToastContext";

/**
 * Dispara a gravação sem travar a interface.
 *
 * Os cadastros aplicam a mudança na tela primeiro e gravam depois — o
 * clique precisa responder na hora, e a ida ao Supabase custa dezenas de
 * milissegundos. Quando a gravação falha, o console registra e a tela
 * segue com o valor otimista; recarregar a página traz de volta o que o
 * banco realmente tem.
 *
 * Sem banco configurado as actions são no-op, então isto também é o
 * caminho do modo demonstração.
 */
export function sincronizar(
  executar: () => Promise<unknown>,
  aoFalhar?: (mensagem: string) => void
) {
  executar().catch((error: unknown) => {

    const mensagem =
      error instanceof Error
        ? error.message
        : "Falha ao gravar no banco.";

    console.error("[cadastro] gravação falhou", error);

    /**
     * Avisa na tela, não só no console.
     *
     * O caso mais comum aqui é permissão: quem tem acesso de leitura
     * via a mudança aplicada na tela e ela sumia no reload, sem nenhuma
     * explicação. Agora o motivo aparece — e o texto vem do servidor,
     * que é quem sabe se foi permissão, sessão expirada ou falha de
     * rede.
     */
    notifyGlobal({
      tone: "error",
      title: "A alteração não foi salva.",
      detail: `${mensagem} Recarregue a página para ver o valor atual.`,
    });

    aoFalhar?.(mensagem);
  });
}
