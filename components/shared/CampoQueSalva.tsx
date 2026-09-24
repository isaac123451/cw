"use client";

import { useEffect, useRef, useState } from "react";

import { Check, Loader2, RotateCcw, TriangleAlert } from "lucide-react";

type Resultado = { ok: true } | { ok: false; erro: string };

interface Props {
  id: string;
  rotulo: string;
  valor: string;
  placeholder?: string;
  /** Grava o valor novo; a tela só diz "salvo" depois de o servidor confirmar. */
  onSalvar: (novo: string) => Promise<Resultado>;
  /** Tamanho máximo do texto. */
  maximo?: number;
  className?: string;
}

/**
 * Um campo que grava sozinho ao sair dele — o "salvar sem botão".
 *
 * O Isaac: "botão de salvar às vezes não é muito interessante, pense em
 * uma forma melhor de salvar". Para um campo solto, o botão é um passo a
 * mais que se esquece. Aqui: sair do campo (ou Enter) grava; ao lado
 * aparece "salvando…", depois "salvo · desfazer" por alguns segundos;
 * se o servidor recusar, o erro fica no próprio campo com "tentar de
 * novo", e o texto digitado não se perde. Cadastros de vários campos
 * continuam com a barra de Salvar.
 */
export default function CampoQueSalva({ id, rotulo, valor, placeholder, onSalvar, maximo = 200, className = "" }: Props) {

  const [texto, setTexto] = useState(valor);
  const [estado, setEstado] = useState<"parado" | "salvando" | "salvo" | "erro">("parado");
  const [erro, setErro] = useState("");
  const anterior = useRef(valor);
  const gravado = useRef(valor);
  const relogio = useRef<number | null>(null);

  useEffect(() => () => {
    if (relogio.current) window.clearTimeout(relogio.current);
  }, []);

  async function gravar(novo: string, ehDesfazer = false) {
    const limpo = novo.trim().slice(0, maximo);
    if (!ehDesfazer && (limpo === "" || limpo === gravado.current)) return;
    setEstado("salvando");
    try {
      const r = await onSalvar(limpo);
      if (!r.ok) {
        setErro(r.erro);
        setEstado("erro");
        return;
      }
      if (!ehDesfazer) anterior.current = gravado.current;
      gravado.current = limpo;
      setTexto(limpo);
      setEstado(ehDesfazer ? "parado" : "salvo");
      if (relogio.current) window.clearTimeout(relogio.current);
      if (!ehDesfazer) relogio.current = window.setTimeout(() => setEstado("parado"), 8000);
    } catch {
      setErro("Não foi gravado. Confira a conexão.");
      setEstado("erro");
    }
  }

  return (
    <div className={className}>
      <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
        {rotulo}
      </label>
      <div className="mt-1 flex items-center gap-2">
        <input
          id={id}
          value={texto}
          maxLength={maximo}
          placeholder={placeholder}
          onChange={(e) => {
            setTexto(e.target.value);
            if (estado === "erro" || estado === "salvo") setEstado("parado");
          }}
          onBlur={() => gravar(texto)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setTexto(gravado.current);
              e.currentTarget.blur();
            }
          }}
          aria-invalid={estado === "erro"}
          className={`h-9 min-w-0 flex-1 rounded-lg border px-2.5 text-sm outline-none transition-colors placeholder:text-zinc-400 ${
            estado === "erro" ? "border-rose-300 focus:border-rose-400" : "border-zinc-200 focus:border-violet-400"
          }`}
        />
        <span aria-live="polite" className="flex shrink-0 items-center gap-1 text-[11px]">
          {estado === "salvando" && (
            <span className="flex items-center gap-1 text-zinc-500">
              <Loader2 size={12} className="animate-spin" /> salvando…
            </span>
          )}
          {estado === "salvo" && (
            <>
              <span className="flex items-center gap-1 text-emerald-700">
                <Check size={12} strokeWidth={2.5} /> salvo
              </span>
              <button
                type="button"
                onClick={() => gravar(anterior.current, true)}
                className="flex items-center gap-0.5 rounded px-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
              >
                <RotateCcw size={11} /> desfazer
              </button>
            </>
          )}
        </span>
      </div>
      {estado === "erro" && (
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-rose-700">
          <TriangleAlert size={12} /> {erro}
          <button type="button" onClick={() => gravar(texto)} className="font-semibold underline-offset-2 hover:underline">
            tentar de novo
          </button>
        </p>
      )}
    </div>
  );
}
