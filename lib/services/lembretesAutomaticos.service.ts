import type { PrismaClient } from "@prisma/client";

import type { AgendaTask } from "@/lib/models/agenda";
import { combinadoNaMensagem, combinadosSemData, idDoLembrete, pedidoNaMensagem, reuniaoNaMensagem, type MensagemDoCombinado } from "@/lib/models/lembretesAutomaticos";
import { nomeDeContatoValido } from "@/lib/models/conversa";
import { lerExpediente } from "@/lib/services/operacao.service";
import { movementStatus } from "@/lib/services/movement.service";
import { paredeDe, prazoUtil } from "@/lib/services/horasUteis";

/** Até onde olhar as conversas: o combinado de três dias atrás ainda pode estar de pé. */
const JANELA_DAS_CONVERSAS_DIAS = 3;

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/**
 * Cria os lembretes que nascem sozinhos e devolve os que nasceram agora.
 *
 * Só cria: o que já existe (inclusive o lembrete desfeito, que fica
 * concluído) não é tocado. Usado pela Agenda (`gerarLembretesAutomaticos`)
 * e pela IA do dia (`iaDoDia.service`) — a mesma regra nos dois (08/10/2026).
 */
export async function criarLembretesAutomaticos(prisma: PrismaClient, userId: string, agora = new Date()): Promise<AgendaTask[]> {
  const hoje = paredeDe(agora).dia;
  const expediente = await lerExpediente(prisma);

  const [areas, mensagens, eu] = await Promise.all([
    prisma.caseMovement.findMany({
      where: { returnedAt: null },
      select: { id: true, destination: true, reason: true, actor: true, startedAt: true, dueHours: true, case: { select: { id: true, protocol: true } } },
      take: 300,
    }),
    prisma.mensagemDaConversa.findMany({
      /* As nossas (o combinado) e, desde a 1.98, as do cliente (o pedido e a reunião). */
      where: { em: { gte: new Date(agora.getTime() - JANELA_DAS_CONVERSAS_DIAS * 86_400_000) } },
      select: { id: true, de: true, texto: true, em: true, conversaId: true, conversa: { select: { contatoNome: true, case: { select: { id: true, protocol: true } } } } },
      take: 500,
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } }),
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
    const dia = paredeDe(m.em).dia;
    /* O nome gravado errado (o subtítulo do WhatsApp) não entra no título da atividade. */
    const nome = nomeDeContatoValido(m.conversa.contatoNome);
    const quem = nome ? ` com ${nome}` : "";

    /* Reunião combinada, de qualquer lado: vira compromisso (e pode ir ao Google pelo aviso). */
    const r = reuniaoNaMensagem(m.texto, dia);
    if (r && r.dueDate >= hoje) {
      candidatos.push({
        id: idDoLembrete("reuniao", m.id),
        title: `Reunião${quem}: “${r.trecho}”`,
        type: "Reunião",
        dueDate: r.dueDate,
        time: r.time,
        caseId: m.conversa.case?.id,
        protocolo: m.conversa.case?.protocol,
      });
      continue;
    }

    /* O pedido do cliente com dia ou hora vira atividade. */
    if (m.de !== "nos") {
      const p = pedidoNaMensagem(m.texto, dia);
      if (p && p.dueDate >= hoje) {
        candidatos.push({
          id: idDoLembrete("pedido", m.id),
          title: `Pedido${nome ? ` de ${nome}` : ""}: “${p.trecho}”`,
          type: "Follow-up",
          dueDate: p.dueDate,
          time: p.time,
          caseId: m.conversa.case?.id,
          protocolo: m.conversa.case?.protocol,
        });
      }
      continue;
    }

    const c = combinadoNaMensagem(m.texto, dia);
    if (!c || c.dueDate < hoje) continue;
    candidatos.push({
      id: idDoLembrete("conversa", m.id),
      title: `Retorno combinado${quem}: “${c.trecho}”`,
      type: "Follow-up",
      dueDate: c.dueDate,
      time: c.time,
      caseId: m.conversa.case?.id,
      protocolo: m.conversa.case?.protocol,
    });
  }

  /*
    O combinado sem data (09/10/2026): "vou verificar e te retorno" vira
    lembrete nosso para dali a 2 horas úteis; "te mando o CNPJ", do cliente,
    vira cobrança no dia útil seguinte. Um de cada lado por conversa — o mais
    recente —, e só o que ainda não foi cumprido na própria conversa.
  */
  const porConversa = new Map<string, { nome: string; caseId?: string; protocolo?: string; mensagens: MensagemDoCombinado[] }>();
  for (const m of mensagens) {
    if (!m.em) continue;
    const g = porConversa.get(m.conversaId) ?? {
      nome: nomeDeContatoValido(m.conversa.contatoNome),
      caseId: m.conversa.case?.id,
      protocolo: m.conversa.case?.protocol,
      mensagens: [],
    };
    g.mensagens.push({ id: m.id, de: m.de, texto: m.texto, em: m.em.toISOString(), dia: paredeDe(m.em).dia });
    porConversa.set(m.conversaId, g);
  }
  for (const g of porConversa.values()) {
    for (const c of combinadosSemData(g.mensagens)) {
      const prazo = paredeDe(prazoUtil(new Date(c.em), c.tipo === "promessa" ? 2 : 24, expediente));
      candidatos.push({
        id: idDoLembrete(c.tipo, c.mensagemId),
        title:
          c.tipo === "promessa"
            ? `Retornar${g.nome ? ` a ${g.nome}` : " ao cliente"}: você disse “${c.trecho}”`
            : `Cobrar ${g.nome || "o cliente"}: ficou de “${c.trecho}”`,
        type: "Follow-up",
        dueDate: prazo.dia,
        time: hhmm(prazo.min),
        caseId: g.caseId,
        protocolo: g.protocolo,
      });
    }
  }

  if (candidatos.length === 0) return [];

  const existentes = new Set(
    (await prisma.agendaTask.findMany({ where: { id: { in: candidatos.map((c) => c.id) } }, select: { id: true } })).map((t) => t.id)
  );
  const novos = candidatos.filter((c) => !existentes.has(c.id));
  if (novos.length === 0) return [];

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

  return novos.map((n) => ({
      id: n.id,
      title: n.title.slice(0, 300),
      type: n.type as AgendaTask["type"],
      owner: eu?.name ?? "",
      dueDate: n.dueDate,
      time: n.time,
      priority: "Média",
      done: false,
      relatedCase: n.protocolo,
    }));
}
