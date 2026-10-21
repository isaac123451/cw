import type { PrismaClient } from "@prisma/client";

import { MARCADO_PELA_IA } from "@/lib/models/classeDaAvaliacao";
import { pedirEstruturado, temIA } from "@/lib/services/ia.service";

/**
 * A IA marca a avaliação como positiva ou negativa (21/10/2026).
 *
 * "Avaliação negativa ... contabilizada conforme eu marque como negativa
 * ou a IA identifique." Ela só lê a avaliação que tem o **comentário
 * final** do consumidor — "resolveram, mas demorou um mês" muda a leitura
 * de uma nota 8. Sem ele, não há o que ler além da nota, e a regra decide.
 *
 * Medido em 21/10/2026: sem o comentário, a IA decidia pelo assunto da
 * reclamação — marcou negativa uma nota 10 porque o título era "Não
 * recebeu repasse", e positiva uma "Reembolso negado". O assunto é sempre
 * a queixa de antes; não diz nada da avaliação.
 *
 * O resto a regra resolve, e a marca da IA nunca é escrita por cima da de
 * quem atende: a seleção só pega avaliação que ninguém marcou. A
 * avaliação que a IA leu e achou neutra fica registrada (sem marca), para
 * não ser lida de novo.
 */

const POR_LOTE = 25;
const DIAS = 180;

export interface AvaliacaoParaLer {
  protocolo: string;
  nota: number | null;
  resolvida: boolean;
  voltaria: boolean;
  titulo: string;
  comentario: string | null;
}

export interface LeituraDaAvaliacao {
  protocolo: string;
  classe: "positiva" | "negativa" | "neutra";
  motivo: string;
}

/** Precisa da IA? Só com o comentário final — é a única evidência além da nota. */
export function precisaDaIA(c: { consideracaoFinal: string | null }) {
  return (c.consideracaoFinal ?? "").trim().length >= 8;
}

export async function lerComIA(itens: AvaliacaoParaLer[]): Promise<LeituraDaAvaliacao[] | null> {
  const r = await pedirEstruturado({
    sistema:
      "Você é analista de reputação da Cardápio Web (sistema e cardápio digital para restaurantes). Classifica avaliações do Reclame Aqui como positiva, negativa ou neutra para a empresa. Português do Brasil. Use só o que está escrito.",
    prompt: [
      "Para cada avaliação, decida:",
      '- "positiva": o consumidor ficou satisfeito com a solução ou com o atendimento (mesmo com ressalva leve).',
      '- "negativa": o consumidor continua insatisfeito, o problema não foi resolvido, ou o comentário reclama da empresa.',
      '- "neutra": sinais misturados, não dá para dizer.',
      "Decida pelo comentário final, pela nota, pelo resolvido e pelo voltaria. O assunto é a reclamação de antes da avaliação — é sempre uma queixa e NÃO serve para decidir. O comentário final pesa mais que a nota quando os dois discordam. motivo: uma frase curta sobre o que o consumidor disse ao avaliar, sem nome, e-mail, telefone ou documento.",
      "",
      ...itens.map(
        (i) =>
          `${i.protocolo} | nota ${i.nota ?? "—"} | ${i.resolvida ? "resolvida" : "não resolvida"} | ${i.voltaria ? "voltaria" : "não voltaria"} | assunto: ${i.titulo.slice(0, 90)}${i.comentario ? ` | comentário final: "${i.comentario.replace(/\s+/g, " ").slice(0, 400)}"` : ""}`
      ),
    ].join("\n"),
    esquema: {
      type: "object",
      properties: {
        itens: {
          type: "array",
          items: {
            type: "object",
            properties: { protocolo: { type: "string" }, classe: { type: "string", enum: ["positiva", "negativa", "neutra"] }, motivo: { type: "string" } },
            required: ["protocolo", "classe", "motivo"],
          },
        },
      },
      required: ["itens"],
    },
    rapido: true,
  }).catch(() => null);
  if (!r || r.erro || !r.dados) return null;
  const pedidos = new Set(itens.map((i) => i.protocolo));
  return ((r.dados.itens as unknown[]) ?? [])
    .map((x) => x as Record<string, unknown>)
    .filter((x) => pedidos.has(String(x.protocolo)) && ["positiva", "negativa", "neutra"].includes(String(x.classe)))
    .map((x) => ({ protocolo: String(x.protocolo), classe: x.classe as LeituraDaAvaliacao["classe"], motivo: String(x.motivo ?? "").replace(/\s+/g, " ").trim().slice(0, 160) }));
}

export async function classificarAvaliacoes(
  prisma: PrismaClient,
  opcoes: { agora?: Date; ler?: (itens: AvaliacaoParaLer[]) => Promise<LeituraDaAvaliacao[] | null>; soProtocolos?: string[] } = {}
): Promise<{ lidas: number; positivas: number; negativas: number; neutras: number }> {
  const ler = opcoes.ler ?? lerComIA;
  const zero = { lidas: 0, positivas: 0, negativas: 0, neutras: 0 };
  if (!opcoes.ler && !temIA()) return zero;

  const desde = new Date((opcoes.agora ?? new Date()).getTime() - DIAS * 86_400_000);
  const candidatas = await prisma.case.findMany({
    where: {
      ...(opcoes.soProtocolos ? { protocol: { in: opcoes.soProtocolos } } : { evaluatedAt: { gte: desde } }),
      channel: "RECLAME_AQUI",
      evaluated: true,
      avaliacaoMarca: null,
      avaliacaoMarcaPor: null,
    },
    select: { protocol: true, score: true, resolved: true, wouldDoBusiness: true, title: true, consideracaoFinal: true },
    orderBy: { evaluatedAt: "desc" },
    take: 200,
  });
  const lote = candidatas.filter(precisaDaIA).slice(0, POR_LOTE);
  if (!lote.length) return zero;

  const lidas = await ler(
    lote.map((c) => ({ protocolo: c.protocol, nota: c.score, resolvida: c.resolved, voltaria: c.wouldDoBusiness, titulo: c.title, comentario: c.consideracaoFinal }))
  );
  if (!lidas) return zero;

  const conta = { ...zero };
  const agora = opcoes.agora ?? new Date();
  for (const l of lidas) {
    /* `avaliacaoMarcaPor: null` no filtro: se alguém marcou enquanto a IA lia, a marca da pessoa fica. */
    const r = await prisma.case.updateMany({
      where: { protocol: l.protocolo, avaliacaoMarcaPor: null },
      data: {
        avaliacaoMarca: l.classe === "neutra" ? null : l.classe,
        avaliacaoMarcaPor: MARCADO_PELA_IA,
        avaliacaoMarcaEm: agora,
        avaliacaoMarcaMotivo: l.motivo || null,
      },
    });
    if (!r.count) continue;
    conta.lidas += 1;
    if (l.classe === "positiva") conta.positivas += 1;
    else if (l.classe === "negativa") conta.negativas += 1;
    else conta.neutras += 1;
  }
  return conta;
}
