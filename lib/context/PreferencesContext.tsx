"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";

import {
  defaultPrefs,
  NotificationPrefs,
} from "@/lib/services/notifications.service";

const STORAGE_KEY = "cw:preferencias";

export interface Preferences {
  notifications: NotificationPrefs;

  /** Mostra só o que está atribuído ao usuário da sessão. */
  somenteMinhas: boolean;
}

const defaults: Preferences = {
  notifications: defaultPrefs,
  somenteMinhas: false,
};

interface PreferencesContextType {
  prefs: Preferences;
  setNotification: (
    key: keyof NotificationPrefs,
    value: boolean
  ) => void;
  setSomenteMinhas: (value: boolean) => void;
  reset: () => void;
}

const PreferencesContext =
  createContext<PreferencesContextType | null>(null);

/**
 * Preferências ficam no localStorage porque são do dispositivo, não da
 * conta — e assim sobrevivem ao reload mesmo antes do banco existir.
 */
export function PreferencesProvider({
  children,
}: {
  children: ReactNode;
}) {

  const [prefs, setPrefs] =
    useState<Preferences>(defaults);

  // Só depois da montagem: no servidor não existe localStorage e ler
  // no primeiro render causaria divergência de hidratação.
  useEffect(() => {

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;

      const parsed = JSON.parse(saved) as Preferences;

      setPrefs({
        notifications: {
          ...defaults.notifications,
          ...parsed.notifications,
        },
        somenteMinhas:
          parsed.somenteMinhas ??
          defaults.somenteMinhas,
      });
    } catch {
      // Preferência corrompida não pode derrubar a aplicação.
    }

  }, []);

  function persist(next: Preferences) {
    setPrefs(next);

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(next)
      );
    } catch {
      // Modo privado pode bloquear a escrita — segue em memória.
    }
  }

  const value = useMemo<PreferencesContextType>(
    () => ({
      prefs,

      setNotification: (key, valor) =>
        persist({
          ...prefs,
          notifications: {
            ...prefs.notifications,
            [key]: valor,
          },
        }),

      setSomenteMinhas: (valor) =>
        persist({ ...prefs, somenteMinhas: valor }),

      reset: () => persist(defaults),
    }),
    [prefs]
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);

  if (!context) {
    throw new Error(
      "usePreferences deve estar dentro de PreferencesProvider."
    );
  }

  return context;
}
