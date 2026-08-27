"use client";

import { useState } from "react";

import {
  CloudDownload,
  PenLine,
  Trash2,
} from "lucide-react";

import { NpsResponseView } from "@/lib/models/nps";

/**
 * As anotações de um ciclo de NPS — as nossas e as do Wootric.
 *
 * O Isaac pediu as duas coisas: puxar a nota que ele escreve no painel
 * do Wootric, e poder escrever anotação aqui do mesmo jeito.
 *
 * **Elas ficam juntas, e a origem é dita.** Vieram de lugares
 * diferentes e valem coisas diferentes: a nossa tem autor e data e
 * ninguém de fora apaga; a do Wootric é texto puro, sem autor e sem
 * data, e é reescrita a cada importação. Misturá-las sem dizer qual é
 * qual faria alguém cobrar autoria de um texto que nunca teve.
 *
 * **Não é tentativa de contato.** A tentativa tem canal e significa
 * "liguei"; é ela que decide se o ciclo encerra por "sem retorno".
 * Uma anotação que virasse tentativa inflaria essa contagem, e o número
 * passaria a mentir sobre quantas vezes se tentou falar com a pessoa.
 */
export default function NpsNotas({
  item,
  podeEscrever,
  onAdd,
  onRemove,
}: {
  item: NpsResponseView;
  podeEscrever: boolean;
  onAdd: (texto: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {

  const [texto, setTexto] = useState("");
  const [gravando, setGravando] = useState(false);
  const [apagando, setApagando] = useState<string>();

  const daCasa = item.notes ?? [];
  const doWootric = item.wootricNotes ?? [];

  const total = daCasa.length + doWootric.length;

  async function gravar() {

    if (texto.trim() === "" || gravando) return;

    setGravando(true);
    await onAdd(texto.trim());
    setGravando(false);
    setTexto("");
  }

  return (
    <div>

      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        Anotações ({total})
      </p>

      {total === 0 ? (

        <p className="mb-3 rounded-lg border border-dashed border-zinc-200 px-3 py-4 text-center text-xs text-zinc-400">
          Nenhuma anotação — nem escrita aqui, nem vinda do
          Wootric.
        </p>

      ) : (

        <ul className="mb-3 space-y-1.5">

          {/*
            As do Wootric primeiro.

            Elas são o que já existia antes de a pessoa abrir esta
            ficha; o que se escreve aqui vem depois, e é essa a ordem
            em que os fatos aconteceram.
          */}
          {doWootric.map((nota, i) => (

            <li
              key={`w-${i}`}
              className="flex items-start gap-2.5 rounded-lg border border-sky-100 bg-sky-50/40 px-3 py-2 text-xs"
            >

              <CloudDownload
                size={12}
                className="mt-0.5 shrink-0 text-sky-500"
              />

              <span className="min-w-0 flex-1 text-zinc-700">
                {nota}
              </span>

              <span
                className="shrink-0 text-[10px] text-sky-700"
                title="Escrita no painel do Wootric. A API não devolve autor nem data — só o texto."
              >
                do Wootric
              </span>

            </li>

          ))}

          {daCasa.map((nota) => (

            <li
              key={nota.id}
              className="group/nota flex items-start gap-2.5 rounded-lg border border-zinc-100 px-3 py-2 text-xs"
            >

              <PenLine
                size={12}
                className="mt-0.5 shrink-0 text-zinc-300"
              />

              <span className="min-w-0 flex-1">

                <span className="block whitespace-pre-wrap text-zinc-700">
                  {nota.body}
                </span>

                <span className="mt-0.5 block text-[10px] text-zinc-400">
                  {nota.actor || "sem autor"} ·{" "}
                  {new Date(
                    nota.createdAt
                  ).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>

              </span>

              {podeEscrever && (
                <button
                  type="button"
                  disabled={apagando === nota.id}
                  onClick={async () => {
                    setApagando(nota.id);
                    await onRemove(nota.id);
                    setApagando(undefined);
                  }}
                  title="Apagar esta anotação"
                  className="shrink-0 rounded p-1 text-zinc-300 opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-600 focus-visible:opacity-100 group-hover/nota:opacity-100 disabled:opacity-40"
                >
                  <Trash2 size={12} />
                </button>
              )}

            </li>

          ))}

        </ul>

      )}

      {podeEscrever && (

        <div className="flex items-end gap-2">

          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={2}
            placeholder="O que você descobriu sobre este cliente"
            className="min-w-0 flex-1 resize-none rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400"
          />

          <button
            type="button"
            onClick={gravar}
            disabled={texto.trim() === "" || gravando}
            className="shrink-0 rounded-xl bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-40"
          >
            {gravando ? "Salvando…" : "Anotar"}
          </button>

        </div>

      )}

      {/*
        A nota do Wootric é reescrita, não acumulada.

        Sem este aviso, quem apagasse uma nota lá e visse ela voltar na
        importação seguinte concluiria que a plataforma guarda cópia.
        Ela não guarda: espelha.
      */}
      {doWootric.length > 0 && (
        <p className="mt-2 text-[10px] leading-relaxed text-zinc-400">
          As anotações do Wootric são espelhadas a cada
          importação — apagar lá some daqui. As escritas
          aqui são nossas e ficam.
        </p>
      )}

    </div>
  );
}
