"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Calculator,
  CheckCircle2,
  Circle,
  Gift,
  Loader2,
  Trash2,
} from "lucide-react";

import BotaoCopiar from "@/components/shared/BotaoCopiar";
import { ConfirmDelete } from "@/components/shared/Modal";

import type { Case } from "@/lib/models/case";
import { linkDoPortal } from "@/lib/models/establishment";
import {
  CHECKLIST_DA_RENEGOCIACAO,
  mensagemAoFinanceiro,
  MOTIVOS_DE_OFERTA,
  ofertaSugerida,
  prontoParaOferta,
  reais,
  ROTULO_DO_STATUS,
  type NegociacaoView,
} from "@/lib/models/negociacao";
import { descreverRegistro } from "@/lib/services/horasUteis";

import {
  apagarNegociacao,
  listarNegociacoes,
  marcarChecklist,
  responderNegociacao,
} from "@/lib/actions/negociacao";
import { useEstablishments } from "@/lib/context/EstablishmentsContext";
import { useToast } from "@/lib/context/ToastContext";
import { useAgora } from "@/lib/hooks/useAgora";

import OfertaModal from "./OfertaModal";
import RenegociacaoModal from "./RenegociacaoModal";

const TOM_DO_STATUS: Record<NegociacaoView["status"], string> = {
  proposta: "bg-sky-50 text-sky-700 ring-sky-100",
  aceita: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  recusada: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  concluida: "bg-emerald-50 text-emerald-700 ring-emerald-100",
};

/**
 * Ofertas e renegociações do caso, na lateral.
 *
 * A oferta aparece "na hora certa": antes da triagem e do 1º contato o
 * botão explica o que falta, em vez de oferecer desconto como primeira
 * abordagem. Depois, a sugestão da criticidade. Cada negociação mostra
 * quem validou, o status e o que falta — e, na renegociação, o
 * checklist do documento até o recebimento confirmado.
 */
export default function NegociacoesDoCaso({ data }: { data: Case }) {

  const { notify } = useToast();
  const { establishments } = useEstablishments();
  const agoraData = useAgora();

  const [lista, setLista] = useState<NegociacaoView[] | null>(null);
  const [aberto, setAberto] = useState<"oferta" | "renegociacao" | null>(null);
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const [teriaCancelado, setTeriaCancelado] = useState<boolean | null>(null);
  const [humor, setHumor] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [apagando, setApagando] = useState<NegociacaoView | null>(null);

  const recarregar = useCallback(() => {
    listarNegociacoes(data.protocol)
      .then(setLista)
      .catch(() => setLista([]));
  }, [data.protocol]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const pronto = prontoParaOferta(data);
  const sugerida = ofertaSugerida(data.priority);
  const estabelecimento = establishments.find((e) => e.id === data.establishmentId);

  function trocar(n: NegociacaoView) {
    setLista((atual) => (atual ?? []).map((x) => (x.id === n.id ? n : x)));
  }

  async function responder(n: NegociacaoView, resultado: "aceita" | "recusada") {

    setOcupado(n.id);

    try {
      const r = await responderNegociacao({ id: n.id, resultado, teriaCancelado, humor });

      if (!r.ok) {
        notify({ tone: "error", title: "Não foi registrado.", detail: r.erro });
        return;
      }

      trocar(r.negociacao);
      setRespondendo(null);
      setTeriaCancelado(null);
      setHumor(null);

      notify({
        tone: "success",
        title: resultado === "aceita" ? "Aceite registrado." : "Recusa registrada.",
        detail:
          resultado === "aceita"
            ? `${reais(n.valorCents)} lançado em Impacto como custo${teriaCancelado ? ", com o cliente contado como retido" : ""}.`
            : undefined,
      });
    } finally {
      setOcupado(null);
    }
  }

  async function alternar(n: NegociacaoView, item: string) {

    setOcupado(`${n.id}:${item}`);

    try {
      const r = await marcarChecklist({ id: n.id, item, feito: !n.checklist.includes(item) });

      if (!r.ok) {
        notify({ tone: "error", title: "Não foi marcado.", detail: r.erro });
        return;
      }

      trocar(r.negociacao);

      if (r.negociacao.status === "concluida" && n.status !== "concluida") {
        const faltam = CHECKLIST_DA_RENEGOCIACAO.filter((c) => !r.negociacao.checklist.includes(c.id));
        notify({
          tone: "success",
          title: "Renegociação concluída.",
          detail:
            faltam.length === 0
              ? "Recebimento confirmado com o cliente — os cinco itens do checklist estão feitos."
              : `Recebimento confirmado, mas ficou sem marcar: ${faltam.map((c) => c.texto.toLowerCase()).join("; ")}.`,
        });
      }
    } finally {
      setOcupado(null);
    }
  }

  async function apagar() {

    const n = apagando;
    setApagando(null);
    if (!n) return;

    setOcupado(n.id);

    try {
      const r = await apagarNegociacao(n.id);

      if (!r.ok) {
        notify({ tone: "error", title: "Não foi apagada.", detail: r.erro });
        return;
      }

      setLista((atual) => (atual ?? []).filter((x) => x.id !== n.id));
      notify({ tone: "success", title: "Negociação apagada." });
    } finally {
      setOcupado(null);
    }
  }

  const agora = agoraData?.getTime() ?? 0;

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">

      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-zinc-900">Ofertas e negociações</h3>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAberto("oferta")}
          disabled={!pronto.pronto}
          title={pronto.pronto ? "Registrar uma oferta" : `A oferta vem depois da condução do caso: falta ${pronto.falta.join(" e ")}.`}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200 transition-colors hover:bg-violet-50 disabled:cursor-not-allowed disabled:text-zinc-400 disabled:ring-zinc-200 disabled:hover:bg-transparent"
        >
          <Gift size={13} /> Oferta
        </button>
        <button
          type="button"
          onClick={() => setAberto("renegociacao")}
          title="Exceção máxima, com autorização da gestão"
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-50"
        >
          <Calculator size={13} /> Renegociação
        </button>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-zinc-500">
        {!pronto.pronto
          ? `Oferta só depois da condução do caso — falta ${pronto.falta.join(" e ")}.`
          : sugerida
            ? `Caso ${data.priority}: o documento prevê ${sugerida.titulo.toLowerCase()}, se houve impacto real na experiência.`
            : "Caso Normal: o documento não prevê oferta; qualquer condição precisa de validação."}
      </p>

      {lista === null ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-zinc-400">
          <Loader2 size={12} className="animate-spin" /> Carregando…
        </p>
      ) : (
        lista.length > 0 && (
          <ul className="mt-3 space-y-2.5 border-t border-zinc-100 pt-3">
            {lista.map((n) => {

              const vencida = agora > 0 && n.status === "proposta" && n.validaAte && Date.parse(n.validaAte) < agora;

              return (
                <li key={n.id} className="rounded-xl bg-zinc-50 px-3 py-2.5 text-xs ring-1 ring-inset ring-zinc-100">

                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block font-medium text-zinc-800">
                        {n.tipo === "renegociacao" ? "Renegociação" : n.descricao}
                      </span>
                      <span className="mt-0.5 block text-zinc-500">
                        {reais(n.valorCents)} · {descreverRegistro(n.criadoEm)} · {n.autorNome}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ring-inset ${TOM_DO_STATUS[n.status]}`}>
                        {vencida ? "Vencida" : ROTULO_DO_STATUS[n.status]}
                      </span>
                      {n.status === "proposta" && (
                        <button
                          type="button"
                          title="Apagar — registrada por engano"
                          onClick={() => setApagando(n)}
                          className="rounded p-0.5 text-zinc-300 transition-colors hover:text-rose-600"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </span>
                  </div>

                  {n.motivos.length > 0 && (
                    <p className="mt-1 text-zinc-500">
                      {n.motivos.map((m) => MOTIVOS_DE_OFERTA.find((x) => x.id === m)?.texto ?? m).join(" · ")}
                    </p>
                  )}

                  {n.validadoPor && (
                    <p className="mt-1 text-zinc-500">
                      {n.tipo === "renegociacao" ? "Autorizada por" : "Validada por"} {n.validadoPor}
                      {n.validaAte ? ` · vale até ${descreverRegistro(n.validaAte)}` : ""}
                    </p>
                  )}

                  {n.respondidaEm && (
                    <p className="mt-1 text-zinc-500">
                      {n.status === "recusada" ? "Recusada" : "Aceita"} em {descreverRegistro(n.respondidaEm)}
                      {n.impactoId ? " · lançada em Impacto" : ""}
                    </p>
                  )}

                  {/* A resposta do cliente, com as duas perguntas do Impacto. */}
                  {n.status === "proposta" && (
                    respondendo === n.id ? (
                      <div className="mt-2 space-y-2 rounded-lg bg-white px-2.5 py-2 ring-1 ring-inset ring-zinc-200">
                        <p className="font-medium text-zinc-700">Sem esta condição, o cliente teria cancelado?</p>
                        <div className="flex gap-1.5">
                          {([
                            [true, "Sim"],
                            [false, "Não"],
                            [null, "Não sei"],
                          ] as const).map(([v, r]) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => setTeriaCancelado(v)}
                              className={`rounded-full px-2.5 py-1 font-medium ring-1 ring-inset ${
                                teriaCancelado === v ? "bg-violet-50 text-violet-800 ring-violet-300" : "text-zinc-600 ring-zinc-200"
                              }`}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                        <p className="font-medium text-zinc-700">Como o cliente ficou (1 a 5)?</p>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((h) => (
                            <button
                              key={h}
                              type="button"
                              onClick={() => setHumor(humor === h ? null : h)}
                              className={`h-7 w-7 rounded-lg font-semibold tabular-nums ring-1 ring-inset ${
                                humor === h ? "bg-violet-50 text-violet-800 ring-violet-300" : "text-zinc-600 ring-zinc-200"
                              }`}
                            >
                              {h}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-1.5 pt-1">
                          <button
                            type="button"
                            disabled={ocupado === n.id}
                            onClick={() => responder(n, "aceita")}
                            className="flex items-center gap-1 rounded-lg bg-violet-700 px-2.5 py-1.5 font-medium text-white transition-colors hover:bg-violet-800 disabled:opacity-50"
                          >
                            {ocupado === n.id && <Loader2 size={11} className="animate-spin" />}
                            Salvar aceite
                          </button>
                          <button type="button" onClick={() => setRespondendo(null)} className="rounded-lg px-2.5 py-1.5 font-medium text-zinc-600 hover:bg-zinc-100">
                            Voltar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setRespondendo(n.id);
                            setTeriaCancelado(data.churnRisk ? true : null);
                            setHumor(null);
                          }}
                          className="rounded-lg bg-white px-2.5 py-1 font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 transition-colors hover:bg-emerald-50"
                        >
                          Cliente aceitou
                        </button>
                        <button
                          type="button"
                          disabled={ocupado === n.id}
                          onClick={() => responder(n, "recusada")}
                          className="rounded-lg bg-white px-2.5 py-1 font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-100"
                        >
                          Recusou
                        </button>
                      </div>
                    )
                  )}

                  {/* O checklist do documento, na renegociação. */}
                  {n.tipo === "renegociacao" && n.status !== "recusada" && (
                    <ul className="mt-2 space-y-1">
                      {CHECKLIST_DA_RENEGOCIACAO.map((c) => {
                        const feito = n.checklist.includes(c.id);
                        const carregando = ocupado === `${n.id}:${c.id}`;
                        return (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => alternar(n, c.id)}
                              disabled={carregando}
                              className="flex w-full items-start gap-1.5 text-left text-zinc-600 hover:text-zinc-900"
                            >
                              {carregando ? (
                                <Loader2 size={13} className="mt-px shrink-0 animate-spin" />
                              ) : feito ? (
                                <CheckCircle2 size={13} className="mt-px shrink-0 text-emerald-600" />
                              ) : (
                                <Circle size={13} className="mt-px shrink-0 text-zinc-300" />
                              )}
                              <span className={feito ? "text-zinc-800" : ""}>{c.texto}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {n.tipo === "renegociacao" && (n.status === "aceita" || n.status === "concluida") && (
                    <div className="mt-2">
                      <BotaoCopiar
                        className="!px-2.5 !py-1.5 !text-xs bg-white"
                        rotulo="Copiar pedido ao financeiro"
                        texto={mensagemAoFinanceiro({
                          cliente: n.cliente,
                          protocolo: data.protocol,
                          portal: estabelecimento ? linkDoPortal(estabelecimento) || undefined : undefined,
                          valorFinalCents: n.valorCents,
                        })}
                      />
                    </div>
                  )}

                </li>
              );
            })}
          </ul>
        )
      )}

      {aberto === "oferta" && (
        <OfertaModal
          item={data}
          onClose={() => setAberto(null)}
          onSalvo={(n) => setLista((atual) => [n, ...(atual ?? [])])}
        />
      )}

      {aberto === "renegociacao" && (
        <RenegociacaoModal
          item={data}
          onClose={() => setAberto(null)}
          onSalvo={(n) => setLista((atual) => [n, ...(atual ?? [])])}
        />
      )}

      <ConfirmDelete
        open={apagando !== null}
        label={apagando ? `${apagando.tipo === "renegociacao" ? "a renegociação" : "a oferta"} de ${reais(apagando.valorCents)}` : ""}
        onCancel={() => setApagando(null)}
        onConfirm={apagar}
      />

    </section>
  );
}
