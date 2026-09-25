"use client";

import Link from "next/link";

import { useMemo, useState } from "react";

import {
  BellOff,
  CalendarClock,
  Loader2,
  PhoneOff,
  RotateCcw,
  Send,
  Sparkles,
  Star,
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";
import PageHeading from "@/components/shared/PageHeading";
import SurfaceCard from "@/components/shared/SurfaceCard";
import ModuleNav from "@/components/reclame-aqui/ModuleNav";
import { useTratativa } from "@/components/reclame-aqui/tratativa/TratativaProvider";
import DispararEmLote from "@/components/disparos/DispararEmLote";
import { mensagemDePedidoDeAvaliacao } from "@/lib/models/mensagens";
import { telefoneDoDisparo } from "@/lib/models/disparos";
import { hojeNaOperacao } from "@/lib/services/reputation.service";
import { useSession } from "@/lib/context/SessionContext";

import type { Case } from "@/lib/models/case";
import { filaDeAvaliacao, type NaFila } from "@/lib/models/cadencia";
import { descreverRegistro } from "@/lib/services/horasUteis";
import { caseHref } from "@/lib/services/case.service";
import {
  emptySimulation,
  getRange,
  getRawCounts,
  inRange,
  ptBR,
  scoreFrom,
  simulate,
} from "@/lib/services/reputation.service";

import { useScopedCases } from "@/lib/context/useScopedCases";
import { useCases } from "@/lib/context/CaseContext";
import { useAgora } from "@/lib/hooks/useAgora";
import { useToast } from "@/lib/context/ToastContext";
import { dispensarPedidoDeAvaliacao, dispensarPedidosDeAvaliacao } from "@/lib/actions/tratativa";

function diaCurto(dia?: string) {
  return dia ? dia.split("-").reverse().slice(0, 2).join("/") : "—";
}

/**
 * O Passo 8 como fila: quem pedir a avaliação hoje.
 *
 * "Criar uma cadência de lembretes gentis: o primeiro 2 dias após a
 * resposta, e a cada 2 dias; depois, semanalmente, por até 6 meses." Em
 * cinquenta reclamações respondidas, ninguém segue isso de cabeça — e é
 * a avaliação que move a nota. A fila faz a conta da cadência, mostra o
 * que cada nota 10 vale na reputação e abre a mensagem pronta.
 */
export default function AvaliacoesPage() {

  const { cases } = useScopedCases("reclame-aqui");
  const { setCases } = useCases();
  const { abrirPedidoAvaliacao } = useTratativa();
  const sessao = useSession();
  const { notify } = useToast();

  /*
    Dispensar tira o caso da cadência sem apagar nada: os pedidos já
    registrados continuam no histórico. É reversível, e os dispensados
    aparecem numa lista própria para poder voltar.
  */
  const [gravando, setGravando] = useState<string | null>(null);

  async function dispensar(item: Case, desfazer: boolean) {
    setGravando(item.protocol);
    try {
      const r = await dispensarPedidoDeAvaliacao({ protocol: item.protocol, desfazer });
      if (!r.ok) {
        notify({ tone: "error", title: "Não foi gravado.", detail: r.erro });
        return;
      }
      setCases((prev) =>
        prev.map((c) =>
          c.protocol === item.protocol
            ? { ...c, avaliacaoDispensadaEm: r.em, avaliacaoDispensadaPor: r.por }
            : c
        )
      );
      notify({
        tone: "success",
        title: desfazer ? `${item.protocol} voltou para a fila.` : `${item.protocol} saiu da fila de pedir avaliação.`,
        detail: desfazer
          ? "A cadência conta de novo a partir do último pedido."
          : "Os pedidos já registrados continuam no histórico do caso.",
      });
    } catch {
      notify({ tone: "error", title: "Não foi gravado.", detail: "Tente de novo em instantes." });
    } finally {
      setGravando(null);
    }
  }

  /* Vários de uma vez: uma gravação só, com o mesmo aviso do de um. */
  async function emLote(itens: Case[], desfazer: boolean) {
    if (itens.length === 0) return;
    setGravando("lote");
    try {
      const r = await dispensarPedidosDeAvaliacao({ protocols: itens.map((i) => i.protocol), desfazer });
      if (!r.ok) {
        notify({ tone: "error", title: "Não foi gravado.", detail: r.erro });
        return;
      }
      const alvo = new Set(itens.map((i) => i.protocol));
      setCases((prev) =>
        prev.map((c) => (alvo.has(c.protocol) ? { ...c, avaliacaoDispensadaEm: r.em, avaliacaoDispensadaPor: r.por } : c))
      );
      notify({
        tone: "success",
        title: desfazer ? `${r.n} voltaram para a fila.` : `${r.n} saíram da fila de pedir avaliação.`,
        detail: desfazer ? "A cadência conta de novo a partir do último pedido." : "Nada foi apagado; dá para devolver depois.",
      });
    } catch {
      notify({ tone: "error", title: "Não foi gravado.", detail: "Tente de novo em instantes." });
    } finally {
      setGravando(null);
    }
  }

  const dispensados = useMemo(
    () => cases.filter((c) => c.avaliacaoDispensadaEm && !c.evaluated),
    [cases]
  );

  const agoraMs = useAgora()?.getTime();

  const fila = useMemo(
    () => (agoraMs ? filaDeAvaliacao(cases, new Date(agoraMs)) : null),
    [cases, agoraMs]
  );

  /* O que a fila vale na nota do período que o portal mostra agora. */
  const impacto = useMemo(() => {

    if (!fila) return null;

    const range = getRange("6m", "vigente");
    const doPeriodo = cases.filter((c) => inRange(c, range.start, range.end));
    const base = getRawCounts(doPeriodo);
    const atual = scoreFrom(base).raScore;

    const conta = (lista: NaFila<Case>[]) =>
      lista.filter((x) => inRange(x.item, range.start, range.end)).length;

    const nHoje = conta(fila.hoje);
    const nTodas = nHoje + conta(fila.proximos);

    const com = (n: number) =>
      scoreFrom(simulate(base, { ...emptySimulation, ratings: { 10: n } })).raScore;

    /*
      O ganho medido em dez, e não em uma.

      Uma avaliação sozinha move a nota na segunda ou terceira casa — a
      tela mostrava "+0", que desanima e não é verdade. Dez avaliações
      (limitadas ao que a fila tem) é a unidade que se enxerga.
    */
    const lote = Math.max(1, Math.min(10, nTodas || 10));

    return {
      atual,
      nHoje,
      nTodas,
      lote,
      comHoje: com(nHoje),
      comTodas: com(nTodas),
      porLote: com(lote) - atual,
    };
  }, [cases, fila]);

  return (
    <MainLayout>

      <div className="space-y-5">

        <PageHeading
          eyebrow="Reclame Aqui"
          title="Pedir avaliação"
          description="Respondidas e ainda sem nota, na cadência da documentação: 2 dias depois da resposta e a cada 2 dias; depois, semanal, por até 6 meses."
        />

        <ModuleNav />

        {!fila || !impacto ? (
          <p className="text-sm text-zinc-400">Montando a fila…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">

              <div className="rounded-2xl bg-violet-700 p-4 text-white sm:p-5 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/75">Para hoje</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums sm:text-3xl">{fila.hoje.length}</p>
                <p className="mt-1 text-xs text-white/80">lembretes no dia ou atrasados</p>
              </div>

              <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Próximos dias</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums sm:text-3xl text-zinc-900">{fila.proximos.length}</p>
                <p className="mt-1 text-xs text-zinc-500">na cadência, ainda não é o dia</p>
              </div>

              <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  {impacto.lote === 1 ? "Uma nota 10 vale" : `${impacto.lote} notas 10 valem`}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums sm:text-3xl text-emerald-700">
                  +{ptBR(Math.max(0, impacto.porLote), 2)}
                </p>
                <p className="mt-1 text-xs text-zinc-500">na nota dos últimos 6 meses (hoje {ptBR(impacto.atual)})</p>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                  <Sparkles size={12} /> Se a fila avaliar com 10
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums sm:text-3xl text-emerald-800">
                  {ptBR(impacto.atual)} → {ptBR(impacto.comTodas)}
                </p>
                <p className="mt-1 text-xs text-emerald-800/80">
                  {impacto.nTodas} da fila estão no período da nota
                  {impacto.nHoje > 0 ? ` · só as de hoje: ${ptBR(impacto.comHoje)}` : ""}
                </p>
              </div>

            </div>

            <SurfaceCard
              title="Para hoje"
              description="Primeiro o lembrete mais atrasado. A mensagem muda de tom a cada lembrete; quem envia é você."
              action={fila.hoje.length > 1 ? <BotaoEmLote rotulo="Dispensar todos" n={fila.hoje.length} ocupado={gravando === "lote"} onConfirmar={() => emLote(fila.hoje.map((x) => x.item), false)} /> : undefined}
            >
              {fila.hoje.length === 0 ? (
                <p className="rounded-xl bg-emerald-50 px-4 py-4 text-sm font-medium text-emerald-800 ring-1 ring-inset ring-emerald-100">
                  Fila de hoje zerada. O próximo lembrete é{" "}
                  {fila.proximos[0] ? `em ${diaCurto(fila.proximos[0].pedido.proximoDia)}` : "quando houver resposta nova"}.
                </p>
              ) : (
                <>
                  {/* Os de hoje com telefone, para mandar em lote pelo WhatsApp Web (1.78). */}
                  <div className="mb-3">
                    <DispararEmLote
                      nome={`Pedir avaliação · ${hojeNaOperacao().split("-").reverse().join("/")}`}
                      origem="avaliacao"
                      candidatos={fila.hoje
                        .filter((x) => telefoneDoDisparo(x.item.phone ?? ""))
                        .map((x) => ({
                          chave: x.item.protocol,
                          nome: x.item.customer,
                          telefone: telefoneDoDisparo(x.item.phone ?? "")!,
                          mensagem: mensagemDePedidoDeAvaliacao({ nome: x.item.customer, numero: Math.max(1, x.pedido.numero), raUrl: x.item.raUrl, agente: sessao?.name }),
                          ref: `caso:${x.item.protocol}`,
                          motivo: x.pedido.numero > 1 ? `${x.pedido.numero}º lembrete` : "1º pedido",
                        }))}
                    />
                  </div>
                  <Lista itens={fila.hoje} onPedir={(item) => abrirPedidoAvaliacao(item)} onDispensar={(item) => dispensar(item, false)} gravando={gravando} destaque />
                </>
              )}
            </SurfaceCard>

            {fila.proximos.length > 0 && (
              <SurfaceCard
                title="Próximos dias"
                description="Já estão na cadência. Adiantar o pedido também conta — o próximo lembrete passa a contar dele."
                action={fila.proximos.length > 1 ? <BotaoEmLote rotulo="Dispensar todos" n={fila.proximos.length} ocupado={gravando === "lote"} onConfirmar={() => emLote(fila.proximos.map((x) => x.item), false)} /> : undefined}
              >
                <Lista itens={fila.proximos} onPedir={(item) => abrirPedidoAvaliacao(item)} onDispensar={(item) => dispensar(item, false)} gravando={gravando} />
              </SurfaceCard>
            )}

            {dispensados.length > 0 && (
              <SurfaceCard
                title={`Dispensados (${dispensados.length})`}
                description="Fora da cadência por decisão de alguém. Nada foi apagado — devolver à fila volta a contar do último pedido."
                action={dispensados.length > 1 ? <BotaoEmLote rotulo="Devolver todos" n={dispensados.length} ocupado={gravando === "lote"} devolver onConfirmar={() => emLote(dispensados, true)} /> : undefined}
              >
                <ul className="divide-y divide-zinc-100">
                  {dispensados.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center gap-2 py-2 first:pt-0 last:pb-0 sm:gap-3">
                      <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                        <Link href={caseHref(item)} className="group flex min-w-0 items-baseline gap-2">
                          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-zinc-400">{item.protocol}</span>
                          <span className="truncate text-sm font-medium text-zinc-700 group-hover:text-violet-700">{item.title}</span>
                        </Link>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {item.customer} · dispensado {descreverRegistro(item.avaliacaoDispensadaEm)}
                          {item.avaliacaoDispensadaPor ? ` por ${item.avaliacaoDispensadaPor}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => dispensar(item, true)}
                        disabled={gravando === item.protocol}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-50 disabled:opacity-60"
                      >
                        {gravando === item.protocol ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                        Devolver à fila
                      </button>
                    </li>
                  ))}
                </ul>
              </SurfaceCard>
            )}
          </>
        )}

      </div>

    </MainLayout>
  );
}

/** Dispensar ou devolver todos: o primeiro clique pergunta no próprio botão, o segundo grava. */
function BotaoEmLote({ rotulo, n, ocupado, devolver = false, onConfirmar }: { rotulo: string; n: number; ocupado: boolean; devolver?: boolean; onConfirmar: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  return (
    <button
      type="button"
      disabled={ocupado}
      onClick={() => {
        if (confirmando) {
          setConfirmando(false);
          onConfirmar();
        } else {
          setConfirmando(true);
          window.setTimeout(() => setConfirmando(false), 4000);
        }
      }}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors disabled:opacity-60 ${
        confirmando ? "bg-amber-50 text-amber-800 ring-amber-200" : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50"
      }`}
    >
      {ocupado ? <Loader2 size={13} className="animate-spin" /> : devolver ? <RotateCcw size={13} /> : <BellOff size={13} />}
      {confirmando ? `${devolver ? "Devolver" : "Dispensar"} os ${n}?` : `${rotulo} (${n})`}
    </button>
  );
}

function Lista({
  itens,
  onPedir,
  onDispensar,
  gravando,
  destaque = false,
}: {
  itens: NaFila<Case>[];
  onPedir: (item: Case) => void;
  onDispensar: (item: Case) => void;
  gravando: string | null;
  destaque?: boolean;
}) {
  /* O primeiro clique pergunta; o segundo dispensa. Tirar da fila não é para acontecer por engano. */
  const [confirmando, setConfirmando] = useState<string | null>(null);

  return (
    <ul className="divide-y divide-zinc-100">
      {itens.map(({ item, pedido }) => {

        const semTelefone = !item.phone || item.phone.includes("•") || item.phone.replace(/\D/g, "").length < 10;

        return (
          <li key={item.id} className="flex flex-wrap items-center gap-2 py-2 first:pt-0 last:pb-0 sm:gap-3">

            <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
              <Link href={caseHref(item)} className="group flex min-w-0 items-baseline gap-2">
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-zinc-400">{item.protocol}</span>
                <span className="truncate text-sm font-medium text-zinc-900 group-hover:text-violet-700">
                  {item.title}
                </span>
              </Link>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500">
                <span>{item.customer}</span>
                <span>· respondida {item.publicResponseAt ? descreverRegistro(item.publicResponseAt) : "(sem data)"}</span>
                {(item.pedidosDeAvaliacao ?? 0) > 0 && (
                  <span>
                    · {item.pedidosDeAvaliacao} pedido(s), o último em {descreverRegistro(item.ultimoPedidoAvaliacaoEm)}
                  </span>
                )}
                {semTelefone && (
                  <span className="flex items-center gap-1 text-amber-700">
                    <PhoneOff size={11} /> sem telefone
                  </span>
                )}
              </p>
            </div>

            <span className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${
              destaque ? "bg-violet-50 text-violet-800 ring-violet-200" : "bg-zinc-50 text-zinc-600 ring-zinc-200"
            }`}>
              {destaque ? <Star size={11} /> : <CalendarClock size={11} />}
              {pedido.numero}º lembrete · {pedido.quando}
            </span>

            <button
              type="button"
              onClick={() => onPedir(item)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                destaque
                  ? "bg-violet-700 text-white hover:bg-violet-800"
                  : "text-violet-700 ring-1 ring-inset ring-violet-200 hover:bg-violet-50"
              }`}
            >
              <Send size={14} /> Pedir
            </button>

            <button
              type="button"
              onClick={() => {
                if (confirmando === item.protocol) {
                  onDispensar(item);
                  setConfirmando(null);
                } else {
                  setConfirmando(item.protocol);
                  window.setTimeout(() => setConfirmando((atual) => (atual === item.protocol ? null : atual)), 4000);
                }
              }}
              disabled={gravando === item.protocol}
              title="Tira este caso da fila de pedir avaliação. Nada é apagado, e dá para devolver depois."
              aria-label={confirmando === item.protocol ? "Confirmar: dispensar o pedido de avaliação" : "Dispensar o pedido de avaliação"}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
                confirmando === item.protocol
                  ? "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200"
                  : "text-zinc-500 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50 hover:text-zinc-700"
              }`}
            >
              {gravando === item.protocol ? <Loader2 size={13} className="animate-spin" /> : <BellOff size={13} />}
              {confirmando === item.protocol ? "Dispensar?" : <span className="hidden sm:inline">Dispensar</span>}
            </button>

          </li>
        );
      })}
    </ul>
  );
}
