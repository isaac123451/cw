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

import { getUpcomingEvents } from "@/lib/actions/google";

import { GoogleEvent } from "@/lib/models/google";

interface GoogleEventsContextType {
  events: GoogleEvent[];
  loading: boolean;
  error?: string;
  recarregar: () => Promise<void>;
}

const GoogleEventsContext =
  createContext<GoogleEventsContextType | null>(null);

/**
 * Eventos do Google carregados **uma vez** para o sino e o cartão da
 * agenda.
 *
 * Sem isto, cada um chamaria a API do Google por conta própria: o sino
 * está em toda tela, então seria uma ida à rede em cada navegação, e as
 * duas listas poderiam divergir na tela.
 *
 * Falha em silêncio de propósito: quem não conectou a conta não tem o
 * que ver, e um erro no sino não pode atrapalhar o resto.
 */
export function GoogleEventsProvider({
  children,
  enabled = false,
}: {
  children: ReactNode;
  /** Sem banco ou sem credenciais, nem tenta. */
  enabled?: boolean;
}) {

  const [events, setEvents] = useState<GoogleEvent[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string>();

  const recarregar = useCallback(async () => {

    if (!enabled) return;

    try {
      const { events: lista, error: falha } =
        await getUpcomingEvents();

      setEvents(lista);
      setError(falha);
    } catch {
      // Conta não conectada é o caso comum — não é erro para mostrar.
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {

    let ativo = true;

    // `loading` já nasce como `enabled`, então aqui não há o que zerar.
    if (!enabled) return;

    getUpcomingEvents()
      .then(({ events: lista, error: falha }) => {
        if (!ativo) return;
        setEvents(lista);
        setError(falha);
      })
      .catch(() => {
        if (ativo) setEvents([]);
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });

    return () => {
      ativo = false;
    };

  }, [enabled]);

  const value = useMemo(
    () => ({ events, loading, error, recarregar }),
    [events, loading, error, recarregar]
  );

  return (
    <GoogleEventsContext.Provider value={value}>
      {children}
    </GoogleEventsContext.Provider>
  );
}

export function useGoogleEvents() {

  const context = useContext(GoogleEventsContext);

  if (!context) {
    throw new Error(
      "useGoogleEvents deve estar dentro de GoogleEventsProvider."
    );
  }

  return context;
}
