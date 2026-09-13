import {
  Case,
  CRITERIOS,
  respondida,
} from "@/lib/models/case";
import { CaseMovement } from "@/lib/models/movement";
import {
  ROTULO_DO_RESULTADO,
  type ContatoView,
} from "@/lib/models/tratativa";

import { diaDoRegistro, descreverPrazo } from "@/lib/services/horasUteis";
import { movementsOf } from "@/lib/services/movement.service";

export type TimelineTone =
  | "origem"
  | "andamento"
  | "contato"
  | "movimentacao"
  | "retorno"
  | "alerta"
  | "avaliacao"
  | "encerramento";

export interface TimelineEntry {
  id: string;
  title: string;
  detail: string;
  /** Dia (`AAAA-MM-DD`) ou instante ISO — ver `quandoNaLinha`. */
  at: string;
  tone: TimelineTone;
  /** A data não foi registrada: é a melhor aproximação que o caso tem. */
  aproximado?: boolean;
}

export const TIMELINE_TONE: Record<TimelineTone, string> = {
  origem: "bg-violet-500",
  andamento: "bg-sky-500",
  contato: "bg-indigo-400",
  movimentacao: "bg-amber-500",
  retorno: "bg-teal-500",
  alerta: "bg-rose-500",
  avaliacao: "bg-violet-500",
  encerramento: "bg-emerald-600",
};

const TITULO_DO_CONTATO: Record<ContatoView["tipo"], string> = {
  contato: "Contato com o cliente",
  tentativa: "Tentativa de contato",
  atualizacao: "Atualização ao cliente",
  "pedido-avaliacao": "Pedido de avaliação",
  validacao: "Cliente confirmou a solução",
};

/**
 * "21/08/2026" ou "21/08/2026 14:05" — dia sem hora não ganha hora.
 *
 * A linha mistura datas de dia (a publicação no portal, a avaliação) com
 * instantes (contatos, acionamentos). Antes ela partia tudo em "-" e
 * invertia: um instante ISO virava "05:00.000Z-14T10/09/2026".
 */
export function quandoNaLinha(at: string) {
  const { dia, min } = diaDoRegistro(at);
  const data = dia.split("-").reverse().join("/");
  return min === undefined
    ? data
    : `${data} ${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** A ordem cronológica em Brasília; o dia sem hora vem antes das horas daquele dia. */
function chave(at: string) {
  const { dia, min } = diaDoRegistro(at);
  return `${dia}|${min === undefined ? "0000" : String(min + 1).padStart(4, "0")}`;
}

/**
 * Linha do tempo do caso.
 *
 * Parte do que aparece aqui é derivado do próprio caso (registro,
 * classificação, resposta, avaliação, encerramento) e parte é registro
 * de verdade — triagem, contatos, áreas acionadas, escalonamentos,
 * moderação, CW Engine. É a trilha do documento contada na ordem em que
 * aconteceu, com quem fez cada passo.
 */
export function buildTimeline(
  item: Case,
  movements: CaseMovement[] = [],
  contatos: ContatoView[] = []
): TimelineEntry[] {

  const chegada = item.recebidaEm ?? item.createdAt;

  const entries: TimelineEntry[] = [
    {
      id: "registro",
      title: "Reclamação registrada",
      detail: `Recebida via ${item.source}`,
      at: chegada,
      tone: "origem",
    },
  ];

  /*
    A classificação não tem data própria: entra colada ao registro, e só
    quando existe. "Classificada · Não classificado" era uma linha que
    não dizia nada — e, datada só pelo dia, aparecia antes da chegada.
  */
  if (item.category && !/^n[ãa]o classificad/i.test(item.category)) {
    entries.push({
      id: "classificacao",
      title: "Classificada",
      detail: [item.category, item.subcategory, item.owner ? `responsável: ${item.owner}` : null]
        .filter(Boolean)
        .join(" · "),
      at: chegada,
      tone: "andamento",
    });
  }

  if (item.triadaEm) {
    const marcados = CRITERIOS.filter((c) => item.criterios?.includes(c.id)).map((c) => c.texto.toLowerCase());
    entries.push({
      id: "triagem",
      title: `Triada como ${item.priority}`,
      detail: [marcados.length ? marcados.join("; ") : "sem critério de Urgente ou Alta", item.triadaPor ? `por ${item.triadaPor}` : ""]
        .filter(Boolean)
        .join(" · "),
      at: item.triadaEm,
      tone: "andamento",
    });
  }

  if (item.imersaoEm) {
    entries.push({
      id: "imersao",
      title: "Imersão no histórico do cliente",
      detail: item.imersaoPor ? `por ${item.imersaoPor}` : "Conta, fase e jornada conferidas.",
      at: item.imersaoEm,
      tone: "andamento",
    });
  }

  const primeiro = contatos
    .filter((c) => c.tipo !== "pedido-avaliacao")
    .reduce<ContatoView | null>((a, c) => (!a || c.em < a.em ? c : a), null);

  for (const c of contatos) {
    entries.push({
      id: `contato-${c.id}`,
      title: c.id === primeiro?.id ? "1º contato" : TITULO_DO_CONTATO[c.tipo] ?? "Contato",
      detail: [
        c.id === primeiro?.id && c.tipo !== "contato" ? TITULO_DO_CONTATO[c.tipo].toLowerCase() : null,
        c.canal,
        c.resultado ? ROTULO_DO_RESULTADO[c.resultado].toLowerCase() : null,
        `por ${c.autor}`,
        c.nota ? `"${c.nota.length > 140 ? `${c.nota.slice(0, 140)}…` : c.nota}"` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      at: c.em,
      tone: c.tipo === "validacao" ? "retorno" : "contato",
    });
  }

  for (const movement of movementsOf(item.id, movements)) {

    entries.push({
      id: `mov-${movement.id}`,
      title: `${movement.destination} acionada`,
      detail: [
        movement.reason,
        movement.prioridade ? `caso ${movement.prioridade}, retorno em até ${descreverPrazo(movement.dueHours)}` : `retorno em até ${descreverPrazo(movement.dueHours)}`,
        movement.chamado ? `chamado ${movement.chamado}` : null,
        `por ${movement.actor}`,
      ]
        .filter(Boolean)
        .join(" · "),
      at: movement.startedAt,
      tone: "movimentacao",
    });

    if (movement.escalonadoEm) {
      entries.push({
        id: `esc-${movement.id}`,
        title: `Atraso de ${movement.destination} escalonado ao gestor`,
        detail: "O prazo de retorno venceu.",
        at: movement.escalonadoEm,
        tone: "alerta",
      });
    }

    if (movement.returnedAt) {
      entries.push({
        id: `ret-${movement.id}`,
        title: `Retorno de ${movement.destination}`,
        detail: movement.outcome ?? "Retorno registrado.",
        at: movement.returnedAt,
        tone: "retorno",
      });
    }
  }

  if (respondida(item)) {
    entries.push({
      id: "resposta",
      title: "Resposta pública publicada",
      detail: item.responseTime
        ? `Retorno em ${item.responseTime}`
        : "Publicada no portal",
      at: item.publicResponseAt ?? item.updatedAt ?? item.createdAt,
      aproximado: !item.publicResponseAt,
      tone: "andamento",
    });
  }

  if (item.moderacaoPedidaEm) {
    entries.push({
      id: "moderacao",
      title: "Moderação pedida ao Reclame Aqui",
      detail: item.moderacaoMotivo ?? "Motivo não registrado.",
      at: item.moderacaoPedidaEm,
      tone: "alerta",
    });

    if (item.moderacaoRespondidaEm && item.moderacaoResultado && item.moderacaoResultado !== "pendente") {
      entries.push({
        id: "moderacao-resposta",
        title: item.moderacaoResultado === "aceita" ? "Moderação aceita" : "Moderação negada",
        detail: item.moderacaoResultado === "aceita" ? "A reclamação sai da nota." : "A reclamação segue contando na nota.",
        at: item.moderacaoRespondidaEm,
        tone: item.moderacaoResultado === "aceita" ? "encerramento" : "alerta",
      });
    }
  }

  if (item.evaluated) {
    entries.push({
      id: "avaliacao",
      title: "Cliente avaliou",
      detail: `Nota ${item.score ?? 0} · voltaria: ${
        item.wouldDoBusiness ? "sim" : "não"
      }`,
      at:
        item.evaluatedAt ??
        item.updatedAt ??
        item.createdAt,
      aproximado: !item.evaluatedAt,
      tone: "avaliacao",
    });
  }

  if (item.cwEngineEm) {
    entries.push({
      id: "cw-engine",
      title: "CW Engine atualizado",
      detail: item.cwEnginePor ? `Finalização registrada por ${item.cwEnginePor}` : "Finalização registrada.",
      at: item.cwEngineEm,
      tone: "encerramento",
    });
  }

  if (item.resolved) {
    entries.push({
      id: "encerramento",
      title: "Caso encerrado",
      detail: item.solutionTime
        ? `Solução em ${item.solutionTime}`
        : "Encerrado pela operação",
      at: item.updatedAt ?? item.createdAt,
      aproximado: true,
      tone: "encerramento",
    });
  }

  // Cronológica. Empate mantém a ordem de construção, que é a ordem
  // natural do ciclo — registro antes de classificação, por exemplo.
  return entries
    .map((e, i) => ({ e, i, k: chave(e.at) }))
    .sort((a, b) => a.k.localeCompare(b.k) || a.i - b.i)
    .map(({ e }) => e);
}
