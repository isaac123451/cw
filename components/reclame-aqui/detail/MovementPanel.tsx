"use client";

import { useState } from "react";

import {
  AlarmClock,
  CornerDownLeft,
  Loader2,
  Megaphone,
  Share2,
  Timer,
  Trash2,
} from "lucide-react";

import { Case } from "@/lib/models/case";
import { mensagemDeAtualizacao, mensagemDeEscalonamento } from "@/lib/models/mensagens";

import { useMovements } from "@/lib/context/MovementsContext";
import { useSla } from "@/lib/context/SlaContext";
import { useToast } from "@/lib/context/ToastContext";
import { useAgora } from "@/lib/hooks/useAgora";

import {
  apagarMovimento,
  registrarEscalonamento,
  registrarRetornoDaArea,
} from "@/lib/actions/tratativa";

import {
  movementStatus,
  movementsOf,
  openMovementOf,
} from "@/lib/services/movement.service";

import { toneOfSla } from "@/lib/services/sla.service";
import {
  descreverMinutosUteis,
  descreverPrazo,
  descreverRegistro,
} from "@/lib/services/horasUteis";

import SurfaceCard from "@/components/shared/SurfaceCard";
import { CopiarOuEditar } from "@/components/shared/TextoEditavel";
import { ConfirmDelete, textareaClass } from "@/components/shared/Modal";

import { quandoVence } from "@/components/reclame-aqui/tratativa/RelogioDoCaso";
import { useTratativa } from "@/components/reclame-aqui/tratativa/TratativaProvider";

/**
 * As áreas internas do caso: quem está com a bola e até quando.
 *
 * Uma de cada vez em aberto: acionar de novo sem registrar o retorno
 * deixaria dois relógios correndo sobre o mesmo caso, e nenhum diria
 * quem está com a bola.
 *
 * O acionamento sai do modelo da documentação (com o prazo da
 * criticidade), o retorno grava com a resposta do servidor, e o atraso
 * vira escalonamento ao gestor da área — com a mensagem pronta e a data
 * registrada. Enquanto isso, o cliente recebe notícia: é o Passo 5.
 */
export default function MovementPanel({
  data,
}: {
  data: Case;
}) {

  const { movements, aplicarMovimento, retirarMovimento } = useMovements();
  const { expediente } = useSla();
  const { notify } = useToast();
  const { abrirArea, abrirContato } = useTratativa();
  const agora = useAgora() ?? undefined;

  const [retorno, setRetorno] = useState("");
  const [salvando, setSalvando] = useState<"retorno" | "escalonar" | "apagar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [apagando, setApagando] = useState(false);

  const doCaso = movementsOf(data.id, movements);
  const aberta = openMovementOf(data.id, movements);

  const status = aberta ? movementStatus(aberta, { agora, expediente }) : undefined;

  const historico = doCaso.filter((item) => item.returnedAt);

  async function salvarRetorno() {

    if (!aberta) return;

    setSalvando("retorno");
    setErro(null);

    try {
      const r = await registrarRetornoDaArea({ id: aberta.id, retorno });

      if (!r.ok) {
        setErro(r.erro);
        return;
      }

      aplicarMovimento(r.movimento);
      setRetorno("");

      const final = movementStatus(r.movimento, { expediente });

      notify({
        tone: "success",
        title: `Retorno de ${aberta.destination} registrado.`,
        detail: `${final.label} — ${descreverMinutosUteis(final.decorridoMin, expediente)} de tempo útil com a área. Próximo passo: validar a solução com o cliente.`,
      });
    } catch {
      setErro("O retorno não foi gravado. Tente de novo.");
    } finally {
      setSalvando(null);
    }
  }

  async function escalonar() {

    if (!aberta) return;

    setSalvando("escalonar");
    setErro(null);

    try {
      const r = await registrarEscalonamento(aberta.id);

      if (!r.ok) {
        setErro(r.erro);
        return;
      }

      aplicarMovimento(r.movimento);

      notify({
        tone: "success",
        title: "Escalonamento registrado.",
        detail: `Fica no histórico do caso que o atraso de ${aberta.destination} subiu para o gestor.`,
      });
    } catch {
      setErro("O escalonamento não foi gravado. Tente de novo.");
    } finally {
      setSalvando(null);
    }
  }

  async function apagar() {

    if (!aberta) return;

    setApagando(false);
    setSalvando("apagar");
    setErro(null);

    try {
      const r = await apagarMovimento(aberta.id);

      if (!r.ok) {
        setErro(r.erro);
        return;
      }

      retirarMovimento(aberta.id);
      notify({ tone: "success", title: "Acionamento apagado." });
    } catch {
      setErro("Não foi apagado. Tente de novo.");
    } finally {
      setSalvando(null);
    }
  }

  const estourado = status?.situation === "estourado";

  return (
    <>
      <SurfaceCard
        title="Áreas internas"
        description="Quem está com o caso, com o prazo da criticidade contado em horas úteis."
        hint="É um relógio separado do prazo do 1º contato: o caso pode estar em dia com o cliente e parado com uma área."
        action={
          !aberta && (
            <button
              onClick={() => abrirArea(data)}
              title="Acionar uma área, com o modelo de mensagem da documentação"
              className="flex shrink-0 items-center gap-2 rounded-xl border border-violet-200 px-3.5 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
            >
              <Share2 size={15} />
              Acionar área
            </button>
          )
        }
      >

        {aberta && status ? (

          <div className="rounded-2xl border border-zinc-200/80 p-4">

            <div className="flex flex-wrap items-start justify-between gap-3">

              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900">
                  Com {aberta.destination}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Acionado por {aberta.actor} em {descreverRegistro(aberta.startedAt)} · prazo de{" "}
                  {descreverPrazo(aberta.dueHours)}
                  {aberta.prioridade ? ` (caso ${aberta.prioridade})` : ""} · vence {quandoVence(status.prazo)}
                  {aberta.chamado ? ` · chamado ${aberta.chamado}` : ""}
                </p>
              </div>

              <span
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${toneOfSla(status.situation)}`}
                title={status.label}
              >
                <Timer size={12} />
                {estourado
                  ? `${descreverMinutosUteis(status.restanteMin, expediente)} de atraso`
                  : `retorno em ${descreverMinutosUteis(status.restanteMin, expediente)}`}
              </span>

            </div>

            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
              {aberta.reason}
            </p>

            {/* O atraso sobe para o gestor da área, como pede a documentação. */}
            {estourado && (
              <div className="mt-4 rounded-xl bg-rose-50 px-3.5 py-3 text-xs leading-relaxed text-rose-900 ring-1 ring-inset ring-rose-100">
                {aberta.escalonadoEm ? (
                  <p className="flex items-center gap-1.5 font-medium">
                    <AlarmClock size={13} /> Escalonado ao gestor de {aberta.destination} em{" "}
                    {descreverRegistro(aberta.escalonadoEm)}.
                  </p>
                ) : (
                  <>
                    <p className="flex items-center gap-1.5 font-medium">
                      <AlarmClock size={13} /> O prazo venceu: a documentação pede para escalonar ao gestor da área.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <CopiarOuEditar
                        className="bg-white"
                        rotulo="Copiar mensagem ao gestor"
                        texto={mensagemDeEscalonamento({
                          area: aberta.destination,
                          protocolo: data.protocol,
                          assunto: data.title,
                          acionadoEm: descreverRegistro(aberta.startedAt),
                          vencidoHa: descreverMinutosUteis(status.restanteMin, expediente),
                          raUrl: data.raUrl,
                        })}
                      />
                      <button
                        type="button"
                        onClick={escalonar}
                        disabled={salvando !== null}
                        className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
                      >
                        {salvando === "escalonar" && <Loader2 size={14} className="animate-spin" />}
                        Registrar escalonamento
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Enquanto a área trabalha, o cliente recebe notícia. */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-600 ring-1 ring-inset ring-zinc-200">
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <Megaphone size={13} className="shrink-0 text-zinc-400" />
                Não deixe o cliente no vácuo: avise que {aberta.destination} está analisando.
              </span>
              <span className="flex shrink-0 gap-2">
                <CopiarOuEditar
                  className="bg-white !px-2.5 !py-1.5 !text-xs"
                  rotulo="Copiar aviso"
                  texto={mensagemDeAtualizacao({
                    nome: data.customer,
                    area: aberta.destination,
                    retornoAte: quandoVence(status.prazo),
                  })}
                />
                <button
                  type="button"
                  onClick={() => abrirContato(data, "atualizacao")}
                  className="rounded-xl bg-white px-2.5 py-1.5 font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-100"
                >
                  Registrar
                </button>
              </span>
            </div>

            <div className="mt-4 space-y-3 border-t border-zinc-100 pt-4">

              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                Retorno da área
              </p>

              <textarea
                value={retorno}
                onChange={(e) => setRetorno(e.target.value)}
                rows={3}
                placeholder={`O que ${aberta.destination} fez — a solução ou o parecer técnico. É o que se valida com o cliente depois.`}
                className={textareaClass}
              />

              <div className="flex flex-wrap items-center gap-2">

                <button
                  onClick={salvarRetorno}
                  disabled={retorno.trim().length < 8 || salvando !== null}
                  className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
                >
                  {salvando === "retorno" ? <Loader2 size={15} className="animate-spin" /> : <CornerDownLeft size={15} />}
                  Salvar retorno
                </button>

                <button
                  onClick={() => setApagando(true)}
                  disabled={salvando !== null}
                  title="Apagar este acionamento — use quando foi registrado por engano"
                  className="rounded-xl p-2.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                >
                  {salvando === "apagar" ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                </button>

              </div>

            </div>

          </div>

        ) : (

          <p className="rounded-xl border border-dashed border-zinc-200 py-8 text-center text-sm text-zinc-400">
            Nenhuma área com o caso agora. Acione só quando precisar — Suporte N2, Financeiro,
            Comercial ou Desenvolvimento.
          </p>

        )}

        {erro && (
          <p className="mt-3 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800 ring-1 ring-inset ring-rose-100">
            {erro}
          </p>
        )}

        {historico.length > 0 && (

          <div className="mt-5 border-t border-zinc-100 pt-4">

            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Já retornaram
            </p>

            <ul className="mt-3 space-y-3">

              {historico.map((item) => {

                const s = movementStatus(item, { expediente });

                return (
                  <li key={item.id} className="flex gap-3 text-sm">

                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${s.restanteMin < 0 ? "bg-rose-500" : "bg-teal-500"}`} />

                    <span className="min-w-0 flex-1">

                      <span className="block font-medium text-zinc-800">
                        {item.destination}
                        <span className="ml-2 text-[11px] font-normal text-zinc-400">
                          {descreverRegistro(item.startedAt)} → {descreverRegistro(item.returnedAt)} ·{" "}
                          {descreverMinutosUteis(s.decorridoMin, expediente)} de tempo útil
                          {s.restanteMin < 0 && " · fora do prazo"}
                          {item.escalonadoEm && " · escalonado"}
                        </span>
                      </span>

                      <span className="mt-0.5 block whitespace-pre-wrap text-xs leading-relaxed text-zinc-500">
                        {item.outcome}
                      </span>

                    </span>

                  </li>
                );
              })}

            </ul>

          </div>

        )}

      </SurfaceCard>

      <ConfirmDelete
        open={apagando}
        label={aberta ? `o acionamento de ${aberta.destination}` : "o acionamento"}
        onCancel={() => setApagando(false)}
        onConfirm={apagar}
      />
    </>
  );
}
