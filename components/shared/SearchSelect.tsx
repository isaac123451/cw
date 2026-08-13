"use client";

import { useMemo, useRef, useState } from "react";

import { Check, ChevronDown, Search, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: string[];

  /** Texto do estado "sem filtro" — ex.: "Todos os clientes". */
  allLabel: string;

  title?: string;
}

/**
 * Seletor de lista longa, com busca.
 *
 * O `<select>` nativo dava conta de 6 status, mas não dos 287 clientes da
 * base: além de despejar 287 nós no DOM, obrigava a rolar a lista inteira
 * atrás de um nome. Aqui a lista só monta quando abre, filtra por
 * digitação e corta no que cabe na tela.
 */
const MOSTRAR = 60;

export default function SearchSelect({
  value,
  onChange,
  options,
  allLabel,
  title,
}: Props) {

  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");

  const campo = useRef<HTMLInputElement>(null);

  const filtradas = useMemo(() => {

    const busca = term.trim().toLowerCase();

    if (!busca) return options;

    return options.filter((item) =>
      item.toLowerCase().includes(busca)
    );

  }, [options, term]);

  const visiveis = filtradas.slice(0, MOSTRAR);

  const ocultas = filtradas.length - visiveis.length;

  function abrir() {
    setOpen((estado) => !estado);
    setTerm("");

    // Foco no campo de busca: a lista é longa, digitar é o caminho.
    requestAnimationFrame(() => campo.current?.focus());
  }

  function escolher(item: string) {
    onChange(item);
    setOpen(false);
  }

  return (
    <div className="relative">

      <button
        onClick={abrir}
        title={title}
        className={`flex h-10 max-w-56 items-center gap-1.5 rounded-xl border px-3 text-sm transition-colors ${value ? "border-violet-300 bg-violet-50 text-violet-800" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"}`}
      >

        <span className="min-w-0 flex-1 truncate text-left">
          {value || allLabel}
        </span>

        {value ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="Limpar filtro"
            onClick={(event) => {
              event.stopPropagation();
              onChange("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.stopPropagation();
                onChange("");
              }
            }}
            className="shrink-0 rounded-md p-0.5 text-violet-500 transition-colors hover:bg-violet-100 hover:text-violet-800"
          >
            <X size={13} />
          </span>
        ) : (
          <ChevronDown
            size={13}
            className="shrink-0 opacity-60"
          />
        )}

      </button>

      {open && (

        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-72 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_12px_32px_-12px_rgba(16,24,40,0.25)]">

            <div className="relative border-b border-zinc-100 p-2">

              <Search
                size={14}
                className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400"
              />

              <input
                ref={campo}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Buscar..."
                className="h-9 w-full rounded-xl bg-zinc-50 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:bg-white focus:ring-1 focus:ring-violet-300"
              />

            </div>

            <ul className="max-h-72 overflow-y-auto p-1.5">

              <li>
                <button
                  onClick={() => escolher("")}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${value === "" ? "bg-violet-50 font-medium text-violet-800" : "text-zinc-600 hover:bg-zinc-50"}`}
                >
                  {allLabel}

                  {value === "" && <Check size={14} />}
                </button>
              </li>

              {visiveis.map((item) => (

                <li key={item}>
                  <button
                    onClick={() => escolher(item)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${item === value ? "bg-violet-50 font-medium text-violet-800" : "text-zinc-700 hover:bg-zinc-50"}`}
                  >
                    <span className="min-w-0 truncate">
                      {item}
                    </span>

                    {item === value && (
                      <Check
                        size={14}
                        className="shrink-0"
                      />
                    )}
                  </button>
                </li>

              ))}

              {filtradas.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-zinc-400">
                  Nada encontrado.
                </li>
              )}

            </ul>

            {ocultas > 0 && (
              <p className="border-t border-zinc-100 bg-zinc-50/60 px-4 py-2 text-[11px] text-zinc-500">
                Mostrando {visiveis.length} de{" "}
                {filtradas.length} — refine a busca.
              </p>
            )}

          </div>
        </>

      )}

    </div>
  );
}
