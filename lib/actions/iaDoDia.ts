"use server";

import { updateTag } from "next/cache";

import { requireRole, SemPermissao } from "@/lib/auth/guard";
import { CASES_TAG, WORKSPACE_TAG } from "@/lib/actions/tags";
import type { AcaoDaIAView } from "@/lib/models/iaDoDia";
import { acoesDeHoje, acoesNaoVistas, desfazer, marcarVistas, registrar, rodarIaDoDia } from "@/lib/services/iaDoDia.service";
import { atividadeDoFeito, entenderComando } from "@/lib/models/comandosDaIA";
import { paredeDe } from "@/lib/services/horasUteis";

/**
 * A IA do dia, pela tela (08/10/2026) — ver `lib/models/iaDoDia.ts`.
 *
 * Quem chama é o vigia que mora no layout: ao abrir a plataforma e a cada
 * poucos minutos. A rodada é cara (conversas, agenda, IA), então cada
 * pessoa roda no máximo a cada 5 minutos por instância do servidor.
 */

const INTERVALO_MS = 5 * 60_000;
const ultimaRodada = new Map<string, number>();

type Resultado<T> = { ok: true } & T | { ok: false; erro: string };

async function contexto() {
  try {
    return await requireRole("AGENTE");
  } catch (erro) {
    if (erro instanceof SemPermissao) return null;
    throw erro;
  }
}

/** Roda (se já passou o intervalo) e devolve o que ainda não foi mostrado. */
export async function rodarAIaDoDia(): Promise<Resultado<{ novas: AcaoDaIAView[] }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: true, novas: [] };
  try {
    const agora = Date.now();
    if (agora - (ultimaRodada.get(ctx.userId) ?? 0) >= INTERVALO_MS) {
      ultimaRodada.set(ctx.userId, agora);
      await rodarIaDoDia(ctx.prisma, ctx.userId);
      /* Lembrete criado, atividade fechada e anotação mudam a agenda e as fichas. */
      updateTag(WORKSPACE_TAG);
      updateTag(CASES_TAG);
    }
    return { ok: true, novas: await acoesNaoVistas(ctx.prisma, ctx.userId) };
  } catch (erro) {
    /* Sem a tabela ainda (antes do db:push) ou banco recusando: a IA do dia só não aparece. */
    console.error("[ia do dia] rodada", erro);
    return { ok: false, erro: "A IA do dia não rodou agora." };
  }
}

export async function marcarAcoesVistas(ids: string[]): Promise<Resultado<object>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Entre na aplicação." };
  try {
    await marcarVistas(ctx.prisma, ctx.userId, ids.slice(0, 50));
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não deu para marcar agora." };
  }
}

export async function desfazerAcaoDaIA(id: string): Promise<Resultado<object>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Entre na aplicação." };
  try {
    const r = await desfazer(ctx.prisma, ctx.userId, id);
    if (r.ok) {
      updateTag(WORKSPACE_TAG);
      updateTag(CASES_TAG);
    }
    return r;
  } catch {
    return { ok: false, erro: "O banco não aceitou agora — tente de novo." };
  }
}

export async function lerAcoesDeHoje(): Promise<Resultado<{ acoes: AcaoDaIAView[] }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: true, acoes: [] };
  try {
    return { ok: true, acoes: await acoesDeHoje(ctx.prisma, ctx.userId) };
  } catch {
    return { ok: false, erro: "Não deu para ler o que a IA fez hoje." };
  }
}

/**
 * O comando em palavras, executado (08/10/2026) — ver `comandosDaIA`.
 *
 * A frase é interpretada de novo aqui: o navegador só diz o que foi
 * escrito. Cada ação fica registrada como as outras da IA do dia — na
 * lista do Meu dia e com o mesmo desfazer.
 */
export async function executarComandoDaIA(frase: string): Promise<Resultado<{ texto: string; acaoId?: string }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Entre na aplicação." };
  const prisma = ctx.prisma;
  const hoje = paredeDe(new Date()).dia;

  try {
    const casos = await prisma.case.findMany({ select: { id: true, protocol: true, externalId: true, channel: true } });
    const porProtocolo = new Map(casos.flatMap((c) => [[c.protocol, c], ...(c.externalId ? [[c.externalId, c] as const] : [])]));
    const comando = entenderComando(frase, hoje, new Set(porProtocolo.keys()));
    if (!comando) return { ok: false, erro: "Não entendi como um pedido de ação." };
    const eu = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } });

    if (comando.tipo === "lembrete") {
      const l = comando.linha;
      const caso = l.relatedCase ? porProtocolo.get(l.relatedCase) : undefined;
      const tarefa = await prisma.agendaTask.create({
        data: { title: l.title.slice(0, 300), type: l.type, priority: "Média", done: false, dueDate: new Date(`${l.dueDate}T00:00:00.000Z`), time: l.time ?? null, ownerId: ctx.userId, caseId: caso?.id ?? null, frente: l.frente ?? null },
      });
      const quando = `${l.dueDate === hoje ? "hoje" : l.dueDate.split("-").reverse().slice(0, 2).join("/")}${l.time ? ` às ${l.time}` : ""}`;
      await registrar(prisma, ctx.userId, { tipo: "lembrete", origem: "pedido", chave: `pedido:lembrete:${tarefa.id}`, titulo: l.title, detalhe: `Na agenda para ${quando}.`, href: "/agenda", desfazer: { tarefa: tarefa.id } });
      updateTag(WORKSPACE_TAG);
      return { ok: true, texto: `Lembrete criado para ${quando}: **${l.title}**.` };
    }

    if (comando.tipo === "anotacao") {
      const caso = porProtocolo.get(comando.protocolo);
      if (!caso) return { ok: false, erro: `Não achei o caso ${comando.protocolo}.` };
      const comentario = await prisma.caseComment.create({ data: { caseId: caso.id, authorId: ctx.userId, authorName: eu?.name ?? "", body: comando.texto } });
      await registrar(prisma, ctx.userId, {
        tipo: "anotacao",
        origem: "pedido",
        chave: `pedido:anotacao:${comentario.id}`,
        titulo: `Anotação em ${caso.protocol}`,
        detalhe: comando.texto.slice(0, 280),
        href: `/${caso.channel === "RECLAME_AQUI" ? "reclame-aqui" : "redes-sociais"}/${caso.externalId ?? caso.protocol}`,
        desfazer: { comentario: comentario.id },
      });
      updateTag(CASES_TAG);
      return { ok: true, texto: `Anotado em **${caso.protocol}**: “${comando.texto.slice(0, 200)}”.` };
    }

    const abertas = await prisma.agendaTask.findMany({ where: { done: false, ownerId: ctx.userId }, select: { id: true, title: true }, take: 300 });
    const { escolhida, candidatas } = atividadeDoFeito(comando.busca, abertas);
    if (!escolhida) {
      return {
        ok: true,
        texto: candidatas.length
          ? `Achei mais de uma parecida — qual delas?\n${candidatas.map((t) => `- ${t.title}`).join("\n")}`
          : `Não achei atividade aberta parecida com “${comando.busca}”.`,
      };
    }
    await prisma.agendaTask.update({ where: { id: escolhida.id }, data: { done: true } });
    await registrar(prisma, ctx.userId, { tipo: "feito", origem: "pedido", chave: `pedido:feito:${escolhida.id}:${Date.now()}`, titulo: escolhida.title, detalhe: "Fechada a seu pedido.", href: "/agenda", desfazer: { reabrir: escolhida.id } });
    updateTag(WORKSPACE_TAG);
    return { ok: true, texto: `Marquei como feita: **${escolhida.title}**.` };
  } catch (erro) {
    console.error("[ia do dia] comando", erro);
    return { ok: false, erro: "O banco não aceitou agora — tente de novo." };
  }
}
