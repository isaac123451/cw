"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { guardarProximoPasso } from "@/lib/actions/proximoPasso";
import { resumoDaFila, retratoDoProximoPasso } from "@/lib/models/proximoPasso";

import { useOQueValeHoje } from "@/components/rotina/recuperacaoDoDia";
import type { useMeuDia } from "@/components/rotina/useMeuDia";

type MeuDia = ReturnType<typeof useMeuDia>;

/**
 * O próximo passo (1.123): o primeiro da fila do Um por vez — o que vale
 * hoje, desde a 1.124 —, menos os que a pessoa pulou nesta tela.
 *
 * Quando o primeiro da fila muda (não a cada recarga), grava na conta — é
 * dali que o popup da extensão mostra "o próximo". Espera 3 s parado antes
 * de gravar, para a fila que se reorganiza depois de fechar um item não
 * virar três gravações.
 */
export function useProximoPasso(dia: MeuDia, marcadas: Set<string>) {
  /* O que vale hoje (1.124): a fila com o acumulado cortado pela cota do plano. */
  const { hoje: fila } = useOQueValeHoje(dia, marcadas);

  const [pulados, setPulados] = useState<string[]>([]);
  const visivel = useMemo(() => {
    const resto = fila.filter((i) => !pulados.includes(i.chave));
    /* Pulou todos: a fila recomeça do primeiro. */
    return resto.length ? resto : fila;
  }, [fila, pulados]);

  const item = visivel[0] ?? null;
  const resumo = useMemo(() => resumoDaFila(fila), [fila]);

  /* Grava o primeiro da fila de verdade (sem os pulos desta tela) quando ele muda. */
  const primeiro = fila[0]?.chave ?? "";
  const gravado = useRef<string | null>(null);
  useEffect(() => {
    if (dia.carregando || !dia.contagens || gravado.current === primeiro) return;
    const t = window.setTimeout(() => {
      gravado.current = primeiro;
      guardarProximoPasso(retratoDoProximoPasso(fila, new Date())).catch(() => {
        gravado.current = null;
      });
    }, 3000);
    return () => window.clearTimeout(t);
  }, [primeiro, fila, dia.carregando, dia.contagens]);

  return {
    fila,
    item,
    resumo,
    /** A posição do item na fila inteira, a partir de 1. */
    posicao: item ? fila.findIndex((i) => i.chave === item.chave) + 1 : 0,
    pular: () => item && setPulados((p) => [...p, item.chave]),
    carregando: dia.carregando || !dia.contagens,
  };
}
