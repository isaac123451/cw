"use client";

import { useState, type ReactNode } from "react";

import { useRascunhoNaJanela } from "@/lib/context/rascunhosDasJanelas";

import { Loader2, PhoneOutgoing, ShieldAlert, StickyNote, Tags } from "lucide-react";

import Combobox from "@/components/shared/Combobox";
import DonoDaCausa from "@/components/causas/DonoDaCausa";
import CausaSugerida from "@/components/causas/CausaSugerida";

import { useNps } from "@/lib/context/NpsContext";
import { useToast } from "@/lib/context/ToastContext";

import {
  addNpsNote,
  classificarNps,
  registerNpsAttempt,
  setNpsChurnRisk,
  setNpsStatus,
} from "@/lib/actions/nps";

import { CHANNELS, segmentOf } from "@/lib/models/nps";
import { descreverRegistro } from "@/lib/services/horasUteis";

/**
 * O ciclo do NPS numa mini-janela.
 *
 * Cada bloco é **uma ação com o seu botão**, e não um formulário único:
 * no NPS, mover de etapa, classificar, registrar uma tentativa e anotar
 * são registros diferentes, com regras diferentes no servidor (o tipo
 * que pede causa raiz, a tentativa que conta para a cadência). Juntar
 * tudo num Salvar faria uma recusa de um apagar o que os outros
 * aceitariam.
 *
 * O encerramento fica na ficha: ele pede como o ciclo terminou e devolve
 * ao Wootric — não é coisa para uma janela pequena.
 */

const rotulo = "text-[10px] font-semibold uppercase tracking-wide text-zinc-400";
const campo =
  "h-8 w-full rounded-lg border border-zinc-200 bg-white px-2 text-[13px] text-zinc-800 outline-none transition-colors focus:border-violet-400";
const botao =
  "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200 hover:bg-violet-50 disabled:opacity-50";

function Bloco({ titulo, icone, children }: { titulo: string; icone: ReactNode; children: ReactNode }) {
  return (
    <div className="border-t border-zinc-100 pt-3">
      <p className={`${rotulo} flex items-center gap-1`}>
        {icone}
        {titulo}
      </p>
      <div className="mt-1.5 space-y-1.5">{children}</div>
    </div>
  );
}

export default function JanelaDoNps({ id }: { id: string }) {

  const { responses, stages, kinds, rootCauses, loading, recarregar, aplicarLocal } = useNps();
  const { notify } = useToast();

  const item = responses.find((r) => r.id === id);

  const [etapa, setEtapa] = useState<string | null>(null);
  const [tipo, setTipo] = useState<string | null>(null);
  const [causa, setCausa] = useState<string | null>(null);
  const [assumir, setAssumir] = useState(false);
  const [canal, setCanal] = useState<string>(CHANNELS[0]);
  const [tentativa, setTentativa] = useState("");
  const [nota, setNota] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);

  /* Algo digitado e não salvo: a moldura pede confirmação para fechar. */
  useRascunhoNaJanela(etapa !== null || tipo !== null || causa !== null || tentativa.trim() !== "" || nota.trim() !== "");

  if (!item) {
    return (
      <p className="px-4 py-6 text-sm text-zinc-500">
        {loading ? "Carregando a resposta…" : "Esta resposta não está mais na base. Feche a janela."}
      </p>
    );
  }

  const segmento = segmentOf(item.score);
  const encerrado = Boolean(item.closedAt);

  const etapasAbertas = stages.filter((s) => s.active && !s.final).sort((a, b) => a.order - b.order);
  const tiposAtivos = kinds.filter((k) => k.active).sort((a, b) => a.order - b.order);
  const tipoEscolhido = tipo ?? item.kind ?? "";
  const regra = tiposAtivos.find((k) => k.name === tipoEscolhido);

  /**
   * Toda ação daqui passa por este funil: botão ocupado enquanto espera,
   * aviso só com a resposta do servidor, e a lista relida depois — a
   * janela e a tela de trás têm de mostrar o mesmo ciclo.
   */
  async function executar(
    chave: string,
    acao: () => Promise<{ ok: true } | { ok: false; erro: string }>,
    sucesso: string,
    depois?: () => void
  ) {
    setOcupado(chave);
    try {
      const r = await acao();
      if (!r.ok) {
        notify({ tone: "error", title: "Não foi gravado.", detail: r.erro });
        return;
      }
      depois?.();
      notify({ tone: "success", title: sucesso, detail: item?.customerName ?? item?.customer });
      await recarregar();
    } catch {
      notify({ tone: "error", title: "Não foi gravado.", detail: "O servidor não respondeu. Tente de novo." });
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="space-y-3 px-4 py-3">

      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
          style={{ backgroundColor: segmento.color }}
          title={segmento.label}
        >
          {item.score}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-zinc-800">{item.customerName ?? item.customer}</p>
          <p className="text-[11px] text-zinc-400">
            {item.status}
            {!item.firstContactAt && !encerrado
              ? ` · 1º contato até ${descreverRegistro(item.firstContactDueAt)}`
              : ""}
          </p>
        </div>
      </div>

      {item.comment && (
        <p className="line-clamp-4 rounded-lg bg-zinc-50 px-3 py-2 text-[13px] leading-relaxed text-zinc-700">
          “{item.comment}”
        </p>
      )}

      {encerrado ? (
        <p className="text-xs text-zinc-500">Ciclo encerrado. Para reabrir ou ver o encerramento, abra a ficha.</p>
      ) : (
        <>
          <Bloco titulo="Etapa" icone={null}>
            <div className="flex gap-1.5">
              <select value={etapa ?? item.status} onChange={(e) => setEtapa(e.target.value)} className={campo}>
                {[...new Set([item.status, ...etapasAbertas.map((s) => s.name)])].map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!etapa || etapa === item.status || ocupado !== null}
                onClick={() =>
                  executar(
                    "etapa",
                    async () => {
                      const r = await setNpsStatus(item.id, etapa!);
                      if (r.ok) aplicarLocal(item.id, { status: r.status });
                      return r.ok ? { ok: true } : r;
                    },
                    `Movido para ${etapa}.`,
                    () => setEtapa(null)
                  )
                }
                className={botao}
              >
                {ocupado === "etapa" ? <Loader2 size={12} className="animate-spin" /> : null}
                Mover
              </button>
            </div>
            <p className="text-[11px] text-zinc-400">Encerrar pede como o ciclo terminou — é pela ficha.</p>
          </Bloco>

          <Bloco titulo="Classificar" icone={<Tags size={11} />}>
            <select value={tipoEscolhido} onChange={(e) => setTipo(e.target.value)} className={campo}>
              <option value="">Escolha o tipo…</option>
              {tiposAtivos.map((k) => (
                <option key={k.id} value={k.name}>
                  {k.emoji} {k.name}
                </option>
              ))}
            </select>
            <Combobox
              value={causa ?? item.rootCause ?? ""}
              onChange={(c) => setCausa(c)}
              emptyLabel={regra?.requiresRootCause ? "Causa raiz (obrigatória)" : "Causa raiz"}
              placeholder={regra?.requiresRootCause ? "Causa raiz (obrigatória)" : "Causa raiz"}
              options={[...new Set([...rootCauses.filter((c) => c.active).map((c) => c.name), ...(item.rootCause ? [item.rootCause] : [])])]}
            />
            <DonoDaCausa causa={causa ?? item.rootCause} />
            <CausaSugerida texto={item.comment} atual={causa ?? item.rootCause} excluirId={item.id} onUsar={(c) => setCausa(c)} />
            <div className="flex items-center justify-between gap-2">
              {!item.owner && (
                <label className="flex items-center gap-1.5 text-xs text-zinc-600">
                  <input type="checkbox" checked={assumir} onChange={(e) => setAssumir(e.target.checked)} />
                  Assumir este ciclo
                </label>
              )}
              <button
                type="button"
                disabled={!tipoEscolhido || ocupado !== null}
                onClick={() =>
                  executar(
                    "classificar",
                    async () => {
                      const r = await classificarNps({
                        id: item.id,
                        tipo: tipoEscolhido,
                        causa: (causa ?? item.rootCause) || null,
                        assumir,
                      });
                      return r.ok ? { ok: true } : r;
                    },
                    "Classificação gravada.",
                    () => {
                      setTipo(null);
                      setCausa(null);
                      setAssumir(false);
                    }
                  )
                }
                className={`${botao} ml-auto`}
              >
                {ocupado === "classificar" ? <Loader2 size={12} className="animate-spin" /> : null}
                Salvar classificação
              </button>
            </div>
          </Bloco>

          <Bloco titulo="Tentativa de contato" icone={<PhoneOutgoing size={11} />}>
            <div className="flex gap-1.5">
              <select value={canal} onChange={(e) => setCanal(e.target.value)} className={`${campo} w-32 shrink-0`}>
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                value={tentativa}
                onChange={(e) => setTentativa(e.target.value)}
                placeholder="O que aconteceu"
                className={campo}
              />
            </div>
            <button
              type="button"
              disabled={!tentativa.trim() || ocupado !== null}
              onClick={() =>
                executar(
                  "tentativa",
                  () => registerNpsAttempt({ responseId: item.id, channel: canal, note: tentativa.trim() }),
                  `Tentativa por ${canal} registrada.`,
                  () => setTentativa("")
                )
              }
              className={botao}
            >
              {ocupado === "tentativa" ? <Loader2 size={12} className="animate-spin" /> : null}
              Registrar tentativa
            </button>
          </Bloco>
        </>
      )}

      <Bloco titulo="Anotação" icone={<StickyNote size={11} />}>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={2}
          placeholder="Fica no histórico do ciclo."
          className="w-full resize-y rounded-lg border border-zinc-200 px-2 py-1.5 text-[13px] outline-none focus:border-violet-400"
        />
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={!nota.trim() || ocupado !== null}
            onClick={() =>
              executar(
                "nota",
                async () => {
                  const r = await addNpsNote({ id: item.id, texto: nota.trim() });
                  return r.ok ? { ok: true } : r;
                },
                "Anotação gravada.",
                () => setNota("")
              )
            }
            className={botao}
          >
            {ocupado === "nota" ? <Loader2 size={12} className="animate-spin" /> : null}
            Anotar
          </button>

          <button
            type="button"
            disabled={ocupado !== null}
            onClick={() =>
              executar(
                "risco",
                () => setNpsChurnRisk({ id: item.id, valor: !item.churnRisk }),
                item.churnRisk ? "Marca de risco retirada." : "Marcado como risco de cancelamento."
              )
            }
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ring-inset transition-colors ${
              item.churnRisk ? "bg-rose-50 text-rose-700 ring-rose-100" : "text-zinc-500 ring-zinc-200 hover:bg-zinc-50"
            }`}
          >
            <ShieldAlert size={12} />
            {item.churnRisk ? "Em risco" : "Risco de cancelamento"}
          </button>
        </div>
      </Bloco>

    </div>
  );
}
