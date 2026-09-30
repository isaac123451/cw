"use client";

import { useState } from "react";

import { ChevronDown, Loader2, Sparkles } from "lucide-react";

import { modelosParaOCaso } from "@/lib/actions/respostaEResultado";

type Modelo = { id: string; protocolo: string; nota: number | null; texto: string };

/**
 * As suas melhores viram modelo (Fase 29, 1.109): na hora de escrever a
 * resposta pública, as que levaram a "resolvido" com nota alta em
 * reclamações do mesmo tipo. Só busca quando alguém abre — a ficha não
 * paga a consulta a cada visita. "Usar como base" troca o `{nome}` pelo
 * primeiro nome deste cliente e põe no rascunho; o texto ainda precisa
 * ser o deste caso.
 */
export default function ModelosQueFuncionaram({ caseId, cliente, aoUsar }: { caseId: string; cliente: string; aoUsar: (texto: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState<{ categoria: string | null; modelos: Modelo[] } | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function abrir() {
    const vai = !aberto;
    setAberto(vai);
    if (!vai || dados || carregando) return;
    setCarregando(true);
    const r = await modelosParaOCaso(caseId);
    setCarregando(false);
    if (r.ok) setDados({ categoria: r.categoria, modelos: r.modelos });
    else setErro(r.erro);
  }

  const primeiroNome = cliente.trim().split(/\s+/)[0] ?? "";

  return (
    <div className="mt-2">
      <button type="button" onClick={abrir} aria-expanded={aberto} className="flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-violet-700">
        <Sparkles size={12} className="text-emerald-600" />
        Respostas que funcionaram neste tipo de reclamação
        <ChevronDown size={12} className={`transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>
      {aberto && (
        <div className="mt-2 space-y-2">
          {carregando && (
            <p className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Loader2 size={12} className="animate-spin" /> Buscando…
            </p>
          )}
          {erro && <p className="text-xs text-rose-700">{erro}</p>}
          {dados && !dados.categoria && <p className="text-xs text-zinc-500">Classifique a reclamação (categoria) para ver as respostas que funcionaram no mesmo tipo.</p>}
          {dados?.categoria && dados.modelos.length === 0 && <p className="text-xs text-zinc-500">Ainda nenhuma resposta resolvida com nota 8 ou mais em {dados.categoria}.</p>}
          {dados?.modelos.map((m) => (
            <div key={m.id} className="rounded-xl bg-emerald-50/40 ring-1 ring-inset ring-emerald-100">
              <div className="flex items-center justify-between gap-2 px-3 pt-2 text-[11px] text-zinc-500">
                <span>
                  {m.protocolo} · nota {m.nota ?? "—"} · {dados.categoria}
                </span>
                <button
                  type="button"
                  onClick={() => aoUsar(m.texto.replaceAll("{nome}", primeiroNome))}
                  className="rounded-md bg-white px-2 py-1 font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-50"
                >
                  Usar como base
                </button>
              </div>
              <p className="max-h-32 overflow-y-auto whitespace-pre-wrap px-3 py-2 text-xs leading-relaxed text-zinc-700">{m.texto}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
