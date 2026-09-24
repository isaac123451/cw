"use server";

import { updateTag } from "next/cache";

import { requireRole, SemPermissao } from "@/lib/auth/guard";
import type { AgendaTask } from "@/lib/models/agenda";
import { combinadoNaMensagem, idDoLembrete } from "@/lib/models/lembretesAutomaticos";
import { lerExpediente } from "@/lib/services/operacao.service";
import { movementStatus } from "@/lib/services/movement.service";
import { paredeDe } from "@/lib/services/horasUteis";
import { WORKSPACE_TAG } from "@/lib/actions/tags";

/** Até onde olhar as conversas: o combinado de três dias atrás ainda pode estar de pé. */
const JANELA_DAS_CONVERSAS_DIAS = 3;

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/**
 * Cria os lembretes que nascem sozinhos e devolve os que nasceram agora.
 *
 * Só cria: o que já existe (inclusive o lembrete desfeito, que fica
 * concluído) não é tocado. Roda quando a Agenda abre — quem chama mostra
 * o que nasceu, com desfazer.
 */
export async function gerarLembretesAutomaticos(): Promise<{ ok: true; criados: AgendaTask[] } | { ok: false; erro: string }> {

  let ctx;
  try {
    ctx = await requireRole("AGENTE");
  } catch (erro) {
    return { ok: false, erro: erro instanceof SemPermissao ? erro.message : "Não foi possível confirmar sua sessão." };
  }
  if (!ctx) return { ok: true, criados: [] };

  const prisma = ctx.prisma;
  const agora = new Date();
  const hoje = paredeDe(agora).dia;
  const expediente = await lerExpediente(prisma);

  try {
    const [areas, mensagens, eu] = await Promise.all([
      prisma.caseMovement.findMany({
        where: { returnedAt: null },
        select: { id: true, destination: true, reason: true, actor: true, startedAt: true, dueHours: true, case: { select: { id: true, protocol: true } } },
        take: 300,
      }),
      prisma.mensagemDaConversa.findMany({
        where: { de: "nos", em: { gte: new Date(agora.getTime() - JANELA_DAS_CONVERSAS_DIAS * 86_400_000) } },
        select: { id: true, texto: true, em: true, conversa: { select: { contatoNome: true, case: { select: { id: true, protocol: true } } } } },
        take: 500,
      }),
      prisma.user.findUnique({ where: { id: ctx.userId }, select: { id: true, name: true } }),
    ]);

    type Novo = { id: string; title: string; type: string; dueDate: string; time?: string; caseId?: string; protocolo?: string };
    const candidatos: Novo[] = [];

    for (const a of areas) {
      const s = movementStatus(
        { id: a.id, caseId: a.case.id, destination: a.destination, reason: a.reason, actor: a.actor, startedAt: a.startedAt.toISOString(), dueHours: a.dueHours },
        { agora, expediente }
      );
      const p = paredeDe(new Date(s.prazo));
      /* Prazo que já passou vira lembrete para agora mesmo — é o que mais precisa de cobrança. */
      const [dueDate, time] = p.dia < hoje ? [hoje, hhmm(paredeDe(agora).min)] : [p.dia, hhmm(p.min)];
      candidatos.push({
        id: idDoLembrete("area", a.id),
        title: `Cobrar retorno de ${a.destination} — ${a.case.protocol}`,
        type: "Cobrança interna",
        dueDate,
        time,
        caseId: a.case.id,
        protocolo: a.case.protocol,
      });
    }

    for (const m of mensagens) {
      if (!m.em) continue;
      const c = combinadoNaMensagem(m.texto, paredeDe(m.em).dia);
      if (!c || c.dueDate < hoje) continue;
      candidatos.push({
        id: idDoLembrete("conversa", m.id),
        title: `Retorno combinado${m.conversa.contatoNome ? ` com ${m.conversa.contatoNome}` : ""}: “${c.trecho}”`,
        type: "Follow-up",
        dueDate: c.dueDate,
        time: c.time,
        caseId: m.conversa.case?.id,
        protocolo: m.conversa.case?.protocol,
      });
    }

    if (candidatos.length === 0) return { ok: true, criados: [] };

    const existentes = new Set(
      (await prisma.agendaTask.findMany({ where: { id: { in: candidatos.map((c) => c.id) } }, select: { id: true } })).map((t) => t.id)
    );
    const novos = candidatos.filter((c) => !existentes.has(c.id));
    if (novos.length === 0) return { ok: true, criados: [] };

    await prisma.agendaTask.createMany({
      data: novos.map((n) => ({
        id: n.id,
        title: n.title.slice(0, 300),
        type: n.type,
        priority: "Média",
        done: false,
        dueDate: new Date(`${n.dueDate}T00:00:00.000Z`),
        time: n.time ?? null,
        ownerId: eu?.id ?? null,
        caseId: n.caseId ?? null,
      })),
      skipDuplicates: true,
    });

    updateTag(WORKSPACE_TAG);

    return {
      ok: true,
      criados: novos.map((n) => ({
        id: n.id,
        title: n.title.slice(0, 300),
        type: n.type as AgendaTask["type"],
        owner: eu?.name ?? "",
        dueDate: n.dueDate,
        time: n.time,
        priority: "Média",
        done: false,
        relatedCase: n.protocolo,
      })),
    };
  } catch (erro) {
    console.error("[agenda] lembretes automáticos", erro);
    return { ok: false, erro: "O banco não aceitou agora. Os lembretes automáticos tentam de novo na próxima vez que a Agenda abrir." };
  }
}
