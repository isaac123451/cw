import type { PrismaClient } from "@prisma/client";

import type { Case } from "@/lib/models/case";
import {
  classificarItens,
  protocoloDaCaptura,
  tituloDaCaptura,
  type EstadoDaCaptura,
  type ItemCapturado,
} from "@/lib/models/capturaDasRedes";
import { criarSeNova } from "@/lib/services/case.repository";
import { hojeNaOperacao } from "@/lib/services/reputation.service";
import { eFinalDasRedes, FINAIS_DAS_REDES } from "@/lib/models/redes";

/**
 * A captura das Redes contra o banco: o que já existe, e gravar o novo.
 *
 * A planilha e o Slack chegam aqui pelo mesmo caminho — a diferença
 * entre eles termina em `lib/models/capturaDasRedes.ts`.
 */

export interface LinhaDaPrevia {
  chave: string;
  referencia: string;
  estado: EstadoDaCaptura;
  rede: string | null;
  perfil: string;
  nome: string;
  texto: string;
  quando: string;
  /** O caso que já existe, quando existe. */
  protocolo?: string;
  id?: string;
  /**
   * Fechado na planilha e aberto no CW (09/11/2026): a etapa final que o
   * STATUS diz ("Resolvido", "Encaminhado", "Sem contato"). O Gravar finaliza.
   */
  fechar?: string;
}

async function jaNoCw(prisma: PrismaClient, itens: ItemCapturado[]) {
  const chaves = [...new Set(itens.map((i) => i.chave))];
  const links = [...new Set(itens.map((i) => i.link).filter(Boolean))];
  const achados = await prisma.case.findMany({
    where: { OR: [{ externalId: { in: chaves } }, ...(links.length ? [{ externalUrl: { in: links } }] : [])] },
    select: { id: true, protocol: true, externalId: true, externalUrl: true, status: true },
  });
  const porChave = new Map<string, { id: string; protocol: string; status: string }>();
  const porLink = new Map<string, { id: string; protocol: string; status: string }>();
  for (const a of achados) {
    if (a.externalId) porChave.set(a.externalId, a);
    if (a.externalUrl) porLink.set(a.externalUrl, a);
  }
  return { porChave, porLink };
}

export async function previaDaCaptura(prisma: PrismaClient, itens: ItemCapturado[]): Promise<LinhaDaPrevia[]> {
  const { porChave, porLink } = await jaNoCw(prisma, itens);
  return classificarItens(itens, { chaves: new Set(porChave.keys()), links: new Set(porLink.keys()) }).map(({ item, estado }) => {
    const caso = porChave.get(item.chave) ?? (item.link ? porLink.get(item.link) : undefined);
    return {
      chave: item.chave,
      referencia: item.referencia,
      estado,
      rede: item.rede,
      perfil: item.perfil,
      nome: item.nome,
      texto: item.texto.slice(0, 280),
      quando: item.quando,
      ...(estado === "existente" && caso ? { protocolo: caso.protocol, id: caso.id } : {}),
      /* Só para uma etapa final, e só se o caso ainda está aberto aqui: nunca reabre nem troca um fechamento por outro. */
      ...(estado === "existente" && caso && eFinalDasRedes(item.status || "") && !eFinalDasRedes(caso.status) ? { fechar: item.status } : {}),
    };
  });
}

/** O atendimento que nasce da captura: Recebido, a triar, com a origem guardada. */
export function casoDaCaptura(item: ItemCapturado, categorias: Map<string, string>, agora = new Date()): Case {
  const cliente = item.nome || (item.perfil ? `@${item.perfil}` : "Não identificado");
  const categoria = item.assunto ? categorias.get(item.assunto.trim().toLowerCase()) : undefined;
  const hoje = hojeNaOperacao();
  const origem = item.origem === "planilha" ? `Capturado da planilha (${item.referencia}).` : `Capturado do Slack (${item.referencia}).`;
  return {
    id: item.chave,
    protocol: protocoloDaCaptura(item),
    company: cliente,
    customer: cliente,
    socialHandle: item.perfil || undefined,
    followers: item.seguidores ?? undefined,
    phone: item.telefone || undefined,
    email: item.email || undefined,
    source: item.rede ?? "Instagram",
    category: categoria ?? "Não classificado",
    priority: "Normal",
    /* O STATUS da planilha (26/10/2026): o atendimento já resolvido lá não entra como novo na fila. */
    status: item.status || "Recebido",
    title: tituloDaCaptura(item),
    description: [item.texto, "", origem].join("\n").trim(),
    raUrl: item.link || undefined,
    recebidaEm: item.quando || agora.toISOString(),
    publicResponse: "",
    evaluated: false,
    resolved: item.status === "Resolvido",
    wouldDoBusiness: false,
    responseTime: "-",
    solutionTime: "-",
    sla: "4h",
    createdAt: (item.quando || agora.toISOString()).slice(0, 10),
    updatedAt: hoje,
    lastInteraction: hoje,
    churnRisk: false,
    tags: [],
  } as Case;
}

export async function gravarCaptura(
  prisma: PrismaClient,
  itens: ItemCapturado[],
  apenas?: string[]
): Promise<{ criados: { protocolo: string; id: string; referencia: string }[]; jaExistiam: number; ignorados: number; finalizados: { protocolo: string; etapa: string }[] }> {
  const previa = await previaDaCaptura(prisma, itens);
  const escolhidas = new Set(apenas ?? previa.filter((p) => p.estado === "nova").map((p) => p.chave));
  const novas = previa.filter((p) => p.estado === "nova" && escolhidas.has(p.chave));

  const categorias = new Map(
    (await prisma.category.findMany({ where: { active: true }, select: { name: true } })).map((c) => [c.name.toLowerCase(), c.name])
  );

  const criados: { protocolo: string; id: string; referencia: string }[] = [];
  let jaExistiam = 0;

  for (const linha of novas) {
    const item = itens.find((i) => i.chave === linha.chave)!;
    const caso = casoDaCaptura(item, categorias);
    /* Protocolo e chave são únicos: a segunda extensão que gravar a mesma linha esbarra e não duplica. */
    const id = await criarSeNova(prisma, caso);
    if (id) criados.push({ protocolo: caso.protocol, id, referencia: item.referencia });
    else jaExistiam += 1;
  }

  /*
    Fechados na planilha, abertos no CW (09/11/2026): "finaliza os casos de
    redes sociais que já foram fechados". A etapa vem do STATUS da planilha,
    com o registro no histórico. Mesma escolha de linhas do Gravar.
  */
  const finalizados: { protocolo: string; etapa: string }[] = [];
  for (const linha of previa.filter((p) => p.fechar && p.id && (!apenas || escolhidas.has(p.chave)))) {
    const etapa = linha.fechar!;
    const mudou = await prisma.case.updateMany({
      where: { id: linha.id, status: { notIn: FINAIS_DAS_REDES } },
      data: { status: etapa, resolved: etapa === "Resolvido" },
    });
    if (!mudou.count) continue;
    await prisma.caseEvent
      .create({ data: { caseId: linha.id!, kind: "etapa", detail: `Fechado na planilha (${linha.referencia}): ${etapa}`, actor: "Leitura da planilha" } })
      .catch(() => undefined);
    finalizados.push({ protocolo: linha.protocolo!, etapa });
  }

  return { criados, jaExistiam, ignorados: previa.length - novas.length, finalizados };
}
