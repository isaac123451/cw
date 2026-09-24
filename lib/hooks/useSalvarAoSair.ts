"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Gravacao } from "@/lib/context/sync";
import type { Rascunho } from "@/lib/hooks/useRascunho";

/**
 * Salvar sem botão, para uma ficha inteira (Fase 22 do roadmap 2.0).
 *
 * O Isaac: "botão de salvar às vezes não é muito interessante, pense em
 * uma forma melhor de salvar". A 1.39.0 trouxe a primeira peça — o
 * `CampoQueSalva`, um campo que grava ao sair. Esta é a mesma regra
 * para a ficha do caso, que tem dezenas de campos soltos espalhados em
 * abas e passava tudo por um rascunho com a barra Salvar:
 *
 * - **o que se escolhe grava na hora** — seletor, caixa de marcar,
 *   botão. Não há o que "terminar de digitar";
 * - **o que se digita grava ao sair do campo** (ou Enter, nos campos de
 *   uma linha, que já tiram o foco). Tecla por tecla, não: era o
 *   defeito que o rascunho veio corrigir, uma ida ao banco por letra;
 * - **"salvo" só depois de o servidor confirmar**, com desfazer ao lado
 *   por alguns segundos; recusado, o que foi digitado fica na tela e o
 *   aviso oferece tentar de novo.
 *
 * O rascunho continua embaixo, fazendo o que já fazia bem: guardar a
 * edição enquanto ela acontece, gravar só o que mudou, não limpar o que
 * o servidor recusou.
 */

export type EstadoDoSalvar =
  | { tipo: "parado" }
  | { tipo: "salvando" }
  | { tipo: "salvo" }
  | { tipo: "erro"; erro: string; tentar: () => void };

/** Quanto tempo o "salvo · desfazer" fica à vista. */
const TEMPO_DO_DESFAZER_MS = 8000;

/** Os campos em que se digita: esses gravam ao sair, e não a cada tecla. */
const TIPOS_DE_DIGITAR = new Set(["text", "email", "tel", "url", "search", "number", "date", "datetime-local", "time", "password"]);

export function ehCampoDeDigitar(el: EventTarget | Element | null) {
  if (typeof HTMLElement === "undefined" || !(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return TIPOS_DE_DIGITAR.has(el.type);
  return el.isContentEditable;
}

export interface SalvarAoSair<T> {
  /** Troca de `rascunho.alterar` para quem edita a ficha. */
  alterar: (patch: Partial<T>) => void;
  /** Vai no `onBlur` do invólucro da ficha — o blur do React sobe. */
  aoSairDoCampo: (evento: { target: EventTarget | null }) => void;
  desfazer: () => void;
  estado: EstadoDoSalvar;
  /** Há alteração que ainda não foi ao banco — a pessoa está no campo. */
  pendente: boolean;
}

export function useSalvarAoSair<T extends { id: string }>(
  rascunho: Rascunho<T>,
  /** O item como o banco tem agora — a base do desfazer. */
  doBanco: T,
  gravar: (item: T) => Promise<Gravacao>
): SalvarAoSair<T> {

  const id = doBanco.id;
  const [estado, setEstado] = useState<EstadoDoSalvar>({ tipo: "parado" });

  /** Pede uma gravação; o efeito abaixo a faz quando o rascunho já tem a edição. */
  const [pedido, setPedido] = useState(0);
  const querGravar = useRef(false);

  /** O valor de cada campo antes da primeira edição desde a última gravação. */
  const antes = useRef<Partial<T>>({});
  /** O que o desfazer devolve: os valores de antes da última gravação. */
  const volta = useRef<Partial<T> | null>(null);
  const relogio = useRef<number | null>(null);

  /*
    O que o efeito de desmontagem e o desfazer leem. Atualizados depois
    de cada render, e não durante: ref escrita no render é a dívida que
    o React Compiler recusa.
  */
  const atual = useRef({ rascunho, doBanco, gravar });
  useEffect(() => {
    atual.current = { rascunho, doBanco, gravar };
  });

  const pedirGravacao = useCallback(() => {
    querGravar.current = true;
    setPedido((n) => n + 1);
  }, []);

  const gravarAgora = useCallback(async () => {

    const { rascunho: r } = atual.current;
    const deAntes = antes.current;
    antes.current = {};

    /* "salvando…" vem do próprio rascunho, que sabe quando está gravando. */
    if (relogio.current) window.clearTimeout(relogio.current);

    const resultado = await r.salvar();

    if (resultado.falhas > 0) {
      /* O que ficou na tela ainda é para desfazer depois, quando gravar. */
      antes.current = { ...deAntes, ...antes.current };
      setEstado({
        tipo: "erro",
        erro: resultado.erro ?? "Não foi gravado. Confira a conexão.",
        tentar: pedirGravacao,
      });
      return;
    }

    volta.current = deAntes;
    setEstado({ tipo: "salvo" });
    relogio.current = window.setTimeout(() => {
      volta.current = null;
      setEstado((e) => (e.tipo === "salvo" ? { tipo: "parado" } : e));
    }, TEMPO_DO_DESFAZER_MS);
  }, [pedirGravacao]);

  /*
    A gravação acontece no efeito, e não no clique que a pediu.

    `rascunho.salvar` grava as edições que ele conhece no render em que
    foi criado; chamado no mesmo clique que acabou de alterar um seletor,
    ele ainda não conhece a alteração, e gravaria o valor velho. No
    efeito do render seguinte, conhece. Pedido que chega durante uma
    gravação espera por ela e sai logo depois.
  */
  useEffect(() => {
    if (!querGravar.current || rascunho.salvando) return;
    querGravar.current = false;
    if (!rascunho.sujo) return;
    void gravarAgora();
  }, [pedido, rascunho.salvando, rascunho.sujo, gravarAgora]);

  const alterar = useCallback(
    (patch: Partial<T>) => {

      const { rascunho: r } = atual.current;
      const naTela = r.itens.find((item) => item.id === id);

      for (const chave of Object.keys(patch) as (keyof T)[]) {
        if (!(chave in antes.current) && naTela) antes.current[chave] = naTela[chave];
      }

      r.alterar(id, patch);

      /* Escolher não tem "terminar de digitar": grava já. */
      if (typeof document === "undefined" || !ehCampoDeDigitar(document.activeElement)) {
        pedirGravacao();
        return;
      }

      /*
        O foco num campo de digitar nem sempre é alguém digitando.

        O seletor de responsável tem busca: escolher com Enter muda o
        valor com o cursor no campo da busca — que some da tela junto
        com a lista, sem blur. A gravação ficaria esperando uma saída
        que não vem. Passada a mudança, se o cursor já não está num
        campo de digitar que continua na tela, grava.
      */
      window.setTimeout(() => {
        const foco = document.activeElement;
        if (!ehCampoDeDigitar(foco) || !(foco as HTMLElement).isConnected) pedirGravacao();
      }, 0);
    },
    [id, pedirGravacao]
  );

  const aoSairDoCampo = useCallback(
    (evento: { target: EventTarget | null }) => {
      if (ehCampoDeDigitar(evento.target) && atual.current.rascunho.sujo) pedirGravacao();
    },
    [pedirGravacao]
  );

  /* O "tentar de novo" de um desfazer recusado chama o próprio desfazer. */
  const desfazerRef = useRef<() => Promise<void>>(async () => undefined);

  const desfazer = useCallback(async () => {

    const valores = volta.current;
    if (!valores) return;
    volta.current = null;
    if (relogio.current) window.clearTimeout(relogio.current);

    const { rascunho: r, doBanco: banco, gravar: g } = atual.current;

    /* Uma edição ainda aberta noutro campo não pode regravar o que se desfez. */
    if (r.sujo) r.alterar(id, valores);

    setEstado({ tipo: "salvando" });
    const resultado = await g({ ...banco, ...valores });

    if (!resultado.ok) {
      volta.current = valores;
      setEstado({
        tipo: "erro",
        erro: `Não foi desfeito: ${resultado.erro ?? "confira a conexão"}.`,
        tentar: () => void desfazerRef.current(),
      });
      return;
    }

    setEstado({ tipo: "parado" });
  }, [id]);

  useEffect(() => {
    desfazerRef.current = desfazer;
  });

  /*
    Fechar a ficha com o cursor num campo não passa pelo blur: o React
    tira o campo da tela sem avisar. O que estava digitado vai ao banco
    na saída, em vez de sumir.
  */
  useEffect(
    () => () => {
      if (relogio.current) window.clearTimeout(relogio.current);
      const { rascunho: r, gravar: g } = atual.current;
      const item = r.itens.find((i) => i.id === id);
      if (r.sujo && !r.salvando && item) void g(item);
    },
    [id]
  );

  /* Fechar a aba antes de gravar pede confirmação do navegador. */
  const pendente = rascunho.sujo;
  useEffect(() => {
    if (!pendente && !rascunho.salvando && estado.tipo !== "salvando") return;
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [pendente, rascunho.salvando, estado.tipo]);

  return {
    alterar,
    aoSairDoCampo,
    desfazer: () => void desfazer(),
    estado: rascunho.salvando ? { tipo: "salvando" } : estado,
    pendente,
  };
}
