import { acharCaso, type Case } from "@/lib/models/case";
import type { NpsResponseView } from "@/lib/models/nps";

/**
 * O que o assistente precisa saber da tela aberta (1.125, Fase 28: "um
 * botão flutuante e arrastável que abre o assistente com o contexto da
 * tela").
 *
 * A mini-janela na frente vence a página (é para ela que a pessoa está
 * olhando); depois, a ficha aberta pelo endereço — reclamação, Redes ou
 * NPS —; senão, o nome da tela. O texto vai junto do retrato da operação,
 * e as sugestões mudam com o que está aberto.
 */

export interface ContextoDaTela {
  tipo: "caso" | "nps" | "tela";
  /** "RA-123 · Pizzaria da Ana", "NPS de João (nota 3)", "Índice". */
  rotulo: string;
  /** O que entra no retrato, para o modelo. */
  texto: string;
  sugestoes: string[];
}

interface JanelaVisivel {
  frente: string;
  ref: string;
  minimizada: boolean;
  z: number;
}

/** O caso inteiro, como o assistente lê. */
export function descreverCasoAberto(c: Case) {
  return [
    `${c.protocol || c.id} (${c.source}), status "${c.status}", aberto em ${c.createdAt}. Consumidor: ${c.customer}${c.company ? `, estabelecimento ${c.company}` : ""}.`,
    c.category ? `Categoria: ${c.category}.` : "",
    `Título: ${c.title}`,
    c.description ? `Relato: ${c.description.slice(0, 1500)}` : "Relato: (não registrado na lista — peça o relato se precisar)",
    c.publicResponse ? `Nossa resposta pública: ${c.publicResponse.slice(0, 800)}` : "Ainda sem resposta pública nossa.",
    c.evaluated ? `Avaliado: nota ${c.score ?? "—"}, ${c.resolved ? "resolvido" : "não resolvido"}.` : "Ainda sem avaliação.",
    c.churnRisk ? "Marcado como risco de cancelamento." : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function descreverNps(r: NpsResponseView) {
  return [
    `Resposta do NPS de ${r.customerName || r.customer}${r.company ? ` (${r.company})` : ""}: nota ${r.score}, respondida em ${r.respondedAt.slice(0, 10)}.`,
    r.comment ? `Comentário: ${r.comment.slice(0, 1200)}` : "Sem comentário.",
    `Etapa: "${r.status}".${r.kind ? ` Tipo: ${r.kind}.` : ""}${r.rootCause ? ` Causa raiz: ${r.rootCause}.` : ""}`,
    r.firstContactAt ? `1º contato feito em ${r.firstContactAt.slice(0, 10)}.` : `Sem 1º contato; o prazo é ${r.firstContactDueAt.slice(0, 16).replace("T", " ")}.`,
    r.closedAt ? `Encerrada em ${r.closedAt.slice(0, 10)}${r.outcome ? ` (${r.outcome})` : ""}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const SUGESTOES_DO_CASO = ["O que fazer agora neste caso?", "Escreva uma resposta pública para este caso", "Qual a chance de este cliente cancelar?"];
const SUGESTOES_DO_NPS = ["Como abordar este cliente?", "O que já foi feito e o que falta?", "Que causa raiz parece ser?"];
const SUGESTOES_DA_TELA = ["Qual o próximo passo de hoje?", "O que está fora do prazo hoje?", "O que mais move a nota agora?"];

function doCaso(c: Case, onde: string): ContextoDaTela {
  return {
    tipo: "caso",
    rotulo: `${c.protocol || "Caso"} · ${c.customer}`,
    texto: `TELA ABERTA AGORA: ${onde}. "Este caso" é este:\n${descreverCasoAberto(c)}`,
    sugestoes: SUGESTOES_DO_CASO,
  };
}

function doNps(r: NpsResponseView, onde: string): ContextoDaTela {
  return {
    tipo: "nps",
    rotulo: `NPS de ${r.customerName || r.customer} (nota ${r.score})`,
    texto: `TELA ABERTA AGORA: ${onde}. "Este cliente" é este:\n${descreverNps(r)}`,
    sugestoes: SUGESTOES_DO_NPS,
  };
}

export function contextoDaTela(entrada: {
  caminho: string;
  nomeDaTela?: string;
  casos: Case[];
  nps: NpsResponseView[];
  janelas: JanelaVisivel[];
}): ContextoDaTela {
  const { caminho, casos, nps } = entrada;

  /* 1. A mini-janela na frente. */
  const naFrente = [...entrada.janelas].filter((j) => !j.minimizada).sort((a, b) => b.z - a.z)[0];
  if (naFrente) {
    if (naFrente.frente === "nps") {
      const r = nps.find((x) => x.id === naFrente.ref);
      if (r) return doNps(r, "a mini-janela da resposta do NPS");
    } else if (naFrente.frente === "reclame-aqui" || naFrente.frente === "redes") {
      const c = acharCaso(casos, naFrente.ref);
      if (c) return doCaso(c, "a mini-janela do caso");
    }
  }

  /* 2. A ficha aberta pelo endereço. */
  const ficha = caminho.match(/^\/(reclame-aqui|redes-sociais)\/([^/?#]+)\/?$/);
  if (ficha) {
    const c = acharCaso(casos, ficha[2]);
    if (c) return doCaso(c, ficha[1] === "reclame-aqui" ? "a ficha da reclamação" : "a ficha do atendimento das Redes");
  }
  const fichaNps = caminho.match(/^\/nps\/([^/?#]+)\/?$/);
  if (fichaNps) {
    const r = nps.find((x) => x.id === decodeURIComponent(fichaNps[1]));
    if (r) return doNps(r, "a ficha da resposta do NPS");
  }

  /* 3. A tela. */
  const nome = entrada.nomeDaTela || caminho;
  return {
    tipo: "tela",
    rotulo: nome,
    texto: `TELA ABERTA AGORA: ${nome} (${caminho}). Responda pensando no que esta tela mostra.`,
    sugestoes: SUGESTOES_DA_TELA,
  };
}
