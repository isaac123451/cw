"use client";

import { useState } from "react";

import { marcarAvaliacao } from "@/lib/actions/tratativa";
import { ajustarCasoNaTela } from "@/lib/context/ajusteDoCaso";
import type { Case } from "@/lib/models/case";
import { classeDaAvaliacao, MARCADO_PELA_IA, ROTULO_DA_ORIGEM } from "@/lib/models/classeDaAvaliacao";

/**
 * Positiva ou negativa, na ficha (21/10/2026): "quando for possível ver,
 * ter uma opção de marcar avaliação positiva". Grava na hora, pela ação —
 * a marca não é campo do formulário e não espera o "Salvar".
 */
export default function MarcaDaAvaliacao({ caso }: { caso: Case }) {
  const [ajuste, setAjuste] = useState<Partial<Case>>({});
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const c = { ...caso, ...ajuste };
  const classe = classeDaAvaliacao(c);
  if (!classe) return null;

  async function marcar(marca: "positiva" | "negativa") {
    const tirar = c.avaliacaoMarca === marca && c.avaliacaoMarcaPor !== MARCADO_PELA_IA;
    setGravando(true);
    setErro(null);
    const r = await marcarAvaliacao({ protocol: c.protocol, marca: tirar ? null : marca });
    setGravando(false);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    const campos: Partial<Case> = tirar
      ? { avaliacaoMarca: undefined, avaliacaoMarcaPor: undefined, avaliacaoMarcaEm: undefined, avaliacaoMarcaMotivo: undefined }
      : { avaliacaoMarca: marca, avaliacaoMarcaPor: r.por, avaliacaoMarcaEm: r.em, avaliacaoMarcaMotivo: undefined };
    setAjuste((a) => ({ ...a, ...campos }));
    ajustarCasoNaTela(c.protocol, campos);
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {(["positiva", "negativa"] as const).map((m) => {
          const ativa = classe.classe === m;
          const cor = m === "positiva" ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-rose-50 text-rose-800 ring-rose-200";
          return (
            <button
              key={m}
              type="button"
              disabled={gravando}
              onClick={() => void marcar(m)}
              aria-pressed={ativa}
              className={`rounded-full px-2.5 py-1 font-medium ring-1 ring-inset transition-colors disabled:opacity-50 ${ativa ? cor : "text-zinc-500 ring-zinc-200 hover:bg-zinc-50 hover:text-zinc-800"}`}
              title={ativa && classe.origem === "voce" ? "Clique para tirar a sua marca" : `Marcar a avaliação como ${m}`}
            >
              Avaliação {m}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-xs text-zinc-400">
        {classe.classe === "neutra" ? "Neutra pela nota — marque se for o caso." : `${ROTULO_DA_ORIGEM[classe.origem].replace(/^./, (l) => l.toUpperCase())}`}
        {classe.origem === "voce" && c.avaliacaoMarcaPor ? ` · ${c.avaliacaoMarcaPor}` : ""}
        {classe.origem === "ia" && c.avaliacaoMarcaMotivo ? ` — ${c.avaliacaoMarcaMotivo}` : ""}
      </p>
      {c.consideracaoFinal && <p className="mt-1.5 text-xs italic text-zinc-600">“{c.consideracaoFinal}”</p>}
      {erro && <p className="mt-1 text-xs text-rose-700">{erro}</p>}
    </div>
  );
}
