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
  listNpsRootCauses,
  NpsDraft,
} from "@/lib/actions/nps";

import {
  NpsResponseView,
  ROOT_CAUSES,
  RootCauseOption,
} from "@/lib/models/nps";

interface NpsContextType {
  responses: NpsResponseView[];
  /**
   * Causas raiz cadastradas. Vêm junto das respostas — é a mesma tela, e
   * duas consultas separadas na montagem custam duas conexões ao pooler.
   */
  rootCauses: RootCauseOption[];
  loading: boolean;
  recarregar: () => Promise<void>;
  recarregarCausas: () => Promise<void>;
  /** Aplica na tela sem esperar o banco. */
  aplicarLocal: (
    id: string,
    mudanca: Partial<NpsResponseView>
  ) => void;
}

/** Usado enquanto a carga não volta, e no modo demonstração. */
const CAUSAS_PADRAO: RootCauseOption[] = ROOT_CAUSES.map(
  (name, i) => ({
    id: `padrao-${i}`,
    name,
    order: i,
    active: true,
  })
);

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

  const [rootCauses, setRootCauses] = useState<
    RootCauseOption[]
  >(CAUSAS_PADRAO);

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

  const recarregarCausas = useCallback(async () => {

    if (!enabled) return;

    try {
      setRootCauses(await listNpsRootCauses());
    } catch (erro) {
      console.error("[nps] causas falharam", erro);
    }
  }, [enabled]);

  useEffect(() => {

    let ativo = true;

    if (!enabled) return;

    Promise.all([
      listNpsResponses(),
      listNpsRootCauses(),
    ])
      .then(([lista, causas]) => {
        if (!ativo) return;
        setResponses(lista);
        setRootCauses(causas);
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
      rootCauses,
      loading,
      recarregar,
      recarregarCausas,
      aplicarLocal,
    }),
    [
      responses,
      rootCauses,
      loading,
      recarregar,
      recarregarCausas,
      aplicarLocal,
    ]
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
