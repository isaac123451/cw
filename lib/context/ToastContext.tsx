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

export type ToastTone = "success" | "error" | "info";

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  detail?: string;
  /** Link opcional — "abrir no Google", "ver na agenda". */
  href?: string;
  hrefLabel?: string;
}

interface ToastContextType {
  toasts: Toast[];
  /** Devolve o id, para quem quiser fechar antes da hora. */
  notify: (toast: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
}

const ToastContext =
  createContext<ToastContextType | null>(null);

/**
 * Ponte para quem não é componente.
 *
 * `sincronizar` (em `lib/context/sync.ts`) é função solta, chamada de
 * dentro de callbacks — não pode usar `useToast()`. Sem isto, uma
 * gravação recusada pelo servidor só aparecia no console: a tela
 * mostrava a mudança aplicada e o valor sumia no reload seguinte, o que
 * parece bug em vez de "você não tem permissão".
 */
let notificador:
  | ((toast: Omit<Toast, "id">) => void)
  | null = null;

export function notifyGlobal(toast: Omit<Toast, "id">) {
  notificador?.(toast);
}

/** Erro fica mais tempo: quem errou precisa ler o motivo. */
const DURACAO: Record<ToastTone, number> = {
  success: 4000,
  info: 5000,
  error: 8000,
};

/**
 * Avisos passageiros no canto da tela.
 *
 * Separado do sino: o sino mostra o **estado** da operação (o que está
 * pendente agora, derivado dos dados), o toast confirma uma **ação** que
 * a pessoa acabou de fazer. Misturar os dois faria "evento criado"
 * ficar preso na lista de pendências.
 */
export function ToastProvider({
  children,
}: {
  children: ReactNode;
}) {

  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((atual) =>
      atual.filter((item) => item.id !== id)
    );
  }, []);

  const notify = useCallback(
    (toast: Omit<Toast, "id">) => {

      const id = crypto.randomUUID();

      setToasts((atual) => [
        // Teto de 3: uma pilha maior cobre a tela e esconde o conteúdo.
        ...atual.slice(-2),
        { ...toast, id },
      ]);

      setTimeout(
        () => dismiss(id),
        DURACAO[toast.tone]
      );

      return id;
    },
    [dismiss]
  );

  // Registra a ponte enquanto o provider estiver montado.
  useEffect(() => {

    notificador = notify;

    return () => {
      notificador = null;
    };

  }, [notify]);

  const value = useMemo(
    () => ({ toasts, notify, dismiss }),
    [toasts, notify, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {

  const context = useContext(ToastContext);

  if (!context) {
    throw new Error(
      "useToast deve estar dentro de ToastProvider."
    );
  }

  return context;
}
