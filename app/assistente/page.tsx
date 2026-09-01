"use client";

import Link from "next/link";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ArrowRight,
  Bot,
  Database,
  Eraser,
  Loader2,
  Send,
  Sparkles,
  TriangleAlert,
  UserRound,
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import SurfaceCard from "@/components/shared/SurfaceCard";

import { useCases } from "@/lib/context/CaseContext";
import { useAgenda } from "@/lib/context/AgendaContext";
import { useImpact } from "@/lib/context/ImpactContext";
import { useSla } from "@/lib/context/SlaContext";
import { useNps } from "@/lib/context/NpsContext";
import { useEstablishments } from "@/lib/context/EstablishmentsContext";

import {
  ask,
  AssistantAnswer,
  suggestions,
} from "@/lib/services/assistant.service";

import { buildOperationSnapshot } from "@/lib/services/assistant.context";

interface Turn {
  id: string;
  question: string;
  /** Texto vindo do modelo, preenchido conforme o stream chega. */
  answer: string;
  /** Resposta determinística, usada no modo local. */
  local?: AssistantAnswer;
  streaming: boolean;
  error?: string;
}

/**
 * As perguntas que a operação faz de verdade, prontas para clicar.
 *
 * Um campo em branco com "pergunte alguma coisa" é o pior começo que
 * um assistente pode ter: quem chega não sabe o que ele responde, testa
 * algo que ele não entende, e conclui que não serve.
 *
 * As seis abaixo são as da segunda-feira, e cada uma prova uma
 * capacidade diferente — projeção de nota, fila, prazo, retenção, causa
 * raiz e dinheiro. Quem lê a lista já sabe o alcance da ferramenta sem
 * precisar descobrir por tentativa.
 */
const SUGESTOES = [
  "Quantas avaliações preciso para chegar a 9,0?",
  "Quais reclamações estão sem resposta?",
  "O que está fora do prazo hoje?",
  "Quem está em risco de cancelamento?",
  "Qual a causa raiz que mais aparece?",
  "Quanto de impacto financeiro no mês?",
];

export default function AssistentePage() {

  const { cases } = useCases();

  const { tasks } = useAgenda();
  const { records } = useImpact();
  const { rules } = useSla();
  const { responses } = useNps();
  const { establishments } = useEstablishments();

  const [message, setMessage] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);

  /** null enquanto ainda não sabemos se a chave existe. */
  const [aiEnabled, setAiEnabled] = useState<
    boolean | null
  >(null);

  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/assistente")
      .then((response) => response.json())
      .then((data) => setAiEnabled(Boolean(data.enabled)))
      .catch(() => setAiEnabled(false));
  }, []);

  useEffect(() => {
    if (turns.length === 0) return;
    fimRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [turns]);

  /*
    O NPS entra no que o assistente enxerga.

    Sem ele, "como está o NPS?" caía na rotina da reputação — porque
    as duas frentes falam em "nota" — e a resposta vinha sobre o
    Reclame Aqui, com a mesma segurança de uma resposta certa.
  */
  const localInput = useMemo(
    () => ({
      cases,
      nps: responses.map((item) => ({
        score: item.score,
        status: item.status,
        churnRisk: item.churnRisk,
        respondedAt: item.respondedAt,
        customer: item.customer,
        comment: item.comment,
        kind: item.kind,
        rootCause: item.rootCause,
      })),
      tasks,
      impacts: records,
      rules,
    }),
    [cases, responses, tasks, records, rules]
  );

  async function perguntar(texto: string) {

    const pergunta = texto.trim();

    if (pergunta === "" || busy) return;

    const id = crypto.randomUUID();

    setMessage("");

    // Sem chave configurada, responde pelas rotinas determinísticas.
    if (!aiEnabled) {
      setTurns((prev) => [
        ...prev,
        {
          id,
          question: pergunta,
          answer: "",
          local: ask(pergunta, localInput),
          streaming: false,
        },
      ]);
      return;
    }

    setTurns((prev) => [
      ...prev,
      {
        id,
        question: pergunta,
        answer: "",
        streaming: true,
      },
    ]);

    setBusy(true);

    try {

      const historico = turns
        .filter((item) => !item.error && item.answer)
        .flatMap((item) => [
          { role: "user" as const, content: item.question },
          {
            role: "assistant" as const,
            content: item.answer,
          },
        ]);

      const response = await fetch("/api/assistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshot: buildOperationSnapshot({
            cases,
            tasks,
            impacts: records,
            rules,
            establishments,
          }),
          messages: [
            ...historico,
            { role: "user", content: pergunta },
          ],
        }),
      });

      if (!response.ok || !response.body) {
        const detalhe = await response
          .json()
          .catch(() => ({}));

        throw new Error(
          detalhe.error ?? "Falha na requisição."
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";

      // Lê o SSE linha a linha; um chunk pode cortar um evento no meio.
      while (true) {

        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        /**
         * `\r?` porque o mesmo descuido já emudeceu esta tela uma vez.
         *
         * Aqui quem escreve o SSE é a nossa própria rota, e ela usa
         * `\n\n` — então este lado nunca esteve errado. Mas foi
         * exatamente esta linha, do outro lado (lendo o Gemini, que
         * separa com `\r\n\r\n`), que fez o assistente responder HTTP
         * 200 com zero caracteres, sem erro nenhum. Aceitar as duas
         * formas custa um caractere e fecha a porta de vez.
         */
        const partes = buffer.split(/\r?\n\r?\n/);
        buffer = partes.pop() ?? "";

        for (const parte of partes) {

          const linha = parte
            .split(/\r?\n/)
            .find((item) => item.startsWith("data: "));

          if (!linha) continue;

          const evento = JSON.parse(linha.slice(6));

          if (evento.type === "delta") {
            setTurns((prev) =>
              prev.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      answer: item.answer + evento.text,
                    }
                  : item
              )
            );
          }

          if (evento.type === "error") {
            setTurns((prev) =>
              prev.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      error: evento.message,
                      streaming: false,
                    }
                  : item
              )
            );
          }
        }
      }

    } catch (error) {

      const detalhe =
        error instanceof Error
          ? error.message
          : "Falha ao consultar o assistente.";

      setTurns((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, error: detalhe, streaming: false }
            : item
        )
      );

    } finally {

      setTurns((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, streaming: false }
            : item
        )
      );

      setBusy(false);
    }
  }

  return (
    <MainLayout>

      <div className="space-y-6">

        <PageHeading
          eyebrow="Inteligência"
          title="Assistente"
          description="Conversa sobre a operação usando os números reais da base."
        >
          {turns.length > 0 && (
            <button
              onClick={() => setTurns([])}
              className="flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
            >
              <Eraser size={15} />
              Limpar conversa
            </button>
          )}
        </PageHeading>

        {aiEnabled === false && (

          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/60 px-5 py-4">

            <Database
              size={17}
              className="shrink-0 text-amber-600"
            />

            <p className="flex-1 text-sm leading-relaxed text-amber-900">
              Sem{" "}
              <code className="rounded bg-amber-100 px-1 py-0.5 text-[12px]">
                ANTHROPIC_API_KEY
              </code>{" "}
              configurada, o assistente responde em{" "}
              <strong className="font-semibold">
                modo local
              </strong>
              : consultas prontas sobre nota, fila, SLA,
              churn, causa raiz, impacto e agenda. Com a
              chave, ele passa a conversar de verdade sobre
              os mesmos dados.
            </p>

          </div>

        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">

          <SurfaceCard
            title="Conversa"
            description={
              aiEnabled
                ? "Claude Opus 5 lendo o retrato atual da operação."
                : "Consultas locais sobre os dados da base."
            }
            hint="O modelo recebe os indicadores já apurados pelos serviços — nota, fila, SLA, agenda e impacto — em vez das reclamações cruas, para não recontar por conta própria o que a plataforma já calcula."
          >

            <div className="max-h-[520px] space-y-4 overflow-y-auto pr-1">

              {turns.length === 0 ? (

                <div className="rounded-2xl bg-gradient-to-br from-violet-50 via-white to-sky-50/60 p-5 ring-1 ring-inset ring-violet-100">

                  <div className="flex items-start gap-3">

                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
                      <Bot size={18} />
                    </span>

                    <div className="min-w-0">

                      <p className="text-sm font-semibold text-zinc-900">
                        Assistente CW
                      </p>

                      <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
                        Pergunte sobre a nota, a fila sem
                        resposta, prazos estourados, risco de
                        cancelamento, causa raiz, impacto
                        financeiro ou a agenda — e também o
                        que fazer a respeito.
                      </p>

                    </div>

                  </div>

                  {/*
                    As perguntas que se faz de verdade, prontas.

                    O Isaac pediu: "preciso que algo mais criação de
                    análise, como: 'quantas notas preciso para conseguir
                    9,0 de reputação', coisa assim mais direcionadas".

                    Um campo em branco com "pergunte alguma coisa" é o
                    pior começo que um assistente pode ter: quem chega
                    não sabe o que ele responde, testa uma pergunta que
                    ele não entende, e conclui que não serve. Estas seis
                    são as que a operação faz na segunda-feira, e cada
                    uma prova uma capacidade diferente.
                  */}
                  <div className="mt-4 flex flex-wrap gap-2">

                    {SUGESTOES.map((pergunta) => (
                      <button
                        key={pergunta}
                        type="button"
                        onClick={() => perguntar(pergunta)}
                        disabled={busy}
                        className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200 transition-colors hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {pergunta}
                      </button>
                    ))}

                  </div>

                </div>

              ) : (

                turns.map((turn) => (

                  <div key={turn.id} className="space-y-3">

                    <div className="flex justify-end">

                      <p className="flex max-w-[80%] items-start gap-2.5 rounded-2xl rounded-tr-md bg-violet-700 px-4 py-2.5 text-sm text-white">
                        {turn.question}
                        <UserRound
                          size={14}
                          className="mt-0.5 shrink-0 opacity-70"
                        />
                      </p>

                    </div>

                    <div className="flex gap-2.5">

                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
                        <Bot size={16} />
                      </span>

                      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-zinc-200/80 bg-white p-4">

                        {turn.error ? (

                          <p className="flex items-start gap-2 text-sm text-rose-700">
                            <TriangleAlert
                              size={15}
                              className="mt-0.5 shrink-0"
                            />
                            {turn.error}
                          </p>

                        ) : turn.local ? (

                          <>
                            {turn.local.paragraphs.map(
                              (texto, index) => (
                                <p
                                  key={index}
                                  className="mb-2 text-sm leading-relaxed text-zinc-700 last:mb-0"
                                >
                                  {texto}
                                </p>
                              )
                            )}

                            {turn.local.links.length > 0 && (

                              <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-100 pt-3">

                                {turn.local.links.map(
                                  (link) => (
                                    <Link
                                      key={
                                        link.href +
                                        link.label
                                      }
                                      href={link.href}
                                      className="flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-100"
                                    >
                                      {link.label}
                                      <ArrowRight size={12} />
                                    </Link>
                                  )
                                )}

                              </div>

                            )}
                          </>

                        ) : (

                          <>
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
                              {turn.answer}
                            </p>

                            {turn.streaming &&
                              turn.answer === "" && (
                                <p className="flex items-center gap-2 text-sm text-zinc-400">
                                  <Loader2
                                    size={14}
                                    className="animate-spin"
                                  />
                                  Analisando a operação...
                                </p>
                              )}
                          </>

                        )}

                      </div>

                    </div>

                  </div>

                ))

              )}

              <div ref={fimRef} />

            </div>

            <div className="mt-4 flex items-end gap-2 border-t border-zinc-100 pt-4">

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey
                  ) {
                    e.preventDefault();
                    perguntar(message);
                  }
                }}
                rows={2}
                disabled={busy}
                placeholder="Ex.: o que devo priorizar para subir a nota?"
                className="flex-1 resize-none rounded-xl border border-zinc-200 p-3 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400 disabled:bg-zinc-50"
              />

              <button
                onClick={() => perguntar(message)}
                disabled={message.trim() === "" || busy}
                className="flex h-11 items-center gap-2 rounded-xl bg-violet-700 px-4 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
              >
                {busy ? (
                  <Loader2
                    size={15}
                    className="animate-spin"
                  />
                ) : (
                  <Send size={15} />
                )}
                Enviar
              </button>

            </div>

          </SurfaceCard>

          <SurfaceCard
            title="Perguntas frequentes"
            description="Clique para perguntar."
          >

            <ul className="space-y-2">

              {suggestions.map((item) => (

                <li key={item}>

                  <button
                    onClick={() => perguntar(item)}
                    disabled={busy}
                    className="flex w-full items-start gap-2 rounded-xl border border-zinc-200/80 px-3.5 py-2.5 text-left text-sm text-zinc-700 transition-colors hover:border-violet-200 hover:bg-violet-50/60 hover:text-violet-800 disabled:opacity-50"
                  >
                    <Sparkles
                      size={13}
                      className="mt-0.5 shrink-0 text-violet-500"
                    />
                    {item}
                  </button>

                </li>

              ))}

            </ul>

            <p className="mt-4 border-t border-zinc-100 pt-3 text-xs leading-relaxed text-zinc-400">
              {aiEnabled
                ? "O modelo só enxerga os indicadores já apurados pela plataforma, então os números que ele cita são os mesmos das telas de Analytics e Processos."
                : "Modo local: as respostas saem direto das mesmas consultas que alimentam o Analytics."}
            </p>

          </SurfaceCard>

        </div>

      </div>

    </MainLayout>
  );
}
