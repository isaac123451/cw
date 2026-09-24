"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

import CompletarDrawer from "./CompletarDrawer";

/**
 * Quem abre o painel "Completar", de qualquer tela.
 *
 * O painel é um só e mora no layout: o cartão do Kanban, a linha da
 * lista, a tela do caso e o aviso do quadro chamam `abrir(id)`, e o
 * painel aparece por cima de onde a pessoa estiver — sem sair da tela,
 * que é o "abrindo uma aba rápida" do pedido.
 */

interface CompletarContextType {
  abrir: (caseId: string) => void;
  /** Completar em sequência: gravou (ou pulou) uma, abre a próxima. */
  abrirFila: (caseIds: string[]) => void;
}

const CompletarContext = createContext<CompletarContextType | null>(null);

export function CompletarProvider({ children }: { children: ReactNode }) {

  const [caseId, setCaseId] = useState<string | null>(null);
  const [fila, setFila] = useState<string[]>([]);

  const abrir = useCallback((id: string) => {
    setFila([]);
    setCaseId(id);
  }, []);
  const abrirFila = useCallback((ids: string[]) => {
    setFila(ids);
    setCaseId(ids[0] ?? null);
  }, []);
  const fechar = useCallback(() => {
    setFila([]);
    setCaseId(null);
  }, []);

  const i = caseId ? fila.indexOf(caseId) : -1;
  const proximo = i >= 0 && i < fila.length - 1 ? fila[i + 1] : null;

  return (
    <CompletarContext.Provider value={{ abrir, abrirFila }}>
      {children}

      {caseId && (
        /* A chave zera o formulário quando outra reclamação é aberta. */
        <CompletarDrawer
          key={caseId}
          caseId={caseId}
          onClose={fechar}
          posicao={i >= 0 ? { atual: i + 1, total: fila.length } : undefined}
          onProximo={i >= 0 ? () => (proximo ? setCaseId(proximo) : fechar()) : undefined}
        />
      )}
    </CompletarContext.Provider>
  );
}

/** Fora do provider, abrir não faz nada — o botão some em vez de quebrar a tela. */
export function useCompletar(): CompletarContextType {
  return useContext(CompletarContext) ?? { abrir: () => {}, abrirFila: () => {} };
}
