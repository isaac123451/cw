"use client";

import { useState } from "react";

import { Loader2, MessageCircle, Send, TriangleAlert } from "lucide-react";

import Modal, { GhostButton, inputClass, textareaClass } from "@/components/shared/Modal";
import BotaoCopiar from "@/components/shared/BotaoCopiar";

import type { Case } from "@/lib/models/case";
import { pedidoDeAvaliacao } from "@/lib/models/cadencia";
import { mensagemDePedidoDeAvaliacao } from "@/lib/models/mensagens";
import { patchDoResumo } from "@/lib/models/tratativa";

import { registrarContato } from "@/lib/actions/tratativa";
import { useConversasGuardadas } from "@/components/conversas/ConversasGuardadas";
import { descreverRegistro } from "@/lib/services/horasUteis";
import { useSession } from "@/lib/context/SessionContext";
import { useToast } from "@/lib/context/ToastContext";

interface Props {
  item: Case;
  onClose: () => void;
  onSalvo: (patch: Partial<Case>) => void;
}

/**
 * O Passo 8: pedir a avaliação, com a mensagem pronta e o registro.
 *
 * A cadência da documentação — a cada 2 dias depois da resposta, depois
 * semanal por até 6 meses — decide qual lembrete é este e o tom muda com
 * ele. O gancho do histórico ("vi que você pediu ajuste no cardápio")
 * entra quando existe: é o que o documento mostra como exemplo de pedido
 * que funciona. Abrir no WhatsApp só preenche o texto — quem envia é você.
 */
export default function PedidoAvaliacaoModal({ item, onClose, onSalvo }: Props) {

  const { notify } = useToast();
  const sessao = useSession();

  const cadencia = pedidoDeAvaliacao(item);

  const [gancho, setGancho] = useState("");
  const [editada, setEditada] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const gerada = mensagemDePedidoDeAvaliacao({
    nome: item.customer,
    numero: Math.max(1, cadencia.numero),
    raUrl: item.raUrl,
    gancho,
    agente: sessao?.name,
  });

  const mensagem = editada ?? gerada;

  /*
    O gancho da conversa guardada: a última fala do cliente, com o dia.
    A frase é sugestão — entra no campo de gancho, editável, só no clique.
  */
  const conversas = useConversasGuardadas({ protocolo: item.protocol });
  const ultimaFala = conversas.find((c) => c.ultimaDoCliente)?.ultimaDoCliente;
  const ganchoDaConversa = ultimaFala
    ? {
        texto: ultimaFala.texto.slice(0, 140),
        quando: ultimaFala.em ? descreverRegistro(ultimaFala.em).split(" ")[0] : "",
        frase: `Na nossa conversa${ultimaFala.em ? ` do dia ${descreverRegistro(ultimaFala.em).split(" ")[0]}` : ""} você comentou: "${ultimaFala.texto.slice(0, 120)}". Segue tudo certo por aí?`,
      }
    : null;

  const digitos = (item.phone ?? "").replace(/\D/g, "");
  const whatsapp = digitos.length >= 10 && !(item.phone ?? "").includes("•")
    ? `https://wa.me/${digitos.length <= 11 ? `55${digitos}` : digitos}?text=${encodeURIComponent(mensagem)}`
    : null;

  async function registrar() {

    setSalvando(true);
    setErro(null);

    try {
      const r = await registrarContato({
        protocol: item.protocol,
        tipo: "pedido-avaliacao",
        canal: "WhatsApp",
        resultado: "enviado",
        nota: mensagem.slice(0, 2000),
      });

      if (!r.ok) {
        setErro(r.erro);
        return;
      }

      const patch: Partial<Case> = patchDoResumo(r.resumo);

      onSalvo(patch);

      const proximo = pedidoDeAvaliacao({ ...item, ...patch });

      notify({
        tone: "success",
        title: `${r.resumo.pedidosDeAvaliacao}º pedido de avaliação registrado em ${item.protocol}.`,
        detail: proximo.ativo && proximo.proximoDia
          ? `Próximo lembrete em ${proximo.proximoDia.split("-").reverse().slice(0, 2).join("/")}.`
          : undefined,
      });

      onClose();
    } catch {
      setErro("O pedido não foi registrado. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open
      porque="ra.follow-up"
      title={`Pedir a avaliação — ${item.protocol}`}
      description={cadencia.ativo ? `${cadencia.resumo} Tom gentil, perguntando se o sistema continua rodando bem.` : cadencia.resumo}
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <BotaoCopiar texto={mensagem} />
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              title="Abre a conversa com a mensagem preenchida — quem envia é você"
              className="flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 transition-colors hover:bg-emerald-50"
            >
              <MessageCircle size={14} /> WhatsApp
            </a>
          )}
          <button
            type="button"
            onClick={registrar}
            disabled={salvando}
            className="flex items-center gap-2 whitespace-nowrap rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Registrar pedido
          </button>
        </>
      }
    >

      <div className="space-y-4">

        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Gancho do histórico (opcional)
          </span>
          <input
            value={gancho}
            onChange={(e) => {
              setGancho(e.target.value);
              setEditada(null);
            }}
            placeholder="Ex.: Vi que você falou com o Suporte para ajustar o cardápio — deu tudo certo?"
            className={`mt-1.5 ${inputClass}`}
          />
          <span className="mt-1 block text-xs text-zinc-500">
            A documentação usa contatos recentes com Suporte ou Implantação como gancho para chamar a atenção.
          </span>
        </label>

        {/* A conversa guardada deste caso: a última fala do cliente é o gancho mais concreto que existe. */}
        {ganchoDaConversa && gancho !== ganchoDaConversa.frase && (
          <div className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-emerald-50/70 px-3.5 py-2.5 text-xs leading-5 text-emerald-900 ring-1 ring-inset ring-emerald-100">
            <span className="min-w-0 flex-1">
              <strong>Da conversa do WhatsApp guardada</strong> ({ganchoDaConversa.quando}): &ldquo;{ganchoDaConversa.texto}&rdquo;
            </span>
            <button
              type="button"
              onClick={() => {
                setGancho(ganchoDaConversa.frase);
                setEditada(null);
              }}
              className="shrink-0 rounded-lg bg-white px-2.5 py-1 font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-50"
            >
              Usar como gancho
            </button>
          </div>
        )}

        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Mensagem</span>
          <textarea
            value={mensagem}
            onChange={(e) => setEditada(e.target.value)}
            rows={7}
            className={`mt-1.5 ${textareaClass}`}
          />
        </label>

        {!item.raUrl && (
          <p className="flex items-start gap-1.5 text-xs text-amber-700">
            <TriangleAlert size={13} className="mt-0.5 shrink-0" />
            O caso não tem o link do Reclame Aqui — cole na lateral para ele entrar na mensagem.
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
