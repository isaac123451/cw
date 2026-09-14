"use client";

import { useState } from "react";

import Modal from "@/components/shared/Modal";
import TextoEditavel from "@/components/shared/TextoEditavel";

import { confirmNpsResolution, setNpsStatus } from "@/lib/actions/nps";
import { useNps } from "@/lib/context/NpsContext";
import { useToast } from "@/lib/context/ToastContext";
import { STATUS_AGUARDANDO, STATUS_EM_TRATATIVA, type NpsResponseView } from "@/lib/models/nps";
import { mensagemDeReengajamento } from "@/lib/models/trilhaNps";
import { descreverRegistro } from "@/lib/services/horasUteis";

import { ErroDoServidor, RodapeDeSalvar, Rotulo } from "./Rodape";

type Escolha = "enviei" | "confirmou" | "desfazer" | "voltar";

/**
 * A confirmação do cliente — a regra que o guia escreve com todas as letras.
 *
 * "Pergunta de reengajamento enviada ('Isso resolveu sua questão?')
 * antes de marcar como [Encerrado] Resolvido. Sem essa confirmação, o
 * loop permanece em [Aguardando Resposta]." A pergunta sai pronta para
 * copiar; enviar move o ciclo para aguardando; a resposta confirma.
 */
export default function ConfirmacaoNpsModal({ item, onClose }: { item: NpsResponseView; onClose: () => void }) {

  const { recarregar } = useNps();
  const { notify } = useToast();

  const confirmado = Boolean(item.confirmedAt);
  const aguardando = item.status === STATUS_AGUARDANDO;

  const opcoes: { id: Escolha; titulo: string; texto: string }[] = confirmado
    ? [{ id: "desfazer", titulo: "Desfazer a confirmação", texto: "Foi registrada por engano — o cliente ainda não confirmou." }]
    : [
        ...(aguardando
          ? [{ id: "voltar" as const, titulo: "Voltar para em tratativa", texto: "A pergunta ainda não foi enviada, ou a conversa recomeçou." }]
          : [{ id: "enviei" as const, titulo: "Enviei a pergunta", texto: "O ciclo vai para [Aguardando Resposta] até o cliente responder." }]),
        { id: "confirmou", titulo: "O cliente confirmou que resolveu", texto: "Libera o encerramento como resolvido (com o resto do checklist)." },
      ];

  const [escolha, setEscolha] = useState<Escolha>(opcoes[opcoes.length - 1].id);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const r =
        escolha === "confirmou"
          ? await confirmNpsResolution(item.id, true)
          : escolha === "desfazer"
            ? await confirmNpsResolution(item.id, false)
            : await setNpsStatus(item.id, escolha === "enviei" ? STATUS_AGUARDANDO : STATUS_EM_TRATATIVA);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      await recarregar();
      notify({
        tone: "success",
        title:
          escolha === "confirmou"
            ? "Confirmação do cliente registrada."
            : escolha === "desfazer"
              ? "Confirmação desfeita."
              : escolha === "enviei"
                ? "Aguardando a resposta do cliente."
                : "De volta para em tratativa.",
        detail: escolha === "confirmou" ? "O encerramento como resolvido já pode ser aplicado." : undefined,
      });
      onClose();
    } catch {
      setErro("Não foi gravado. Tente de novo; se repetir, atualize a página.");
    } finally {
      setSalvando(false);
    }
  }

  const pergunta = mensagemDeReengajamento(item);

  return (
    <Modal
      open
      title="Confirmação do cliente"
      description={confirmado ? `Confirmado em ${descreverRegistro(item.confirmedAt)}.` : "Sem a confirmação, o ciclo não encerra como resolvido."}
      onClose={onClose}
      footer={<RodapeDeSalvar salvando={salvando} onSalvar={salvar} onCancelar={onClose} />}
    >
      <div className="space-y-5">

        {!confirmado && (
          <div>
            <Rotulo>A pergunta de reengajamento</Rotulo>
            <TextoEditavel gerado={pergunta} rotulo="Copiar a pergunta" linhasMinimas={3} className="mt-2" />
            <p className="mt-1.5 text-xs text-zinc-400">A plataforma não envia nada: copie e mande pelo canal em que a conversa aconteceu.</p>
          </div>
        )}

        <div className="space-y-2">
          {opcoes.map((o) => (
            <label
              key={o.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors ${
                escolha === o.id ? "border-violet-300 bg-violet-50/70" : "border-zinc-200 hover:border-zinc-300"
              }`}
            >
              <input type="radio" name="confirmacao" checked={escolha === o.id} onChange={() => setEscolha(o.id)} className="mt-1 h-4 w-4 accent-violet-600" />
              <span>
                <span className="block text-sm font-medium text-zinc-900">{o.titulo}</span>
                <span className="block text-xs text-zinc-500">{o.texto}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <ErroDoServidor erro={erro} />
    </Modal>
  );
}
