"use client";

import { useState } from "react";

import { Check, CheckCircle2, Circle, Loader2, TriangleAlert, Undo2 } from "lucide-react";

import Modal, { GhostButton } from "@/components/shared/Modal";

import type { Case } from "@/lib/models/case";

import { marcarPasso } from "@/lib/actions/tratativa";
import { useToast } from "@/lib/context/ToastContext";

interface Props {
  item: Case;
  onClose: () => void;
  onSalvo: (patch: Partial<Case>) => void;
}

/**
 * A finalização do fluxo interno do Reclame Aqui, em quatro checks.
 *
 * "Após o retorno da área interna: 1. valida a solução com o cliente;
 * 2. responde no Reclame Aqui; 3. solicita a avaliação no portal RA;
 * 4. atualiza as informações no CW Engine." Os três primeiros a
 * plataforma já sabe pelo que foi registrado; o quarto só quem fez sabe.
 */
export default function FinalizacaoModal({ item, onClose, onSalvo }: Props) {

  const { notify } = useToast();

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const respondida = item.respondida ?? (item.publicResponse ?? "").trim() !== "";

  const checks = [
    { feito: Boolean(item.validadoEm), texto: "Validou a solução com o cliente", falta: "Registre a validação como contato — \"Cliente confirmou a solução\"." },
    { feito: respondida, texto: "Respondeu no Reclame Aqui", falta: "Publique a resposta e marque em Avaliação RA." },
    { feito: (item.pedidosDeAvaliacao ?? 0) > 0 || Boolean(item.evaluated), texto: "Solicitou a avaliação", falta: "Peça a avaliação pelo WhatsApp e registre o pedido." },
    { feito: Boolean(item.cwEngineEm), texto: "Atualizou as informações no CW Engine", falta: "É o registro final do caso na conta do cliente." },
  ];

  async function marcar(desfazer: boolean) {

    setSalvando(true);
    setErro(null);

    try {
      const r = await marcarPasso({ protocol: item.protocol, passo: "cw-engine", desfazer });

      if (!r.ok) {
        setErro(r.erro);
        return;
      }

      onSalvo({ cwEngineEm: r.em, cwEnginePor: r.por });

      const restantes = checks.slice(0, 3).filter((c) => !c.feito).length;

      notify({
        tone: "success",
        title: desfazer ? "CW Engine desmarcado." : "CW Engine atualizado.",
        detail: desfazer
          ? undefined
          : restantes === 0
            ? "Os quatro checks da finalização estão feitos."
            : `Faltam ${restantes} dos outros checks da finalização.`,
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
      porque="ra.finalizacao"
      title={`Finalização — ${item.protocol}`}
      description="Os quatro passos que a documentação pede depois do retorno da área interna."
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Fechar</GhostButton>
          {item.cwEngineEm ? (
            <button
              type="button"
              onClick={() => marcar(true)}
              disabled={salvando}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-50"
            >
              <Undo2 size={15} /> Desmarcar o CW Engine
            </button>
          ) : (
            <button
              type="button"
              onClick={() => marcar(false)}
              disabled={salvando}
              className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
            >
              {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              Atualizei o CW Engine
            </button>
          )}
        </>
      }
    >

      <ol className="space-y-3">
        {checks.map((c, i) => (
          <li key={c.texto} className="flex items-start gap-3">
            {c.feito ? (
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
            ) : (
              <Circle size={18} className="mt-0.5 shrink-0 text-zinc-300" />
            )}
            <span>
              <span className={`block text-sm ${c.feito ? "text-zinc-800" : "font-medium text-zinc-900"}`}>
                {i + 1}. {c.texto}
              </span>
              {!c.feito && <span className="mt-0.5 block text-xs text-zinc-500">{c.falta}</span>}
            </span>
          </li>
        ))}
      </ol>

      {erro && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-100">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          {erro}
        </p>
      )}

    </Modal>
  );
}
