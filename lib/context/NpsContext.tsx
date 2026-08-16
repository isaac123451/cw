"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";

import {
  listNpsResponses,
  NpsDraft,
} from "@/lib/actions/nps";

import { NpsResponseView } from "@/lib/models/nps";

interface NpsContextType {
  responses: NpsResponseView[];
  loading: boolean;
  recarregar: () => Promise<void>;
  /** Aplica na tela sem esperar o banco. */
  aplicarLocal: (
    id: string,
    mudanca: Partial<NpsResponseView>
  ) => void;
}

const NpsContext = createContext<NpsContextType | null>(
  null
);

/**
 * Respostas do NPS.
 *
 * Fora do `loadWorkspace` de propósito: a lista cresce com o tempo e só
 * duas telas usam, então não vale carregar em toda sessão junto dos
 * doze contextos.
 */
export function NpsProvider({
  children,
  enabled = false,
}: {
  children: ReactNode;
  /** Sem banco não há o que buscar. */
  enabled?: boolean;
}) {

  const [responses, setResponses] = useState<
    NpsResponseView[]
  >([]);

  const [loading, setLoading] = useState(enabled);

  const recarregar = useCallback(async () => {

    if (!enabled) return;

    try {
      setResponses(await listNpsResponses());
    } catch (erro) {
      console.error("[nps] carga falhou", erro);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {

    let ativo = true;

    if (!enabled) return;

    listNpsResponses()
      .then((lista) => {
        if (ativo) setResponses(lista);
      })
      .catch((erro: unknown) => {
        console.error("[nps] carga falhou", erro);
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });

    return () => {
      ativo = false;
    };

  }, [enabled]);

  const aplicarLocal = useCallback(
    (id: string, mudanca: Partial<NpsResponseView>) => {
      setResponses((atual) =>
        atual.map((item) =>
          item.id === id
            ? { ...item, ...mudanca }
            : item
        )
      );
    },
    []
  );

  const value = useMemo(
    () => ({
      responses,
      loading,
      recarregar,
      aplicarLocal,
    }),
    [responses, loading, recarregar, aplicarLocal]
  );

  return (
    <NpsContext.Provider value={value}>
      {children}
    </NpsContext.Provider>
  );
}

export function useNps() {

  const context = useContext(NpsContext);

  if (!context) {
    throw new Error(
      "useNps deve estar dentro de NpsProvider."
    );
  }

  return context;
}

export type { NpsDraft };
