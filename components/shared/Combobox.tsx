"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Check, ChevronDown, Loader2, Pencil, Plus, Search, X } from "lucide-react";

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

  /**
   * Criar ali mesmo. Com isto, a busca que não acha um nome igual oferece
   * "Criar “…”". Devolve o valor criado — que já fica escolhido — ou
   * `null` quando o servidor recusou (quem chama avisa o porquê).
   */
  onCriar?: (texto: string) => Promise<string | null>;

  /** Renomear ali mesmo: o lápis de cada item. Devolve se o servidor aceitou. */
  onRenomear?: (value: string, nome: string) => Promise<boolean>;

  /** "categoria", "estabelecimento" — no botão de criar. */
  nomeDoItem?: string;
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

/** O valor do "Criar" na navegação por teclado — nenhum id real começa assim. */
const CRIAR = "__criar__";

/** Teto de itens desenhados. Além disso, refine a busca. */
const MOSTRAR = 80;

/** Os diacríticos combinantes do Unicode — o que "NFD" separa da letra. */
const ACENTOS = /[\u0300-\u036f]/g;

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
  onCriar,
  onRenomear,
  nomeDoItem,
}: Props) {

  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [ativo, setAtivo] = useState(0);

  /* Criar e renomear esperam o servidor: nada aparece como feito antes da resposta. */
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [nomeEditado, setNomeEditado] = useState("");
  const [renomeando, setRenomeando] = useState(false);

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

  /* "Criar" só quando o que foi digitado ainda não existe — nome igual, sem acento e caixa. */
  const digitado = term.trim().replace(/\s+/g, " ");
  const podeCriar =
    Boolean(onCriar) &&
    digitado.length >= 2 &&
    !itens.some((i) => normalizar(i.label) === normalizar(digitado));

  /* A opção vazia e o "Criar" entram na navegação como se fossem itens. */
  const navegaveis = [
    ...(emptyLabel ? [{ value: "", label: emptyLabel }] : []),
    ...visiveis,
    ...(podeCriar ? [{ value: CRIAR, label: digitado }] : []),
  ];

  /**
   * Digitou, abriu ou fechou: o destaque volta para o primeiro.
   *
   * No render, e não num efeito. Era `useEffect(() => setAtivo(0), …)`,
   * que só corrige **depois** de a lista nova ter sido pintada — existe
   * um quadro em que a busca já filtrou e o destaque ainda está no
   * índice de antes, apontando para outro item. Quem navega com o
   * teclado e aperta Enter rápido escolhe o item errado.
   *
   * Ajustar durante o render faz o React refazer antes de mostrar.
   */
  const chaveDaLista = `${term}|${open}`;

  const [chaveDesenhada, setChaveDesenhada] =
    useState(chaveDaLista);

  if (chaveDesenhada !== chaveDaLista) {
    setChaveDesenhada(chaveDaLista);
    setAtivo(0);
  }

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
    if (v === CRIAR) {
      void criar();
      return;
    }
    onChange(v);
    setOpen(false);
    setTerm("");
  }

  async function criar() {
    if (!onCriar || criando) return;
    setCriando(true);
    const criado = await onCriar(digitado).catch(() => null);
    setCriando(false);
    if (criado === null) return;
    onChange(criado);
    setOpen(false);
    setTerm("");
  }

  function editar(item: Opcao) {
    setEditando(item.value);
    setNomeEditado(item.label);
  }

  async function renomear() {
    const nome = nomeEditado.trim().replace(/\s+/g, " ");
    const atual = itens.find((i) => i.value === editando);
    if (!onRenomear || !editando || renomeando) return;
    if (!atual || nome.length < 2 || nome === atual.label) {
      setEditando(null);
      return;
    }
    setRenomeando(true);
    const ok = await onRenomear(editando, nome).catch(() => false);
    setRenomeando(false);
    if (ok) setEditando(null);
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
      setEditando(null);
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
            onClick={() => {
              setOpen(false);
              setEditando(null);
            }}
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

                if (editando === item.value) {
                  return (
                    <li key={item.value} className="flex items-center gap-1 px-1 py-0.5">
                      <input
                        autoFocus
                        value={nomeEditado}
                        onChange={(e) => setNomeEditado(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void renomear();
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            setEditando(null);
                          }
                        }}
                        disabled={renomeando}
                        aria-label={`Novo nome de ${item.label}`}
                        className="h-8 min-w-0 flex-1 rounded-lg bg-white px-2.5 text-sm outline-none ring-1 ring-violet-300 focus:ring-2 focus:ring-violet-200"
                      />
                      <button
                        type="button"
                        onClick={() => void renomear()}
                        disabled={renomeando}
                        title="Salvar o nome (Enter)"
                        className="flex h-8 items-center gap-1 rounded-lg bg-violet-700 px-2.5 text-xs font-medium text-white transition-colors hover:bg-violet-800 disabled:opacity-60"
                      >
                        {renomeando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        Salvar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditando(null)}
                        title="Cancelar (Esc)"
                        aria-label="Cancelar"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                      >
                        <X size={13} />
                      </button>
                    </li>
                  );
                }

                return (
                  <li key={item.value} className="group relative">
                    <button
                      type="button"
                      role="option"
                      aria-selected={item.value === value}
                      onMouseEnter={() => setAtivo(indice)}
                      onClick={() => escolher(item.value)}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                        ativo === indice ? "bg-zinc-100" : ""
                      } ${item.value === value ? "font-medium text-violet-800" : "text-zinc-700"} ${onRenomear ? "pr-10" : ""}`}
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

                    {onRenomear && (
                      <button
                        type="button"
                        onClick={() => editar(item)}
                        title={`Renomear ${item.label}`}
                        aria-label={`Renomear ${item.label}`}
                        className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 opacity-0 transition-opacity hover:bg-white hover:text-violet-700 focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                  </li>
                );
              })}

              {podeCriar && (
                <li>
                  <button
                    type="button"
                    onMouseEnter={() => setAtivo(navegaveis.length - 1)}
                    onClick={() => void criar()}
                    disabled={criando}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-violet-800 transition-colors disabled:opacity-60 ${
                      ativo === navegaveis.length - 1 ? "bg-violet-50" : ""
                    }`}
                  >
                    {criando ? <Loader2 size={14} className="shrink-0 animate-spin" /> : <Plus size={14} className="shrink-0" />}
                    <span className="min-w-0 truncate">
                      {criando ? "Criando" : "Criar"}{nomeDoItem ? ` ${nomeDoItem}` : ""} “{digitado}”
                    </span>
                  </button>
                </li>
              )}

              {filtradas.length === 0 && !podeCriar && (
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
