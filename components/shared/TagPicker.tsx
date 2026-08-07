"use client";

import { useState } from "react";

import { Check, Plus, Tag as TagIcon } from "lucide-react";

import { useSettings } from "@/lib/context/SettingsContext";

interface Props {
  selected: string[];
  onToggle: (tag: string) => void;
}

/** Aplica ou remove etiquetas de um caso. */
export default function TagPicker({
  selected,
  onToggle,
}: Props) {

  const { tags } = useSettings();

  const [open, setOpen] = useState(false);

  const active = tags.filter((item) => item.active);

  return (
    <div className="relative">

      <button
        onClick={() => setOpen((value) => !value)}
        title="Aplicar etiquetas ao caso"
        className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
      >
        <TagIcon size={15} />
        Etiquetas
        {selected.length > 0 && (
          <span className="rounded-full bg-violet-100 px-1.5 text-[11px] font-semibold text-violet-700">
            {selected.length}
          </span>
        )}
      </button>

      {open && (

        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-72 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_12px_32px_-12px_rgba(16,24,40,0.25)]">

            <p className="border-b border-zinc-100 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Etiquetas disponíveis
            </p>

            <ul className="max-h-72 overflow-y-auto p-1.5">

              {active.map((tag) => {

                const on = selected.includes(tag.name);

                return (
                  <li key={tag.id}>

                    <button
                      onClick={() => onToggle(tag.name)}
                      title={tag.description}
                      className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors ${
                        on
                          ? "bg-violet-50"
                          : "hover:bg-zinc-50"
                      }`}
                    >

                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                          on
                            ? "border-violet-700 bg-violet-700 text-white"
                            : "border-zinc-300"
                        }`}
                      >
                        {on && <Check size={11} />}
                      </span>

                      <span className="min-w-0">

                        <span className="flex items-center gap-1.5">

                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: tag.color }}
                          />

                          <span className="text-sm font-medium text-zinc-800">
                            {tag.name}
                          </span>

                        </span>

                        <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">
                          {tag.description}
                        </span>

                      </span>

                    </button>

                  </li>
                );
              })}

              {active.length === 0 && (
                <li className="px-3 py-6 text-center text-xs text-zinc-400">
                  Nenhuma etiqueta ativa. Crie em Configurar
                  fluxo → Tags.
                </li>
              )}

            </ul>

          </div>
        </>

      )}

    </div>
  );
}

/** Exibição compacta das etiquetas de um caso. */
export function TagChips({
  tags,
  limit = 3,
}: {
  tags: string[];
  limit?: number;
}) {

  const { tags: catalog } = useSettings();

  if (tags.length === 0) return null;

  const colorOf = (name: string) =>
    catalog.find((item) => item.name === name)?.color ??
    "#71717A";

  const shown = tags.slice(0, limit);

  const rest = tags.length - shown.length;

  return (
    <div className="flex flex-wrap items-center gap-1">

      {shown.map((tag) => (

        <span
          key={tag}
          title={tag}
          className="inline-flex max-w-[140px] items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
          style={{
            background: `${colorOf(tag)}18`,
            color: colorOf(tag),
          }}
        >
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: colorOf(tag) }}
          />
          <span className="truncate">{tag}</span>
        </span>

      ))}

      {rest > 0 && (
        <span
          className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500"
          title={tags.slice(limit).join(", ")}
        >
          +{rest}
        </span>
      )}

    </div>
  );
}
