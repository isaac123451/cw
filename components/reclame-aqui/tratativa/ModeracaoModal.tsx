"use client";

import { useState } from "react";

import { Loader2, Save, TriangleAlert } from "lucide-react";

import Modal, { GhostButton, textareaClass } from "@/components/shared/Modal";

import type { Case } from "@/lib/models/case";

import { registrarModeracao } from "@/lib/actions/tratativa";
import { useToast } from "@/lib/context/ToastContext";

interface Props {
  item: Case;
  onClose: () => void;
  onSalvo: (patch: Partial<Case>) => void;
}

/** Motivos que costumam sustentar um pedido — só atalhos para o texto. */
const MOTIVOS = [
  "Reclamação duplicada de outra já registrada.",
  "Quem reclama não é cliente da Cardápio Web — o problema é de outra empresa.",
  "O problema foi resolvido por outro canal antes da publicação.",
  "Conteúdo ofensivo ou com informação falsa sobre a empresa.",
  "Reclamação trata de terceiro (cliente final do restaurante), não da plataforma.",
];

const RESULTADOS: { id: "pendente" | "aceita" | "negada"; rotulo: string }[] = [
  { id: "pendente", rotulo: "Aguardando o Reclame Aqui" },
  { id: "aceita", rotulo: "Aceita" },
  { id: "negada", rotulo: "Negada" },
];

/**
 * "Solicitar e acompanhar moderações" — item 6 da rotina diária.
 *
 * O pedido é feito na área da empresa do Reclame Aqui; aqui fica o
 * registro: o motivo, quando foi pedido e o que o Reclame Aqui decidiu.
 * Sem isso, moderação pedida vira moderação esquecida — e a reclamação
 * continua pesando na nota enquanto ninguém confere a resposta.
 */
export default function ModeracaoModal({ item, onClose, onSalvo }: Props) {

  const { notify } = useToast();

  const pedida = Boolean(item.moderacaoPedidaEm);

  const [motivo, setMotivo] = useState(item.moderacaoMotivo ?? "");
  const [resultado, setResultado] = useState<"pendente" | "aceita" | "negada">(item.moderacaoResultado ?? "pendente");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(limpar = false) {

    setSalvando(true);
    setErro(null);

    try {
      const r = await registrarModeracao({ protocol: item.protocol, motivo, resultado, limpar });

      if (!r.ok) {
        setErro(r.erro);
        return;
      }

      onSalvo({
        moderacaoPedidaEm: r.moderacaoPedidaEm,
        moderacaoMotivo: r.moderacaoMotivo,
        moderacaoResultado: r.moderacaoResultado,
        moderacaoRespondidaEm: r.moderacaoRespondidaEm,
      });

      notify({
        tone: "success",
        title: limpar
          ? "Registro de moderação removido."
          : !pedida
            ? `Pedido de moderação registrado em ${item.protocol}.`
            : `Moderação: ${RESULTADOS.find((x) => x.id === resultado)?.rotulo.toLowerCase()}.`,
        detail: !limpar && !pedida ? "Fica marcado na lateral do caso e no histórico até você registrar a decisão do Reclame Aqui." : undefined,
      });

      onClose();
    } catch {
      setErro("Não foi gravado. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open
      title={pedida ? `Moderação — ${item.protocol}` : `Registrar pedido de moderação — ${item.protocol}`}
      description="O pedido é feito na área da empresa do Reclame Aqui. Aqui fica o motivo e o acompanhamento."
      onClose={onClose}
      footer={
        <>
          {pedida && (
            <button
              type="button"
              onClick={() => salvar(true)}
              disabled={salvando}
              className="mr-auto rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-500 hover:bg-zinc-100"
            >
              Remover registro
            </button>
          )}
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <button
            type="button"
            onClick={() => salvar(false)}
            disabled={salvando || (!pedida && motivo.trim().length < 10)}
            className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Salvar
          </button>
        </>
      }
    >

      <div className="space-y-4">

        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Motivo do pedido</span>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={4}
            placeholder="Por que esta reclamação deve ser moderada — com o fato que sustenta."
            className={`mt-1.5 ${textareaClass}`}
          />
        </label>

        {!pedida && (
          <div className="flex flex-wrap gap-1.5">
            {MOTIVOS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMotivo((atual) => (atual.trim() ? `${atual.trim()} ${m}` : m))}
                className="rounded-full border border-zinc-200 px-2.5 py-1 text-left text-xs text-zinc-600 transition-colors hover:border-violet-300 hover:text-violet-700"
              >
                {m}
              </button>
            ))}
          </div>
        )}

        {pedida && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">O que o Reclame Aqui decidiu</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {RESULTADOS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setResultado(r.id)}
                  aria-pressed={resultado === r.id}
                  className={`rounded-xl border px-3 py-2 text-sm transition-colors ${
                    resultado === r.id ? "border-violet-300 bg-violet-50 font-semibold text-violet-800" : "border-zinc-200 text-zinc-600"
                  }`}
                >
                  {r.rotulo}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="rounded-xl bg-zinc-50 px-3.5 py-2.5 text-xs leading-relaxed text-zinc-600 ring-1 ring-inset ring-zinc-200">
          O dossiê do caso (montado pela extensão) é o anexo que sustenta o pedido: a história ordenada,
          com as peças numeradas.
        </p>

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
