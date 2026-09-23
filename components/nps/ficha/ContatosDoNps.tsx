"use client";

import { useState } from "react";

import { CheckCircle2, Flag, Loader2, MessageSquareHeart, Phone, PhoneOff } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import {
  isEncerrado,
  JANELA_TENTATIVAS_DIAS,
  moodOf,
  rotuloDeEtapa,
  STATUS_SEM_TRATATIVA,
  tentativasMinimas,
  type NpsResponseView,
} from "@/lib/models/nps";
import { tentativasNaJanela } from "@/lib/services/nps.service";
import { descreverRegistro } from "@/lib/services/horasUteis";
import { podeMarcarSemRetorno, quandoLiberaSemRetorno } from "@/lib/models/tratativa";
import { useAgora } from "@/lib/hooks/useAgora";
import { marcarTentativaNpsSemRetorno } from "@/lib/actions/nps";
import { useNps } from "@/lib/context/NpsContext";
import { useToast } from "@/lib/context/ToastContext";

import type { ModoDoContato } from "./ContatoNpsModal";

interface Evento {
  id: string;
  em: string;
  icone: typeof Phone;
  cor: string;
  titulo: string;
  texto?: string;
  quem?: string;
  /** A tentativa ainda aguardando retorno — o id, para marcar depois das 2 horas. */
  aguardando?: string;
}

/**
 * O que aconteceu com este cliente, em ordem: tentativas, o retorno, a
 * confirmação e o encerramento.
 *
 * Era uma lista de tentativas num canto e o pós-contato noutro, cada um
 * com o seu formulário aberto. Aqui é a linha do tempo do ciclo — o
 * "histórico do cliente está atualizado?" do checklist do guia — e os
 * registros saem pelos botões, que abrem o diálogo certo.
 */
export default function ContatosDoNps({ item, registrar }: { item: NpsResponseView; registrar: (modo: ModoDoContato) => void }) {

  const agora = useAgora();
  const { recarregar } = useNps();
  const { notify } = useToast();
  const [marcando, setMarcando] = useState<string | null>(null);
  const encerrado = isEncerrado(item.status);
  const minimas = tentativasMinimas(item.kind);
  const naJanela = agora ? tentativasNaJanela(item, agora).length : 0;
  const humor = moodOf(item.moodAfter);

  const eventos: Evento[] = [
    ...item.attempts.map((a) => ({
      id: a.id,
      em: a.createdAt,
      icone: Phone,
      cor: a.resultado === "aguardando" ? "text-amber-500" : "text-zinc-400",
      titulo: `Tentativa por ${a.channel} · ${a.resultado === "aguardando" ? "aguardando retorno" : "sem retorno"}`,
      texto: a.note,
      quem: a.actor,
      aguardando: a.resultado === "aguardando" && !encerrado ? a.id : undefined,
    })),
    ...(item.postContactAt
      ? [
          {
            id: "retorno",
            em: item.postContactAt,
            icone: MessageSquareHeart,
            cor: "text-violet-500",
            titulo: [
              "Falou com o cliente",
              humor ? `${humor.emoji} ${humor.label}` : null,
              item.resolvedAfter === true ? "resolveu" : item.resolvedAfter === false ? "não resolveu" : null,
            ]
              .filter(Boolean)
              .join(" · "),
            texto: item.postContactNote,
            quem: item.postContactBy,
          },
        ]
      : []),
    ...(item.confirmedAt
      ? [{ id: "confirmacao", em: item.confirmedAt, icone: CheckCircle2, cor: "text-emerald-500", titulo: "O cliente confirmou que resolveu" }]
      : []),
    ...(encerrado && item.closedAt && item.status !== STATUS_SEM_TRATATIVA
      ? [
          {
            id: "encerramento",
            em: item.closedAt,
            icone: Flag,
            cor: "text-emerald-600",
            titulo: `Encerrado: ${rotuloDeEtapa(item.status)}`,
            texto: item.outcome && item.outcome !== item.status ? item.outcome : undefined,
          },
        ]
      : []),
  ].sort((a, b) => Date.parse(a.em) - Date.parse(b.em));

  /* Passadas as 2 horas sem resposta, a tentativa vira "sem retorno" e conta para o guia. */
  async function semRetorno(id: string) {
    setMarcando(id);
    try {
      const r = await marcarTentativaNpsSemRetorno(id);
      if (!r.ok) {
        notify({ tone: "error", title: "Não foi marcado.", detail: r.erro });
        return;
      }
      await recarregar();
      const n = naJanela + 1;
      notify({
        tone: "success",
        title: "Tentativa sem retorno.",
        detail:
          n >= minimas
            ? `${n} tentativas em ${JANELA_TENTATIVAS_DIAS} dias: o guia já permite encerrar sem retorno.`
            : `${n} de ${minimas} tentativas em ${JANELA_TENTATIVAS_DIAS} dias — varie o canal e o horário.`,
      });
    } catch {
      notify({ tone: "error", title: "Não foi marcado.", detail: "Tente de novo em instantes." });
    } finally {
      setMarcando(null);
    }
  }

  return (
    <SurfaceCard
      title="Contatos"
      description={
        encerrado
          ? "O que aconteceu neste ciclo, em ordem."
          : `${naJanela} de ${minimas} tentativas nos últimos ${JANELA_TENTATIVAS_DIAS} dias — o guia pede ${minimas} antes de encerrar sem retorno.`
      }
      action={
        !encerrado && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => registrar("tentativa")}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-50"
            >
              <PhoneOff size={13} /> Tentei contato
            </button>
            <button
              type="button"
              onClick={() => registrar("contato")}
              className="flex items-center gap-1.5 rounded-xl bg-violet-700 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-violet-800"
            >
              <MessageSquareHeart size={13} /> Falei com o cliente
            </button>
          </div>
        )
      }
    >
      {eventos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500">
          Nenhum contato ainda. A primeira tentativa já conta como 1º contato — vale registrar mesmo quando a pessoa não atende. Ela fica aguardando retorno por 2 horas; depois, marque sem retorno.
        </p>
      ) : (
        <ol className="relative space-y-3 before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-px before:bg-zinc-200">
          {eventos.map((e) => {
            const Icone = e.icone;
            return (
              <li key={e.id} className="relative flex gap-3">
                <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-zinc-200">
                  <Icone size={12} className={e.cor} />
                </span>
                <div className="min-w-0 flex-1 pb-0.5">
                  <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                    <span className="font-medium text-zinc-800">{e.titulo}</span>
                    <span className="text-[11px] tabular-nums text-zinc-400">
                      {descreverRegistro(e.em)}
                      {e.quem ? ` · ${e.quem}` : ""}
                    </span>
                  </p>
                  {e.texto && <p className="mt-0.5 text-[13px] leading-relaxed text-zinc-600">{e.texto}</p>}
                  {e.aguardando && agora && (
                    podeMarcarSemRetorno(e.em, agora) ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-amber-800">O cliente não respondeu?</span>
                        <button
                          type="button"
                          onClick={() => semRetorno(e.aguardando!)}
                          disabled={marcando !== null}
                          className="flex items-center gap-1 rounded-md bg-white px-2 py-0.5 font-medium text-zinc-800 ring-1 ring-inset ring-zinc-200 hover:ring-zinc-300 disabled:opacity-50"
                        >
                          {marcando === e.aguardando && <Loader2 size={11} className="animate-spin" />}
                          Marcar sem retorno
                        </button>
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-zinc-500">
                        Sem retorno a partir das {quandoLiberaSemRetorno(e.em, agora)} — até lá, o cliente ainda pode responder.
                      </p>
                    )
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </SurfaceCard>
  );
}
