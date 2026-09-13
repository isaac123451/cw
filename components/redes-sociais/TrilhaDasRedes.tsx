"use client";

import { useEffect, useState } from "react";

import {
  ArrowRight,
  Check,
  History,
  Loader2,
  MessagesSquare,
  RotateCcw,
  Siren,
} from "lucide-react";

import type { Case } from "@/lib/models/case";
import type { ContatoView } from "@/lib/models/tratativa";
import {
  cadenciaDasRedes,
  eFinalDasRedes,
  etapaDasRedes,
  SEGUIDORES_DE_ALCANCE,
  sinaisDeCrise,
} from "@/lib/models/redes";
import { descreverRegistro } from "@/lib/services/horasUteis";
import { openMovementOf } from "@/lib/services/movement.service";

import { listarContatos, retratoDoCliente } from "@/lib/actions/tratativa";
import { loadCaseTexts } from "@/lib/actions/cases";
import { reabrirAtendimento } from "@/lib/actions/redes";
import { useCases } from "@/lib/context/CaseContext";
import { useMovements } from "@/lib/context/MovementsContext";
import { useSla } from "@/lib/context/SlaContext";
import { useToast } from "@/lib/context/ToastContext";

import { quandoVence } from "@/components/reclame-aqui/tratativa/RelogioDoCaso";
import { useTratativa } from "@/components/reclame-aqui/tratativa/TratativaProvider";

import EncerrarRedesModal from "./EncerrarRedesModal";

interface Props {
  data: Case;
  aoMudarNoServidor?: (patch: Partial<Case>) => void;
  /** Leva à aba em que fica a área acionada. */
  irParaAreas: () => void;
  /** Move o caso de etapa no quadro. */
  mover: (status: string) => void;
}

type Passo = {
  id: string;
  titulo: string;
  feito: boolean;
  detalhe: string;
  acao?: { rotulo: string; fazer: () => void };
};

/**
 * O fluxo das Redes Sociais no topo do atendimento.
 *
 * Os cinco passos do documento — recebimento, análise, 1º contato,
 * tratativa, validação — e o encerramento, com a etapa do quadro
 * acompanhando o que foi registrado. Em cima, os dois avisos que o
 * documento pede que ninguém perca: o cliente que já tentou outro canal
 * (não pedir para repetir) e os sinais de crise (acionar a liderança;
 * nada público sem alinhamento).
 */
export default function TrilhaDasRedes({ data, aoMudarNoServidor, irParaAreas, mover }: Props) {

  const t = useTratativa();
  const { cases, setCases } = useCases();
  const { movements } = useMovements();
  const { expediente } = useSla();
  const { notify } = useToast();

  const opcoes = { aoSalvar: aoMudarNoServidor };

  const [contatos, setContatos] = useState<ContatoView[] | null>(null);
  const [historico, setHistorico] = useState<{ ra: number; redes: number; nps: number } | null>(null);
  const [encerrando, setEncerrando] = useState<string | null>(null);
  const [reabrindo, setReabrindo] = useState(false);
  const [relato, setRelato] = useState<{ protocolo: string; texto: string } | null>(null);

  useEffect(() => {
    let ativo = true;
    loadCaseTexts(data.protocol)
      .then((textos) => ativo && setRelato({ protocolo: data.protocol, texto: textos.description }))
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [data.protocol]);

  useEffect(() => {
    let ativo = true;
    listarContatos(data.protocol)
      .then((c) => ativo && setContatos(c))
      .catch(() => ativo && setContatos([]));
    return () => {
      ativo = false;
    };
  }, [data.protocol, data.ultimoContatoEm]);

  useEffect(() => {
    let ativo = true;
    retratoDoCliente(data.protocol)
      .then((r) => ativo && setHistorico(r ? { ra: r.outrasReclamacoes.length, redes: r.redes.length, nps: r.nps.length } : null))
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [data.protocol]);

  const final = eFinalDasRedes(data.status);
  const aberta = openMovementOf(data.id, movements);
  const cadencia = contatos ? cadenciaDasRedes(contatos, expediente) : null;
  /*
    O relato não vem na carga do quadro (é o texto pesado do caso), e sem
    ele a menção a Procon, processo ou imprensa escrita pelo cliente
    passava em branco: o alerta via só os seguidores.
  */
  const descricao = data.description || (relato?.protocolo === data.protocol ? relato.texto : "");
  const crise = sinaisDeCrise({ ...data, description: descricao }, cases);

  const passos: Passo[] = [
    {
      id: "recebido",
      titulo: "Recebimento",
      feito: true,
      detalhe: [data.source, data.socialHandle ? `@${data.socialHandle.replace(/^@/, "")}` : null, data.followers ? `${data.followers.toLocaleString("pt-BR")} seguidores` : null]
        .filter(Boolean)
        .join(" · "),
    },
    {
      id: "analise",
      titulo: "Análise inicial",
      feito: Boolean(data.imersaoEm || data.primeiroContatoEm),
      detalhe: data.imersaoEm ? `Histórico conferido · ${data.imersaoPor ?? ""}` : "Conta, histórico e o que já foi tentado, antes de responder.",
      acao: { rotulo: "Ver o histórico", fazer: () => t.abrirImersao(data, opcoes) },
    },
    {
      id: "contato",
      titulo: "1º contato",
      feito: Boolean(data.primeiroContatoEm),
      detalhe: data.primeiroContatoEm
        ? `${descreverRegistro(data.primeiroContatoEm)} · ${data.primeiroContatoCanal ?? ""}`
        : (data.followers ?? 0) >= SEGUIDORES_DE_ALCANCE
          ? "Perfil com mais de 10 mil seguidores: em até 1 hora, pelo agente de reputação."
          : "Em até 4 horas úteis, pelo Crisp, já com o histórico verificado.",
      acao: { rotulo: "Registrar o 1º contato", fazer: () => t.abrirContato(data, "contato", opcoes) },
    },
    {
      id: "tratativa",
      titulo: "Tratativa",
      feito: Boolean(data.validadoEm) || final,
      detalhe: aberta
        ? `Com ${aberta.destination}${aberta.chamado ? ` (chamado ${aberta.chamado})` : ""} — o caso segue com você; mantenha o cliente informado.`
        : "Resolver na primeira interação; se precisar de área, registre o nº do chamado.",
      acao: aberta
        ? { rotulo: `Ver ${aberta.destination}`, fazer: irParaAreas }
        : { rotulo: "Acionar área", fazer: () => t.abrirArea(data) },
    },
    {
      id: "validacao",
      titulo: "Validação",
      feito: Boolean(data.validadoEm),
      detalhe: data.validadoEm ? `Cliente confirmou em ${descreverRegistro(data.validadoEm)}.` : "Confirmar com o cliente que a solicitação foi atendida.",
      acao: { rotulo: "Cliente confirmou", fazer: () => t.abrirContato(data, "validacao", opcoes) },
    },
    {
      id: "encerramento",
      titulo: "Encerramento",
      feito: final,
      detalhe: final
        ? `${data.status}${data.encerradoEm ? ` em ${descreverRegistro(data.encerradoEm)}` : ""}${data.causaRaiz ? ` · causa: ${data.causaRaiz}` : ""}`
        : "Resultado, solução aplicada e causa raiz.",
      acao: { rotulo: "Encerrar", fazer: () => setEncerrando("Resolvido") },
    },
  ];

  const atual = passos.find((p) => !p.feito);

  /* A etapa que o registro diz, para o quadro acompanhar. */
  const etapaPeloRegistro = final
    ? data.status
    : data.validadoEm
      ? "Validação"
      : aberta
        ? "Em tratativa"
        : data.primeiroContatoEm
          ? "1º contato"
          : data.imersaoEm
            ? "Em análise"
            : "Recebido";

  const etapaAtual = etapaDasRedes(data.status)?.nome ?? data.status;
  const ordem = ["Recebido", "Em análise", "1º contato", "Em tratativa", "Validação"];
  const atrasada = !final && ordem.indexOf(etapaPeloRegistro) > ordem.indexOf(etapaAtual);

  async function reabrir() {
    setReabrindo(true);
    try {
      const r = await reabrirAtendimento(data.protocol);
      if (!r.ok) {
        notify({ tone: "error", title: "Não foi reaberto.", detail: r.erro });
        return;
      }
      const patch: Partial<Case> = { status: r.status, resolved: false, encerradoEm: undefined, reaberturas: r.reaberturas };
      setCases((prev) => prev.map((c) => (c.protocol === data.protocol ? { ...c, ...patch } : c)));
      aoMudarNoServidor?.(patch);
      notify({ tone: "success", title: "Atendimento reaberto.", detail: "O mesmo registro, com o histórico preservado. Registre o novo contato." });
    } finally {
      setReabrindo(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
          <MessagesSquare size={17} className="text-pink-600" />
          Fluxo das Redes Sociais
        </h2>
        {(data.reaberturas ?? 0) > 0 && (
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-600">
            reaberto {data.reaberturas}×
          </span>
        )}
      </div>

      {crise.length > 0 && !final && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-xs leading-relaxed text-rose-900 ring-1 ring-inset ring-rose-100">
          <Siren size={15} className="mt-0.5 shrink-0 text-rose-600" />
          <span>
            <strong>Risco de exposição: {crise.map((s) => s.motivo).join("; ")}.</strong> O documento pede acionar a
            liderança agora — e nenhuma resposta pública sem alinhamento prévio.
          </span>
        </p>
      )}

      {historico && historico.ra + historico.redes + historico.nps > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-900 ring-1 ring-inset ring-amber-100">
          <History size={14} className="mt-0.5 shrink-0 text-amber-600" />
          <span>
            <strong>Já tentou outro canal:</strong>{" "}
            {[
              historico.ra ? `${historico.ra} reclamação(ões) no Reclame Aqui` : null,
              historico.redes ? `${historico.redes} atendimento(s) em rede social` : null,
              historico.nps ? `${historico.nps} resposta(s) de NPS` : null,
            ]
              .filter(Boolean)
              .join(", ")}
            . Reconheça a tentativa anterior e não peça para repetir o que já está no histórico.
          </span>
        </p>
      )}

      <ol className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {passos.map((p, i) => (
          <li
            key={p.id}
            className={`rounded-xl px-3 py-2.5 ring-1 ring-inset ${
              p.feito
                ? "bg-emerald-50/60 ring-emerald-100"
                : p === atual
                  ? "bg-violet-50 ring-violet-200"
                  : "ring-zinc-200"
            }`}
            title={p.detalhe}
          >
            <p className={`flex items-center gap-1.5 text-xs font-semibold ${p.feito ? "text-emerald-800" : p === atual ? "text-violet-800" : "text-zinc-500"}`}>
              {p.feito ? <Check size={12} strokeWidth={3} /> : <span className="tabular-nums">{i + 1}</span>}
              {p.titulo}
            </p>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-zinc-500">{p.detalhe}</p>
          </li>
        ))}
      </ol>

      {/* A ação da vez — ou o reabrir, com o caso encerrado. */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-zinc-50 px-4 py-3 ring-1 ring-inset ring-zinc-200">
        <div className="min-w-0 flex-1 text-xs leading-relaxed text-zinc-600">
          {final ? (
            <>Encerrado como <strong>{data.status}</strong>. Se o cliente responder depois, reabra — o registro é o mesmo.</>
          ) : cadencia && cadencia.tentativas > 0 ? (
            <>
              <strong>{cadencia.resumo}</strong>
              {cadencia.proxima ? ` Até ${quandoVence(cadencia.proxima.ate)}.` : ""}
            </>
          ) : atual ? (
            <><strong>Agora: {atual.titulo.toLowerCase()}.</strong> {atual.detalhe}</>
          ) : null}
          {contatos === null && <Loader2 size={12} className="ml-1 inline animate-spin" />}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {final ? (
            <button
              type="button"
              onClick={reabrir}
              disabled={reabrindo}
              className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium text-zinc-700 ring-1 ring-inset ring-zinc-300 transition-colors hover:bg-white"
            >
              {reabrindo ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              Reabrir
            </button>
          ) : (
            <>
              {cadencia?.esgotada && (
                <button
                  type="button"
                  onClick={() => setEncerrando("Sem contato")}
                  className="rounded-xl px-3.5 py-2 text-sm font-medium text-zinc-700 ring-1 ring-inset ring-zinc-300 transition-colors hover:bg-white"
                >
                  Encerrar sem contato
                </button>
              )}
              {cadencia && cadencia.tentativas > 0 && !cadencia.esgotada && (
                <button
                  type="button"
                  onClick={() => t.abrirContato(data, "tentativa", opcoes)}
                  className="rounded-xl px-3.5 py-2 text-sm font-medium text-zinc-700 ring-1 ring-inset ring-zinc-300 transition-colors hover:bg-white"
                >
                  Registrar a {cadencia.proxima?.numero}ª tentativa
                </button>
              )}
              {atual?.acao && (
                <button
                  type="button"
                  onClick={atual.acao.fazer}
                  className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-800"
                >
                  {atual.acao.rotulo}
                  <ArrowRight size={14} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {atrasada && (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          O quadro mostra “{etapaAtual}”, mas o registro já está em “{etapaPeloRegistro}”.
          <button type="button" onClick={() => mover(etapaPeloRegistro)} className="font-medium text-violet-700 hover:underline">
            Mover para {etapaPeloRegistro}
          </button>
        </p>
      )}

      {encerrando && (
        <EncerrarRedesModal
          item={data}
          resultadoInicial={encerrando}
          onClose={() => setEncerrando(null)}
          onSalvo={(patch) => {
            setCases((prev) => prev.map((c) => (c.protocol === data.protocol ? { ...c, ...patch } : c)));
            aoMudarNoServidor?.(patch);
          }}
        />
      )}

    </section>
  );
}
