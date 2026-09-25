import type { PrismaClient } from "@prisma/client";

import { gravarContato } from "@/lib/services/tratativa.service";
import { INTERVALO_S, POR_LOTE, itensValidos, type ItemNovo, type LoteView, type OrigemDoDisparo } from "@/lib/models/disparos";

/**
 * Disparos em lote seguros (Fase 33, 1.78).
 *
 * "Poucos por vez (10 em 10), um a cada ~40 s, com pausa e parada, lista
 * escolhida por você e registro de cada envio."
 *
 * A lista nasce na plataforma — os indicados do Prêmio, a fila do pedir
 * avaliação —, com a mensagem de cada pessoa pronta. A extensão, no
 * WhatsApp Web, abre uma conversa por vez com o texto escrito; a pessoa
 * aperta Enter; a extensão vê a mensagem sair, registra aqui e espera o
 * intervalo antes da próxima. A cada 10, para e espera um clique.
 *
 * Quem envia é sempre a pessoa: é a regra da extensão desde o primeiro
 * dia, e é também o que protege o número de bloqueio — o WhatsApp
 * derruba conta que dispara sozinha.
 */

export { POR_LOTE, INTERVALO_S, TETO_DE_ITENS, telefoneDoDisparo, itensValidos } from "@/lib/models/disparos";
export type { OrigemDoDisparo, ItemNovo, LoteView } from "@/lib/models/disparos";

export async function criarLote(
  prisma: PrismaClient,
  entrada: { nome: string; origem: OrigemDoDisparo; campanhaId?: string; itens: ItemNovo[]; autor: { id: string; nome: string } }
) {
  const itens = itensValidos(entrada.itens);
  if (itens.length === 0) return { erro: "Nenhum contato com telefone válido e mensagem." } as const;
  const lote = await prisma.loteDeDisparo.create({
    data: {
      nome: entrada.nome.trim().slice(0, 120) || "Disparo",
      origem: entrada.origem,
      campanhaId: entrada.campanhaId ?? null,
      criadoPor: entrada.autor.nome,
      criadoPorId: entrada.autor.id,
      itens: { create: itens.map((i, ordem) => ({ ...i, ordem })) },
    },
    select: { id: true },
  });
  return { id: lote.id, itens: itens.length } as const;
}


async function contar(prisma: PrismaClient, loteId: string) {
  const grupos = await prisma.itemDeDisparo.groupBy({ by: ["situacao"], where: { loteId }, _count: { _all: true } });
  const n = (s: string) => grupos.find((g) => g.situacao === s)?._count._all ?? 0;
  const enviados = n("enviado");
  const pulados = n("pulado");
  const pendentes = n("pendente");
  return { total: enviados + pulados + pendentes, enviados, pulados, pendentes };
}

export async function lotesRecentes(prisma: PrismaClient, limite = 10): Promise<LoteView[]> {
  const lotes = await prisma.loteDeDisparo.findMany({ orderBy: { criadoEm: "desc" }, take: limite });
  return Promise.all(
    lotes.map(async (l) => ({
      id: l.id,
      nome: l.nome,
      origem: l.origem as OrigemDoDisparo,
      situacao: l.situacao,
      criadoEm: l.criadoEm.toISOString(),
      ...(await contar(prisma, l.id)),
    }))
  );
}

/** O lote que a extensão trabalha: o mais recente, ativo ou pausado, de quem está no WhatsApp. */
export async function loteDaVez(prisma: PrismaClient, userId: string) {
  const lote = await prisma.loteDeDisparo.findFirst({
    where: { criadoPorId: userId, situacao: { in: ["ativo", "pausado"] } },
    orderBy: { criadoEm: "desc" },
  });
  if (!lote) return null;
  const [contagem, proximos] = await Promise.all([
    contar(prisma, lote.id),
    prisma.itemDeDisparo.findMany({
      where: { loteId: lote.id, situacao: "pendente" },
      orderBy: { ordem: "asc" },
      take: POR_LOTE,
      select: { id: true, nome: true, telefone: true, mensagem: true },
    }),
  ]);
  return { id: lote.id, nome: lote.nome, situacao: lote.situacao, ...contagem, proximos, porLote: POR_LOTE, intervalo: INTERVALO_S };
}

/**
 * O que o envio significa no domínio.
 *
 * Prêmio: a pessoa entra na campanha como "pedido feito" (ou anda para
 * isso). Pedir avaliação: um contato "Pedi a avaliação" por WhatsApp no
 * caso — o mesmo registro do diálogo, que conta o lembrete e move a fila.
 */
async function efeitoDoEnvio(
  prisma: PrismaClient,
  lote: { origem: string; campanhaId: string | null },
  item: { nome: string; telefone: string; ref: string | null },
  autor: { id: string; nome: string },
  agora: Date
) {
  const [tipo, id] = (item.ref ?? "").split(":");
  if (!id) return;

  if (lote.origem === "premio" && lote.campanhaId && (tipo === "reclame-aqui" || tipo === "nps")) {
    await prisma.pedidoDeVoto.upsert({
      where: { campanhaId_origem_ref: { campanhaId: lote.campanhaId, origem: tipo, ref: id } },
      create: { campanhaId: lote.campanhaId, origem: tipo, ref: id, nome: item.nome, telefone: `+${item.telefone}`, situacao: "pedido", pedidoEm: agora, exportadoPor: autor.nome },
      update: { situacao: "pedido", pedidoEm: agora },
    });
  }

  /* A referência é o protocolo: na tela, o id da reclamação é o do portal, não o do banco. */
  if (lote.origem === "avaliacao" && tipo === "caso") {
    const caso = await prisma.case.findFirst({ where: { OR: [{ protocol: id }, { externalId: id }, { id }] }, select: { id: true } });
    if (!caso) return;
    await gravarContato(prisma, { caseId: caso.id, entrada: { tipo: "pedido-avaliacao", canal: "WhatsApp", nota: "Pelo disparo em lote.", em: agora.toISOString() }, autorId: autor.id, autorNome: autor.nome });
  }
}

/** Marca o item como enviado ou pulado; o lote se fecha quando não sobra ninguém. */
export async function marcarItem(
  prisma: PrismaClient,
  itemId: string,
  situacao: "enviado" | "pulado",
  autor: { id: string; nome: string },
  motivo?: string
) {
  const item = await prisma.itemDeDisparo.findUnique({ where: { id: itemId }, include: { lote: { select: { id: true, origem: true, campanhaId: true, criadoPorId: true } } } });
  if (!item) return { erro: "Este contato não está mais na lista." } as const;
  if (item.lote.criadoPorId && item.lote.criadoPorId !== autor.id) return { erro: "Esta lista é de outra pessoa." } as const;
  if (item.situacao !== "pendente") return { ok: true, repetido: true } as const;

  const agora = new Date();
  await prisma.itemDeDisparo.update({
    where: { id: itemId },
    data: { situacao, motivo: motivo?.slice(0, 200) ?? null, enviadoEm: situacao === "enviado" ? agora : null, enviadoPor: autor.nome },
  });
  if (situacao === "enviado") await efeitoDoEnvio(prisma, item.lote, item, autor, agora);

  const restam = await prisma.itemDeDisparo.count({ where: { loteId: item.lote.id, situacao: "pendente" } });
  if (restam === 0) await prisma.loteDeDisparo.update({ where: { id: item.lote.id }, data: { situacao: "concluido" } });
  return { ok: true, restam } as const;
}

export async function mudarLote(prisma: PrismaClient, loteId: string, situacao: "ativo" | "pausado" | "parado", autor: { id: string }) {
  const lote = await prisma.loteDeDisparo.findUnique({ where: { id: loteId }, select: { criadoPorId: true, situacao: true } });
  if (!lote) return { erro: "Lista não encontrada." } as const;
  if (lote.criadoPorId && lote.criadoPorId !== autor.id) return { erro: "Esta lista é de outra pessoa." } as const;
  if (lote.situacao === "concluido" || lote.situacao === "parado") return { ok: true } as const;
  await prisma.loteDeDisparo.update({ where: { id: loteId }, data: { situacao } });
  return { ok: true } as const;
}
