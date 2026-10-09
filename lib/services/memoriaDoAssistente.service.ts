import type { PrismaClient } from "@prisma/client";

import { nomeDoCliente, semMensagensDeOutraConversa } from "@/lib/models/identidadeNaConversa";
import { telefoneLegivel } from "@/lib/models/conversa";
import { humorDaConversa } from "@/lib/services/motorProprio";
import { paredeDe } from "@/lib/services/horasUteis";

/**
 * O que o assistente sabe do seu trabalho, além dos números (09/10/2026).
 *
 * "Verifique minhas últimas mensagens" → "Não possuo acesso ao histórico".
 * A plataforma guarda as conversas do WhatsApp, os combinados viram
 * lembretes e o Slack chega pela extensão — e nada disso ia para o
 * assistente, que só recebia o retrato da operação. Aqui fica a memória
 * que vai junto de cada pergunta:
 *
 * - as conversas guardadas dos últimos dias, já sem o que veio de outra
 *   conversa, com o nome certo do cliente, a que caso ou NPS ela está
 *   ligada, quem está esperando quem e o humor do cliente;
 * - as mensagens em si, quando a pergunta é sobre elas (ou sobre um
 *   cliente que aparece nelas) — e sempre as do contato aberto, na
 *   extensão;
 * - os combinados e lembretes em aberto (o que você prometeu, o que o
 *   cliente ficou de mandar, o que pediram no Slack);
 * - o que pediram a você no Slack e o que a IA fez hoje.
 *
 * Tudo lido do banco na hora da pergunta; nada é inventado ou resumido no
 * caminho — o modelo lê as falas como foram escritas.
 */

const DIAS = 3;
const ROTULO_DO_HUMOR = { 1: "muito irritado", 2: "insatisfeito", 3: "neutro", 4: "satisfeito", 5: "muito satisfeito" } as const;

/** A pergunta é sobre mensagens, conversas, combinados? Então as falas vão inteiras. */
const PERGUNTA_DE_CONVERSA =
  /mensag|convers|whats|zap|falei|disse|escrev|combin|promet|promessa|retorn|respond|[uú]ltim|slack|cliente|pediu|pedido|cobrar|lembr|pend[eê]n|aguard|esperando/i;

const quando = (d: Date) => {
  const p = paredeDe(d);
  return `${p.dia.slice(8, 10)}/${p.dia.slice(5, 7)} ${String(Math.floor(p.min / 60)).padStart(2, "0")}:${String(p.min % 60).padStart(2, "0")}`;
};

function haQuanto(d: Date, agora: Date) {
  const min = Math.max(0, Math.round((agora.getTime() - d.getTime()) / 60_000));
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
}

const semAcento = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export interface PedidoDeMemoria {
  userId: string | null;
  pergunta: string;
  /** O contato aberto na extensão: as falas dele vão sempre, e inteiras. */
  telefone?: string;
  agora?: Date;
}

export async function memoriaDoAssistente(prisma: PrismaClient, pedido: PedidoDeMemoria): Promise<string> {
  const agora = pedido.agora ?? new Date();
  const desde = new Date(agora.getTime() - DIAS * 86_400_000);
  const hoje = paredeDe(agora).dia;
  const daqui7 = new Date(Date.parse(`${hoje}T00:00:00Z`) + 7 * 86_400_000);
  const oitoDoContato = String(pedido.telefone ?? "").replace(/\D/g, "").slice(-8);

  const [conversas, lembretes, slack, feitas] = await Promise.all([
    prisma.conversa.findMany({
      where: {
        OR: [
          { mensagens: { some: { em: { gte: desde } } } },
          ...(oitoDoContato.length === 8 ? [{ telefone: { endsWith: oitoDoContato } }] : []),
        ],
      },
      select: {
        id: true,
        telefone: true,
        contatoNome: true,
        case: { select: { id: true, protocol: true, title: true, status: true, customer: true, channel: true } },
        npsResponse: { select: { id: true, score: true, customerName: true, status: true, comment: true } },
        mensagens: {
          orderBy: { em: "desc" },
          take: 60,
          select: { de: true, texto: true, em: true, autor: true, chave: true, criadoEm: true },
        },
      },
      orderBy: { atualizadoEm: "desc" },
      take: 25,
    }),
    prisma.agendaTask.findMany({
      where: {
        done: false,
        id: { startsWith: "auto-" },
        dueDate: { lte: daqui7 },
        ...(pedido.userId ? { OR: [{ ownerId: pedido.userId }, { ownerId: null }] } : {}),
      },
      select: { title: true, dueDate: true, time: true, case: { select: { protocol: true } } },
      orderBy: [{ dueDate: "asc" }, { time: "asc" }],
      take: 30,
    }),
    pedido.userId
      ? prisma.acaoDaIA.findMany({
          where: { userId: pedido.userId, origem: "slack", criadaEm: { gte: desde } },
          select: { titulo: true, detalhe: true, criadaEm: true, desfeitaEm: true },
          orderBy: { criadaEm: "desc" },
          take: 15,
        })
      : [],
    pedido.userId
      ? prisma.acaoDaIA.findMany({
          where: { userId: pedido.userId, criadaEm: { gte: new Date(Date.parse(`${hoje}T03:00:00Z`)) }, desfeitaEm: null, tipo: { not: "aviso" } },
          select: { tipo: true, titulo: true },
          orderBy: { criadaEm: "desc" },
          take: 12,
        })
      : [],
  ]);

  /* Cada conversa: limpa, com o nome certo, na ordem do tempo. */
  const lidas = conversas
    .map((c) => {
      const mensagens = semMensagensDeOutraConversa({ telefone: c.telefone, nome: c.contatoNome }, [...c.mensagens].reverse()).filter(
        (m): m is typeof m & { em: Date } => Boolean(m.em) && (m.de === "nos" || m.de === "cliente")
      );
      const nome = nomeDoCliente(c, c.case?.customer ?? c.npsResponse?.customerName, mensagens) || (c.telefone ? telefoneLegivel(c.telefone) : "contato");
      const doContato = oitoDoContato.length === 8 && String(c.telefone ?? "").endsWith(oitoDoContato);
      return { c, mensagens, nome, doContato };
    })
    .filter((x) => x.mensagens.length > 0);

  /* O termômetro gravado de cada um (09/10/2026): a satisfação de 0 a 10 e a avaliação prevista. */
  const termometros = new Map<string, string>();
  try {
    const ids = lidas.flatMap((x) => [x.c.case?.id, x.c.npsResponse?.id]).filter((v): v is string => Boolean(v));
    if (ids.length) {
      const linhas = await prisma.termometroDoCliente.findMany({
        where: { OR: [{ caseId: { in: ids } }, { npsResponseId: { in: ids } }] },
        orderBy: { criadoEm: "desc" },
        select: { caseId: true, npsResponseId: true, satisfacao: true, notaPrevista: true, chanceResolvido: true, tendencia: true, motivo: true },
      });
      for (const l of linhas) {
        const chave = l.caseId ?? l.npsResponseId!;
        if (termometros.has(chave)) continue;
        termometros.set(
          chave,
          ` Termômetro: satisfação ${l.satisfacao}/10${l.tendencia ? ` (${l.tendencia})` : ""}${l.notaPrevista !== null ? `, avaliaria ${l.notaPrevista}, chance de resolvido ${l.chanceResolvido}%` : ""} — ${l.motivo.slice(0, 140)}.`
        );
      }
    }
  } catch {
    /* Sem a tabela ainda (falta o db:push): segue sem o termômetro. */
  }

  const pergunta = semAcento(pedido.pergunta);
  const citada = (x: (typeof lidas)[number]) => {
    const primeiro = semAcento(x.nome.split(/\s+/)[0] ?? "").replace(/[^a-z0-9]/g, "");
    return (primeiro.length >= 3 && new RegExp(`\\b${primeiro}\\b`).test(pergunta)) || (x.c.case?.protocol && pergunta.includes(semAcento(x.c.case.protocol)));
  };
  const querFalas = PERGUNTA_DE_CONVERSA.test(pedido.pergunta);

  const linhas: string[] = [];
  linhas.push(`Agora: ${quando(agora)}. Conversas do WhatsApp guardadas na plataforma nos últimos ${DIAS} dias: ${lidas.length}.`);

  for (const [i, x] of lidas.entries()) {
    const ultimaCliente = [...x.mensagens].reverse().find((m) => m.de === "cliente");
    const ultimaNossa = [...x.mensagens].reverse().find((m) => m.de === "nos");
    const ultima = x.mensagens[x.mensagens.length - 1];
    const vinculo = [
      x.c.case ? `reclamação ${x.c.case.protocol} (${x.c.case.status}) “${x.c.case.title.slice(0, 80)}”` : null,
      x.c.npsResponse ? `NPS nota ${x.c.npsResponse.score} (${x.c.npsResponse.status})` : null,
    ]
      .filter(Boolean)
      .join(" + ") || "sem caso ligado";
    const espera = ultima.de === "cliente" ? `o cliente espera resposta ${haQuanto(ultima.em, agora)}` : `nós respondemos por último ${haQuanto(ultima.em, agora)}`;
    const humor = ROTULO_DO_HUMOR[humorDaConversa(x.mensagens.slice(-12).map((m) => ({ de: m.de === "nos" ? ("nos" as const) : ("cliente" as const), texto: m.texto })))];
    linhas.push(
      `• ${x.nome}${x.c.telefone ? ` (${telefoneLegivel(x.c.telefone)})` : ""} — ${vinculo} — ${espera}; humor: ${humor}.` +
        (ultimaCliente ? ` Última do cliente: “${ultimaCliente.texto.replace(/\s+/g, " ").slice(0, 140)}”.` : "") +
        (ultimaNossa ? ` Nossa última: “${ultimaNossa.texto.replace(/\s+/g, " ").slice(0, 120)}”.` : "") +
        (termometros.get(x.c.case?.id ?? "") ?? termometros.get(x.c.npsResponse?.id ?? "") ?? "")
    );

    /* As falas: do contato aberto sempre; das citadas na pergunta; e das mais recentes quando a pergunta é sobre conversas. */
    const quantas = x.doContato ? 40 : citada(x) ? 40 : querFalas && i < 6 ? 14 : 0;
    if (quantas > 0) {
      linhas.push(`  Mensagens${x.doContato ? " (o contato aberto agora)" : ""}, da mais antiga para a mais nova:`);
      for (const m of x.mensagens.slice(-quantas)) {
        linhas.push(`  [${quando(m.em)}] ${m.de === "nos" ? "Nós" : x.nome}: ${m.texto.replace(/\s+/g, " ").slice(0, 280)}`);
      }
    }
  }

  linhas.push("");
  linhas.push(`Combinados e lembretes em aberto (até 7 dias): ${lembretes.length}.`);
  for (const t of lembretes) {
    const dia = t.dueDate.toISOString().slice(0, 10);
    const atrasado = dia < hoje ? " — ATRASADO" : dia === hoje ? " — hoje" : "";
    linhas.push(`• ${dia.slice(8, 10)}/${dia.slice(5, 7)}${t.time ? ` ${t.time}` : ""}${atrasado}: ${t.title}${t.case?.protocol ? ` [${t.case.protocol}]` : ""}`);
  }

  /* As mensagens do Slack guardadas (09/10/2026): o texto inteiro, com o caso citado. */
  let slackGuardado: { autor: string; texto: string; quando: Date; caseId: string | null }[] = [];
  if (pedido.userId) {
    try {
      slackGuardado = await prisma.mensagemDoSlack.findMany({
        where: { userId: pedido.userId, quando: { gte: desde } },
        orderBy: { quando: "desc" },
        take: querFalas ? 30 : 12,
        select: { autor: true, texto: true, quando: true, caseId: true },
      });
    } catch {
      /* Sem a tabela ainda (falta o db:push): fica o que virou lembrete. */
    }
  }
  if (slackGuardado.length) {
    const protocolos = new Map(
      (
        await prisma.case.findMany({
          where: { id: { in: slackGuardado.map((m) => m.caseId).filter((v): v is string => Boolean(v)) } },
          select: { id: true, protocol: true },
        })
      ).map((c) => [c.id, c.protocol])
    );
    linhas.push("");
    linhas.push(`Mensagens do Slack para você (últimos ${DIAS} dias, da mais nova para a mais antiga):`);
    for (const m of slackGuardado) {
      const caso = m.caseId ? protocolos.get(m.caseId) : undefined;
      linhas.push(`• [${quando(m.quando)}] ${m.autor || "alguém"}${caso ? ` (sobre ${caso})` : ""}: ${m.texto.replace(/\s+/g, " ").slice(0, querFalas ? 400 : 160)}`);
    }
  } else if (slack.length) {
    linhas.push("");
    linhas.push(`O que pediram a você no Slack (últimos ${DIAS} dias):`);
    for (const s of slack) linhas.push(`• ${quando(s.criadaEm)}${s.desfeitaEm ? " (descartado)" : ""}: ${s.titulo}${s.detalhe ? ` — ${s.detalhe.slice(0, 160)}` : ""}`);
  }

  if (feitas.length) {
    linhas.push("");
    linhas.push("O que a IA do dia já fez hoje (está em “O que eu fiz hoje”, com desfazer):");
    for (const a of feitas) linhas.push(`• ${a.tipo}: ${a.titulo}`);
  }

  return linhas.join("\n");
}

/** A instrução que acompanha a memória: o modelo sabe que tem as conversas e como usá-las. */
export const COMO_USAR_A_MEMORIA = `Você TEM acesso às conversas do WhatsApp guardadas na plataforma, aos combinados em aberto, ao que pediram no Slack e ao que a IA já fez — estão no bloco "SUAS CONVERSAS E COMBINADOS". Nunca diga que não tem acesso a mensagens: leia o bloco. Se a conversa pedida não estiver lá, diga que ela ainda não foi guardada na plataforma (a extensão guarda sozinha quando a conversa está aberta e ligada a um caso ou NPS).
Ao falar de uma conversa: diga com quem é, a que caso ou NPS está ligada, o que foi combinado, quem está esperando quem e o próximo passo — citando a fala quando ajudar. Não misture conversas de clientes diferentes.`;

/** O ciclo do NPS aberto na extensão, por inteiro: nota, comentário, etapa, tentativas, anotações e régua de humor. */
export async function retratoNpsParaOAssistente(prisma: PrismaClient, id: string): Promise<string> {
  if (!id) return "";
  const r = await prisma.npsResponse.findUnique({
    where: { id },
    select: {
      score: true,
      comment: true,
      respondedAt: true,
      customerName: true,
      company: true,
      status: true,
      rootCause: true,
      firstContactAt: true,
      moodAfter: true,
      churnRisk: true,
      postContactNote: true,
      attempts: { orderBy: { createdAt: "desc" }, take: 5, select: { channel: true, resultado: true, note: true, createdAt: true } },
      notes: { orderBy: { createdAt: "desc" }, take: 5, select: { body: true, createdAt: true, actor: true } },
    },
  });
  if (!r) return "";
  const tipo = r.score >= 9 ? "promotor" : r.score >= 7 ? "neutro" : "detrator";
  return [
    "--- O NPS DESTE CLIENTE ---",
    `Nota ${r.score} (${tipo}) em ${quando(r.respondedAt)}${r.customerName ? ` — ${r.customerName}` : ""}${r.company ? ` (${r.company})` : ""}. Etapa: ${r.status}.${r.rootCause ? ` Causa: ${r.rootCause}.` : ""}`,
    r.comment ? `Comentário: “${r.comment.replace(/\s+/g, " ").slice(0, 400)}”` : "Sem comentário.",
    `1º contato: ${r.firstContactAt ? quando(r.firstContactAt) : "ainda não"}.${r.moodAfter ? ` Humor depois do contato: ${r.moodAfter} de 5.` : ""}${r.churnRisk ? " Marcado com risco de cancelar." : ""}`,
    r.postContactNote ? `Registro do pós-contato: ${r.postContactNote.slice(0, 300)}` : "",
    ...r.attempts.map((a) => `Tentativa ${quando(a.createdAt)} por ${a.channel}: ${a.resultado}${a.note ? ` — ${a.note.slice(0, 120)}` : ""}`),
    ...r.notes.map((n) => `Anotação ${quando(n.createdAt)}${n.actor ? ` (${n.actor})` : ""}: ${n.body.replace(/\s+/g, " ").slice(0, 300)}`),
  ]
    .filter(Boolean)
    .join("\n");
}
