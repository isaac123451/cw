"use client";

import { ArrowRight, Check, CircleAlert, PartyPopper, PhoneOff, Route } from "lucide-react";

import BotaoCopiar from "@/components/shared/BotaoCopiar";

import type { NpsResponseView } from "@/lib/models/nps";
import { mensagemDeReengajamento, type AcaoDoNps, type PassoDoNps } from "@/lib/models/trilhaNps";
import { descreverRegistro } from "@/lib/services/horasUteis";

interface Props {
  item: NpsResponseView;
  passos: PassoDoNps[];
  executar: (acao: AcaoDoNps) => void;
}

const FASES: PassoDoNps["fase"][] = ["Diagnóstico", "Contato", "Validação", "Encerramento"];

const ROTULO_DA_ACAO: Record<AcaoDoNps, string> = {
  classificar: "Classificar",
  contato: "Falei com o cliente",
  tentativa: "Registrar tentativa",
  retorno: "Registrar o retorno",
  confirmacao: "Confirmação do cliente",
  promotor: "Ações do promotor",
  encerrar: "Encerrar o ciclo",
};

/**
 * A trilha do NPS no topo da ficha: onde o ciclo está e o que falta.
 *
 * O mesmo desenho da trilha do Reclame Aqui e das redes — os passos por
 * fase, cada um um botão, e o passo da vez com a ação dele na frente —,
 * para quem trabalha as três frentes não reaprender a tela em cada uma.
 */
export default function TrilhaDoNps({ item, passos, executar }: Props) {

  const atual = passos.find((p) => p.estado === "atual");
  const feitos = passos.filter((p) => p.estado === "feito").length;
  const contam = passos.filter((p) => p.estado !== "opcional").length;

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
          <Route size={17} className="text-violet-700" />
          Trilha do NPS
        </h2>
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-medium tabular-nums text-zinc-500">
            {feitos} de {contam} passos
          </span>
          <span className="h-1.5 w-28 overflow-hidden rounded-full bg-zinc-100" aria-hidden>
            <span
              className="block h-full rounded-full bg-violet-600 transition-all"
              style={{ width: `${Math.round((feitos / Math.max(1, contam)) * 100)}%` }}
            />
          </span>
        </div>
      </div>

      <div className="mt-4">
        <ol className="flex flex-wrap gap-x-5 gap-y-3">
          {FASES.map((fase) => {
            const daFase = passos.filter((p) => p.fase === fase);
            if (daFase.length === 0) return null;
            return (
              <li key={fase} className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{fase}</p>
                <ol className="mt-1.5 flex flex-wrap gap-1.5">
                  {daFase.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => p.acao && executar(p.acao)}
                        disabled={!p.acao}
                        title={[`${p.numero}. ${p.titulo}`, p.detalhe, p.quando ? `Em ${descreverRegistro(p.quando)}.` : null]
                          .filter(Boolean)
                          .join(" · ")}
                        className={`flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-xs font-medium ring-1 ring-inset transition-colors disabled:cursor-default ${
                          p.estado === "feito"
                            ? "bg-emerald-50 text-emerald-800 ring-emerald-200 hover:bg-emerald-100"
                            : p.estado === "atual"
                              ? p.alerta
                                ? "bg-rose-600 text-white ring-rose-600 hover:bg-rose-700"
                                : "bg-violet-700 text-white ring-violet-700 hover:bg-violet-800"
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
                                ? p.alerta
                                  ? "bg-white text-rose-700"
                                  : "bg-white text-violet-800"
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

      {atual ? (
        <div
          className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 ring-1 ring-inset ${
            atual.alerta ? "bg-rose-50/70 ring-rose-100" : "bg-violet-50/60 ring-violet-100"
          }`}
        >
          <div className="min-w-0 flex-1">
            <p className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${atual.alerta ? "text-rose-700" : "text-violet-700"}`}>
              {atual.alerta && <CircleAlert size={12} />}
              Agora · passo {atual.numero}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-zinc-900">{atual.titulo}</p>
            {atual.detalhe && <p className="mt-0.5 text-xs leading-relaxed text-zinc-600">{atual.detalhe}</p>}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {atual.id === "contato" && atual.acao === "contato" && (
              <button
                type="button"
                onClick={() => executar("tentativa")}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-white"
              >
                <PhoneOff size={14} /> Tentei, sem sucesso
              </button>
            )}
            {atual.id === "confirmacao" && (
              <BotaoCopiar texto={mensagemDeReengajamento(item)} rotulo="Copiar a pergunta" className="bg-white" />
            )}
            {atual.acao && (
              <button
                type="button"
                onClick={() => executar(atual.acao!)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors ${
                  atual.alerta ? "bg-rose-600 hover:bg-rose-700" : "bg-violet-700 hover:bg-violet-800"
                }`}
              >
                {ROTULO_DA_ACAO[atual.acao]}
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-inset ring-emerald-100">
          <PartyPopper size={18} className="shrink-0 text-emerald-600" />
          <span>
            <strong>Ciclo fechado.</strong>{" "}
            {passos.find((p) => p.id === "encerrar")?.detalhe}
            {item.moodAfter && item.score <= 6 && item.moodAfter >= 4 ? " Um detrator que saiu satisfeito do contato — recuperado." : ""}
          </span>
        </div>
      )}

    </section>
  );
}
