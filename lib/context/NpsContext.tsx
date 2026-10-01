"use client";

import { daCargaInicial } from "@/lib/context/cargaInicial";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useMemo,
  useState,
  ReactNode,
} from "react";

import { useAtualizarSozinho } from "@/lib/hooks/useAtualizarSozinho";

import {

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
  /** A lista inteira de novo — depois de apagar, que a recarga do que mudou não vê (1.116). */
  recarregarTudo: () => Promise<void>;
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
/**
 * As respostas pela rota `/api/leitura/nps` (1.116): 2,3 MB que, como server
 * action, seguravam as outras leituras da tela na fila. `desde` traz só o
 * que mudou.
 */
let listaEmAndamento: Promise<{ respostas: NpsResponseView[]; agora: string }> | null = null;

async function buscarNps(desde?: string): Promise<{ respostas: NpsResponseView[]; agora: string }> {
  /* A lista inteira pedida duas vezes ao mesmo tempo é um pedido só (2,3 MB). */
  if (!desde && listaEmAndamento) return listaEmAndamento;
  const pedido = fetch(`/api/leitura/nps${desde ? `?desde=${encodeURIComponent(desde)}` : ""}`, { cache: "no-store" }).then((resposta) => {
    if (!resposta.ok) throw new Error(`NPS: ${resposta.status}`);
    return resposta.json() as Promise<{ respostas: NpsResponseView[]; agora: string }>;
  });
  if (desde) return pedido;
  listaEmAndamento = pedido.finally(() => {
    listaEmAndamento = null;
  });
  return listaEmAndamento;
}

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

  /*
    A recarga traz só o que mudou (1.116). Eram as 4.110 respostas (2,3 MB) a
    cada 3 minutos e a cada gravação; agora só as alteradas desde a última
    leitura, e a lista inteira a cada 30 minutos — é ela que pega o que foi
    apagado.
  */
  const ultimaLeitura = useRef<string | null>(null);
  const ultimaCompleta = useRef(0);

  const lerTudo = useCallback(async () => {
    const { respostas, agora } = await buscarNps();
    ultimaLeitura.current = agora;
    ultimaCompleta.current = Date.now();
    return respostas;
  }, []);

  const recarregar = useCallback(async () => {

    if (!enabled) return;

    try {
      if (!ultimaLeitura.current || Date.now() - ultimaCompleta.current > 30 * 60_000) {
        setResponses(await lerTudo());
        return;
      }
      const { respostas, agora } = await buscarNps(ultimaLeitura.current);
      ultimaLeitura.current = agora;
      if (respostas.length === 0) return;
      const novas = new Map(respostas.map((r) => [r.id, r]));
      setResponses((atual) => {
        const conhecidas = new Set(atual.map((r) => r.id));
        const trocadas = atual.map((r) => novas.get(r.id) ?? r);
        const chegaram = respostas.filter((r) => !conhecidas.has(r.id));
        /* A lista vem da mais recente para a mais antiga. */
        return chegaram.length ? [...chegaram, ...trocadas].sort((a, b) => b.respondedAt.localeCompare(a.respondedAt)) : trocadas;
      });
    } catch (erro) {
      console.error("[nps] carga falhou", erro);
    } finally {
      setLoading(false);
    }
  }, [enabled, lerTudo]);

  const recarregarTudo = useCallback(async () => {
    if (!enabled) return;
    try {
      setResponses(await lerTudo());
    } catch (erro) {
      console.error("[nps] carga falhou", erro);
    }
  }, [enabled, lerTudo]);

  /* As respostas do NPS se atualizam sozinhas, como as reclamações. */
  useAtualizarSozinho(recarregar, enabled);

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
      /* Por rota, fora da fila das server actions (1.116). */
      buscarNps(),
      daCargaInicial("causasDoNps", listNpsRootCauses),
      carregarWorkspace(),
    ])
      .then(([lista, causas, workspace]) => {
        if (!ativo) return;
        setResponses(lista.respostas);
        ultimaLeitura.current = lista.agora;
        ultimaCompleta.current = Date.now();
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
      recarregarTudo,
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
      recarregarTudo,
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
