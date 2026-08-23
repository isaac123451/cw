"use client";

import { useMemo, useState } from "react";

import {
  emAndamento,
  isEncerrado,
  moodOf,
  NpsKindOption,
  NpsResponseView,
  NpsStageOption,
  rotuloDeEtapa,
  segmentOf,
  tipoPorNome,
} from "@/lib/models/nps";

import { slaState } from "@/lib/services/nps.service";

interface Props {
  itens: NpsResponseView[];
  /** As etapas cadastradas — o quadro é desenhado a partir delas. */
  etapas: NpsStageOption[];
  tipos: NpsKindOption[];
  onOpen: (item: NpsResponseView) => void;
  /** Devolve o status escolhido; a página decide o que gravar. */
  onMove: (
    item: NpsResponseView,
    status: string
  ) => Promise<void>;
}

const ENCERRADO = "__encerrado__";

/**
 * As colunas do ciclo, vindas do cadastro.
 *
 * Eram quatro fixas no código. Agora as de andamento são as etapas
 * ativas não finais, na ordem cadastrada — e a de encerrados continua
 * sendo **uma só**, e não uma por rótulo final: são vários status de
 * encerramento no guia, e uma coluna para cada faria o quadro virar uma
 * planilha rolando na horizontal. Quem quer o rótulo exato abre a ficha.
 */
function colunasDe(etapas: NpsStageOption[]) {

  const andamento = emAndamento(etapas).map((etapa) => ({
    id: etapa.name,
    titulo: rotuloDeEtapa(etapa.name),
    dica:
      etapa.description ??
      "Nenhum ciclo parado aqui.",
    cor: etapa.color,
  }));

  return [
    ...andamento,
    {
      id: ENCERRADO,
      titulo: "Encerrado",
      dica: "Ciclo fechado.",
      cor: "#71717A",
    },
  ];
}

/**
 * Em que coluna o ciclo cai.
 *
 * O encerramento sai do **prefixo do status**, não do cadastro: é o
 * mesmo `isEncerrado()` que a fila da extensão e o indicador de
 * resolução usam, e ele não depende de a lista de etapas ter carregado.
 *
 * O status que não existe mais no cadastro cai na primeira coluna de
 * andamento — desativar uma etapa não pode fazer sumir do quadro o
 * ciclo que estava parado nela.
 */
function colunaDe(
  item: NpsResponseView,
  colunas: { id: string }[]
) {

  if (isEncerrado(item.status)) return ENCERRADO;

  const existe = colunas.some(
    (coluna) => coluna.id === item.status
  );

  return existe
    ? item.status
    : (colunas[0]?.id ?? ENCERRADO);
}

/**
 * Quadro do ciclo de NPS.
 *
 * A lista responde "o que existe"; o quadro responde "onde cada coisa
 * está parada", que é a pergunta da reunião de segunda-feira. Arrastar
 * move o status — menos a coluna de encerrados, que exige o rótulo
 * final e por isso abre a ficha em vez de aceitar o solto.
 *
 * **Altura definida no invólucro**, e não `h-full`: é a mesma armadilha
 * já documentada no Kanban do Reclame Aqui — com `h-full` as colunas
 * espremem para ~126 px, com `min-h-full` a página estica sem fim.
 */
export default function NpsKanban({
  itens,
  etapas,
  tipos,
  onOpen,
  onMove,
}: Props) {

  const [sobre, setSobre] = useState<string>();

  const colunas = useMemo(
    () => colunasDe(etapas),
    [etapas]
  );

  async function soltar(
    evento: React.DragEvent,
    coluna: string
  ) {

    evento.preventDefault();
    setSobre(undefined);

    /**
     * O id sai do `dataTransfer`, e não do estado do React: no momento
     * do `drop` o estado pode ainda não ter re-renderizado. Mesma regra
     * do quadro do Reclame Aqui.
     */
    const id = evento.dataTransfer.getData("text/plain");

    const item = itens.find((i) => i.id === id);

    if (!item) return;

    if (colunaDe(item, colunas) === coluna) return;

    /**
     * Encerrar exige escolher entre os finais do tipo — "[Encerrado]
     * Resolvido" e "[Encerrado] Sem Retorno" não são a mesma coisa, e
     * arrastar não tem como perguntar qual. Então abre a ficha.
     */
    if (coluna === ENCERRADO) {
      onOpen(item);
      return;
    }

    await onMove(item, coluna);
  }

  /**
   * Quantas colunas cabem lado a lado.
   *
   * Com a etapa virando cadastro, o número deixou de ser quatro. Sem
   * isto, cadastrar a quinta etapa produziria uma quinta coluna
   * espremida embaixo, fora da grade — e o quadro deixaria de ser
   * legível justamente para quem mexeu no fluxo.
   */
  const grade =
    colunas.length <= 3
      ? "xl:grid-cols-3"
      : colunas.length === 4
        ? "xl:grid-cols-4"
        : colunas.length === 5
          ? "xl:grid-cols-5"
          : "xl:grid-cols-6";

  return (
    <div
      className={`grid h-[calc(100vh-420px)] min-h-[380px] grid-cols-1 gap-3 sm:grid-cols-2 ${grade}`}
    >

      {colunas.map((coluna) => {

        const daColuna = itens.filter(
          (item) =>
            colunaDe(item, colunas) === coluna.id
        );

        return (
          <div
            key={coluna.id}
            onDragOver={(e) => {
              e.preventDefault();
              setSobre(coluna.id);
            }}
            onDragLeave={() => setSobre(undefined)}
            onDrop={(e) => soltar(e, coluna.id)}
            className={`flex min-h-0 flex-col rounded-2xl border transition-colors ${sobre === coluna.id ? "border-violet-300 bg-violet-50/40" : "border-zinc-200 bg-zinc-50/60"}`}
          >

            <div className="flex items-center gap-2 px-3 pb-2 pt-3">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: coluna.cor }}
              />
              <span className="truncate text-xs font-semibold text-zinc-700">
                {coluna.titulo}
              </span>
              <span className="ml-auto shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-500 ring-1 ring-inset ring-zinc-200">
                {daColuna.length}
              </span>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-2">

              {daColuna.length === 0 && (
                <p className="px-1 py-6 text-center text-[11px] text-zinc-400">
                  {coluna.dica}
                </p>
              )}

              {daColuna.map((item) => (
                <Cartao
                  key={item.id}
                  item={item}
                  tipos={tipos}
                  onOpen={onOpen}
                />
              ))}

            </div>

          </div>
        );
      })}

    </div>
  );
}

function Cartao({
  item,
  tipos,
  onOpen,
}: {
  item: NpsResponseView;
  tipos: NpsKindOption[];
  onOpen: (item: NpsResponseView) => void;
}) {

  const segmento = segmentOf(item.score);
  const humor = moodOf(item.moodAfter);
  const regra = tipoPorNome(tipos, item.kind);

  const atrasado = slaState(item) === "estourado";

  return (
    <article
      draggable
      onDragStart={(e) =>
        e.dataTransfer.setData("text/plain", item.id)
      }
      onClick={() => onOpen(item)}
      className="cursor-pointer rounded-xl border border-zinc-200 bg-white p-2.5 shadow-sm transition-colors hover:border-violet-300"
    >

      <div className="flex items-start gap-2">

        <span
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
          style={{ background: segmento.color }}
          title={segmento.label}
        >
          {item.score}
        </span>

        <p className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-800">
          {item.customer}
        </p>

        {humor && (
          <span
            title={`${humor.label} após contato`}
            className="shrink-0 text-sm leading-none"
          >
            {humor.emoji}
          </span>
        )}

      </div>

      {item.comment && (
        <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-zinc-500">
          {item.comment}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1">

        {regra && (
          <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
            {regra.emoji} {regra.name}
          </span>
        )}

        {item.rootCause && (
          <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
            {item.rootCause}
          </span>
        )}

        {atrasado && (
          <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
            fora do prazo
          </span>
        )}

        {item.resolvedAfter === false && (
          <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
            não resolvido
          </span>
        )}

        {item.attempts.length > 0 && (
          <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
            {item.attempts.length} tentativa(s)
          </span>
        )}

      </div>

    </article>
  );
}
