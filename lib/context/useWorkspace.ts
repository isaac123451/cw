"use client";

import { useEffect, useState } from "react";

import {
  loadWorkspace,
  type Workspace,
} from "@/lib/actions/workspace";

/**
 * Uma requisição para todos os contextos.
 *
 * A promessa é memoizada no módulo: os treze providers montam juntos e
 * chamam isto ao mesmo tempo, mas só o primeiro dispara a busca — os
 * demais aguardam a mesma resposta. Sem isso seriam treze conexões
 * simultâneas ao Supabase, que o plano gratuito não sustenta.
 */
let pendente: Promise<Workspace> | null = null;

export function carregarWorkspace() {

  if (!pendente) {
    pendente = loadWorkspace().catch((error) => {
      // Falha não pode ficar em cache: a próxima montagem tenta de novo.
      pendente = null;
      throw error;
    });
  }

  return pendente;
}

/** Descarta o cache — usado depois de importar ou de gravar em lote. */
export function invalidarWorkspace() {
  pendente = null;
}

/**
 * Recorta um pedaço da carga para um contexto.
 *
 * Devolve o estado e o `setState`, para o contexto seguir fazendo as
 * atualizações otimistas que já fazia.
 */
export function useWorkspaceSlice<T>(
  selecionar: (dados: Workspace) => T,
  inicial: T
) {

  const [dados, setDados] = useState<T>(inicial);
  const [loading, setLoading] = useState(true);

  useEffect(() => {

    let ativo = true;

    carregarWorkspace()
      .then((workspace) => {
        if (ativo) setDados(selecionar(workspace));
      })
      .catch((error: unknown) => {
        console.error(
          "[workspace] carga falhou",
          error
        );
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });

    return () => {
      ativo = false;
    };

    // Só na montagem: `selecionar` é uma função inline em cada contexto
    // e mudaria de identidade a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [dados, setDados, loading] as const;
}
