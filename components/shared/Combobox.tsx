"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Check, ChevronDown, Search } from "lucide-react";

export interface Opcao {
  value: string;
  label: string;

  /** Segunda linha, para desambiguar homônimos. */
  hint?: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;

  /** Aceita a lista curta (só rótulos) ou pares valor/rótulo. */
  options: (string | Opcao)[];

  /** O que aparece quando nada está escolhido. */
  placeholder?: string;

  /** Rótulo da opção vazia. Ausente, escolher nada não é possível. */
  emptyLabel?: string;

  disabled?: boolean;
  id?: string;
  title?: string;

  /** Largura do menu. A do botão é sempre a do campo. */
  menuWidth?: string;
}

/**
 * Campo de escolha com busca, para formulário.
 *
 * O `<select>` nativo dá conta de seis status. Não dá conta dos **239
 * estabelecimentos** — e é exatamente onde o Isaac travou: "é preciso que
 * quando for adicionar alguma informação tipo estabelecimento para
 * selecionar na reclamação seja possível pesquisar, existe muitas caixas
 * cruas e que não é possível pesquisar".
 *
 * Uma lista nativa de 239 itens não é só feia: ela obriga a rolar atrás
 * de um nome que a pessoa já sabe de cor. Digitar três letras é o gesto
 * natural, e o `<select>` não tem onde recebê-las.
 *
 * **É irmão do `SearchSelect`, não substituto.** Aquele é um filtro de
 * barra de ferramentas — botão estreito, estado "Todos", limpar com um
 * X. Este é um campo de formulário: ocupa a largura do campo, tem
 * placeholder e obedece a `disabled`. Juntar os dois num componente só
 * daria um que faz as duas coisas mal.
 *
 * Teclado: setas navegam, Enter escolhe, Esc fecha. Um campo que só
 * responde a mouse é um campo que atrasa quem digita rápido — e quem
 * preenche cinquenta reclamações por dia digita rápido.
 */

/** Teto de itens desenhados. Além disso, refine a busca. */
const MOSTRAR = 80;

/** Os diacríticos combinantes do Unicode — o que "NFD" separa da letra. */
const ACENTOS = /[̀-ͯ]/g;

function normalizar(v: string) {
  return v
    .normalize("NFD")
    .replace(ACENTOS, "")
    .toLowerCase();
}

export default function Combobox({
  value,
  onChange,
  options,
  placeholder = "Selecionar…",
  emptyLabel,
  disabled = false,
  id,
  title,
  menuWidth = "w-full min-w-64",
}: Props) {

  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [ativo, setAtivo] = useState(0);

  const campo = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);

  const itens = useMemo<Opcao[]>(
    () =>
      options.map((o) =>
        typeof o === "string"
          ? { value: o, label: o }
          : o
      ),
    [options]
  );

  const filtradas = useMemo(() => {

    const busca = normalizar(term.trim());

    if (!busca) return itens;

    return itens.filter(
      (item) =>
        normalizar(item.label).includes(busca) ||
        normalizar(item.hint ?? "").includes(busca)
    );
  }, [itens, term]);

  const visiveis = filtradas.slice(0, MOSTRAR);
  const ocultas = filtradas.length - visiveis.length;

  const escolhida = itens.find((i) => i.value === value);

  /* A opção vazia entra na navegação como se fosse item. */
  const navegaveis = emptyLabel
    ? [{ value: "", label: emptyLabel }, ...visiveis]
    : visiveis;

  useEffect(() => {
    setAtivo(0);
  }, [term, open]);

  /**
   * O item destacado precisa estar visível.
   *
   * Sem isto, descer com a seta passa do fim da área rolável e o
   * destaque some — a pessoa continua navegando às cegas.
   */
  useEffect(() => {

    if (!open) return;

    lista.current
      ?.querySelectorAll("li")
      [ativo]?.scrollIntoView({ block: "nearest" });

  }, [ativo, open]);

  function abrir() {
    if (disabled) return;

    setOpen(true);
    setTerm("");

    requestAnimationFrame(() => campo.current?.focus());
  }

  function escolher(v: string) {
    onChange(v);
    setOpen(false);
    setTerm("");
  }

  function teclado(
    e: React.KeyboardEvent<HTMLInputElement>
  ) {

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivo((i) =>
        Math.min(i + 1, navegaveis.length - 1)
      );
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((i) => Math.max(i - 1, 0));
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();

      const alvo = navegaveis[ativo];

      if (alvo) escolher(alvo.value);
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="relative">

      <button
        type="button"
        id={id}
        title={title}
        disabled={disabled}
        onClick={abrir}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex h-11 w-full items-center gap-2 rounded-xl border px-3.5 text-left text-sm transition-colors ${
          disabled
            ? "cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-400"
            : open
              ? "border-violet-400 bg-white text-zinc-900 ring-2 ring-violet-100"
              : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300"
        }`}
      >

        <span
          className={`min-w-0 flex-1 truncate ${escolhida ? "" : "text-zinc-400"}`}
        >
          {escolhida?.label ?? placeholder}
        </span>

        <ChevronDown
          size={15}
          className={`shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
        />

      </button>

      {open && (

        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          <div
            className={`absolute left-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_12px_32px_-12px_rgba(16,24,40,0.25)] ${menuWidth}`}
          >

            <div className="relative border-b border-zinc-100 p-2">

              <Search
                size={14}
                className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400"
              />

              <input
                ref={campo}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onKeyDown={teclado}
                placeholder="Buscar…"
                className="h-9 w-full rounded-xl bg-zinc-50 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:bg-white focus:ring-1 focus:ring-violet-300"
              />

            </div>

            <ul
              ref={lista}
              role="listbox"
              className="max-h-72 overflow-y-auto p-1.5"
            >

              {emptyLabel && (
                <li>
                  <button
                    type="button"
                    onMouseEnter={() => setAtivo(0)}
                    onClick={() => escolher("")}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                      ativo === 0
                        ? "bg-zinc-100"
                        : ""
                    } ${value === "" ? "font-medium text-violet-800" : "text-zinc-500"}`}
                  >
                    {emptyLabel}
                    {value === "" && <Check size={14} />}
                  </button>
                </li>
              )}

              {visiveis.map((item, i) => {

                const indice = emptyLabel ? i + 1 : i;

                return (
                  <li key={item.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={item.value === value}
                      onMouseEnter={() => setAtivo(indice)}
                      onClick={() => escolher(item.value)}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                        ativo === indice ? "bg-zinc-100" : ""
                      } ${item.value === value ? "font-medium text-violet-800" : "text-zinc-700"}`}
                    >

                      <span className="min-w-0">

                        <span className="block truncate">
                          {item.label}
                        </span>

                        {item.hint && (
                          <span className="mt-0.5 block truncate text-[11px] text-zinc-400">
                            {item.hint}
                          </span>
                        )}

                      </span>

                      {item.value === value && (
                        <Check
                          size={14}
                          className="shrink-0"
                        />
                      )}

                    </button>
                  </li>
                );
              })}

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
