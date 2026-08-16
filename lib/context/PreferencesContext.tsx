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
  defaultPrefs,
  NotificationPrefs,
} from "@/lib/services/notifications.service";

import {
  getPreferences,
  savePreferences,
} from "@/lib/actions/preferences";

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
 * Preferências da pessoa.
 *
 * **Com banco, vão para o Postgres** e seguem a conta: quem desliga um
 * aviso no desktop encontra desligado no notebook. Antes viviam só no
 * `localStorage` e eram por dispositivo.
 *
 * Sem banco (modo demonstração) o `localStorage` continua valendo.
 */
export function PreferencesProvider({
  children,
  hasDatabase = false,
}: {
  children: ReactNode;
  /** Vem do layout: este provider não enxerga o `CaseProvider`. */
  hasDatabase?: boolean;
}) {

  const [prefs, setPrefs] =
    useState<Preferences>(defaults);

  // Só depois da montagem: no servidor não existe localStorage e ler
  // no primeiro render causaria divergência de hidratação.
  useEffect(() => {

    let ativo = true;

    if (hasDatabase) {

      getPreferences()
        .then((guardadas) => {
          // `null` = nunca salvou nada; o padrão já está no estado.
          if (ativo && guardadas) setPrefs(guardadas);
        })
        .catch((erro: unknown) => {
          console.error(
            "[preferências] carga falhou",
            erro
          );
        });

      return () => {
        ativo = false;
      };
    }

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

    return () => {
      ativo = false;
    };

  }, [hasDatabase]);

  /**
   * A gravação não bloqueia a tela: marcar uma caixa precisa responder
   * na hora, e a ida ao banco pode esperar.
   */
  const persist = useCallback(
    (next: Preferences) => {
      setPrefs(next);

      if (hasDatabase) {
        savePreferences(next).catch((erro: unknown) => {
          console.error(
            "[preferências] gravação falhou",
            erro
          );
        });
        return;
      }

      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(next)
        );
      } catch {
        // Modo privado pode bloquear a escrita — segue em memória.
      }
    },
    [hasDatabase]
  );

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
    [prefs, persist]
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
