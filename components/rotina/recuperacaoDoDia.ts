"use client";

import { useMemo, useSyncExternalStore } from "react";

import { leitura } from "@/lib/lote";
import type { FrenteId } from "@/lib/models/frentes";
import { filaDoDia, type ItemDaFila } from "@/lib/models/guiaParaFechar";
import {
  ajusteValido,
  cotaDaFrente,
  frentesNoPlano,
  FRENTES_DA_RECUPERACAO,
  restanteDeHoje,
  ritmoDeHoje,
  separarOQueValeHoje,
  type AjusteDaFrente,
  type AjusteDaRecuperacao,
} from "@/lib/models/recuperacao";

import type { useMeuDia } from "@/components/rotina/useMeuDia";

type MeuDia = ReturnType<typeof useMeuDia>;

/* ============================================================
   O AJUSTE DA CONTA — lido uma vez, para todas as partes da tela
============================================================ */

/* Em lote, por rota (1.116): sai junto com as outras leituras do Meu dia. */
const lerAjuste = leitura("recuperacao");

let ajusteAtual: AjusteDaRecuperacao | null = null;
let pedido: Promise<void> | null = null;
const ouvintesDoAjuste = new Set<() => void>();

function avisarAjuste() {
  ouvintesDoAjuste.forEach((o) => o());
}

function assinarAjuste(ouvinte: () => void) {
  ouvintesDoAjuste.add(ouvinte);
  if (!pedido) {
    pedido = lerAjuste()
      .then((a) => {
        ajusteAtual = ajusteValido(a);
      })
      .catch(() => {
        ajusteAtual = ajusteValido(null);
      })
      .finally(avisarAjuste);
  }
  return () => {
    ouvintesDoAjuste.delete(ouvinte);
  };
}

/** O ajuste do plano de recuperação da pessoa; `null` enquanto chega. */
export function useAjusteDaRecuperacao() {
  return useSyncExternalStore(assinarAjuste, () => ajusteAtual, () => null);
}

/** Depois de salvar: todas as partes da tela passam a usar o novo. */
export function definirAjusteDaRecuperacao(ajuste: AjusteDaRecuperacao) {
  ajusteAtual = ajuste;
  avisarAjuste();
}

/* ============================================================
   AS ESCOLHAS DO DIA — no navegador de quem trabalha
============================================================ */

/*
  A cota escolhida nos botões da linha, o número da primeira abertura do
  dia e o que a pessoa adiantou: conveniência de quem olha, não dado da
  operação. Sem acesso ao armazenamento, vale o ajuste da conta.
*/
export const EVENTO_DA_RECUPERACAO = "cw:recuperacao";
export const chaveDaCota = (f: FrenteId) => `cw:recuperacao:cota:${f}`;
export const chaveDoInicio = (f: FrenteId) => `cw:recuperacao:inicio:${f}`;
export const chaveDoAdiantado = (f: FrenteId) => `cw:recuperacao:adiantado:${f}`;

export function lerTexto(chave: string) {
  try {
    return window.localStorage.getItem(chave);
  } catch {
    return null;
  }
}

export function gravarGuardado(chave: string, valor: unknown) {
  try {
    window.localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* sem armazenamento: segue com o que está na tela */
  }
  window.dispatchEvent(new Event(EVENTO_DA_RECUPERACAO));
}

/** Depois de salvar o ajuste, as escolhas rápidas do dia saem — vale o que foi salvo. */
export function esquecerCotasDoDia() {
  try {
    for (const f of FRENTES_DA_RECUPERACAO) window.localStorage.removeItem(chaveDaCota(f));
  } catch {
    /* sem armazenamento: nada guardado */
  }
  window.dispatchEvent(new Event(EVENTO_DA_RECUPERACAO));
}

function ouvir(avisar: () => void) {
  window.addEventListener(EVENTO_DA_RECUPERACAO, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(EVENTO_DA_RECUPERACAO, avisar);
    window.removeEventListener("storage", avisar);
  };
}

const TODAS_AS_CHAVES = FRENTES_DA_RECUPERACAO.flatMap((f) => [chaveDaCota(f), chaveDoInicio(f), chaveDoAdiantado(f)]);

/* Uma leitura só de todas as chaves, como texto estável — no servidor e na hidratação, nada guardado. */
function useGuardadosDoPlano(): Map<string, unknown> {
  const texto = useSyncExternalStore(
    ouvir,
    () => TODAS_AS_CHAVES.map((k) => `${k}\t${lerTexto(k) ?? ""}`).join("\n"),
    () => ""
  );
  return useMemo(() => {
    const mapa = new Map<string, unknown>();
    for (const linha of texto.split("\n")) {
      const [k, v] = linha.split("\t");
      if (!k || !v) continue;
      try {
        mapa.set(k, JSON.parse(v));
      } catch {
        /* valor estragado: como se não houvesse */
      }
    }
    return mapa;
  }, [texto]);
}

/* ============================================================
   O QUE VALE HOJE
============================================================ */

export interface PlanoDaFrenteHoje {
  frente: FrenteId;
  /** Fora do prazo na frente, de todas as atividades. */
  acumulado: number;
  cota: number;
  /** O acumulado na primeira abertura do dia — a régua do "saiu hoje". */
  inicio: number;
  saiu: number;
  /** Quanto do acumulado ainda cabe hoje. */
  restante: number;
  adiantado: number;
  ajuste: AjusteDaFrente;
}

export interface OQueValeHoje {
  /** A fila inteira (sem as atividades marcadas). */
  fila: ItemDaFila[];
  /** A fila com o acumulado cortado pela cota de hoje — o que vale hoje. */
  hoje: ItemDaFila[];
  /** Por frente, quantos do acumulado ficam para os próximos dias. */
  paraDepois: Map<FrenteId, number>;
  /** As frentes com plano hoje. */
  planos: PlanoDaFrenteHoje[];
}

const VAZIO: OQueValeHoje = { fila: [], hoje: [], paraDepois: new Map(), planos: [] };

/**
 * O que vale hoje (1.124): a fila do Meu dia com o acumulado de cada frente
 * cortado pela cota do plano de recuperação.
 *
 * Usado pelo plano, pelo próximo passo, pelo Um por vez e pela rotina —
 * uma conta só, para nenhum deles dizer um número diferente do outro.
 */
export function useOQueValeHoje(dia: MeuDia, marcadas: Set<string>): OQueValeHoje {
  const ajuste = useAjusteDaRecuperacao();
  const guardados = useGuardadosDoPlano();

  return useMemo(() => {
    if (dia.carregando || !dia.contagens || !dia.hoje) return VAZIO;
    const hojeDoDia = dia.hoje;
    const efetivo = ajuste ?? ajusteValido(null);

    /* O acumulado conta todas as atividades: marcar uma como feita não "tira" o atraso. */
    const porFrente = new Map<FrenteId, number>();
    for (const i of filaDoDia(dia.doDia, dia.contagens)) {
      if (i.atrasado && i.frente) porFrente.set(i.frente, (porFrente.get(i.frente) ?? 0) + 1);
    }

    const planos = frentesNoPlano(porFrente, efetivo).map(([f, acumulado]): PlanoDaFrenteHoje => {
      const escolhida = guardados.get(chaveDaCota(f));
      const cota = typeof escolhida === "number" && escolhida > 0 ? escolhida : cotaDaFrente(acumulado, efetivo[f]);
      const doInicio = guardados.get(chaveDoInicio(f)) as { dia?: string; n?: number } | undefined;
      const inicio = doInicio?.dia === hojeDoDia && typeof doInicio.n === "number" ? doInicio.n : acumulado;
      const doAdiantado = guardados.get(chaveDoAdiantado(f)) as { dia?: string; n?: number } | undefined;
      const adiantado = doAdiantado?.dia === hojeDoDia && typeof doAdiantado.n === "number" ? doAdiantado.n : 0;
      const { saiu } = ritmoDeHoje(inicio, acumulado, cota);
      return { frente: f, acumulado, cota, inicio, saiu, restante: restanteDeHoje(cota, saiu, adiantado), adiantado, ajuste: efetivo[f] };
    });

    const fila = filaDoDia(dia.doDia, dia.contagens, marcadas);
    const { hoje, paraDepois } = separarOQueValeHoje(fila, new Map(planos.map((p) => [p.frente, p.restante])));
    return { fila, hoje, paraDepois, planos };
  }, [dia.carregando, dia.contagens, dia.doDia, dia.hoje, marcadas, ajuste, guardados]);
}

/** Adianta mais do acumulado hoje — além da cota, só neste navegador, só hoje. */
export function adiantarHoje(frente: FrenteId, hoje: string, atual: number, quantos: number) {
  gravarGuardado(chaveDoAdiantado(frente), { dia: hoje, n: atual + quantos });
}
