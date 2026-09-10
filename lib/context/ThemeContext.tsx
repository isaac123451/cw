"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

export type Tema = "auto" | "claro" | "escuro";

const CHAVE = "cw:tema";

const CONSULTA = "(prefers-color-scheme: dark)";

/* ============================================================
   AS DUAS FONTES DE FORA DO REACT

   O tema mora no `localStorage` e a preferência do sistema no
   `matchMedia`. Nenhum dos dois é estado do React — são coisas que já
   existem, que mudam por conta própria, e que o React precisa apenas
   **ler e acompanhar**.

   Era `useState` + um efeito de montagem que fazia `setTema(guardado)`
   — ou seja, uma **cópia** do valor de fora, mantida à mão e sempre um
   render atrasada em relação à fonte. É o que a regra
   `set-state-in-effect` aponta, e o motivo é esse: cópia de estado
   externo desanda quando a fonte muda por um caminho que o efeito não
   observa.

   `useSyncExternalStore` existe para isto. Ele lê a fonte, não uma
   cópia; sabe o que responder durante a hidratação, sem descasar o
   HTML; e trouxe de graça a **sincronia entre abas** — mudar o tema
   numa aba passou a valer nas outras, o que a versão anterior não
   fazia.

   **A primeira pintura não é deste arquivo.** O servidor não tem como
   saber o que está no `localStorage` de ninguém; quem acerta a classe
   do `<html>` antes do navegador desenhar é o script bloqueante
   `TEMA_ANTES_DA_PINTURA`, em `app/layout.tsx`, que lê a mesma chave
   `cw:tema`. Este contexto assume dali em diante. (Uma versão anterior
   deste comentário dizia que o script não existia — existia.)
============================================================ */

/**
 * Ouvintes desta aba.
 *
 * O evento `storage` do navegador só avisa as **outras** abas — quem
 * escreveu não recebe nada. Sem esta lista, escolher um tema não
 * mudaria a tela de quem escolheu.
 */
const ouvintes = new Set<() => void>();

function avisar() {
  for (const ouvinte of ouvintes) ouvinte();
}

function assinarTema(aoMudar: () => void) {
  ouvintes.add(aoMudar);
  window.addEventListener("storage", aoMudar);

  return () => {
    ouvintes.delete(aoMudar);
    window.removeEventListener("storage", aoMudar);
  };
}

/**
 * A escolha desta aba, para quando o armazenamento recusa.
 *
 * Sem isto, num navegador com `localStorage` bloqueado o clique no tema
 * não mudaria nada: a gravação falharia calada, a releitura devolveria
 * o valor de antes, e a tela ficaria igual. O tema não sobrevive ao
 * recarregar nesse caso — mas vale agora, que é o que a pessoa pediu.
 *
 * O `localStorage` continua tendo a última palavra quando responde: é
 * ele que carrega a escolha feita em outra aba.
 */
let naMemoria: Tema | null = null;

function lerTema(): Tema {
  try {
    const guardado = localStorage.getItem(CHAVE);

    if (
      guardado === "claro" ||
      guardado === "escuro" ||
      guardado === "auto"
    ) {
      return guardado;
    }
  } catch {
    /* Armazenamento bloqueado: sobra a escolha desta aba. */
  }

  return naMemoria ?? "auto";
}

/**
 * O que o servidor tem como dizer.
 *
 * Ele não sabe o que está guardado no navegador de ninguém, então diz
 * "auto" — e é por isso que o HTML entregue nunca discorda de si
 * mesmo. O React usa este retrato durante a hidratação e troca pelo de
 * verdade assim que ela termina.
 */
const noServidor = (): Tema => "auto";

/**
 * A consulta ao sistema, criada uma vez.
 *
 * Preguiçosa porque `window` não existe no servidor, e guardada porque
 * `lerSistema` roda a cada render — `matchMedia` devolveria um objeto
 * novo toda vez, sem necessidade nenhuma.
 */
let consultaDoSistema: MediaQueryList | null = null;

function doSistema() {
  consultaDoSistema ??= window.matchMedia(CONSULTA);
  return consultaDoSistema;
}

function assinarSistema(aoMudar: () => void) {
  const consulta = doSistema();

  consulta.addEventListener("change", aoMudar);

  return () =>
    consulta.removeEventListener("change", aoMudar);
}

function lerSistema(): "claro" | "escuro" {
  return doSistema().matches ? "escuro" : "claro";
}

const claroNoServidor = (): "claro" | "escuro" => "claro";

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

  const tema = useSyncExternalStore(
    assinarTema,
    lerTema,
    noServidor
  );

  const doSistema = useSyncExternalStore(
    assinarSistema,
    lerSistema,
    claroNoServidor
  );

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

  /**
   * Escreve na fonte e avisa quem está lendo.
   *
   * A ordem importa: gravar primeiro, avisar depois — o aviso faz cada
   * assinante reler o `localStorage`, e ler antes da escrita devolveria
   * o valor anterior.
   *
   * `avisar()` acontece mesmo quando a gravação falha. Num navegador
   * com armazenamento bloqueado o tema não sobrevive ao recarregar, mas
   * precisa valer **agora**, nesta aba: um clique que não muda nada na
   * tela é pior do que uma preferência que não persiste.
   */
  const definir = useCallback((t: Tema) => {
    naMemoria = t;

    try {
      localStorage.setItem(CHAVE, t);
    } catch {
      /* Sem armazenamento, vale só nesta aba e só até recarregar. */
    }

    avisar();
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
