"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";

import { Copy, ShieldAlert } from "lucide-react";

import {
  resumoDosAchados,
  type AchadoLgpd,
} from "@/lib/services/lgpd";

import { respostaParecida } from "@/lib/actions/tratativa";

import PorQue from "@/components/shared/PorQue";
interface Props {
  texto: string;
  protocol: string;
  achados: AchadoLgpd[];
}

type Parecida = { protocolo: string; titulo: string; percentual: number };

/**
 * A conferência da resposta pública, enquanto ela é escrita.
 *
 * Duas regras do Passo 7 que ninguém confere de cabeça num texto de
 * quinze linhas: **nada de dado pessoal** (CPF, e-mail, telefone,
 * valores, condição negociada) e **nada de mensagem pronta** — "cada
 * cliente vivenciou um problema único". A primeira é padrão de texto e
 * roda a cada tecla; a segunda compara com as respostas já publicadas e
 * roda quando a digitação para.
 */
export default function ConferenciaDaResposta({ texto, protocol, achados }: Props) {

  const [parecida, setParecida] = useState<{ texto: string; achado: Parecida | null } | null>(null);

  useEffect(() => {
    if (texto.trim().length < 80) return;

    let ativo = true;

    const espera = setTimeout(() => {
      respostaParecida({ protocol, texto })
        .then((achado) => ativo && setParecida({ texto, achado }))
        .catch(() => undefined);
    }, 900);

    return () => {
      ativo = false;
      clearTimeout(espera);
    };
  }, [texto, protocol]);

  /* O aviso de repetição vale para o texto em que foi medido — ou um quase igual a ele. */
  const repetida =
    texto.trim().length >= 80 && parecida?.achado && Math.abs(parecida.texto.length - texto.length) < 40
      ? parecida.achado
      : null;

  if (achados.length === 0 && !repetida) return null;

  return (
    <div className="mt-3 space-y-2">

      {achados.length > 0 && (
        <div className="rounded-xl bg-rose-50 px-3.5 py-3 text-xs leading-relaxed text-rose-900 ring-1 ring-inset ring-rose-100">
          <p className="flex items-start gap-2 font-medium">
            <ShieldAlert size={14} className="mt-0.5 shrink-0 text-rose-600" />
            <span>
              Revise antes de publicar: {resumoDosAchados(achados)}. A resposta pública fica no ar para
              qualquer pessoa e é indexada — dado pessoal e condição negociada ficam no canal privado.{" "}
              <PorQue chave="ra.resposta-publica" />
            </span>
          </p>
          <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white/80 px-3 py-2 text-zinc-700 ring-1 ring-inset ring-rose-100">
            {trechos(texto, achados)}
          </p>
        </div>
      )}

      {repetida && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-900 ring-1 ring-inset ring-amber-100">
          <Copy size={14} className="mt-0.5 shrink-0 text-amber-600" />
          <span>
            <strong>{repetida.percentual}% igual à resposta de {repetida.protocolo}</strong> ({repetida.titulo}).
            A regra de ouro da documentação: sem mensagem pronta — comece pelo que só este caso tem.{" "}
            <PorQue chave="ra.regra-de-ouro" />
          </span>
        </p>
      )}

    </div>
  );
}

/** O texto com os trechos marcados, cada um com o motivo no título. */
function trechos(texto: string, achados: AchadoLgpd[]) {

  const partes: ReactNode[] = [];
  let cursor = 0;

  achados.forEach((a, i) => {
    if (a.inicio > cursor) partes.push(<Fragment key={`t${i}`}>{texto.slice(cursor, a.inicio)}</Fragment>);
    partes.push(
      <mark key={`m${i}`} title={a.motivo} className="rounded bg-rose-200/80 px-0.5 font-medium text-rose-950">
        {texto.slice(a.inicio, a.fim)}
      </mark>
    );
    cursor = a.fim;
  });

  if (cursor < texto.length) partes.push(<Fragment key="fim">{texto.slice(cursor)}</Fragment>);

  return partes;
}
