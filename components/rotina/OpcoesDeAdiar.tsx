"use client";

import { useState } from "react";

import { ADIAR_NO_MAXIMO_DIAS, ateDoAdiamento, diaCurtoDaMarca, opcoesDeAdiar } from "@/lib/models/meuDia";
import { useSla } from "@/lib/context/SlaContext";
import { paredeDe } from "@/lib/services/horasUteis";

/**
 * As escolhas do "Adiar para outro dia", para dentro de um menu.
 *
 * Amanhã e o próximo dia útil com um clique, cada um dizendo o dia; ou
 * uma data, até 90 dias. O item some até a véspera e volta sozinho.
 */
export default function OpcoesDeAdiar({ id, onAdiar }: { id: string; onAdiar: (volta: string) => void }) {

  const { expediente } = useSla();
  const hoje = paredeDe(new Date()).dia;
  const [data, setData] = useState("");

  const minimo = opcoesDeAdiar(hoje, expediente)[0].volta;
  const maximo = new Date(Date.parse(`${hoje}T00:00:00Z`) + ADIAR_NO_MAXIMO_DIAS * 86_400_000).toISOString().slice(0, 10);
  const valida = data !== "" && ateDoAdiamento(hoje, data) !== null;

  return (
    <div>
      <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Adiar — volta sozinho</p>
      {opcoesDeAdiar(hoje, expediente).map((o) => (
        <button
          key={o.id}
          type="button"
          role="menuitem"
          onClick={() => onAdiar(o.volta)}
          className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
        >
          {o.rotulo}
          <span className="tabular-nums text-zinc-400">{diaCurtoDaMarca(o.volta)}</span>
        </button>
      ))}
      <form
        className="flex items-center gap-1 px-1.5 pb-1 pt-0.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (valida) onAdiar(data);
        }}
      >
        <label htmlFor={`${id}-data`} className="sr-only">
          Voltar em
        </label>
        <input
          id={`${id}-data`}
          type="date"
          value={data}
          min={minimo}
          max={maximo}
          onChange={(e) => setData(e.target.value)}
          className="h-7 min-w-0 flex-1 rounded-md border border-zinc-200 px-1.5 text-xs text-zinc-700 outline-none focus:border-violet-400"
        />
        <button type="submit" disabled={!valida} className="h-7 shrink-0 rounded-md bg-zinc-900 px-2 text-[11px] font-semibold text-white disabled:opacity-40">
          Adiar
        </button>
      </form>
    </div>
  );
}
