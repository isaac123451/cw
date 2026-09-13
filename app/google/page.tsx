"use client";

import { useMemo, useState } from "react";

import { Clock3, MessageSquareReply, Plus, Siren, Star, TrendingUp } from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";
import PageHeading from "@/components/shared/PageHeading";
import StatTile from "@/components/shared/StatTile";
import SurfaceCard from "@/components/shared/SurfaceCard";

import RegistrarAvaliacaoModal from "@/components/google/RegistrarAvaliacaoModal";
import TratarAvaliacaoModal from "@/components/google/TratarAvaliacaoModal";

import {
  indicadoresGoogle,
  ROTULO_DO_STATUS_GOOGLE,
  venceEm,
} from "@/lib/models/avaliacoesGoogle";
import {
  descreverMinutosUteis,
  descreverRegistro,
  minutosUteisEntre,
} from "@/lib/services/horasUteis";

import type { AvaliacaoGoogleView } from "@/lib/actions/avaliacoesGoogle";
import { aplicarAvaliacaoGoogle, retirarAvaliacaoGoogle, useAvaliacoesGoogle } from "@/lib/context/useAvaliacoesGoogle";
import { useSla } from "@/lib/context/SlaContext";
import { useAgora } from "@/lib/hooks/useAgora";

type Filtro = "abertas" | "encerradas" | "todas";

const TOM: Record<string, string> = {
  positiva: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  neutra: "bg-amber-50 text-amber-700 ring-amber-100",
  negativa: "bg-rose-50 text-rose-700 ring-rose-100",
};

/**
 * Google Avaliações — o documento "Google" como tela.
 *
 * "A nota média tratada como indicador ativo de reputação, e não apenas
 * como número de vitrine." Os quatro indicadores do documento no topo;
 * embaixo, cada avaliação com o prazo de resposta correndo, a
 * classificação e a situação. A reincidência — o mesmo problema em
 * várias avaliações recentes — aparece como alerta de escalonamento.
 */
export default function GooglePage() {

  const { expediente } = useSla();
  const agora = useAgora();

  /* A mesma lista do painel e do Meu dia: gravar aqui atualiza lá. */
  const { avaliacoes, carregando } = useAvaliacoesGoogle();
  const lista = carregando ? null : avaliacoes;
  const [filtro, setFiltro] = useState<Filtro>("abertas");
  const [registrando, setRegistrando] = useState(false);
  /* `?avaliacao=<id>` abre a avaliação direto — é o link da Jornada do Cliente. */
  const [aberta, setAberta] = useState<string | null>(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("avaliacao")
  );

  const indicadores = useMemo(() => indicadoresGoogle(lista ?? [], expediente), [lista, expediente]);

  const visiveis = (lista ?? []).filter((a) =>
    filtro === "todas" ? true : filtro === "abertas" ? a.status === "aberta" : a.status !== "aberta"
  );

  /* Negativas recentes com a mesma causa: o sinal de falha estrutural do documento. */
  const reincidencias = useMemo(() => {
    if (!agora) return [];
    const limite = agora.getTime() - 30 * 86_400_000;
    const conta = new Map<string, number>();
    for (const a of lista ?? []) {
      if (a.classificacao !== "negativa" || !a.causaRaiz || Date.parse(a.publicadaEm) < limite) continue;
      conta.set(a.causaRaiz, (conta.get(a.causaRaiz) ?? 0) + 1);
    }
    return [...conta.entries()].filter(([, n]) => n >= 3);
  }, [lista, agora]);

  const selecionada = lista?.find((a) => a.id === aberta);

  function trocar(a: AvaliacaoGoogleView) {
    aplicarAvaliacaoGoogle(a);
  }

  function prazo(a: AvaliacaoGoogleView) {
    if (!agora || a.status !== "aberta" || a.respondidaEm) return null;
    const vence = venceEm(a.publicadaEm, a.criticidade, expediente);
    const resta = minutosUteisEntre(agora, vence, expediente);
    /*
      O horário do prazo vai junto da folga: "4h" num domingo são as 4h
      úteis de segunda de manhã, e sem o "até 14/09 12:00" se lia como
      quatro horas de relógio.
    */
    return agora.getTime() > vence.getTime()
      ? { texto: resta < 0 ? `resposta atrasada ${descreverMinutosUteis(resta, expediente)}` : "resposta fora do prazo", tom: "bg-rose-50 text-rose-700 ring-rose-100" }
      : { texto: `responder até ${descreverRegistro(vence.toISOString())} · faltam ${descreverMinutosUteis(resta, expediente)} úteis`, tom: "bg-sky-50 text-sky-700 ring-sky-100" };
  }

  return (
    <MainLayout>

      <div className="space-y-6">

        <PageHeading
          eyebrow="Operação"
          title="Google Avaliações"
          description="O perfil da Cardápio Web no Google: a resposta é para quem avaliou e para todo futuro cliente que vai ler antes de decidir."
        >
          <button
            onClick={() => setRegistrando(true)}
            className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800"
          >
            <Plus size={16} />
            Registrar avaliação
          </button>
        </PageHeading>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Nota média"
            description="Percepção geral consolidada — com a nota atualizada, quando o cliente atualizou."
            value={indicadores.notaMedia === null ? "—" : indicadores.notaMedia.toLocaleString("pt-BR")}
            hint={`${indicadores.total} avaliação(ões)`}
            icon={Star}
            tone="warning"
          />
          <StatTile
            label="Respondidas"
            description="Cobertura do atendimento: avaliações com resposta pública registrada."
            value={indicadores.percentualRespondidas === null ? "—" : `${indicadores.percentualRespondidas}%`}
            hint={`${indicadores.respondidas} de ${indicadores.total}`}
            icon={MessageSquareReply}
            tone="primary"
          />
          <StatTile
            label="Tempo de resposta"
            description="Mediana entre a publicação e a resposta, em tempo útil — e quantas saíram dentro das 48h úteis."
            value={indicadores.tempoMedianoMin === null ? "—" : descreverMinutosUteis(indicadores.tempoMedianoMin, expediente)}
            hint={`${indicadores.noPrazo} dentro de 48h úteis`}
            icon={Clock3}
            tone="info"
          />
          <StatTile
            label="Negativas revertidas"
            description="Eficácia da tratativa privada: negativas cuja nota foi atualizada para 4 ou 5."
            value={indicadores.percentualRevertidas === null ? "—" : `${indicadores.percentualRevertidas}%`}
            hint={`${indicadores.revertidas} de ${indicadores.negativas} negativa(s)`}
            icon={TrendingUp}
            tone="success"
          />
        </div>

        {reincidencias.length > 0 && (
          <p className="flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm leading-relaxed text-rose-900 ring-1 ring-inset ring-rose-100">
            <Siren size={17} className="mt-0.5 shrink-0 text-rose-600" />
            <span>
              <strong>Reincidência:</strong>{" "}
              {reincidencias.map(([causa, n]) => `${n} negativas de "${causa}" em 30 dias`).join("; ")}. O documento pede
              escalar para a liderança e para a área técnica ou de produto — o padrão entre elas é o sinal de risco.
            </span>
          </p>
        )}

        <SurfaceCard
          title="Avaliações"
          description="Clique para responder, registrar a tratativa privada e encerrar."
          action={
            <div className="flex shrink-0 rounded-xl border border-zinc-200 p-1">
              {(["abertas", "encerradas", "todas"] as Filtro[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFiltro(f)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    filtro === f ? "bg-violet-700 text-white" : "text-zinc-600 hover:bg-zinc-100"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          }
          bodyClassName="p-0"
        >
          {lista === null ? (
            <p className="px-6 py-10 text-center text-sm text-zinc-400">Carregando…</p>
          ) : visiveis.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-medium text-zinc-700">
                {lista.length === 0 ? "Nenhuma avaliação registrada ainda." : `Nenhuma avaliação ${filtro === "abertas" ? "aberta" : "neste filtro"}.`}
              </p>
              {lista.length === 0 && (
                <p className="mx-auto mt-1.5 max-w-md text-sm text-zinc-500">
                  Registre as avaliações do perfil conforme chegam: a classificação, o prazo e os indicadores saem daqui.
                </p>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {visiveis.map((a) => {
                const p = prazo(a);
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setAberta(a.id)}
                      className="flex w-full flex-wrap items-center gap-3 px-6 py-3.5 text-left transition-colors hover:bg-zinc-50"
                    >
                      <span className="flex shrink-0">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} size={13} className={n <= (a.notaAtualizada ?? a.estrelas) ? "fill-amber-400 text-amber-400" : "text-zinc-300"} />
                        ))}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-zinc-800">
                          {a.autor}
                          <span className="ml-2 text-xs font-normal text-zinc-400">{descreverRegistro(a.publicadaEm)}</span>
                        </span>
                        <span className="block truncate text-xs text-zinc-500">{a.texto || "Sem comentário"}</span>
                      </span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${TOM[a.classificacao]}`}>
                        {a.classificacao} · {a.criticidade}
                      </span>
                      {p ? (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${p.tom}`}>{p.texto}</span>
                      ) : (
                        <span className="shrink-0 text-[11px] text-zinc-500">{ROTULO_DO_STATUS_GOOGLE[a.status]}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </SurfaceCard>

      </div>

      {registrando && <RegistrarAvaliacaoModal onClose={() => setRegistrando(false)} onSalvo={trocar} />}

      {selecionada && (
        <TratarAvaliacaoModal
          key={selecionada.id}
          avaliacao={selecionada}
          onClose={() => setAberta(null)}
          onSalvo={trocar}
          onApagado={retirarAvaliacaoGoogle}
        />
      )}

    </MainLayout>
  );
}
