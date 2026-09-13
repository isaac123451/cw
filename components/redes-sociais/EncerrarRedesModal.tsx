"use client";

import { useState } from "react";

import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";

import Modal, { GhostButton, textareaClass } from "@/components/shared/Modal";
import Combobox from "@/components/shared/Combobox";

import type { Case } from "@/lib/models/case";
import { ETAPAS_DAS_REDES, TENTATIVAS_DAS_REDES } from "@/lib/models/redes";

import { encerrarAtendimento } from "@/lib/actions/redes";
import { useNps } from "@/lib/context/NpsContext";
import { useToast } from "@/lib/context/ToastContext";

interface Props {
  item: Case;
  /** O final já escolhido — pelo quadro ou pelo seletor de etapa. */
  resultadoInicial?: string;
  onClose: () => void;
  onSalvo: (patch: Partial<Case>) => void;
}

const FINAIS = ETAPAS_DAS_REDES.filter((e) => e.final);

/**
 * O encerramento do documento das Redes: resultado, solução e causa.
 *
 * "Resultado final, solução aplicada e causa raiz", com data e hora. Os
 * três finais têm regra: resolvido pede a validação do cliente
 * registrada; sem contato, as três tentativas; sem identificação é o
 * cliente que não se identificou pelo canal privado.
 */
export default function EncerrarRedesModal({ item, resultadoInicial, onClose, onSalvo }: Props) {

  const { notify } = useToast();
  const { rootCauses } = useNps();

  const [resultado, setResultado] = useState(resultadoInicial && FINAIS.some((f) => f.nome === resultadoInicial) ? resultadoInicial : "Resolvido");
  const [solucao, setSolucao] = useState(item.solucaoAplicada ?? "");
  const [causa, setCausa] = useState(item.causaRaiz ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const tentativas = item.tentativasSemResposta ?? 0;

  const falta =
    resultado === "Resolvido"
      ? [
          !item.validadoEm ? "registrar a validação do cliente (Registrar contato → Cliente confirmou a solução)" : null,
          solucao.trim().length < 8 ? "descrever a solução aplicada" : null,
          !causa ? "escolher a causa raiz" : null,
        ].filter(Boolean)
      : resultado === "Sem contato" && tentativas < TENTATIVAS_DAS_REDES
        ? [`fazer mais ${TENTATIVAS_DAS_REDES - tentativas} tentativa(s) — hoje são ${tentativas}`]
        : [];

  async function salvar() {

    setSalvando(true);
    setErro(null);

    try {
      const r = await encerrarAtendimento({ protocol: item.protocol, resultado, solucaoAplicada: solucao, causaRaiz: causa });

      if (!r.ok) {
        setErro(r.erro);
        return;
      }

      onSalvo({
        status: r.status,
        resolved: r.resolved,
        encerradoEm: r.encerradoEm,
        solucaoAplicada: r.solucaoAplicada,
        ...(r.causaRaiz ? { causaRaiz: r.causaRaiz } : {}),
      });

      notify({
        tone: "success",
        title: `Atendimento encerrado: ${resultado.toLowerCase()}.`,
        detail:
          resultado === "Resolvido"
            ? "Conta como resolvido nos indicadores."
            : "Não conta como resolvido. Se o cliente voltar, reabra — o registro é o mesmo.",
      });

      onClose();
    } catch {
      setErro("O encerramento não foi gravado. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open
      title={`Encerrar atendimento — ${item.protocol}`}
      description="O registro do documento: resultado final, solução aplicada e causa raiz."
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || falta.length > 0}
            className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            Encerrar
          </button>
        </>
      }
    >

      <div className="space-y-4">

        <div className="grid gap-2">
          {FINAIS.map((f) => (
            <button
              key={f.nome}
              type="button"
              onClick={() => setResultado(f.nome)}
              aria-pressed={resultado === f.nome}
              className={`rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                resultado === f.nome ? "border-violet-300 bg-violet-50" : "border-zinc-200 hover:border-zinc-300"
              }`}
            >
              <span className={`block text-sm ${resultado === f.nome ? "font-semibold text-violet-800" : "font-medium text-zinc-800"}`}>
                {f.nome}
              </span>
              <span className="mt-0.5 block text-xs text-zinc-500">{f.dica}</span>
            </button>
          ))}
        </div>

        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Solução aplicada{resultado === "Resolvido" ? "" : " (opcional)"}
          </span>
          <textarea
            value={solucao}
            onChange={(e) => setSolucao(e.target.value)}
            rows={3}
            placeholder={resultado === "Resolvido" ? "O que resolveu — para quem abrir o caso de novo." : "O que foi feito até aqui."}
            className={`mt-1.5 ${textareaClass}`}
          />
        </label>

        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Causa raiz{resultado === "Resolvido" ? "" : " (se já se sabe)"}
          </span>
          <div className="mt-1.5">
            <Combobox
              value={causa}
              onChange={setCausa}
              emptyLabel="Não definida"
              placeholder="Não definida"
              options={[...new Set([...rootCauses.filter((c) => c.active).map((c) => c.name), ...(causa ? [causa] : [])])]}
            />
          </div>
        </div>

        {falta.length > 0 && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-900 ring-1 ring-inset ring-amber-100">
            <TriangleAlert size={14} className="mt-0.5 shrink-0 text-amber-600" />
            <span>Para encerrar como “{resultado}”, falta {falta.join("; ")}.</span>
          </p>
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
