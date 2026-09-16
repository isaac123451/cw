"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useState } from "react";

import { AlarmClock, ChevronLeft, Mail, MessageCircle, ShieldAlert, Trash2 } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";
import NasQuatroFrentes from "@/components/shared/NasQuatroFrentes";
import { ConfirmDelete } from "@/components/shared/Modal";
import AcoesDoPromotor from "@/components/nps/AcoesDoPromotor";
import NpsNotas from "@/components/nps/NpsNotas";

import { addNpsNote, deleteNpsResponse, removeNpsNote, setNpsChurnRisk } from "@/lib/actions/nps";
import { useNps } from "@/lib/context/NpsContext";
import { useSession } from "@/lib/context/SessionContext";
import { useSla } from "@/lib/context/SlaContext";
import { useToast } from "@/lib/context/ToastContext";
import { useAgora } from "@/lib/hooks/useAgora";
import {
  isEncerrado,
  moodOf,
  nomeDoCliente,
  rotuloDeEtapa,
  segmentOf,
  temNomeProprio,
  tipoPorNome,
} from "@/lib/models/nps";
import { trilhaDoNps, venceEm, type AcaoDoNps } from "@/lib/models/trilhaNps";
import { descreverMinutosUteis, descreverRegistro, minutosUteisEntre } from "@/lib/services/horasUteis";
import { slaState } from "@/lib/services/nps.service";

import TrilhaDoNps from "./TrilhaDoNps";
import ContatosDoNps from "./ContatosDoNps";
import LateralDoNps from "./LateralDoNps";
import ClassificarNpsModal from "./ClassificarNpsModal";
import ContatoNpsModal, { type ModoDoContato } from "./ContatoNpsModal";
import ConfirmacaoNpsModal from "./ConfirmacaoNpsModal";
import EncerrarNpsModal from "./EncerrarNpsModal";

type Dialogo =
  | { tipo: "classificar" }
  | { tipo: "contato"; modo: ModoDoContato }
  | { tipo: "confirmacao" }
  | { tipo: "encerrar" }
  | { tipo: "excluir" };

/**
 * A ficha de um ciclo de NPS, com endereço próprio.
 *
 * O Isaac, com o print do modal: "a de reclame aqui e redes sociais é
 * tão bonita e intuitiva, aqui se torna difícil". O modal empilhava dez
 * blocos abertos. Agora é a tela das outras frentes: o cabeçalho diz
 * quem é e como está, a trilha diz o que falta e oferece a ação, o
 * corpo conta o que aconteceu e a lateral guarda os dados.
 */
export default function FichaDoNps({ id }: { id: string }) {

  const router = useRouter();
  const { responses, stages, kinds, loading, aplicarLocal, recarregar } = useNps();
  const session = useSession();
  const { expediente } = useSla();
  const { notify } = useToast();
  const agora = useAgora();

  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const [marcandoRisco, setMarcandoRisco] = useState(false);

  const item = responses.find((r) => r.id === id);

  if (!item) {
    return (
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-10 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <p className="text-sm text-zinc-500">{loading ? "Carregando o ciclo…" : "Este ciclo não existe mais — pode ter sido excluído."}</p>
        {!loading && (
          <Link href="/nps" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-violet-700 hover:underline">
            <ChevronLeft size={15} /> Voltar para NPS
          </Link>
        )}
      </div>
    );
  }

  const ciclo = item;
  const segmento = segmentOf(ciclo.score);
  const regra = tipoPorNome(kinds, ciclo.kind);
  const etapa = stages.find((e) => e.name === ciclo.status);
  const encerrado = isEncerrado(ciclo.status);
  const humor = moodOf(ciclo.moodAfter);
  const passos = trilhaDoNps(ciclo, { tipos: kinds, agora: agora ?? undefined, expediente });

  const digitos = (ciclo.phone ?? "").replace(/\D/g, "");
  const whatsapp = digitos.length >= 10 ? (digitos.length <= 11 ? `55${digitos}` : digitos) : null;

  function executar(acao: AcaoDoNps) {
    switch (acao) {
      case "classificar":
        return setDialogo({ tipo: "classificar" });
      case "contato":
      case "retorno":
        return setDialogo({ tipo: "contato", modo: "contato" });
      case "tentativa":
        return setDialogo({ tipo: "contato", modo: "tentativa" });
      case "confirmacao":
        return setDialogo({ tipo: "confirmacao" });
      case "encerrar":
        return setDialogo({ tipo: "encerrar" });
      case "promotor":
        return document.getElementById("acoes-do-promotor")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  async function alternarRetencao() {
    setMarcandoRisco(true);
    try {
      const r = await setNpsChurnRisk({ id: ciclo.id, valor: !ciclo.churnRisk });
      if (!r.ok) {
        notify({ tone: "error", title: "A marca de retenção não foi gravada.", detail: r.erro });
        return;
      }
      aplicarLocal(ciclo.id, { churnRisk: !ciclo.churnRisk });
      notify({
        tone: ciclo.churnRisk ? "success" : "info",
        title: ciclo.churnRisk ? "Marca de retenção removida." : "Marcado como caso de retenção.",
        detail: nomeDoCliente(ciclo),
      });
    } finally {
      setMarcandoRisco(false);
    }
  }

  /* O chip do relógio: o 1º contato enquanto não acontece; depois, quando foi. */
  const sla = agora ? slaState(ciclo, agora) : null;
  const prazo = new Date(ciclo.firstContactDueAt);
  const relogio =
    encerrado || !agora
      ? null
      : ciclo.firstContactAt
        ? { texto: `1º contato em ${descreverRegistro(ciclo.firstContactAt)}`, tom: "bg-emerald-50 text-emerald-700 ring-emerald-100" }
        : sla === "estourado"
          ? { texto: `1º contato fora do prazo há ${descreverMinutosUteis(minutosUteisEntre(prazo, agora, expediente), expediente)}`, tom: "bg-rose-50 text-rose-700 ring-rose-100" }
          : { texto: `1º contato: ${venceEm(agora, prazo, expediente).replace(/^V/, "v")}`, tom: sla === "vence-hoje" ? "bg-amber-50 text-amber-800 ring-amber-100" : "bg-zinc-50 text-zinc-600 ring-zinc-200" };

  return (
    <div className="space-y-5">

      {/* Cabeçalho */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">

        <Link href="/nps" className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-violet-700">
          <ChevronLeft size={16} /> Voltar para NPS
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-5">

          <div className="flex min-w-0 flex-1 items-start gap-4">

            {/* A nota, grande, na cor do segmento — é o primeiro dado que se lê. */}
            <div
              className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl"
              style={{ color: segmento.color, background: `${segmento.color}14`, boxShadow: `inset 0 0 0 1px ${segmento.color}33` }}
              title={segmento.hint}
            >
              <span className="text-2xl font-bold leading-none tabular-nums">{ciclo.score}</span>
              <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide">{segmento.label}</span>
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="break-words text-2xl font-semibold leading-snug tracking-tight text-zinc-900 [overflow-wrap:anywhere]">{nomeDoCliente(ciclo)}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-zinc-500">
                {[
                  temNomeProprio(ciclo) ? ciclo.customer : null,
                  ciclo.company,
                  `respondeu em ${descreverRegistro(ciclo.respondedAt)}`,
                  ciclo.source === "Wootric" ? "via Wootric" : "registro manual",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className="rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ring-zinc-200"
                  style={etapa ? { color: etapa.color, background: `${etapa.color}12` } : undefined}
                >
                  {rotuloDeEtapa(ciclo.status).replace(/^\[(.*)\]$/, "$1")}
                </span>

                <button
                  type="button"
                  onClick={() => setDialogo({ tipo: "classificar" })}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
                    regra ? "bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50" : "bg-amber-50 text-amber-800 ring-amber-100 hover:bg-amber-100"
                  }`}
                  title={regra?.action ?? "Classificar o tipo do feedback"}
                >
                  {regra ? `${regra.emoji} ${regra.name}` : "a classificar"}
                  {ciclo.rootCause ? ` · ${ciclo.rootCause}` : ""}
                </button>

                {relogio && (
                  <button
                    type="button"
                    onClick={() => !ciclo.firstContactAt && setDialogo({ tipo: "contato", modo: "contato" })}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${relogio.tom}`}
                  >
                    <AlarmClock size={12} />
                    {relogio.texto}
                  </button>
                )}

                {humor && (
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200" title={humor.hint}>
                    {humor.emoji} {humor.label} depois do contato
                  </span>
                )}

                {/*
                  Retenção, no cabeçalho, como no Reclame Aqui e nas redes.
                  Grava no clique: é um alerta, e o aviso de "salvo" só sai
                  depois da resposta do servidor.
                */}
                <button
                  type="button"
                  disabled={marcandoRisco}
                  onClick={alternarRetencao}
                  title={ciclo.churnRisk ? "Tirar a marca de risco de cancelamento" : "Marcar como caso de retenção — o cliente sinalizou que pode cancelar"}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset transition-colors disabled:opacity-60 ${
                    ciclo.churnRisk ? "bg-rose-50 text-rose-700 ring-rose-100 hover:bg-rose-100" : "text-zinc-500 ring-zinc-200 hover:bg-zinc-50 hover:text-zinc-700"
                  }`}
                >
                  <ShieldAlert size={12} />
                  {ciclo.churnRisk ? "Risco de cancelamento" : "Marcar retenção"}
                </button>
              </div>
            </div>
          </div>

          <div className="flex max-w-full flex-wrap items-center gap-2">
            {ciclo.email && (
              <a
                href={`mailto:${ciclo.email}`}
                className="flex items-center gap-2 rounded-xl border border-violet-200 px-4 py-2.5 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
              >
                <Mail size={15} /> E-mail
              </a>
            )}
            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl bg-violet-800 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-900"
              >
                <MessageCircle size={16} /> WhatsApp
              </a>
            )}
            {session?.role === "ADMIN" && (
              <button
                type="button"
                onClick={() => setDialogo({ tipo: "excluir" })}
                title="Excluir esta resposta da base — muda o NPS do período"
                className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm font-medium text-zinc-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
              >
                <Trash2 size={15} /> Excluir
              </button>
            )}
          </div>
        </div>
      </div>

      <TrilhaDoNps item={ciclo} passos={passos} executar={executar} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">

        <div className="min-w-0 space-y-5">

          <SurfaceCard title="O que o cliente escreveu">
            {ciclo.comment.trim() ? (
              <blockquote className="border-l-4 pl-4 text-[15px] leading-relaxed text-zinc-800" style={{ borderColor: segmento.color }}>
                {ciclo.comment}
              </blockquote>
            ) : (
              <p className="text-sm text-zinc-500">Só a nota — o cliente não escreveu comentário.</p>
            )}
          </SurfaceCard>

          <ContatosDoNps item={ciclo} registrar={(modo) => setDialogo({ tipo: "contato", modo })} />

          {segmento.label === "Promotor" && ciclo.kind !== "Engano" && (
            <div id="acoes-do-promotor" className="scroll-mt-24">
              <AcoesDoPromotor
                key={ciclo.id}
                item={ciclo}
                onSalvo={(acoes) =>
                  aplicarLocal(ciclo.id, {
                    reviewAsked: acoes.reviewAsked,
                    testimonialAsked: acoes.testimonialAsked,
                    referralAsked: acoes.referralAsked,
                    reviewFeita: acoes.reviewFeita ?? undefined,
                    aceitaCase: acoes.aceitaCase ?? undefined,
                    indicacoes: acoes.indicacoes ?? undefined,
                  })
                }
              />
            </div>
          )}

          <SurfaceCard title="Anotações">
            <NpsNotas
              item={ciclo}
              podeEscrever={!encerrado}
              onAdd={async (texto) => {
                const r = await addNpsNote({ id: ciclo.id, texto });
                if (!r.ok) {
                  notify({ tone: "error", title: "A anotação não foi gravada.", detail: r.erro });
                  throw new Error(r.erro);
                }
                await recarregar();
                notify({ tone: "success", title: "Anotação gravada.", detail: nomeDoCliente(ciclo) });
              }}
              onRemove={async (notaId) => {
                const r = await removeNpsNote(notaId);
                if (!r.ok) {
                  notify({ tone: "error", title: "A anotação não foi apagada.", detail: r.erro });
                  return;
                }
                await recarregar();
                notify({ tone: "success", title: "Anotação apagada." });
              }}
            />
          </SurfaceCard>

          <NasQuatroFrentes
            alvo={{ establishmentId: ciclo.establishmentId, contaCwEngine: ciclo.externalCompanyId, emails: ciclo.email ? [ciclo.email] : [] }}
            descricao="O mesmo cliente nas outras frentes — antes de ligar, veja se ele também reclamou ou avaliou."
          />
        </div>

        <LateralDoNps key={ciclo.id} item={ciclo} classificar={() => setDialogo({ tipo: "classificar" })} />
      </div>

      {dialogo?.tipo === "classificar" && <ClassificarNpsModal item={ciclo} onClose={() => setDialogo(null)} />}
      {dialogo?.tipo === "contato" && <ContatoNpsModal item={ciclo} modoInicial={dialogo.modo} onClose={() => setDialogo(null)} />}
      {dialogo?.tipo === "confirmacao" && <ConfirmacaoNpsModal item={ciclo} onClose={() => setDialogo(null)} />}
      {dialogo?.tipo === "encerrar" && <EncerrarNpsModal item={ciclo} onClose={() => setDialogo(null)} />}

      <ConfirmDelete
        open={dialogo?.tipo === "excluir"}
        label={`${nomeDoCliente(ciclo)} (nota ${ciclo.score})`}
        onCancel={() => setDialogo(null)}
        onConfirm={async () => {
          setDialogo(null);
          const r = await deleteNpsResponse(ciclo.id);
          if (!r.ok) {
            notify({ tone: "error", title: "Não foi excluído.", detail: r.erro });
            return;
          }
          await recarregar();
          notify({ tone: "success", title: "Resposta excluída.", detail: `${nomeDoCliente(ciclo)} — o NPS do período foi recalculado.` });
          router.push("/nps");
        }}
      />
    </div>
  );
}
