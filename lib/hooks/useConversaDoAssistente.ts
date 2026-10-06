"use client";

import { useEffect, useMemo, useState } from "react";

import { useAgenda } from "@/lib/context/AgendaContext";
import { useCases } from "@/lib/context/CaseContext";
import { useEstablishments } from "@/lib/context/EstablishmentsContext";
import { useImpact } from "@/lib/context/ImpactContext";
import { useNps } from "@/lib/context/NpsContext";
import { useSla } from "@/lib/context/SlaContext";
import { aberturaParaOPrompt, avisosDeAbertura, prazosDeHoje } from "@/lib/models/aberturaDoAgente";
import type { Case } from "@/lib/models/case";
import { buildOperationSnapshot } from "@/lib/services/assistant.context";
import { ask, type AssistantAnswer } from "@/lib/services/assistant.service";
import { isOpen } from "@/lib/services/case.service";
import { pluralDe } from "@/lib/plural";

/**
 * A conversa com o assistente (1.125) — a mesma na página `/assistente` e
 * no painel flutuante de qualquer tela.
 *
 * Saiu de dentro da página para os dois lugares mandarem o mesmo retrato da
 * operação, os mesmos prazos e os mesmos casos citados — um assistente que
 * responde diferente conforme onde é aberto ensina a desconfiar dele. O
 * painel acrescenta o **contexto da tela** (o caso, a resposta do NPS ou a
 * tela abertos), por `perguntar(texto, contexto)`.
 */

export interface TurnoDoAssistente {
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
 * Os casos que a pergunta cita, por inteiro.
 *
 * O retrato da operação é agregado — conta, prazos, frentes —, e
 * "o que fazer no RA-123?" precisa do caso em si: relato, resposta,
 * status. Só os citados, no máximo três, para não afogar o retrato.
 */
export function casosCitados(pergunta: string, cases: Case[]) {
  const citados = cases.filter((c) => c.protocol && pergunta.includes(c.protocol)).slice(0, 3);
  if (citados.length === 0) return "";
  return ["", "CASOS CITADOS NA PERGUNTA (os dados completos, do banco):", ...citados.map(descreverCaso)].join("\n");
}

/** O caso inteiro, como o assistente lê — relato, resposta, avaliação. */
export function descreverCaso(c: Case) {
  return [
    `- ${c.protocol} (${c.source}), status "${c.status}", aberto em ${c.createdAt}. Consumidor: ${c.customer}.`,
    c.category ? `  Categoria: ${c.category}.` : "",
    `  Título: ${c.title}`,
    c.description ? `  Relato: ${c.description.slice(0, 1500)}` : "  Relato: (não registrado)",
    c.publicResponse ? `  Nossa resposta pública: ${c.publicResponse.slice(0, 800)}` : "  Ainda sem resposta pública nossa.",
    c.evaluated ? `  Avaliado: nota ${c.score ?? "—"}, ${c.resolved ? "resolvido" : "não resolvido"}.` : "  Ainda sem avaliação.",
    c.churnRisk ? "  Marcado como risco de cancelamento." : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function useConversaDoAssistente() {
  const { cases } = useCases();
  const { tasks } = useAgenda();
  const { records } = useImpact();
  const { rules, expediente } = useSla();
  const { responses } = useNps();
  const { establishments } = useEstablishments();

  const [turns, setTurns] = useState<TurnoDoAssistente[]>([]);
  const [busy, setBusy] = useState(false);

  /** null enquanto ainda não sabemos se a chave existe. */
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  /* Quem responde, pelo nome: o texto dizia "Claude Opus 5" mesmo quando era o Gemini. */
  const [provedor, setProvedor] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/assistente")
      .then((response) => response.json())
      .then((data) => {
        setAiEnabled(Boolean(data.enabled));
        setProvedor(typeof data.provedor === "string" ? data.provedor : null);
      })
      .catch(() => setAiEnabled(false));
  }, []);

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

  /**
   * O que o agente diz antes de alguém perguntar (Fase 9.2).
   *
   * As mesmas funções das telas — `slaStatus`, `semNoticia`,
   * `filaDeAvaliacao` e `sinaisDeCrise`. Um aviso que discorda do painel
   * ensina a desconfiar dos dois.
   */
  const abertura = useMemo(
    () => avisosDeAbertura({ casos: cases, regras: rules, nps: responses, expediente }),
    [cases, rules, responses, expediente]
  );

  /** Pergunta ao assistente; `contexto` é o que a tela aberta acrescenta ao retrato. */
  async function perguntar(texto: string, contexto = "") {

    const pergunta = texto.trim();

    if (pergunta === "" || busy) return;

    const id = crypto.randomUUID();

    // Sem chave configurada, responde pelas rotinas determinísticas.
    if (!aiEnabled) {
      setTurns((prev) => [...prev, { id, question: pergunta, answer: "", local: ask(pergunta, localInput), streaming: false }]);
      return;
    }

    setTurns((prev) => [...prev, { id, question: pergunta, answer: "", streaming: true }]);

    setBusy(true);

    try {

      const historico = turns
        .filter((item) => !item.error && item.answer)
        .flatMap((item) => [
          { role: "user" as const, content: item.question },
          { role: "assistant" as const, content: item.answer },
        ]);

      /*
        Os prazos do relógio do documento, por frente — a mesma conta do Meu
        dia. Sem a separação, o modelo lia "0 fora do prazo" no retrato das
        reclamações e ignorava os 136 da abertura, que eram do NPS.
      */
      const agora = new Date();
      const doCaso = prazosDeHoje(cases.filter(isOpen), rules, [], expediente, agora);
      const doNps = prazosDeHoje([], rules, responses, expediente, agora);
      const prazosPorFrente = [
        "PRAZOS DO RELÓGIO DO DOCUMENTO AGORA (a mesma conta do Meu dia):",
        `- Reclame Aqui e Redes (casos abertos): ${doCaso.estourados} ${pluralDe(doCaso.estourados, "estourado", "estourados")}, ${doCaso.vencemHoje} ${pluralDe(doCaso.vencemHoje, "vence", "vencem")} hoje.`,
        `- NPS (ciclos sem 1º contato): ${doNps.estourados} ${pluralDe(doNps.estourados, "estourado", "estourados")}, ${doNps.vencemHoje} ${pluralDe(doNps.vencemHoje, "vence", "vencem")} hoje.`,
      ].join("\n");

      const response = await fetch("/api/assistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshot: `${buildOperationSnapshot({
            cases,
            tasks,
            impacts: records,
            rules,
            establishments,
          })}

O QUE ESTÁ PEDINDO AÇÃO AGORA (o mesmo que a tela mostra ao abrir):
${aberturaParaOPrompt(abertura)}

${prazosPorFrente}${casosCitados(pergunta, cases)}${contexto ? `\n\n${contexto}` : ""}`,
          messages: [...historico, { role: "user", content: pergunta }],
        }),
      });

      if (!response.ok || !response.body) {
        const detalhe = await response.json().catch(() => ({}));
        throw new Error(detalhe.error ?? "Falha na requisição.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";

      // Lê o SSE linha a linha; um chunk pode cortar um evento no meio.
      while (true) {

        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        /*
          `\r?` porque o mesmo descuido já emudeceu esta tela uma vez: lendo o
          Gemini, que separa com `\r\n\r\n`, o assistente respondia HTTP 200
          com zero caracteres. Aceitar as duas formas custa um caractere.
        */
        const partes = buffer.split(/\r?\n\r?\n/);
        buffer = partes.pop() ?? "";

        for (const parte of partes) {

          const linha = parte.split(/\r?\n/).find((item) => item.startsWith("data: "));

          if (!linha) continue;

          const evento = JSON.parse(linha.slice(6));

          if (evento.type === "delta") {
            setTurns((prev) => prev.map((item) => (item.id === id ? { ...item, answer: item.answer + evento.text } : item)));
          }

          if (evento.type === "error") {
            setTurns((prev) =>
              prev.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      error: evento.message,
                      /* Nada escrito: a resposta pelas regras fica no lugar (1.92). */
                      local: item.answer ? undefined : ask(pergunta, localInput),
                      streaming: false,
                    }
                  : item
              )
            );
          }
        }
      }

    } catch (error) {

      const detalhe = error instanceof Error ? error.message : "Falha ao consultar o assistente.";

      setTurns((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, error: detalhe, local: item.answer ? undefined : ask(pergunta, localInput), streaming: false } : item
        )
      );

    } finally {

      setTurns((prev) => prev.map((item) => (item.id === id ? { ...item, streaming: false } : item)));

      setBusy(false);
    }
  }

  return { turns, setTurns, busy, perguntar, aiEnabled, provedor, abertura };
}
