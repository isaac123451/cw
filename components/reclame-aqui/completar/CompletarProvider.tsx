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
}

const CompletarContext = createContext<CompletarContextType | null>(null);

export function CompletarProvider({ children }: { children: ReactNode }) {

  const [caseId, setCaseId] = useState<string | null>(null);

  const abrir = useCallback((id: string) => setCaseId(id), []);
  const fechar = useCallback(() => setCaseId(null), []);

  return (
    <CompletarContext.Provider value={{ abrir }}>
      {children}

      {caseId && (
        /* A chave zera o formulário quando outra reclamação é aberta. */
        <CompletarDrawer key={caseId} caseId={caseId} onClose={fechar} />
      )}
    </CompletarContext.Provider>
  );
}

/** Fora do provider, abrir não faz nada — o botão some em vez de quebrar a tela. */
export function useCompletar(): CompletarContextType {
  return useContext(CompletarContext) ?? { abrir: () => {} };
}
