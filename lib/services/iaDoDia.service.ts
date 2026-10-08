import type { Prisma, PrismaClient } from "@prisma/client";

import type { AgendaTask } from "@/lib/models/agenda";
import {
  chaveDaAcao,
  ehParaMim,
  lembreteDoSlack,
  tarefaFeita,
  type AcaoDaIAView,
  type MensagemDoSlack,
  type OrigemDaAcao,
  type TipoDeAcao,
} from "@/lib/models/iaDoDia";
import { nomeDeContatoValido } from "@/lib/models/conversa";
import { CLOSED_STATUS } from "@/lib/services/case.service";
import { paredeDe } from "@/lib/services/horasUteis";
import { pedirEstruturado, temIA } from "@/lib/services/ia.service";
import { criarLembretesAutomaticos } from "@/lib/services/lembretesAutomaticos.service";
import { listUpcomingEvents, validAccessToken } from "@/lib/services/google.service";

/**
 * A IA do dia, gravando (08/10/2026) — ver `lib/models/iaDoDia.ts`.
 *
 * Cada coisa que ela faz sozinha vira uma linha de `AcaoDaIA`, com o jeito
 * de desfazer. A linha é registrada **antes** de a ação repetir: a chave é
 * única por pessoa, então a mesma mensagem do Slack, a mesma conversa do
 * dia ou a mesma atividade fechada nunca viram duas ações — e o que a
 * pessoa desfez não volta.
 */

const AUTOR = "Assistente (IA)";

interface NovaAcao {
  tipo: TipoDeAcao;
  origem: OrigemDaAcao;
  chave: string;
  titulo: string;
  detalhe?: string;
  href?: string;
  desfazer?: Record<string, string>;
}

/** As chaves que já viraram ação para a pessoa (desfeitas incluídas). */
async function chavesJaUsadas(prisma: PrismaClient, userId: string, chaves: string[]) {
  if (!chaves.length) return new Set<string>();
  const linhas = await prisma.acaoDaIA.findMany({ where: { userId, chave: { in: chaves } }, select: { chave: true } });
  return new Set(linhas.map((l) => l.chave));
}

/** Registra a ação. Devolve `false` quando a chave já existia — quem chama não repete. */
async function registrar(prisma: PrismaClient, userId: string, a: NovaAcao): Promise<boolean> {
  try {
    await prisma.acaoDaIA.create({
      data: {
        userId,
        tipo: a.tipo,
        origem: a.origem,
        chave: a.chave,
        titulo: a.titulo.slice(0, 300),
        detalhe: a.detalhe?.slice(0, 600) ?? null,
        href: a.href ?? null,
        desfazer: (a.desfazer ?? null) as Prisma.InputJsonValue,
      },
    });
    return true;
  } catch {
    return false;
  }
}

const origemDaTarefa = (id: string): OrigemDaAcao =>
  id.startsWith("auto-area-") ? "area" : id.startsWith("auto-slack-") ? "slack" : id.startsWith("auto-reuniao-depois-") ? "agenda" : id.startsWith("auto-") ? "whatsapp" : "caso";

/* ============================================================
   LEMBRETES
============================================================ */

/** Os lembretes que nasceram (WhatsApp, área, reunião combinada), registrados como ação. */
export async function registrarLembretes(prisma: PrismaClient, userId: string, criados: AgendaTask[]) {
  for (const t of criados) {
    await registrar(prisma, userId, {
      tipo: "lembrete",
      origem: origemDaTarefa(t.id),
      chave: chaveDaAcao.lembrete(t.id),
      titulo: t.title,
      detalhe: `Na agenda para ${t.dueDate.split("-").reverse().slice(0, 2).join("/")}${t.time ? ` às ${t.time}` : ""}.`,
      href: "/agenda",
      desfazer: { tarefa: t.id },
    });
  }
}

/* ============================================================
   FECHAR O QUE FOI FEITO
============================================================ */

/**
 * As atividades abertas da pessoa que um fato registrado mostra que já
 * foram feitas — fechadas, com o motivo no aviso.
 */
export async function fecharOQueFoiFeito(prisma: PrismaClient, userId: string): Promise<number> {
  const abertas = await prisma.agendaTask.findMany({
    where: { done: false, ownerId: userId },
    select: { id: true, title: true, type: true, dueDate: true, createdAt: true, caseId: true },
    take: 300,
  });
  if (!abertas.length) return 0;

  const usadas = await chavesJaUsadas(prisma, userId, abertas.map((t) => chaveDaAcao.feito(t.id)));
  const candidatas = abertas.filter((t) => !usadas.has(chaveDaAcao.feito(t.id)));
  if (!candidatas.length) return 0;

  /* Os sinais, em poucas consultas. */
  const idsDeArea = candidatas.filter((t) => t.id.startsWith("auto-area-")).map((t) => t.id.slice("auto-area-".length));
  const idsDeMensagem = candidatas
    .filter((t) => t.id.startsWith("auto-conversa-") || t.id.startsWith("auto-pedido-"))
    .map((t) => t.id.replace(/^auto-(conversa|pedido)-/, ""));
  const idsDeCaso = [...new Set(candidatas.map((t) => t.caseId).filter((x): x is string => Boolean(x)))];

  const [areas, mensagens, casos, contatos] = await Promise.all([
    idsDeArea.length ? prisma.caseMovement.findMany({ where: { id: { in: idsDeArea } }, select: { id: true, returnedAt: true } }) : [],
    idsDeMensagem.length ? prisma.mensagemDaConversa.findMany({ where: { id: { in: idsDeMensagem } }, select: { id: true, conversaId: true } }) : [],
    idsDeCaso.length ? prisma.case.findMany({ where: { id: { in: idsDeCaso } }, select: { id: true, status: true, resolved: true } }) : [],
    idsDeCaso.length
      ? prisma.caseContato.groupBy({ by: ["caseId"], where: { caseId: { in: idsDeCaso } }, _max: { em: true } })
      : [],
  ]);

  const conversas = [...new Set(mensagens.map((m) => m.conversaId))];
  const nossas = conversas.length
    ? await prisma.mensagemDaConversa.groupBy({ by: ["conversaId"], where: { conversaId: { in: conversas }, de: "nos" }, _max: { em: true } })
    : [];

  const areaRespondeu = new Map(areas.map((a) => [a.id, Boolean(a.returnedAt)]));
  const conversaDaMensagem = new Map(mensagens.map((m) => [m.id, m.conversaId]));
  const nossaEm = new Map(nossas.map((n) => [n.conversaId, n._max.em?.toISOString() ?? null]));
  const caso = new Map(casos.map((c) => [c.id, c]));
  const contatoEm = new Map(contatos.map((c) => [c.caseId, c._max.em?.toISOString() ?? null]));

  let fechadas = 0;
  for (const t of candidatas) {
    const msg = t.id.replace(/^auto-(conversa|pedido)-/, "");
    const c = t.caseId ? caso.get(t.caseId) : undefined;
    const motivo = tarefaFeita(
      { id: t.id, title: t.title, type: t.type, dueDate: t.dueDate.toISOString().slice(0, 10), createdAt: t.createdAt.toISOString(), caseId: t.caseId },
      {
        areaRespondeu: t.id.startsWith("auto-area-") ? areaRespondeu.get(t.id.slice("auto-area-".length)) : undefined,
        nossaMensagemEm: conversaDaMensagem.has(msg) ? nossaEm.get(conversaDaMensagem.get(msg)!) ?? null : null,
        ultimoContatoEm: t.caseId ? contatoEm.get(t.caseId) ?? null : null,
        casoEncerrado: c ? c.resolved || CLOSED_STATUS.includes(c.status) : undefined,
      }
    );
    if (!motivo) continue;
    /* Registra antes de fechar: se outra aba já registrou, esta não fecha de novo. */
    const novo = await registrar(prisma, userId, {
      tipo: "feito",
      origem: origemDaTarefa(t.id),
      chave: chaveDaAcao.feito(t.id),
      titulo: t.title,
      detalhe: `Fechada porque ${motivo}.`,
      href: "/agenda",
      desfazer: { reabrir: t.id },
    });
    if (!novo) continue;
    await prisma.agendaTask.update({ where: { id: t.id }, data: { done: true } });
    fechadas += 1;
  }
  return fechadas;
}

/* ============================================================
   ANOTAÇÕES — o dia da conversa na ficha
============================================================ */

/** Quanto a conversa precisa estar parada para o resumo do dia sair inteiro. */
const CONVERSA_PARADA_MIN = 30;
/** No máximo tantas por rodada: cada uma pode custar uma chamada de IA. */
const ANOTACOES_POR_RODADA = 4;

/**
 * A conversa de hoje no WhatsApp, ligada a um caso ou a um NPS, vira uma
 * anotação na ficha — uma por conversa por dia, depois de 30 minutos
 * parada. Com IA, um resumo do que foi tratado e do que ficou pendente;
 * sem, as últimas falas de cada lado.
 */
export async function anotarConversasDoDia(prisma: PrismaClient, userId: string, agora = new Date()): Promise<number> {
  const hoje = paredeDe(agora).dia;
  const inicioDoDia = new Date(Date.parse(`${hoje}T03:00:00Z`));

  const conversas = await prisma.conversa.findMany({
    where: {
      guardadaPor: { not: "" },
      OR: [{ caseId: { not: null } }, { npsResponseId: { not: null } }],
      mensagens: { some: { em: { gte: inicioDoDia } } },
    },
    select: {
      id: true,
      contatoNome: true,
      caseId: true,
      npsResponseId: true,
      case: { select: { externalId: true, protocol: true, channel: true } },
      mensagens: { where: { em: { gte: inicioDoDia } }, orderBy: { em: "asc" }, select: { de: true, texto: true, em: true }, take: 80 },
    },
    take: 30,
  });

  const prontas = conversas.filter((c) => {
    const ultima = c.mensagens[c.mensagens.length - 1]?.em;
    return c.mensagens.length >= 2 && ultima && agora.getTime() - ultima.getTime() >= CONVERSA_PARADA_MIN * 60_000;
  });
  if (!prontas.length) return 0;

  const usadas = await chavesJaUsadas(prisma, userId, prontas.map((c) => chaveDaAcao.anotacao(c.id, hoje)));
  let feitas = 0;

  for (const c of prontas.filter((x) => !usadas.has(chaveDaAcao.anotacao(x.id, hoje))).slice(0, ANOTACOES_POR_RODADA)) {
    const nome = nomeDeContatoValido(c.contatoNome) || "o cliente";
    const corpo = await resumoDaConversa(nome, c.mensagens.map((m) => ({ de: m.de, texto: m.texto })));
    const texto = `Conversa de hoje no WhatsApp com ${nome}:\n${corpo}`;

    /* Registra antes de anotar: duas abas rodando juntas não anotam duas vezes. */
    const chave = chaveDaAcao.anotacao(c.id, hoje);
    const href = c.caseId
      ? `/${c.case?.channel === "RECLAME_AQUI" ? "reclame-aqui" : "redes-sociais"}/${c.case?.externalId ?? c.case?.protocol ?? c.caseId}`
      : `/nps/${c.npsResponseId}`;
    const novo = await registrar(prisma, userId, {
      tipo: "anotacao",
      origem: c.caseId ? "caso" : "nps",
      chave,
      titulo: `Anotação na ficha${c.case?.protocol ? ` de ${c.case.protocol}` : ""}: conversa com ${nome}`,
      detalhe: corpo.slice(0, 280),
      href,
    });
    if (!novo) continue;

    let desfazer: Record<string, string>;
    if (c.caseId) {
      const comentario = await prisma.caseComment.create({ data: { caseId: c.caseId, authorName: AUTOR, body: texto } });
      desfazer = { comentario: comentario.id };
    } else {
      const nota = await prisma.npsNote.create({ data: { responseId: c.npsResponseId!, actor: AUTOR, body: texto } });
      desfazer = { notaNps: nota.id };
    }
    await prisma.acaoDaIA.update({ where: { userId_chave: { userId, chave } }, data: { desfazer } });
    feitas += 1;
  }
  return feitas;
}

/** O resumo do dia da conversa: pela IA quando há, pelas falas quando não. */
async function resumoDaConversa(nome: string, mensagens: { de: string; texto: string }[]): Promise<string> {
  const linhas = mensagens.map((m) => `${m.de === "nos" ? "Nós" : nome}: ${m.texto.replace(/\s+/g, " ").slice(0, 400)}`);
  if (temIA()) {
    try {
      const r = await pedirEstruturado({
        rapido: true,
        sistema:
          "Você resume conversas de atendimento de uma empresa de cardápio digital para a ficha do caso. Português do Brasil, frases curtas, sem inventar nada que não esteja na conversa. Não inclua telefone, e-mail nem documento.",
        prompt: `Resuma a conversa de hoje em até 3 linhas e diga o que ficou pendente (ou "nada").\n\n${linhas.join("\n").slice(0, 6000)}`,
        esquema: {
          type: "object",
          properties: { resumo: { type: "string" }, pendente: { type: "string" } },
          required: ["resumo", "pendente"],
        },
      });
      const resumo = String(r.dados?.resumo ?? "").trim();
      const pendente = String(r.dados?.pendente ?? "").trim();
      if (!r.erro && resumo) return `${resumo}${pendente && !/^nada\.?$/i.test(pendente) ? `\nFicou pendente: ${pendente}` : ""}`;
    } catch {
      /* Sem IA agora: vão as falas. */
    }
  }
  const ultimaDeles = [...mensagens].reverse().find((m) => m.de !== "nos");
  const ultimaNossa = [...mensagens].reverse().find((m) => m.de === "nos");
  return [
    `${mensagens.length} mensagens hoje.`,
    ultimaDeles ? `Última do cliente: “${ultimaDeles.texto.replace(/\s+/g, " ").slice(0, 160)}”` : null,
    ultimaNossa ? `Nossa última: “${ultimaNossa.texto.replace(/\s+/g, " ").slice(0, 160)}”` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/* ============================================================
   SLACK — o que pede ação de quem foi mencionado
============================================================ */

/**
 * As mensagens do Slack que a extensão viu passar: as que são para a
 * pessoa e pedem ação viram lembrete. A regra decide primeiro; com IA, as
 * que a regra não entendeu passam por ela ("identificável pela IA").
 */
export async function lembretesDoSlack(
  prisma: PrismaClient,
  usuario: { id: string; nome: string },
  mensagens: MensagemDoSlack[],
  agora = new Date()
): Promise<number> {
  const hoje = paredeDe(agora).dia;
  const doisDias = agora.getTime() - 2 * 86_400_000;
  const paraMim = mensagens.filter((m) => ehParaMim(m, usuario.nome) && Date.parse(m.quando) >= doisDias);
  if (!paraMim.length) return 0;

  const usadas = await chavesJaUsadas(prisma, usuario.id, paraMim.map((m) => chaveDaAcao.slack(m.canal, m.ts)));
  const novas = paraMim.filter((m) => !usadas.has(chaveDaAcao.slack(m.canal, m.ts)));
  if (!novas.length) return 0;

  const decididas = new Map(novas.map((m) => [m.ts, lembreteDoSlack(m, hoje)]));

  /* A IA olha o que a regra deixou passar — só as com corpo de conversa. */
  const paraIA = novas.filter((m) => !decididas.get(m.ts) && m.texto.trim().length >= 30).slice(0, 15);
  if (paraIA.length && temIA()) {
    try {
      const r = await pedirEstruturado({
        rapido: true,
        sistema:
          "Você lê mensagens do Slack de uma equipe de atendimento e decide quais pedem uma ação da pessoa que as recebeu (responder, fazer, entregar, participar). Cumprimento, aviso geral e agradecimento não pedem ação.",
        prompt: `Para cada mensagem, diga se pede ação e, se pedir, escreva um título curto de lembrete (até 80 caracteres).\n\n${paraIA
          .map((m) => `[${m.ts}] ${m.autor ? `${m.autor}: ` : ""}${m.texto.replace(/\s+/g, " ").slice(0, 600)}`)
          .join("\n")}`,
        esquema: {
          type: "object",
          properties: {
            itens: {
              type: "array",
              items: {
                type: "object",
                properties: { ts: { type: "string" }, pedeAcao: { type: "boolean" }, titulo: { type: "string" } },
                required: ["ts", "pedeAcao", "titulo"],
              },
            },
          },
          required: ["itens"],
        },
      });
      for (const item of (r.dados?.itens as { ts: string; pedeAcao: boolean; titulo: string }[] | undefined) ?? []) {
        if (item.pedeAcao && decididas.has(item.ts) && item.titulo?.trim()) {
          const m = novas.find((x) => x.ts === item.ts)!;
          decididas.set(item.ts, { titulo: `Slack — ${m.autor ? `${m.autor}: ` : ""}${item.titulo.trim().slice(0, 80)}`, dia: hoje });
        }
      }
    } catch {
      /* Sem IA agora: fica o que a regra decidiu. */
    }
  }

  let criados = 0;
  for (const m of novas) {
    const l = decididas.get(m.ts);
    const chave = chaveDaAcao.slack(m.canal, m.ts);
    if (!l) {
      /* Lido e sem ação: registra como aviso visto, para não reler — e não aparece como novidade. */
      await prisma.acaoDaIA
        .create({ data: { userId: usuario.id, tipo: "aviso", origem: "slack", chave, titulo: m.texto.slice(0, 120), vistaEm: agora, desfeitaEm: agora } })
        .catch(() => {});
      continue;
    }
    const id = `auto-slack-${m.canal}-${m.ts}`.slice(0, 120);
    const novo = await registrar(prisma, usuario.id, {
      tipo: "lembrete",
      origem: "slack",
      chave,
      titulo: l.titulo,
      detalhe: `“${m.texto.replace(/\s+/g, " ").slice(0, 240)}”`,
      href: m.link || "/agenda",
      desfazer: { tarefa: id },
    });
    if (!novo) continue;
    await prisma.agendaTask
      .create({
        data: { id, title: l.titulo.slice(0, 300), type: "Follow-up", priority: "Média", done: false, dueDate: new Date(`${l.dia}T00:00:00.000Z`), time: l.hora ?? null, ownerId: usuario.id },
      })
      .catch(() => {});
    criados += 1;
  }
  return criados;
}

/* ============================================================
   GOOGLE AGENDA — depois da reunião, anotar o que ficou
============================================================ */

/** Reunião que terminou nas últimas 3 horas vira "anotar o que ficou combinado". */
export async function depoisDasReunioes(prisma: PrismaClient, userId: string, agora = new Date()): Promise<number> {
  const token = await validAccessToken(prisma, userId).catch(() => null);
  if (!token) return 0;
  const hoje = paredeDe(agora).dia;
  const eventos = await listUpcomingEvents(token, { start: hoje, end: hoje }).catch(() => []);
  const terminaram = eventos.filter((e) => {
    /* Só reunião de verdade: bloco do plano e lembrete pessoal não têm o que anotar. */
    if (e.allDay || !e.end || !e.reuniao || e.doPlano) return false;
    const fim = Date.parse(e.end);
    return fim <= agora.getTime() && agora.getTime() - fim <= 3 * 3_600_000;
  });
  if (!terminaram.length) return 0;

  const usadas = await chavesJaUsadas(prisma, userId, terminaram.map((e) => chaveDaAcao.reuniao(e.id)));
  let criados = 0;
  for (const e of terminaram.filter((x) => !usadas.has(chaveDaAcao.reuniao(x.id)))) {
    const id = `auto-reuniao-depois-${e.id}`.slice(0, 120);
    const titulo = `Anotar o que ficou combinado: ${e.title}`.slice(0, 300);
    const novo = await registrar(prisma, userId, {
      tipo: "lembrete",
      origem: "agenda",
      chave: chaveDaAcao.reuniao(e.id),
      titulo,
      detalhe: "A reunião terminou — vale escrever as decisões e os próximos passos enquanto está fresco.",
      href: "/agenda",
      desfazer: { tarefa: id },
    });
    if (!novo) continue;
    const p = paredeDe(agora);
    await prisma.agendaTask
      .create({
        data: {
          id,
          title: titulo,
          type: "Follow-up",
          priority: "Média",
          done: false,
          dueDate: new Date(`${hoje}T00:00:00.000Z`),
          time: `${String(Math.floor(p.min / 60)).padStart(2, "0")}:${String(p.min % 60).padStart(2, "0")}`,
          ownerId: userId,
        },
      })
      .catch(() => {});
    criados += 1;
  }
  return criados;
}

/* ============================================================
   A RODADA, O QUE MOSTRAR E O DESFAZER
============================================================ */

/** Tudo o que a IA do dia faz sozinha, numa rodada. Cada parte falha sozinha, sem derrubar as outras. */
export async function rodarIaDoDia(prisma: PrismaClient, userId: string, agora = new Date()) {
  const partes = await Promise.allSettled([
    criarLembretesAutomaticos(prisma, userId, agora).then((criados) => registrarLembretes(prisma, userId, criados)),
    fecharOQueFoiFeito(prisma, userId),
    anotarConversasDoDia(prisma, userId, agora),
    depoisDasReunioes(prisma, userId, agora),
  ]);
  for (const p of partes) if (p.status === "rejected") console.error("[ia do dia]", p.reason);
}

function paraView(l: {
  id: string;
  tipo: string;
  origem: string;
  titulo: string;
  detalhe: string | null;
  href: string | null;
  criadaEm: Date;
  desfeitaEm: Date | null;
  desfazer: Prisma.JsonValue;
}): AcaoDaIAView {
  return {
    id: l.id,
    tipo: l.tipo as TipoDeAcao,
    origem: l.origem as OrigemDaAcao,
    titulo: l.titulo,
    detalhe: l.detalhe ?? undefined,
    href: l.href ?? undefined,
    criadaEm: l.criadaEm.toISOString(),
    desfeita: Boolean(l.desfeitaEm),
    desfazivel: Boolean(l.desfazer) && !l.desfeitaEm,
  };
}

/** O que ainda não foi mostrado à pessoa — os avisos com desfazer. */
export async function acoesNaoVistas(prisma: PrismaClient, userId: string): Promise<AcaoDaIAView[]> {
  const linhas = await prisma.acaoDaIA.findMany({
    where: { userId, vistaEm: null, desfeitaEm: null, tipo: { not: "aviso" } },
    orderBy: { criadaEm: "asc" },
    take: 20,
  });
  return linhas.map(paraView);
}

/** O que a IA fez hoje — a lista do Meu dia. */
export async function acoesDeHoje(prisma: PrismaClient, userId: string, agora = new Date()): Promise<AcaoDaIAView[]> {
  const hoje = paredeDe(agora).dia;
  const linhas = await prisma.acaoDaIA.findMany({
    where: { userId, criadaEm: { gte: new Date(Date.parse(`${hoje}T03:00:00Z`)) }, tipo: { not: "aviso" } },
    orderBy: { criadaEm: "desc" },
    take: 50,
  });
  return linhas.map(paraView);
}

export async function marcarVistas(prisma: PrismaClient, userId: string, ids: string[]) {
  if (!ids.length) return;
  await prisma.acaoDaIA.updateMany({ where: { userId, id: { in: ids }, vistaEm: null }, data: { vistaEm: new Date() } });
}

/**
 * Desfaz uma ação: o lembrete sai da agenda (concluído, para não voltar),
 * a atividade fechada reabre, a anotação é apagada. A linha fica, marcada
 * como desfeita — é ela que impede a IA de fazer de novo.
 */
export async function desfazer(prisma: PrismaClient, userId: string, id: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const acao = await prisma.acaoDaIA.findFirst({ where: { id, userId } });
  if (!acao) return { ok: false, erro: "Essa ação não existe mais." };
  if (acao.desfeitaEm) return { ok: true };
  const d = (acao.desfazer ?? {}) as Record<string, string>;
  if (d.tarefa) await prisma.agendaTask.updateMany({ where: { id: d.tarefa }, data: { done: true } });
  if (d.reabrir) await prisma.agendaTask.updateMany({ where: { id: d.reabrir }, data: { done: false } });
  if (d.comentario) await prisma.caseComment.deleteMany({ where: { id: d.comentario, authorName: AUTOR } });
  if (d.notaNps) await prisma.npsNote.deleteMany({ where: { id: d.notaNps, actor: AUTOR } });
  await prisma.acaoDaIA.update({ where: { id }, data: { desfeitaEm: new Date(), vistaEm: acao.vistaEm ?? new Date() } });
  return { ok: true };
}
