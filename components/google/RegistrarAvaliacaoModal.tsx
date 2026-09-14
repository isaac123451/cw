"use client";

import { useState } from "react";

import { Loader2, Save, Star, TriangleAlert } from "lucide-react";

import Modal, { GhostButton, inputClass, textareaClass } from "@/components/shared/Modal";

import {
  classificarAvaliacao,
  prazoDeResposta,
  ROTULO_DA_URGENCIA,
} from "@/lib/models/avaliacoesGoogle";
import { descreverPrazo, paredeDe } from "@/lib/services/horasUteis";

import { registrarAvaliacaoGoogle, type AvaliacaoGoogleView } from "@/lib/actions/avaliacoesGoogle";
import { useToast } from "@/lib/context/ToastContext";

interface Props {
  onClose: () => void;
  onSalvo: (avaliacao: AvaliacaoGoogleView) => void;
}

function agoraNoCampo() {
  const { dia, min } = paredeDe(new Date());
  return `${dia}T${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

const TOM: Record<string, string> = {
  positiva: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  neutra: "bg-amber-50 text-amber-700 ring-amber-100",
  negativa: "bg-rose-50 text-rose-700 ring-rose-100",
};

/**
 * Registrar uma avaliação do Google — "com nota, data e link".
 *
 * A classificação aparece enquanto se digita, pela tabela do documento,
 * com o prazo de resposta que ela dá. A reincidência (o mesmo problema
 * em outras avaliações recentes) o servidor confere ao gravar.
 */
export default function RegistrarAvaliacaoModal({ onClose, onSalvo }: Props) {

  const { notify } = useToast();

  const [estrelas, setEstrelas] = useState(0);
  const [autor, setAutor] = useState("");
  const [texto, setTexto] = useState("");
  const [link, setLink] = useState("");
  const [quando, setQuando] = useState(agoraNoCampo);
  const [identificado, setIdentificado] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const previa = estrelas > 0 ? classificarAvaliacao(estrelas, texto) : null;

  async function salvar() {

    setSalvando(true);
    setErro(null);

    try {
      const r = await registrarAvaliacaoGoogle({ estrelas, autor, texto, link, publicadaEm: quando, identificado });

      if (!r.ok) {
        setErro(r.erro);
        return;
      }

      onSalvo(r.avaliacao);

      const a = r.avaliacao;

      notify({
        tone: "success",
        title: `Avaliação ${a.classificacao} registrada — ${a.criticidade}.`,
        detail: [
          `Resposta pública em até ${descreverPrazo(prazoDeResposta(a.criticidade))}.`,
          a.motivosDeUrgencia.includes("reincidencia") ? "O mesmo problema apareceu em outras avaliações recentes: escale para a liderança e para a área técnica." : null,
          a.promotorNps ? `Veio de um promotor do NPS (${a.promotorNps.nome}) — a review ficou registrada lá também.` : null,
        ]
          .filter(Boolean)
          .join(" "),
      });

      onClose();
    } catch {
      setErro("A avaliação não foi gravada. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open
      porque="google.classificacao"
      title="Registrar avaliação do Google"
      description="Nota, data e link, como no perfil. A classificação e o prazo de resposta saem da tabela do documento."
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || estrelas === 0 || !autor.trim()}
            className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Salvar
          </button>
        </>
      }
    >

      <div className="space-y-4">

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Estrelas</p>
          <div className="mt-1.5 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setEstrelas(n)}
                aria-label={`${n} estrela(s)`}
                className="rounded-lg p-1 transition-transform hover:scale-110"
              >
                <Star size={26} className={n <= estrelas ? "fill-amber-400 text-amber-400" : "text-zinc-300"} />
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Quem avaliou</span>
            <input value={autor} onChange={(e) => setAutor(e.target.value)} placeholder="Como aparece no Google" className={`mt-1.5 ${inputClass}`} />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Publicada em (Brasília)</span>
            <input type="datetime-local" value={quando} max={agoraNoCampo()} onChange={(e) => setQuando(e.target.value)} className={`mt-1.5 ${inputClass}`} />
          </label>
        </div>

        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Comentário (opcional)</span>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} placeholder="Cole o texto da avaliação." className={`mt-1.5 ${textareaClass}`} />
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Link da avaliação</span>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://g.page/…" className={`mt-1.5 ${inputClass}`} />
        </label>

        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-zinc-700">
          <input type="checkbox" checked={identificado} onChange={(e) => setIdentificado(e.target.checked)} className="mt-0.5 h-4 w-4 accent-violet-700" />
          <span>
            O perfil tem nome real
            <span className="block text-xs text-zinc-500">Avaliação anônima vira &ldquo;sem identificação&rdquo;: só a resposta pública, sem tratativa privada.</span>
          </span>
        </label>

        {previa && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-600 ring-1 ring-inset ring-zinc-200">
            <span className={`rounded-full px-2 py-0.5 font-semibold ring-1 ring-inset ${TOM[previa.classificacao]}`}>{previa.classificacao}</span>
            <span className="font-semibold text-zinc-800">{previa.criticidade}</span>
            <span>· resposta em até {descreverPrazo(prazoDeResposta(previa.criticidade))}</span>
            {previa.motivos.length > 0 && <span className="text-rose-700">· {previa.motivos.map((m) => ROTULO_DA_URGENCIA[m]).join(", ")}</span>}
          </div>
        )}

      </div>

      {erro && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-100">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          {erro}
        </p>
      )}

    </Modal>
  );
}
