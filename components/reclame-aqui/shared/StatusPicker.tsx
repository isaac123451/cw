"use client";

import { useState } from "react";

import { Check, ChevronDown } from "lucide-react";

import { useWorkflow } from "@/lib/context/WorkflowContext";
import { hintOf, toneOf } from "@/lib/services/status.service";

interface Props {
  value: string;
  onChange: (status: string) => void;
  /** compact usa o tamanho de célula de tabela. */
  size?: "compact" | "normal";
}

/**
 * Muda o status do caso sem precisar arrastar no Kanban.
 * As opções vêm do fluxo configurado em Configurar fluxo.
 */
export default function StatusPicker({
  value,
  onChange,
  size = "normal",
}: Props) {

  const { workflow } = useWorkflow();

  const [open, setOpen] = useState(false);

  const options = workflow
    .filter((item) => item.active)
    .sort((a, b) => a.order - b.order);

  const compact = size === "compact";

  return (
    <div className="relative">

      <button
        onClick={(event) => {
          // Na lista a linha inteira é clicável — não abrir o caso junto.
          event.stopPropagation();
          setOpen((state) => !state);
        }}
        title={hintOf(value)}
        className={`flex items-center gap-1 whitespace-nowrap rounded-full font-medium ring-1 ring-inset transition-colors hover:brightness-95 ${toneOf(
          value
        )} ${
          compact
            ? "px-2.5 py-1 text-[11px]"
            : "px-3 py-1.5 text-xs"
        }`}
      >
        {value}

        <ChevronDown
          size={compact ? 11 : 13}
          className="opacity-60"
        />
      </button>

      {open && (

        <>
          <div
            className="fixed inset-0 z-40"
            onClick={(event) => {
              event.stopPropagation();
              setOpen(false);
            }}
          />

          <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-64 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_12px_32px_-12px_rgba(16,24,40,0.25)]">

            <p className="border-b border-zinc-100 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Mover para
            </p>

            <ul className="max-h-72 overflow-y-auto p-1.5">

              {options.map((item) => {

                const active = item.name === value;

                return (
                  <li key={item.id}>

                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onChange(item.name);
                        setOpen(false);
                      }}
                      title={hintOf(item.name)}
                      className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors ${
                        active
                          ? "bg-violet-50"
                          : "hover:bg-zinc-50"
                      }`}
                    >

                      <span
                        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: item.color }}
                      />

                      <span className="min-w-0 flex-1">

                        <span className="block text-sm font-medium text-zinc-800">
                          {item.name}
                        </span>

                        <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">
                          {hintOf(item.name)}
                        </span>

                      </span>

                      {active && (
                        <Check
                          size={14}
                          className="mt-0.5 shrink-0 text-violet-700"
                        />
                      )}

                    </button>

                  </li>
                );
              })}

            </ul>

          </div>
        </>

      )}

    </div>
  );
}
