"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Tema = "auto" | "claro" | "escuro";

const CHAVE = "cw:tema";

interface Valor {
  /** O que a pessoa escolheu. */
  tema: Tema;

  /** O que está valendo na tela agora — "auto" já resolvido. */
  efetivo: "claro" | "escuro";

  definir: (t: Tema) => void;
}

const Ctx = createContext<Valor | null>(null);

/**
 * O tema da aplicação, com os mesmos três estados da extensão.
 *
 * **Automático** segue o sistema, e é o padrão: quem já configurou o
 * computador para escurecer à noite não deveria ter de configurar de
 * novo aqui. **Claro** e **escuro** fixam, para quem quer o contrário do
 * sistema — trabalhar claro num computador escuro é comum quando a sala
 * é clara.
 *
 * A escolha vive no `localStorage`, e não no banco, de propósito: é uma
 * preferência do aparelho, não da pessoa. O mesmo login no notebook da
 * sala e no monitor do escritório quer temas diferentes, e guardar no
 * servidor forçaria os dois a serem iguais.
 */
export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {

  /**
   * Começa em "auto" e corrige no primeiro efeito.
   *
   * Ler o `localStorage` durante o render quebraria a hidratação: o
   * servidor não tem como saber o que está guardado no navegador, e o
   * primeiro HTML sairia diferente do que o cliente monta.
   */
  const [tema, setTema] = useState<Tema>("auto");

  const [doSistema, setDoSistema] = useState<
    "claro" | "escuro"
  >("claro");

  useEffect(() => {

    try {
      const guardado = localStorage.getItem(CHAVE);

      if (
        guardado === "claro" ||
        guardado === "escuro" ||
        guardado === "auto"
      ) {
        setTema(guardado);
      }
    } catch {
      /* Navegador com armazenamento bloqueado: fica no automático. */
    }

    const consulta = window.matchMedia(
      "(prefers-color-scheme: dark)"
    );

    const aplicar = () =>
      setDoSistema(consulta.matches ? "escuro" : "claro");

    aplicar();

    consulta.addEventListener("change", aplicar);

    return () =>
      consulta.removeEventListener("change", aplicar);

  }, []);

  const efetivo =
    tema === "auto" ? doSistema : tema;

  /**
   * A classe vai no `<html>`, e não no `<body>`.
   *
   * O variante `dark` do Tailwind casa com `.dark *`, e há coisas
   * desenhadas fora do `<body>` — o fundo que o navegador pinta ao
   * rolar além do fim da página, por exemplo.
   */
  useEffect(() => {

    const raiz = document.documentElement;

    raiz.classList.toggle("dark", efetivo === "escuro");

  }, [efetivo]);

  const definir = useCallback((t: Tema) => {

    setTema(t);

    try {
      localStorage.setItem(CHAVE, t);
    } catch {
      /* Sem armazenamento, vale só nesta aba. */
    }
  }, []);

  const valor = useMemo(
    () => ({ tema, efetivo, definir }),
    [tema, efetivo, definir]
  );

  return (
    <Ctx.Provider value={valor}>{children}</Ctx.Provider>
  );
}

export function useTema() {

  const ctx = useContext(Ctx);

  if (!ctx) {
    throw new Error(
      "useTema deve estar dentro de ThemeProvider."
    );
  }

  return ctx;
}
