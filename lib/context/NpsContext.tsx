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
  ETAPAS_PADRAO,
  NpsKindOption,
  NpsResponseView,
  NpsStageOption,
  ROOT_CAUSES,
  RootCauseOption,
  TIPOS_PADRAO,
} from "@/lib/models/nps";

import {
  carregarWorkspace,
  invalidarWorkspace,
} from "@/lib/context/useWorkspace";

interface NpsContextType {
  responses: NpsResponseView[];
  /**
   * Causas raiz cadastradas. Vêm junto das respostas — é a mesma tela, e
   * duas consultas separadas na montagem custam duas conexões ao pooler.
   */
  rootCauses: RootCauseOption[];
  /**
   * Etapas do quadro e tipos de tratativa, cadastrados.
   *
   * Vêm da carga do workspace, que já é uma requisição só para os doze
   * contextos — e não de uma consulta própria daqui. A extensão lê as
   * mesmas tabelas direto pelo Prisma, na rota.
   */
  stages: NpsStageOption[];
  kinds: NpsKindOption[];
  loading: boolean;
  recarregar: () => Promise<void>;
  recarregarCausas: () => Promise<void>;
  /** Depois de gravar etapa ou tipo: descarta o cache e relê. */
  recarregarCadastro: () => Promise<void>;
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

  const [stages, setStages] = useState<NpsStageOption[]>(
    ETAPAS_PADRAO
  );

  const [kinds, setKinds] = useState<NpsKindOption[]>(
    TIPOS_PADRAO
  );

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

  const recarregarCadastro = useCallback(async () => {

    if (!enabled) return;

    // A carga é memoizada no módulo: sem descartar, releria o guardado.
    invalidarWorkspace();

    try {
      const workspace = await carregarWorkspace();
      setStages(workspace.npsStages);
      setKinds(workspace.npsKinds);
    } catch (erro) {
      console.error("[nps] cadastro falhou", erro);
    }
  }, [enabled]);

  useEffect(() => {

    let ativo = true;

    if (!enabled) return;

    Promise.all([
      listNpsResponses(),
      listNpsRootCauses(),
      carregarWorkspace(),
    ])
      .then(([lista, causas, workspace]) => {
        if (!ativo) return;
        setResponses(lista);
        setRootCauses(causas);
        setStages(workspace.npsStages);
        setKinds(workspace.npsKinds);
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
      stages,
      kinds,
      loading,
      recarregar,
      recarregarCausas,
      recarregarCadastro,
      aplicarLocal,
    }),
    [
      responses,
      rootCauses,
      stages,
      kinds,
      loading,
      recarregar,
      recarregarCausas,
      recarregarCadastro,
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
