"use client";

import { useEffect, useState } from "react";

import {
  ArrowRight,
  Check,
  Loader2,
  MessageSquareWarning,
  PartyPopper,
  PhoneOff,
  Route,
} from "lucide-react";

import TextoEditavel, { CopiarOuEditar } from "@/components/shared/TextoEditavel";
import PorQue from "@/components/shared/PorQue";

import { PORQUE_DO_PASSO_RA } from "@/lib/documentos/porques";

import type { Case } from "@/lib/models/case";
import {
  pedidoDeAvaliacao,
  persistencia,
  semNoticia,
  type Persistencia,
} from "@/lib/models/cadencia";
import {
  mensagemDeAtualizacao,
  mensagemPublicaTransparente,
} from "@/lib/models/mensagens";
import {
  trilhaDoCaso,
  type AcaoDoPasso,
  type PassoDaTrilha,
} from "@/lib/models/trilha";
import { descreverRegistro } from "@/lib/services/horasUteis";
import {
  movementStatus,
  movementsOf,
  openMovementOf,
} from "@/lib/services/movement.service";

import { listarContatos } from "@/lib/actions/tratativa";
import { useMovements } from "@/lib/context/MovementsContext";
import { useSla } from "@/lib/context/SlaContext";
import { useAgora } from "@/lib/hooks/useAgora";

import { quandoVence } from "./RelogioDoCaso";
import { useTratativa } from "./TratativaProvider";

interface Props {
  data: Case;
  /** O que o servidor gravou, para o rascunho aberto acompanhar. */
  aoMudarNoServidor?: (patch: Partial<Case>) => void;
  /** Leva à aba em que se escreve a resposta pública. */
  irParaResposta: () => void;
  /** Leva à aba em que fica a área acionada. */
  irParaAreas: () => void;
}

const FASES: PassoDaTrilha["fase"][] = ["Diagnóstico", "Conexão", "Validação", "Finalização"];

const ROTULO_DA_ACAO: Record<AcaoDoPasso, string> = {
  triar: "Triar o caso",
  imersao: "Ver quem é o cliente",
  contato: "Registrar o 1º contato",
  tentativa: "Registrar nova tentativa",
  "acionar-area": "Acionar área",
  validacao: "Cliente confirmou a solução",
  resposta: "Escrever a resposta",
  "pedir-avaliacao": "Pedir a avaliação",
  "cw-engine": "Finalizar",
};

/**
 * A trilha do Reclame Aqui no topo do caso: onde ele está e o que falta.
 *
 * O documento descreve oito passos e uma finalização; a ficha mostrava
 * abas. Quem abria o caso tinha de lembrar a ordem — e o passo que se
 * esquece é sempre o mesmo: validar com o cliente antes de responder,
 * pedir a avaliação de novo dois dias depois, atualizar o CW Engine.
 *
 * Aqui cada passo é um botão, o passo atual vem com a ação dele na
 * frente, e os três ritmos que ninguém segue de cabeça (persistência,
 * cliente sem notícia, lembrete de avaliação) aparecem só quando pedem
 * alguma coisa.
 */
export default function TrilhaDoCaso({ data, aoMudarNoServidor, irParaResposta, irParaAreas }: Props) {

  const { movements } = useMovements();
  const { expediente } = useSla();
  const agora = useAgora();
  const t = useTratativa();

  const opcoes = { aoSalvar: aoMudarNoServidor };

  const aberta = openMovementOf(data.id, movements);
  const statusDaArea = aberta && agora ? movementStatus(aberta, { agora, expediente }) : undefined;
  const concluidas = movementsOf(data.id, movements).filter((m) => m.returnedAt).length;

  const passos = trilhaDoCaso(data, {
    areaAberta: aberta
      ? { destino: aberta.destination, vence: statusDaArea ? quandoVence(statusDaArea.prazo) : undefined }
      : undefined,
    areasConcluidas: concluidas,
    agora: agora ?? undefined,
  });

  const atual = passos.find((p) => p.estado === "atual");
  const feitos = passos.filter((p) => p.estado === "feito").length;
  const obrigatorios = passos.filter((p) => p.estado !== "opcional").length;

  /*
    A cadência de persistência precisa da lista de tentativas (os
    horários já tentados). Só é buscada quando há tentativa sem resposta
    — nos outros casos, a ficha não paga uma ida ao banco por nada.
  */
  const tentativas = data.tentativasSemResposta ?? 0;
  const [cadencia, setCadencia] = useState<Persistencia | null>(null);

  useEffect(() => {
    if (tentativas === 0) return;

    let ativo = true;

    listarContatos(data.protocol)
      .then((contatos) => {
        if (ativo) setCadencia(persistencia(contatos, new Date(), expediente));
      })
      .catch(() => ativo && setCadencia(null));

    return () => {
      ativo = false;
    };
  }, [data.protocol, tentativas, data.ultimoContatoEm, expediente]);

  const vacuo = agora ? semNoticia(data, agora, expediente) : null;
  const avaliacao = agora ? pedidoDeAvaliacao(data, agora) : null;

  function executar(acao?: AcaoDoPasso) {
    switch (acao) {
      case "triar":
        return t.abrirTriagem(data, opcoes);
      case "imersao":
        return t.abrirImersao(data, opcoes);
      case "contato":
        return t.abrirContato(data, "contato", opcoes);
      case "tentativa":
        return t.abrirContato(data, "tentativa", opcoes);
      case "acionar-area":
        return aberta ? irParaAreas() : t.abrirArea(data);
      case "validacao":
        return t.abrirContato(data, "validacao", opcoes);
      case "resposta":
        return irParaResposta();
      case "pedir-avaliacao":
        return t.abrirPedidoAvaliacao(data, opcoes);
      case "cw-engine":
        return t.abrirFinalizacao(data, opcoes);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
          <Route size={17} className="text-violet-700" />
          Trilha do Reclame Aqui
        </h2>
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-medium tabular-nums text-zinc-500">
            {feitos} de {obrigatorios} passos
          </span>
          <span className="h-1.5 w-28 overflow-hidden rounded-full bg-zinc-100" aria-hidden>
            <span
              className="block h-full rounded-full bg-violet-600 transition-all"
              style={{ width: `${Math.round((feitos / Math.max(1, obrigatorios)) * 100)}%` }}
            />
          </span>
        </div>
      </div>

      {/* Os passos, por fase — quebram linha em vez de rolar. */}
      <div className="mt-4">
        <ol className="flex flex-wrap gap-x-5 gap-y-3">
          {FASES.map((fase) => {
            const daFase = passos.filter((p) => p.fase === fase);
            return (
              <li key={fase} className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{fase}</p>
                <ol className="mt-1.5 flex flex-wrap gap-1.5">
                  {daFase.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => executar(p.acao)}
                        title={[
                          `${p.numero}. ${p.titulo}`,
                          p.detalhe,
                          p.quando ? `Em ${descreverRegistro(p.quando)}.` : null,
                          p.deduzido ? "Feito antes de a plataforma registrar este passo — marcado pelo que o caso mostra." : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                        className={`flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-xs font-medium ring-1 ring-inset transition-colors ${
                          p.estado === "feito"
                            ? p.deduzido
                              ? "bg-emerald-50/50 text-emerald-700/80 ring-emerald-100 hover:bg-emerald-50"
                              : "bg-emerald-50 text-emerald-800 ring-emerald-200 hover:bg-emerald-100"
                            : p.estado === "atual"
                              ? "bg-violet-700 text-white ring-violet-700 hover:bg-violet-800"
                              : p.estado === "opcional"
                                ? "text-zinc-400 ring-zinc-200 [border-style:dashed] hover:bg-zinc-50"
                                : "text-zinc-500 ring-zinc-200 hover:bg-zinc-50"
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                            p.estado === "feito"
                              ? "bg-emerald-600 text-white"
                              : p.estado === "atual"
                                ? "bg-white text-violet-800"
                                : "bg-zinc-100 text-zinc-500"
                          }`}
                        >
                          {p.estado === "feito" ? <Check size={11} strokeWidth={3} /> : p.numero}
                        </span>
                        <span className="whitespace-nowrap">{p.titulo}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </li>
            );
          })}
        </ol>
      </div>

      {/* O passo atual, com a ação dele na frente. */}
      {atual ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-violet-50/60 px-4 py-3 ring-1 ring-inset ring-violet-100">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">
              Agora · passo {atual.numero}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm font-semibold text-zinc-900">
              {atual.titulo}
              {PORQUE_DO_PASSO_RA[atual.id] && <PorQue chave={PORQUE_DO_PASSO_RA[atual.id]} />}
            </p>
            {atual.detalhe && <p className="mt-0.5 text-xs leading-relaxed text-zinc-600">{atual.detalhe}</p>}
            {atual.id === "pedir-avaliacao" && avaliacao?.ativo && (
              <p className={`mt-1 text-xs font-medium ${avaliacao.vencido ? "text-violet-800" : "text-zinc-500"}`}>
                {avaliacao.resumo}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {atual.id === "contato" && (
              <button
                type="button"
                onClick={() => executar("tentativa")}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-white"
              >
                <PhoneOff size={14} /> Tentei, sem sucesso
              </button>
            )}
            {atual.id === "validacao" && !aberta && (
              <button
                type="button"
                onClick={() => t.abrirArea(data)}
                className="rounded-xl px-3 py-2 text-sm font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-white"
              >
                Precisa de outra área
              </button>
            )}
            <button
              type="button"
              onClick={() => executar(atual.acao)}
              className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-800"
            >
              {atual.id === "area" && aberta ? `Ver ${aberta.destination}` : atual.acao ? ROTULO_DA_ACAO[atual.acao] : "Abrir"}
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-inset ring-emerald-100">
          <PartyPopper size={18} className="shrink-0 text-emerald-600" />
          <span>
            <strong>Trilha completa.</strong> Todos os passos da documentação estão feitos neste caso
            {data.evaluated && data.score !== undefined ? ` — e a nota veio: ${data.score}.` : "."}
          </span>
        </div>
      )}

      {/* Persistência: a próxima tentativa, ou a cadência esgotada. */}
      {tentativas > 0 && (
        <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 ring-1 ring-inset ring-amber-100">
          {cadencia === null ? (
            <span className="flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" /> Calculando a cadência…
            </span>
          ) : (
            <>
              <p className="font-medium">{cadencia.resumo}</p>
              {cadencia.esgotada && (
                <TextoEditavel
                  gerado={mensagemPublicaTransparente({ nome: data.customer })}
                  rotulo="Copiar a mensagem pública"
                  linhasMinimas={3}
                  className="mt-2"
                />

              )}
            </>
          )}
        </div>
      )}

      {/* Cliente sem notícia: o "não deixe o cliente no vácuo" do Passo 5. */}
      {vacuo?.atrasado && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-orange-50 px-4 py-3 text-xs text-orange-900 ring-1 ring-inset ring-orange-100">
          <p className="flex min-w-0 flex-1 items-start gap-2 leading-relaxed">
            <MessageSquareWarning size={15} className="mt-0.5 shrink-0 text-orange-600" />
            <span>
              <strong>{vacuo.dias} dias úteis sem notícia ao cliente.</strong> A documentação pede para mantê-lo
              informado enquanto a solução anda — mesmo sem novidade.
            </span>
          </p>
          <div className="flex shrink-0 gap-2">
            <CopiarOuEditar
              texto={mensagemDeAtualizacao({
                nome: data.customer,
                area: aberta?.destination,
                retornoAte: statusDaArea ? quandoVence(statusDaArea.prazo) : undefined,
              })}
              rotulo="Copiar atualização"
              className="bg-white"
            />
            <button
              type="button"
              onClick={() => t.abrirContato(data, "atualizacao", opcoes)}
              className="rounded-xl bg-orange-600 px-3.5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-700"
            >
              Registrar atualização
            </button>
          </div>
        </div>
      )}

    </section>
  );
}
