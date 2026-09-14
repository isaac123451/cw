"use client";

import { useState } from "react";

import { Pencil, RotateCcw } from "lucide-react";

import BotaoCopiar from "@/components/shared/BotaoCopiar";

/**
 * Texto que a plataforma monta e a pessoa ajusta antes de copiar.
 *
 * O Isaac, com o print do checkpoint: "importante também se der para
 * editar o texto, para digitar". A mensagem pronta é o ponto de
 * partida — quem manda no Slack ou no WhatsApp quer acrescentar o que
 * só ela sabe. O Copiar leva o que está no campo; "Voltar ao texto
 * gerado" desfaz a edição e traz de volta a versão calculada (que
 * continua acompanhando os números enquanto ninguém edita).
 */
export default function TextoEditavel({
  gerado,
  rotulo = "Copiar",
  linhasMinimas = 4,
  className = "",
  aoCopiar,
}: {
  gerado: string;
  rotulo?: string;
  linhasMinimas?: number;
  className?: string;
  aoCopiar?: () => void;
}) {

  const [editado, setEditado] = useState<string | null>(null);
  const texto = editado ?? gerado;
  const mexeu = editado !== null && editado !== gerado;

  return (
    <div className={className}>
      <textarea
        value={texto}
        onChange={(e) => setEditado(e.target.value)}
        rows={linhasMinimas}
        spellCheck
        className="w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 text-[13px] leading-relaxed text-zinc-800 outline-none transition-colors [field-sizing:content] focus:border-violet-400 focus:bg-white"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <BotaoCopiar texto={texto} rotulo={rotulo} aoCopiar={aoCopiar} />
        {mexeu && (
          <button
            type="button"
            onClick={() => setEditado(null)}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <RotateCcw size={13} /> Voltar ao texto gerado
          </button>
        )}
        <span className="text-[11px] text-zinc-400">
          {mexeu ? "Editado — o Copiar leva o seu texto." : "Dá para editar antes de copiar."}
        </span>
      </div>
    </div>
  );
}

/**
 * O botão de copiar de um clique, com um lápis ao lado que abre o texto
 * num balão para editar antes. Para os lugares em que a mensagem não
 * aparece na tela — o aviso ao cliente, o pedido ao gestor, ao
 * financeiro. O balão flutua sobre a tela, sem mexer no que está em
 * volta, e fecha no X ou no Esc.
 */
export function CopiarOuEditar({
  texto,
  rotulo = "Copiar",
  className = "",
}: {
  texto: string;
  rotulo?: string;
  className?: string;
}) {

  const [aberto, setAberto] = useState(false);

  return (
    <span className="relative inline-flex items-center gap-1.5">
      <BotaoCopiar texto={texto} rotulo={rotulo} className={className} />
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        title="Ver e editar antes de copiar"
        className={`flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-medium ring-1 ring-inset transition-colors ${
          aberto ? "bg-violet-50 text-violet-800 ring-violet-200" : "bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50"
        }`}
      >
        <Pencil size={12} /> Editar
      </button>
      {aberto && (
        <span
          role="dialog"
          aria-label={rotulo}
          onKeyDown={(e) => e.key === "Escape" && setAberto(false)}
          className="absolute right-0 top-full z-50 mt-2 block w-[28rem] max-w-[calc(100vw-2rem)] rounded-2xl bg-white p-3 text-left shadow-2xl ring-1 ring-zinc-900/10"
        >
          <span className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{rotulo}</span>
            <button type="button" onClick={() => setAberto(false)} className="rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100">
              Fechar
            </button>
          </span>
          <TextoEditavel gerado={texto} rotulo={rotulo} linhasMinimas={5} />
        </span>
      )}
    </span>
  );
}
