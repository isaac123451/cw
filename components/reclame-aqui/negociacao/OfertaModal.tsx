"use client";

import { useState } from "react";

import { Gift, Loader2, TriangleAlert } from "lucide-react";

import Modal, { GhostButton, inputClass, textareaClass } from "@/components/shared/Modal";
import BotaoCopiar from "@/components/shared/BotaoCopiar";

import type { Case } from "@/lib/models/case";
import {
  centavosDoTexto,
  custoDoModelo,
  mensagemDeOferta,
  MODELOS_DE_OFERTA,
  modeloDeOferta,
  MOTIVOS_DE_OFERTA,
  ofertaSugerida,
  precisaDeValidacao,
  reais,
  type NegociacaoView,
} from "@/lib/models/negociacao";

import { registrarOferta } from "@/lib/actions/negociacao";
import { useEstablishments } from "@/lib/context/EstablishmentsContext";
import { useSession } from "@/lib/context/SessionContext";
import { useToast } from "@/lib/context/ToastContext";

interface Props {
  item: Case;
  onClose: () => void;
  onSalvo: (negociacao: NegociacaoView) => void;
}

function textoDoValor(cents: number | null) {
  return cents === null ? "" : (cents / 100).toFixed(2).replace(".", ",");
}

/**
 * A oferta do documento, na hora certa e com o rastro.
 *
 * A criticidade sugere o modelo (Urgente, 1 mês gratuito; Alta, 10% por
 * 3 meses) e a mensalidade do estabelecimento dá o custo. Mudar o modelo
 * ou subir o valor é "condição fora do padrão": o campo "validado por"
 * aparece e é obrigatório. O que justifica a oferta é marcado — o
 * documento pede impacto real na experiência, não pedido de desconto.
 */
export default function OfertaModal({ item, onClose, onSalvo }: Props) {

  const { notify } = useToast();
  const sessao = useSession();
  const { establishments } = useEstablishments();

  const estabelecimento = establishments.find((e) => e.id === item.establishmentId);
  const mensalidadeCents = estabelecimento?.mrr ? Math.round(estabelecimento.mrr * 100) : null;

  const sugerida = ofertaSugerida(item.priority);

  const [modelo, setModelo] = useState<string>(sugerida?.id ?? "personalizada");
  const [descricao, setDescricao] = useState(sugerida?.titulo ?? "");
  const [valor, setValor] = useState(textoDoValor(custoDoModelo(sugerida ?? undefined, mensalidadeCents)));
  const [motivos, setMotivos] = useState<string[]>([]);
  const [validadoPor, setValidadoPor] = useState("");

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const valorCents = centavosDoTexto(valor);

  const foraDoPadrao = precisaDeValidacao({
    prioridade: item.priority,
    modelo,
    valorCents: valorCents ?? 0,
    mensalidadeCents,
  });

  function escolherModelo(id: string) {
    setModelo(id);
    const m = modeloDeOferta(id);
    if (m && m.id !== "personalizada") {
      setDescricao(m.titulo);
      setValor(textoDoValor(custoDoModelo(m, mensalidadeCents)));
    }
  }

  const [editada, setEditada] = useState<string | null>(null);

  const mensagem =
    editada ?? mensagemDeOferta({ nome: item.customer, oferta: descricao || "[a condição]", agente: sessao?.name });

  async function salvar() {

    if (valorCents === null) {
      setErro("Informe o custo estimado em reais — zero, se não houver.");
      return;
    }

    setSalvando(true);
    setErro(null);

    try {
      const r = await registrarOferta({
        protocol: item.protocol,
        modelo,
        descricao,
        valorCents,
        motivos,
        validadoPor,
      });

      if (!r.ok) {
        setErro(r.erro);
        return;
      }

      onSalvo(r.negociacao);

      notify({
        tone: "success",
        title: `Oferta registrada em ${item.protocol}.`,
        detail: r.foraDoPadrao
          ? `Fora do padrão, validada por ${r.negociacao.validadoPor}. Quando o cliente responder, registre na lateral — aceita, ela entra em Impacto.`
          : "Quando o cliente responder, registre na lateral — aceita, ela entra em Impacto como custo.",
      });

      onClose();
    } catch {
      setErro("A oferta não foi gravada. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open
      porque="ofertas.autonomia"
      size="wide"
      title={`Oferta — ${item.protocol}`}
      description="Estratégia de reversão, depois da condução do caso — nunca como primeira abordagem."
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <BotaoCopiar texto={mensagem} rotulo="Copiar mensagem" />
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || motivos.length === 0 || descricao.trim().length < 6 || (foraDoPadrao && validadoPor.trim().length < 3)}
            className="flex items-center gap-2 whitespace-nowrap rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Gift size={15} />}
            Registrar oferta
          </button>
        </>
      }
    >

      <div className="grid gap-5 md:grid-cols-2">

        <div className="space-y-4">

          <div className="rounded-xl bg-violet-50/60 px-3.5 py-3 text-xs leading-relaxed text-violet-900 ring-1 ring-inset ring-violet-100">
            {sugerida ? (
              <>
                Caso <strong>{item.priority}</strong>: o documento prevê <strong>{sugerida.titulo.toLowerCase()}</strong>
                {mensalidadeCents
                  ? `, cerca de ${reais(custoDoModelo(sugerida, mensalidadeCents) ?? 0)} para esta conta (mensalidade de ${reais(mensalidadeCents)}).`
                  : " — sem mensalidade no cadastro do estabelecimento, informe o custo."}
              </>
            ) : (
              <>
                Caso <strong>Normal</strong>: o documento não prevê oferta. Qualquer condição precisa de validação
                interna antes de ir ao cliente.
              </>
            )}
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">O que justifica</p>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {MOTIVOS_DE_OFERTA.map((m) => {
                const marcado = motivos.includes(m.id);
                return (
                  <label
                    key={m.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                      marcado ? "border-violet-300 bg-violet-50 text-violet-800" : "border-zinc-200 text-zinc-600"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() =>
                        setMotivos((atual) => (marcado ? atual.filter((x) => x !== m.id) : [...atual, m.id]))
                      }
                      className="h-4 w-4 accent-violet-700"
                    />
                    {m.texto}
                  </label>
                );
              })}
            </div>
          </div>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Modelo</span>
            <select value={modelo} onChange={(e) => escolherModelo(e.target.value)} className={`mt-1.5 ${inputClass}`}>
              {MODELOS_DE_OFERTA.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.titulo}
                  {m.prioridade ? ` (caso ${m.prioridade})` : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Como vai ser apresentada</span>
              <input value={descricao} onChange={(e) => setDescricao(e.target.value)} className={`mt-1.5 ${inputClass}`} />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Custo (R$)</span>
              <input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                className={`mt-1.5 ${inputClass} tabular-nums`}
              />
            </label>
          </div>

          {foraDoPadrao && (
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                Validado por (obrigatório — condição fora do padrão)
              </span>
              <input
                value={validadoPor}
                onChange={(e) => setValidadoPor(e.target.value)}
                placeholder="Quem aprovou internamente"
                className={`mt-1.5 ${inputClass}`}
              />
            </label>
          )}

        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Mensagem ao cliente (canal privado)
            </span>
            {editada !== null && (
              <button type="button" onClick={() => setEditada(null)} className="text-xs font-medium text-violet-700 hover:underline">
                Voltar ao modelo
              </button>
            )}
          </div>
          <textarea value={mensagem} onChange={(e) => setEditada(e.target.value)} rows={9} className={`mt-1.5 ${textareaClass}`} />
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
            Ponto de partida — ajuste antes de enviar. A condição nunca vai para a resposta pública do
            Reclame Aqui.
          </p>
        </div>

      </div>

      {erro && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-100">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          {erro}
        </p>
      )}

    </Modal>
  );
}
