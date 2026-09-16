import "server-only";

import type { PrismaClient } from "@prisma/client";

import { classificarAvaliacao } from "@/lib/models/avaliacoesGoogle";
import { instanteDeParede } from "@/lib/services/horasUteis";
import { semelhanca } from "@/lib/services/lgpd";

/**
 * Registrar uma avaliação do Google — a regra, longe da tela.
 *
 * Mora aqui, e não na action, porque duas portas chamam: a tela
 * ("Registrar avaliação") e a extensão, de dentro do próprio Perfil da
 * Empresa. A classificação da tabela do documento, a marca de repetição
 * e o casamento com o promotor do NPS não podem existir em duas versões
 * — foi assim que a nota da reputação e o gráfico já divergiram uma vez
 * nesta base.
 *
 * O que dá errado volta em português; quem chamou decide como mostrar.
 */

export interface NovaAvaliacaoDoGoogle {
  estrelas: number;
  autor: string;
  texto?: string;
  link?: string;
  /** "2026-09-13T14:05" em Brasília, ou só "2026-09-13". */
  publicadaEm: string;
  identificado: boolean;
}

/** A data, aceitando o dia sozinho (o Google nem sempre mostra a hora). */
export function dataDaAvaliacao(valor: string) {
  const bruto = String(valor ?? "").trim();
  return (
    instanteDeParede(bruto) ??
    (/^\d{4}-\d{2}-\d{2}$/.test(bruto) ? new Date(`${bruto}T00:00:00Z`) : null)
  );
}

/** O que impede a gravação, antes de encostar no banco. */
export function problemaDaAvaliacao(entrada: NovaAvaliacaoDoGoogle): string | null {

  if (!Number.isInteger(entrada.estrelas) || entrada.estrelas < 1 || entrada.estrelas > 5) {
    return "A nota vai de 1 a 5 estrelas.";
  }

  if (!String(entrada.autor ?? "").trim()) {
    return "Informe o nome de quem avaliou, como aparece no Google.";
  }

  const publicadaEm = dataDaAvaliacao(entrada.publicadaEm);

  if (!publicadaEm) return "Informe quando a avaliação foi publicada.";

  if (publicadaEm.getTime() > Date.now() + 5 * 60_000) {
    return "A data da avaliação não pode estar no futuro.";
  }

  const link = entrada.link?.trim();

  if (link && !/^https?:\/\//i.test(link)) {
    return "O link precisa começar com http:// ou https://.";
  }

  return null;
}

function limpar(nome: string) {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Grava a avaliação. Devolve a linha criada e o promotor casado, se houve.
 *
 * Pressupõe `problemaDaAvaliacao` já chamado — a validação é de quem
 * atende a pessoa, para o erro aparecer no campo certo.
 */
export async function gravarAvaliacaoDoGoogle(
  prisma: PrismaClient,
  entrada: NovaAvaliacaoDoGoogle,
  registradaPor: string
) {

  const publicadaEm = dataDaAvaliacao(entrada.publicadaEm)!;
  const autor = entrada.autor.trim();
  const texto = entrada.texto?.trim() || "";

  /*
    "Repetição do mesmo problema em múltiplas avaliações recentes": duas
    ou mais negativas nos últimos 14 dias com texto parecido com esta.
  */
  const recentes = await prisma.avaliacaoGoogle.findMany({
    where: {
      classificacao: "negativa",
      publicadaEm: { gte: new Date(publicadaEm.getTime() - 14 * 86_400_000) },
    },
    select: { texto: true },
  });

  const parecidas =
    texto.length >= 40
      ? recentes.filter((r) => semelhanca(texto, r.texto ?? "") >= 25).length
      : 0;

  const triagem = classificarAvaliacao(entrada.estrelas, texto, parecidas >= 2);

  /*
    O promotor do NPS que foi convidado a avaliar — pelo nome, entre os
    que receberam o pedido de review. É o fluxo do documento: o NPS
    "deve alimentar o monitoramento do Google, não competir com ele".
  */
  const promotores = await prisma.npsResponse.findMany({
    where: { score: { gte: 9 }, reviewAsked: true },
    select: { id: true, customerName: true, customer: true },
    take: 500,
  });

  const alvo = limpar(autor);

  const promotor = promotores.find((p) =>
    [p.customerName, p.customer].some((n) => n && limpar(n) === alvo)
  );

  const criada = await prisma.avaliacaoGoogle.create({
    data: {
      estrelas: entrada.estrelas,
      autor: autor.slice(0, 120),
      texto: texto || null,
      link: entrada.link?.trim() || null,
      publicadaEm,
      identificado: entrada.identificado,
      classificacao: triagem.classificacao,
      criticidade: triagem.criticidade,
      motivosDeUrgencia: triagem.motivos,
      npsResponseId: promotor?.id ?? null,
      registradaPor,
    },
    include: {
      case: { select: { protocol: true, externalId: true, id: true, title: true } },
      npsResponse: { select: { id: true, customerName: true, customer: true } },
    },
  });

  if (promotor) {
    await prisma.npsResponse.update({
      where: { id: promotor.id },
      data: { reviewFeita: true },
    });
  }

  return { criada, promotor: promotor ?? null };
}
