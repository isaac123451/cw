"use client";

import { useState } from "react";

import { useRascunhoNaJanela } from "@/lib/context/rascunhosDasJanelas";

import { Loader2, MessageSquareReply, Star, UserRoundCheck } from "lucide-react";

import Combobox from "@/components/shared/Combobox";

import { useAvaliacoesGoogle } from "@/lib/context/useAvaliacoesGoogle";
import { useNps } from "@/lib/context/NpsContext";
import { useToast } from "@/lib/context/ToastContext";

import {
  registrarTratativaGoogle,
  responderAvaliacaoGoogle,
  type AvaliacaoGoogleView,
} from "@/lib/actions/avaliacoesGoogle";

import { conferirResposta, ROTULO_DO_STATUS_GOOGLE } from "@/lib/models/avaliacoesGoogle";
import { CANAIS_DE_CONTATO } from "@/lib/models/tratativa";
import { dadosSensiveis, resumoDosAchados } from "@/lib/services/lgpd";

/**
 * A avaliação do Google numa mini-janela.
 *
 * Duas ações, as duas que mais se repetem: **registrar a resposta
 * pública** (com a mesma conferência da ficha — nome, canal privado,
 * promessa, tom e dado pessoal, antes de gravar) e **registrar a
 * tratativa privada** (canal, resultado, nota atualizada e causa raiz).
 * Denunciar, vincular caso e o histórico ficam na ficha.
 */

const rotulo = "text-[10px] font-semibold uppercase tracking-wide text-zinc-400";
const campo =
  "h-8 w-full rounded-lg border border-zinc-200 bg-white px-2 text-[13px] text-zinc-800 outline-none transition-colors focus:border-violet-400";
const botao =
  "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200 hover:bg-violet-50 disabled:opacity-50";

const RESULTADOS = [
  { id: "em-andamento", texto: "Em andamento" },
  { id: "resolvido", texto: "Resolvido" },
  { id: "sem-retorno", texto: "Sem retorno do cliente" },
  { id: "sem-identificacao", texto: "Sem identificação" },
];

export default function JanelaDoGoogle({ id }: { id: string }) {

  const { avaliacoes, carregando, recarregar } = useAvaliacoesGoogle();
  const { rootCauses } = useNps();
  const { notify } = useToast();

  const a = avaliacoes.find((item) => item.id === id);

  const [resposta, setResposta] = useState<string | null>(null);
  const [canal, setCanal] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const [notaAtualizada, setNotaAtualizada] = useState<string | null>(null);
  const [causa, setCausa] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  /* Algo digitado e não salvo: a moldura pede confirmação para fechar. */
  useRascunhoNaJanela(
    (resposta !== null && resposta !== (a?.resposta ?? "")) || canal !== null || resultado !== null || notaAtualizada !== null || causa !== null
  );

  if (!a) {
    return (
      <p className="px-4 py-6 text-sm text-zinc-500">
        {carregando ? "Carregando a avaliação…" : "Esta avaliação não está mais na base. Feche a janela."}
      </p>
    );
  }

  const textoDaResposta = resposta ?? a.resposta ?? "";
  const avisos = conferirResposta({ resposta: textoDaResposta, autor: a.autor, classificacao: a.classificacao });
  const achados = dadosSensiveis(textoDaResposta);

  async function executar(
    qual: string,
    acao: () => Promise<{ ok: true; avaliacao: AvaliacaoGoogleView } | { ok: false; erro: string }>,
    titulo: string,
    depois: () => void
  ) {
    setOcupado(qual);
    try {
      const r = await acao();
      if (!r.ok) {
        notify({ tone: "error", title: "Não foi gravado.", detail: r.erro });
        return;
      }
      depois();
      notify({ tone: "success", title: titulo, detail: `Situação: ${ROTULO_DO_STATUS_GOOGLE[r.avaliacao.status]}.` });
      recarregar();
    } catch {
      notify({ tone: "error", title: "Não foi gravado.", detail: "O servidor não respondeu. Tente de novo." });
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="space-y-3 px-4 py-3">

      <div>
        <p className="flex items-center gap-1 text-[13px] font-medium text-zinc-800">
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} size={12} className={i < a.estrelas ? "fill-amber-400 text-amber-400" : "text-zinc-300"} />
          ))}
          <span className="ml-1 truncate">{a.autor}</span>
        </p>
        <p className="text-[11px] text-zinc-400">
          {a.classificacao} · {a.criticidade} · {ROTULO_DO_STATUS_GOOGLE[a.status]}
        </p>
      </div>

      {a.texto && (
        <p className="line-clamp-4 rounded-lg bg-zinc-50 px-3 py-2 text-[13px] leading-relaxed text-zinc-700">“{a.texto}”</p>
      )}

      <div className="border-t border-zinc-100 pt-3">
        <p className={`${rotulo} flex items-center gap-1`}>
          <MessageSquareReply size={11} />
          Resposta pública {a.respondidaEm ? "(já registrada)" : ""}
        </p>
        <textarea
          value={textoDaResposta}
          onChange={(e) => setResposta(e.target.value)}
          rows={3}
          placeholder="Como ela ficou no ar, no Google."
          className="mt-1.5 w-full resize-y rounded-lg border border-zinc-200 px-2 py-1.5 text-[13px] outline-none focus:border-violet-400"
        />

        {(avisos.length > 0 || achados.length > 0) && textoDaResposta.trim() && (
          <ul className="mt-1 space-y-0.5 text-[11px] text-amber-700">
            {achados.length > 0 && (
              <li className="text-rose-700">• {resumoDosAchados(achados)} — tire antes de publicar.</li>
            )}
            {avisos.map((av) => (
              <li key={av.aviso}>• {av.aviso}</li>
            ))}
          </ul>
        )}

        <button
          type="button"
          disabled={resposta === null || !resposta.trim() || ocupado !== null}
          onClick={() =>
            executar(
              "resposta",
              () => responderAvaliacaoGoogle({ id: a.id, resposta: resposta!.trim() }),
              "Resposta pública registrada.",
              () => setResposta(null)
            )
          }
          className={`${botao} mt-1.5`}
        >
          {ocupado === "resposta" ? <Loader2 size={12} className="animate-spin" /> : null}
          Registrar resposta
        </button>
      </div>

      <div className="border-t border-zinc-100 pt-3">
        <p className={`${rotulo} flex items-center gap-1`}>
          <UserRoundCheck size={11} />
          Tratativa privada
        </p>

        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <select value={canal ?? a.tratativaCanal ?? "WhatsApp"} onChange={(e) => setCanal(e.target.value)} className={campo}>
            {CANAIS_DE_CONTATO.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select value={resultado ?? a.tratativaResultado ?? ""} onChange={(e) => setResultado(e.target.value)} className={campo}>
            <option value="">Resultado…</option>
            {RESULTADOS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.texto}
              </option>
            ))}
          </select>
          <select
            value={notaAtualizada ?? (a.notaAtualizada ? String(a.notaAtualizada) : "")}
            onChange={(e) => setNotaAtualizada(e.target.value)}
            className={campo}
            title="Se o cliente atualizou a nota no Google"
          >
            <option value="">Nota não atualizada</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                Atualizou para {n}★
              </option>
            ))}
          </select>
          <Combobox
            value={causa ?? a.causaRaiz ?? ""}
            onChange={(c) => setCausa(c)}
            emptyLabel="Causa raiz"
            placeholder="Causa raiz"
            options={[...new Set([...rootCauses.filter((c) => c.active).map((c) => c.name), ...(a.causaRaiz ? [a.causaRaiz] : [])])]}
          />
        </div>

        <button
          type="button"
          disabled={!(resultado ?? a.tratativaResultado) || ocupado !== null}
          onClick={() => {
            const nota = notaAtualizada ?? (a.notaAtualizada ? String(a.notaAtualizada) : "");
            executar(
              "tratativa",
              () =>
                registrarTratativaGoogle({
                  id: a.id,
                  canal: canal ?? a.tratativaCanal ?? "WhatsApp",
                  resultado: (resultado ?? a.tratativaResultado)!,
                  notaAtualizada: nota ? Number(nota) : null,
                  causaRaiz: (causa ?? a.causaRaiz) || undefined,
                }),
              "Tratativa registrada.",
              () => {
                setCanal(null);
                setResultado(null);
                setNotaAtualizada(null);
                setCausa(null);
              }
            );
          }}
          className={`${botao} mt-1.5`}
        >
          {ocupado === "tratativa" ? <Loader2 size={12} className="animate-spin" /> : null}
          Registrar tratativa
        </button>
      </div>

    </div>
  );
}
