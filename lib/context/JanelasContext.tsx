"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useToast } from "@/lib/context/ToastContext";

import {
  abrirJanela,
  focarJanela,
  lerJanelasGuardadas,
  limitarNaTela,
  MAXIMO_DE_JANELAS,
  type Janela,
  type PedidoDeJanela,
} from "@/lib/models/janelas";

/**
 * As mini-janelas abertas, acima de qualquer página.
 *
 * Mora no layout raiz, junto dos outros contextos, e é por isso que as
 * janelas **sobrevivem à navegação**: trocar de página troca o conteúdo
 * de dentro, e o provider não desmonta. Era o segundo pedido — "abrir
 * mais de uma e navegar entre as páginas enquanto faço isso".
 *
 * O endereço das janelas (qual ficha, onde na tela) fica guardado na
 * sessão do navegador, para um F5 não fechar tudo. O conteúdo não: ele
 * vem do banco toda vez que a janela aparece.
 */

interface JanelasContextType {
  janelas: Janela[];
  abrir: (pedido: PedidoDeJanela) => void;
  fechar: (id: string) => void;
  focar: (id: string) => void;
  minimizar: (id: string, minimizada?: boolean) => void;
  mover: (id: string, x: number, y: number) => void;
}

const JanelasContext = createContext<JanelasContextType | null>(null);

const CHAVE = "cw:janelas";

function tela() {
  return typeof window === "undefined"
    ? { largura: 1280, altura: 800 }
    : { largura: window.innerWidth, altura: window.innerHeight };
}

export function JanelasProvider({ children }: { children: ReactNode }) {

  const { notify } = useToast();

  const [janelas, setJanelas] = useState<Janela[]>([]);

  /*
    Só grava depois de ler — e "leu" é **estado**, não ref.

    Com ref, a gravação rodava no mesmo ciclo da leitura, ainda com a
    lista vazia de antes, e escrevia "[]" por cima do que estava
    guardado. Como estado, as duas mudanças chegam juntas: quando a
    gravação roda, a lista já é a restaurada.
  */
  const [restaurado, setRestaurado] = useState(false);

  useEffect(() => {
    try {
      const guardadas = lerJanelasGuardadas(sessionStorage.getItem(CHAVE), tela());
      if (guardadas.length > 0) {
        /* Restaurar é um evento de montagem, e acontece uma vez. */
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setJanelas(guardadas);
      }
    } catch {
      /* Sessão bloqueada (modo privado estrito): as janelas só não voltam no F5. */
    }
    setRestaurado(true);
  }, []);

  useEffect(() => {
    if (!restaurado) return;
    try {
      sessionStorage.setItem(CHAVE, JSON.stringify(janelas));
    } catch {
      /* idem */
    }
  }, [janelas, restaurado]);

  const abrir = useCallback(
    (pedido: PedidoDeJanela) => {
      setJanelas((atuais) => {
        const r = abrirJanela(atuais, pedido, tela());
        if (r.tipo === "cheia") {
          /* Fora do setState: o aviso não pode depender de o React repetir a função. */
          queueMicrotask(() =>
            notify({
              tone: "info",
              title: `Já há ${MAXIMO_DE_JANELAS} janelas abertas.`,
              detail: "Feche uma para abrir outra — nenhuma é fechada sozinha, para nenhum rascunho sumir.",
            })
          );
        }
        return r.janelas;
      });
    },
    [notify]
  );

  const fechar = useCallback((id: string) => {
    setJanelas((atuais) => atuais.filter((j) => j.id !== id));
  }, []);

  const focar = useCallback((id: string) => {
    setJanelas((atuais) => focarJanela(atuais, id));
  }, []);

  const minimizar = useCallback((id: string, minimizada = true) => {
    setJanelas((atuais) => {
      const mudadas = atuais.map((j) => (j.id === id ? { ...j, minimizada } : j));
      return minimizada ? mudadas : focarJanela(mudadas, id);
    });
  }, []);

  const mover = useCallback((id: string, x: number, y: number) => {
    const pos = limitarNaTela({ x, y }, tela());
    setJanelas((atuais) => atuais.map((j) => (j.id === id ? { ...j, ...pos } : j)));
  }, []);

  const valor = useMemo(
    () => ({ janelas, abrir, fechar, focar, minimizar, mover }),
    [janelas, abrir, fechar, focar, minimizar, mover]
  );

  return <JanelasContext.Provider value={valor}>{children}</JanelasContext.Provider>;
}

export function useJanelas() {
  const ctx = useContext(JanelasContext);
  if (!ctx) throw new Error("useJanelas deve estar dentro de JanelasProvider.");
  return ctx;
}
