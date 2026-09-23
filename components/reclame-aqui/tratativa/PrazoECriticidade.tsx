"use client";

import Link from "next/link";

import { useCallback, useEffect, useState } from "react";

import { Loader2, PhoneCall, ShieldCheck, Sparkles, Trash2 } from "lucide-react";

import { Case, CRITERIOS } from "@/lib/models/case";
import {
  patchDoResumo,
  podeMarcarSemRetorno,
  quandoLiberaSemRetorno,
  ROTULO_DO_RESULTADO,
  tipoDeContato,
  type ContatoView,
} from "@/lib/models/tratativa";
import { descreverPrazo, paredeDe } from "@/lib/services/horasUteis";
import { slaStatus } from "@/lib/services/sla.service";

import { apagarContato, listarContatos, marcarTentativaSemRetorno } from "@/lib/actions/tratativa";
import { useCases } from "@/lib/context/CaseContext";
import { useSession } from "@/lib/context/SessionContext";
import { useSla } from "@/lib/context/SlaContext";
import { useToast } from "@/lib/context/ToastContext";
import { useAgora } from "@/lib/hooks/useAgora";

import ChipPrioridade from "./ChipPrioridade";
import RelogioDoCaso, { quandoVence } from "./RelogioDoCaso";
import { useTratativa } from "./TratativaProvider";
import { useUrgenciaPorDado } from "./useUrgenciaPorDado";

import PorQue from "@/components/shared/PorQue";
interface Props {
  data: Case;
  /**
   * O que o servidor mudou, para a tela do caso acompanhar.
   *
   * A tela edita num rascunho; se ele estiver aberto, a prioridade nova
   * da triagem precisa entrar nele — senão o próximo "Salvar" regravaria
   * a prioridade antiga por cima.
   */
  aoMudarNoServidor?: (patch: Partial<Case>) => void;
}

function dataHora(iso: string) {
  const { dia, min } = paredeDe(new Date(iso));
  const [, m, d] = dia.split("-");
  return `${d}/${m} ${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/**
 * Criticidade, prazo e contatos — o bloco da lateral do caso.
 *
 * Substitui o bloco "SLA", que mostrava "Restam 48h" contado em dias
 * corridos a partir da meia-noite. Aqui ficam juntos os três fatos que
 * a documentação amarra: a triagem decide o prazo, o prazo corre até o
 * 1º contato, e cada contato fica registrado.
 */
export default function PrazoECriticidade({ data, aoMudarNoServidor }: Props) {

  const { rules, expediente } = useSla();
  const { abrirTriagem, abrirContato } = useTratativa();
  const { setCases } = useCases();
  const { notify } = useToast();
  const sessao = useSession();
  const agora = useAgora();
  const porDado = useUrgenciaPorDado(data);

  const [contatos, setContatos] = useState<ContatoView[] | null>(null);
  const [todos, setTodos] = useState(false);
  const [apagando, setApagando] = useState<string | null>(null);
  const [marcando, setMarcando] = useState<string | null>(null);

  const recarregar = useCallback(() => {
    listarContatos(data.protocol)
      .then(setContatos)
      .catch(() => setContatos([]));
  }, [data.protocol]);

  /*
    Relê a lista quando o resumo do caso muda — é o sinal de que um
    contato entrou, por aqui ou pelo cartão do quadro.
  */
  useEffect(() => {
    recarregar();
  }, [recarregar, data.ultimoContatoEm, data.primeiroContatoEm]);

  const status = agora ? slaStatus(data, rules, { agora, expediente }) : null;
  const marcados = CRITERIOS.filter((c) => data.criterios?.includes(c.id));

  const opcoes = { aoSalvar: aoMudarNoServidor };

  async function apagar(id: string) {

    setApagando(id);

    try {
      const r = await apagarContato(id);

      if (!r.ok) {
        notify({ tone: "error", title: "O contato não foi apagado.", detail: r.erro });
        return;
      }

      const patch: Partial<Case> = patchDoResumo(r.resumo);

      setCases((prev) =>
        prev.map((c) => (c.protocol === data.protocol ? { ...c, ...patch } : c))
      );
      aoMudarNoServidor?.(patch);

      notify({ tone: "success", title: "Contato apagado.", detail: "O resumo do caso foi recalculado." });
      recarregar();
    } finally {
      setApagando(null);
    }
  }

  /* A tentativa aguardando retorno vira "sem retorno" — passadas as 2 horas. */
  async function semRetorno(c: ContatoView) {
    setMarcando(c.id);
    try {
      const r = await marcarTentativaSemRetorno({ id: c.id, resultado: /telefone/i.test(c.canal) ? "nao-atendeu" : "sem-resposta" });
      if (!r.ok) {
        notify({ tone: "error", title: "Não foi marcado.", detail: r.erro });
        return;
      }
      const patch: Partial<Case> = patchDoResumo(r.resumo);
      setCases((prev) => prev.map((x) => (x.protocol === data.protocol ? { ...x, ...patch } : x)));
      aoMudarNoServidor?.(patch);
      notify({
        tone: "success",
        title: "Tentativa sem retorno.",
        detail: `${r.resumo.tentativasSemResposta}ª seguida sem resposta — entra na cadência de 5 em 7 dias.`,
      });
      recarregar();
    } catch {
      notify({ tone: "error", title: "Não foi marcado.", detail: "Tente de novo em instantes." });
    } finally {
      setMarcando(null);
    }
  }

  const visiveis = contatos ? (todos ? contatos : contatos.slice(0, 4)) : [];

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">

      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="text-base font-semibold text-zinc-900">Criticidade e prazo</h3>
          <PorQue chave={data.source === "Reclame Aqui" ? "ra.criticidade" : "redes.primeiro-contato"} />
        </div>
        <button
          type="button"
          onClick={() => abrirTriagem(data, opcoes)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-50"
        >
          <ShieldCheck size={13} />
          {data.triadaEm ? "Refazer triagem" : "Triar"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <ChipPrioridade item={data} />
        <RelogioDoCaso item={data} />
      </div>

      {data.triadaEm ? (
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          Triado {data.triadaPor ? `por ${data.triadaPor} ` : ""}em {dataHora(data.triadaEm)}.
          {marcados.length > 0 && <> Critérios: {marcados.map((c) => c.texto.toLowerCase()).join("; ")}.</>}
        </p>
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          Ainda sem triagem: a prioridade é a de entrada. O Passo 1 da documentação é classificar
          a criticidade — é ela que decide o prazo.
        </p>
      )}

      {porDado.sinais.length > 0 && porDado.nivel !== data.priority && (
        <button
          type="button"
          onClick={() => abrirTriagem(data, opcoes)}
          title={porDado.sinais.map((s) => s.motivo).join("\n")}
          className="mt-2 flex w-full items-start gap-1.5 rounded-xl bg-violet-50 px-3 py-2 text-left text-xs leading-relaxed text-violet-900 ring-1 ring-inset ring-violet-200 transition-colors hover:bg-violet-100"
        >
          <Sparkles size={13} className="mt-0.5 shrink-0" />
          <span>
            <strong className="font-semibold">Os dados sugerem {porDado.nivel}</strong>
            {" — "}
            {porDado.sinais.map((s) => CRITERIOS.find((c) => c.id === s.criterio)?.texto.toLowerCase()).join("; ")}. Abrir a triagem para ver por quê.
          </span>
        </button>
      )}

      {status?.rule && (
        <dl className="mt-3 space-y-1.5 border-t border-zinc-100 pt-3 text-xs">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-zinc-500">1º contato</dt>
            <dd className="text-right font-medium text-zinc-800">
              em até {descreverPrazo(status.rule.responseHours)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-zinc-500">Solução</dt>
            <dd className="text-right font-medium text-zinc-800">
              {status.rule.solutionHours > 0 ? `em até ${descreverPrazo(status.rule.solutionHours)}` : "sem prazo na documentação"}
            </dd>
          </div>
          {status.prazo && status.fase !== "concluido" && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-zinc-500">Vence</dt>
              <dd className="text-right font-medium text-zinc-800">{quandoVence(status.prazo)}</dd>
            </div>
          )}
        </dl>
      )}

      {status && !status.rule && (
        <p className="mt-3 border-t border-zinc-100 pt-3 text-xs leading-relaxed text-zinc-500">
          Nenhuma regra de prazo cobre este caso.{" "}
          <Link href="/processos" className="font-medium text-violet-700 hover:underline">
            Usar os prazos da documentação
          </Link>
        </p>
      )}

      <div className="mt-3 border-t border-zinc-100 pt-3">

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Contatos</p>
          <button
            type="button"
            onClick={() => abrirContato(data, data.primeiroContatoEm ? "tentativa" : "contato", opcoes)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-50"
          >
            <PhoneCall size={12} />
            Registrar contato
          </button>
        </div>

        {data.primeiroContatoEm ? (
          <p className="mt-1.5 text-xs text-zinc-600">
            1º contato em {dataHora(data.primeiroContatoEm)}
            {data.primeiroContatoCanal ? ` por ${data.primeiroContatoCanal}` : ""}
            {data.primeiroContatoPor ? ` · ${data.primeiroContatoPor}` : ""}.
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-zinc-500">Nenhum contato registrado ainda.</p>
        )}

        {(data.tentativasSemResposta ?? 0) > 0 && (
          <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs leading-relaxed text-amber-800 ring-1 ring-inset ring-amber-100">
            {data.tentativasSemResposta} tentativa(s) seguida(s) sem resposta. A documentação pede até 5
            ligações em horários variados ao longo de 7 dias, com e-mail complementar.
          </p>
        )}

        {contatos === null ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-400">
            <Loader2 size={12} className="animate-spin" /> Carregando contatos…
          </p>
        ) : (
          visiveis.length > 0 && (
            <ul className="mt-2 space-y-2">
              {visiveis.map((c) => (
                <li key={c.id} className="group rounded-lg bg-zinc-50 px-2.5 py-2 text-xs ring-1 ring-inset ring-zinc-100">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-zinc-800">
                      {tipoDeContato(c.tipo)?.rotulo ?? c.tipo}
                      <span className="font-normal text-zinc-500">
                        {" "}· {c.canal}
                        {c.resultado ? ` · ${ROTULO_DO_RESULTADO[c.resultado].toLowerCase()}` : ""}
                      </span>
                    </span>
                    {c.autor === sessao?.name && (
                      <button
                        type="button"
                        title="Apagar este contato"
                        disabled={apagando === c.id}
                        onClick={() => apagar(c.id)}
                        className="rounded p-0.5 text-zinc-300 opacity-0 transition-all hover:text-rose-600 focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        {apagando === c.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 text-zinc-500">
                    {dataHora(c.em)} · {c.autor}
                  </p>
                  {c.nota && <p className="mt-1 whitespace-pre-wrap text-zinc-600">{c.nota}</p>}
                  {c.tipo === "tentativa" && c.resultado === "aguardando" && agora && (
                    podeMarcarSemRetorno(c.em, agora) ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="text-amber-800">O cliente não respondeu?</span>
                        <button
                          type="button"
                          onClick={() => semRetorno(c)}
                          disabled={marcando !== null}
                          className="flex items-center gap-1 rounded-md bg-white px-2 py-0.5 font-medium text-zinc-800 ring-1 ring-inset ring-zinc-200 hover:ring-zinc-300 disabled:opacity-50"
                        >
                          {marcando === c.id && <Loader2 size={11} className="animate-spin" />}
                          Marcar sem retorno
                        </button>
                      </div>
                    ) : (
                      <p className="mt-1 text-zinc-500">Sem retorno a partir das {quandoLiberaSemRetorno(c.em, agora)} — até lá, o cliente ainda pode responder.</p>
                    )
                  )}
                </li>
              ))}
            </ul>
          )
        )}

        {contatos && contatos.length > 4 && (
          <button
            type="button"
            onClick={() => setTodos((v) => !v)}
            className="mt-2 text-xs font-medium text-violet-700 hover:underline"
          >
            {todos ? "Mostrar só os últimos" : `Ver os ${contatos.length} contatos`}
          </button>
        )}
      </div>

    </section>
  );
}
