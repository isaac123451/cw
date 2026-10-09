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
  leituraDaResposta,
  type LeituraDoDia,
} from "@/lib/models/iaDoDia";
import { nomeDaConversa, nomeDePessoa, nomeDoCliente, semMensagensDeOutraConversa } from "@/lib/models/identidadeNaConversa";
import { idDoLembrete } from "@/lib/models/lembretesAutomaticos";
import { isEncerrado } from "@/lib/models/nps";
import { CLOSED_STATUS } from "@/lib/services/case.service";
import { descreverRegistro, paredeDe, prazoUtil } from "@/lib/services/horasUteis";
import { lerExpediente } from "@/lib/services/operacao.service";
import { registrarTentativa } from "@/lib/services/nps.repository";
import { completarContato } from "@/lib/services/raPortal.service";
import { dadosDaConversa, oQueCompletar, type CampoDoCadastro } from "@/lib/services/sinaisDaConversa";
import { gravarContato, recalcularResumo } from "@/lib/services/tratativa.service";
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
export async function registrar(prisma: PrismaClient, userId: string, a: NovaAcao): Promise<boolean> {
  /* "Criar se não existir": a chave repetida não é erro — é a regra de não repetir (e não suja o log a cada rodada). */
  try {
    const r = await prisma.acaoDaIA.createMany({
      data: [
        {
          userId,
          tipo: a.tipo,
          origem: a.origem,
          chave: a.chave,
          titulo: a.titulo.slice(0, 300),
          detalhe: a.detalhe?.slice(0, 600) ?? null,
          href: a.href ?? null,
          desfazer: (a.desfazer ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      ],
      skipDuplicates: true,
    });
    return r.count > 0;
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
  const COM_MENSAGEM = /^auto-(conversa|pedido|promessa|espera)-/;
  const idsDeMensagem = candidatas.filter((t) => COM_MENSAGEM.test(t.id)).map((t) => t.id.replace(COM_MENSAGEM, ""));
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
  const [nossas, doCliente] = conversas.length
    ? await Promise.all([
        prisma.mensagemDaConversa.groupBy({ by: ["conversaId"], where: { conversaId: { in: conversas }, de: "nos" }, _max: { em: true } }),
        prisma.mensagemDaConversa.groupBy({ by: ["conversaId"], where: { conversaId: { in: conversas }, de: "cliente" }, _max: { em: true } }),
      ])
    : [[], []];

  const areaRespondeu = new Map(areas.map((a) => [a.id, Boolean(a.returnedAt)]));
  const conversaDaMensagem = new Map(mensagens.map((m) => [m.id, m.conversaId]));
  const nossaEm = new Map(nossas.map((n) => [n.conversaId, n._max.em?.toISOString() ?? null]));
  const clienteEm = new Map(doCliente.map((n) => [n.conversaId, n._max.em?.toISOString() ?? null]));
  const caso = new Map(casos.map((c) => [c.id, c]));
  const contatoEm = new Map(contatos.map((c) => [c.caseId, c._max.em?.toISOString() ?? null]));

  let fechadas = 0;
  for (const t of candidatas) {
    const msg = t.id.replace(COM_MENSAGEM, "");
    const c = t.caseId ? caso.get(t.caseId) : undefined;
    const motivo = tarefaFeita(
      { id: t.id, title: t.title, type: t.type, dueDate: t.dueDate.toISOString().slice(0, 10), createdAt: t.createdAt.toISOString(), caseId: t.caseId },
      {
        areaRespondeu: t.id.startsWith("auto-area-") ? areaRespondeu.get(t.id.slice("auto-area-".length)) : undefined,
        nossaMensagemEm: conversaDaMensagem.has(msg) ? nossaEm.get(conversaDaMensagem.get(msg)!) ?? null : null,
        clienteMensagemEm: conversaDaMensagem.has(msg) ? clienteEm.get(conversaDaMensagem.get(msg)!) ?? null : null,
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
 * parada.
 *
 * **Desde 09/10/2026, com critério.** "A IA fez anotações para um cliente
 * errado… sem misturar assuntos… sem anotar coisas sem sentido… e se é do
 * NPS ela consiga reconhecer." Antes de anotar:
 *
 * - a conversa é lida **sem o que veio de outra** (o lote gravado com a
 *   tela da conversa anterior — `semMensagensDeOutraConversa`);
 * - o cliente é chamado pelo nome certo (`nomeDoCliente`), nunca pelo
 *   número ou pelo texto da tela;
 * - a IA recebe a reclamação e/ou o NPS a que a conversa está ligada e diz
 *   se a conversa é mesmo com este cliente, de qual dos dois ela trata e se
 *   há o que guardar. Conversa que mistura gente, que não trata de nenhum
 *   dos vínculos ou que só tem "ok" e "bom dia" não vira anotação — e só é
 *   lida de novo quando chegar mensagem nova;
 * - se alguém ficou de dar retorno, vira lembrete (o nosso fecha quando
 *   respondemos; o do cliente, quando ele manda mensagem);
 * - sem IA, não anota: as falas soltas que iam no lugar eram o "sem
 *   sentido".
 */
export async function anotarConversasDoDia(
  prisma: PrismaClient,
  userId: string,
  agora = new Date(),
  /** Só estas conversas — é o que deixa a conferência rodar sem tocar nas reais. */
  soConversas?: string[],
  /** A leitura da IA trocada por uma resposta pronta — só na conferência. */
  ler: typeof lerConversaDoDia = lerConversaDoDia
): Promise<number> {
  if (!soConversas && !temIA()) return 0;
  const hoje = paredeDe(agora).dia;
  const inicioDoDia = new Date(Date.parse(`${hoje}T03:00:00Z`));

  const conversas = await prisma.conversa.findMany({
    where: {
      ...(soConversas ? { id: { in: soConversas } } : {}),
      guardadaPor: { not: "" },
      OR: [{ caseId: { not: null } }, { npsResponseId: { not: null } }],
      mensagens: { some: { em: { gte: inicioDoDia } } },
    },
    select: {
      id: true,
      telefone: true,
      contatoNome: true,
      caseId: true,
      npsResponseId: true,
      case: { select: { externalId: true, protocol: true, channel: true, customer: true, title: true, description: true } },
      npsResponse: { select: { score: true, comment: true, customerName: true } },
      mensagens: {
        where: { em: { gte: inicioDoDia } },
        orderBy: { em: "asc" },
        select: { id: true, de: true, texto: true, em: true, autor: true, chave: true, criadoEm: true },
        take: 120,
      },
    },
    take: 30,
  });

  const prontas = conversas.flatMap((c) => {
    const mensagens = semMensagensDeOutraConversa({ telefone: c.telefone, nome: c.contatoNome }, c.mensagens).filter(
      (m): m is typeof m & { em: Date } => Boolean(m.em)
    );
    const ultima = mensagens[mensagens.length - 1];
    if (mensagens.length < 2 || !ultima || agora.getTime() - ultima.em.getTime() < CONVERSA_PARADA_MIN * 60_000) return [];
    return [{ ...c, mensagens, ultima }];
  });
  if (!prontas.length) return 0;

  /* A chave do dia (anotou) e a da leitura (leu até esta mensagem e não havia o que anotar). */
  const lida = (c: (typeof prontas)[number]) => `anotacao-lida:conversa:${c.id}:${c.ultima.id}`;
  const usadas = await chavesJaUsadas(prisma, userId, prontas.flatMap((c) => [chaveDaAcao.anotacao(c.id, hoje), lida(c)]));
  let feitas = 0;

  for (const c of prontas.filter((x) => !usadas.has(chaveDaAcao.anotacao(x.id, hoje)) && !usadas.has(lida(x))).slice(0, ANOTACOES_POR_RODADA)) {
    const nome = nomeDoCliente(c, c.case?.customer ?? c.npsResponse?.customerName, c.mensagens);
    const leitura = await ler({
      nome,
      hoje,
      caso: c.case ? { protocolo: c.case.protocol, canal: c.case.channel, titulo: c.case.title, relato: c.case.description } : null,
      nps: c.npsResponse ? { nota: c.npsResponse.score, comentario: c.npsResponse.comment } : null,
      mensagens: c.mensagens,
    });
    /* A IA não respondeu agora: a próxima volta tenta de novo. */
    if (!leitura) continue;

    const chamado = nome || "o cliente";
    const paraNps = leitura.segmento === "nps" && Boolean(c.npsResponseId);
    const paraCaso = leitura.segmento === "reclamacao" && Boolean(c.caseId);

    if (!leitura.anotar || (!paraNps && !paraCaso)) {
      /* Lida e sem o que guardar: invisível (tipo aviso, já vista), e só volta a ler com mensagem nova. */
      await registrar(prisma, userId, {
        tipo: "aviso",
        origem: c.caseId ? "caso" : "nps",
        chave: lida(c),
        titulo: `Conversa com ${chamado} lida — nada anotado`,
        detalhe: leitura.motivo || "Sem vínculo que combine com a conversa.",
      });
      await prisma.acaoDaIA.updateMany({ where: { userId, chave: lida(c) }, data: { vistaEm: agora } });
      continue;
    }

    const texto = `Conversa de hoje no WhatsApp com ${chamado}:\n${leitura.corpo}`;
    const chave = chaveDaAcao.anotacao(c.id, hoje);
    const href = paraCaso
      ? `/${c.case?.channel === "RECLAME_AQUI" ? "reclame-aqui" : "redes-sociais"}/${c.case?.externalId ?? c.case?.protocol ?? c.caseId}`
      : `/nps/${c.npsResponseId}`;

    /* Registra antes de anotar: duas abas rodando juntas não anotam duas vezes. */
    const novo = await registrar(prisma, userId, {
      tipo: "anotacao",
      origem: paraCaso ? "caso" : "nps",
      chave,
      titulo: paraCaso ? `Anotei na ficha de ${c.case?.protocol}: conversa com ${chamado}` : `Anotei no NPS de ${chamado}: conversa de hoje`,
      detalhe: leitura.corpo.slice(0, 280),
      href,
    });
    if (!novo) continue;

    let desfazer: Record<string, string>;
    if (paraCaso) {
      const comentario = await prisma.caseComment.create({ data: { caseId: c.caseId!, authorName: AUTOR, body: texto } });
      desfazer = { comentario: comentario.id };
    } else {
      const nota = await prisma.npsNote.create({ data: { responseId: c.npsResponseId!, actor: AUTOR, body: texto } });
      desfazer = { notaNps: nota.id };
    }
    await prisma.acaoDaIA.update({ where: { userId_chave: { userId, chave } }, data: { desfazer } });
    feitas += 1;

    if (leitura.retorno && (await lembrarRetorno(prisma, userId, { nome: chamado, caseId: paraCaso ? c.caseId : null, mensagens: c.mensagens, retorno: leitura.retorno, hoje }))) {
      feitas += 1;
    }
  }
  return feitas;
}

export type { LeituraDoDia };
export { leituraDaResposta };

export interface ConversaParaLer {
  nome: string;
  hoje: string;
  caso: { protocolo: string; canal: string; titulo: string; relato: string | null } | null;
  nps: { nota: number; comentario: string | null } | null;
  mensagens: { de: string; texto: string; em: Date }[];
}

const hhmmDe = (d: Date) => {
  const p = paredeDe(d);
  return `${String(Math.floor(p.min / 60)).padStart(2, "0")}:${String(p.min % 60).padStart(2, "0")}`;
};

/**
 * A leitura da conversa do dia pela IA — `null` quando ela não respondeu.
 *
 * Também separa os **pontos importantes** — o que vale guardar na ficha
 * para a próxima conversa. "Preciso que anote coisas importantes sempre."
 */
async function lerConversaDoDia(entrada: ConversaParaLer): Promise<LeituraDoDia | null> {
  const quem = entrada.nome || "Cliente";
  const linhas = entrada.mensagens.map((m) => `[${hhmmDe(m.em)}] ${m.de === "nos" ? "Nós" : quem}: ${m.texto.replace(/\s+/g, " ").slice(0, 400)}`);
  const segmentos = [entrada.caso ? "reclamacao" : null, entrada.nps ? "nps" : null].filter((s): s is string => Boolean(s));
  const vinculos = [
    entrada.caso
      ? `- "reclamacao": a reclamação ${entrada.caso.protocolo} no ${entrada.caso.canal === "RECLAME_AQUI" ? "Reclame Aqui" : "canal social"} — “${entrada.caso.titulo}”. ${(entrada.caso.relato ?? "").replace(/\s+/g, " ").slice(0, 400)}`
      : null,
    entrada.nps
      ? `- "nps": a resposta à pesquisa de satisfação (NPS), nota ${entrada.nps.nota}${entrada.nps.comentario ? ` — “${entrada.nps.comentario.replace(/\s+/g, " ").slice(0, 300)}”` : ""}.`
      : null,
  ].filter(Boolean);

  let r: Awaited<ReturnType<typeof pedirEstruturado>>;
  try {
    r = await pedirEstruturado({
      sistema:
        "Você é o assistente de um agente de reputação da Cardápio Web (cardápio digital e sistema para restaurantes). Lê a conversa de hoje no WhatsApp com UM cliente e decide o que guardar na ficha dele. Português do Brasil, frases curtas e objetivas. Nunca invente: só o que está escrito na conversa. Não inclua telefone, e-mail, documento nem dado bancário.",
      prompt: [
        `Cliente: ${entrada.nome || "(nome não identificado)"}. Hoje é ${entrada.hoje}.`,
        "A conversa está ligada a:",
        ...vinculos,
        "",
        "Responda:",
        "1. sobre_este_cliente: false se a conversa, ou parte dela, parece ser com outra pessoa (chamada por outro nome, assunto de outro cliente) ou mistura duas conversas.",
        `2. segmento: de qual vínculo a conversa trata — ${segmentos.map((s) => `"${s}"`).join(" ou ")} — ou "outro" se não trata de nenhum deles (ex.: venda, assunto pessoal).`,
        '3. vale_anotar: false se hoje só houve cumprimento, agradecimento, "ok", tentativa sem resposta ou nada novo.',
        "4. motivo: quando sobre_este_cliente ou vale_anotar for false, por quê, em uma frase; senão, vazio.",
        "5. resumo: até 3 linhas do que foi tratado hoje.",
        '6. pendente: o que ficou por fazer e de quem, ou "nada".',
        "7. importantes: fatos duradouros para a próxima conversa — quantas lojas, sistema ou integração que usa, valor ou prazo combinado, decisão ou pedido do cliente, risco de cancelar, melhor horário ou canal. Lista vazia se não houver.",
        '8. retorno: se alguém ficou de dar retorno — nós ao cliente (quem "nos") ou o cliente a nós (quem "cliente") — e ainda não deu na conversa: precisa true, oque em até 12 palavras começando por verbo, e dia (AAAA-MM-DD) só se a conversa disser o dia, senão vazio. Sem retorno pendente: precisa false.',
        "",
        "Conversa de hoje:",
        linhas.join("\n").slice(0, 7000),
      ].join("\n"),
      esquema: {
        type: "object",
        properties: {
          sobre_este_cliente: { type: "boolean" },
          segmento: { type: "string", enum: [...segmentos, "outro"] },
          vale_anotar: { type: "boolean" },
          motivo: { type: "string" },
          resumo: { type: "string" },
          pendente: { type: "string" },
          importantes: { type: "array", items: { type: "string" } },
          retorno: {
            type: "object",
            properties: {
              precisa: { type: "boolean" },
              quem: { type: "string", enum: ["nos", "cliente"] },
              oque: { type: "string" },
              dia: { type: "string" },
            },
            required: ["precisa", "quem", "oque", "dia"],
          },
        },
        required: ["sobre_este_cliente", "segmento", "vale_anotar", "motivo", "resumo", "pendente", "importantes", "retorno"],
      },
    });
  } catch {
    return null;
  }
  if (r.erro || !r.dados) return null;
  return leituraDaResposta(r.dados, segmentos, entrada.hoje);
}

/**
 * O retorno que a IA viu na conversa vira lembrete (09/10/2026): "é preciso
 * também realizar lembrete caso seja preciso um retorno".
 *
 * Usa os mesmos ids dos combinados (`auto-promessa-<mensagem>` para o
 * nosso, `auto-espera-<mensagem>` para o do cliente): a regra que fecha
 * sozinha é a mesma — o nosso quando respondemos, o do cliente quando ele
 * escreve —, e se a regra dos combinados já criou um lembrete desta
 * conversa, a IA não cria outro.
 */
async function lembrarRetorno(
  prisma: PrismaClient,
  userId: string,
  entrada: {
    nome: string;
    caseId: string | null;
    mensagens: { id: string; de: string; em: Date }[];
    retorno: { quem: "nos" | "cliente"; oque: string; dia?: string };
    hoje: string;
  }
): Promise<boolean> {
  const { retorno, mensagens } = entrada;
  const doLado = [...mensagens].reverse().find((m) => m.de === retorno.quem) ?? mensagens[mensagens.length - 1];
  if (!doLado) return false;

  const daConversa = mensagens.flatMap((m) => (["conversa", "pedido", "promessa", "espera", "reuniao"] as const).map((o) => idDoLembrete(o, m.id)));
  const jaHa = await prisma.agendaTask.findFirst({ where: { id: { in: daConversa }, done: false }, select: { id: true } });
  if (jaHa) return false;

  const id = idDoLembrete(retorno.quem === "nos" ? "promessa" : "espera", doLado.id);
  const expediente = await lerExpediente(prisma);
  const prazo = retorno.dia ? { dia: retorno.dia, min: expediente.inicioMin } : paredeDe(prazoUtil(doLado.em, retorno.quem === "nos" ? 2 : 24, expediente));
  const titulo = retorno.quem === "nos" ? `Retornar a ${entrada.nome}: ${retorno.oque}` : `Cobrar ${entrada.nome}: ${retorno.oque}`;

  const criada = await prisma.agendaTask.createMany({
    data: [
      {
        id,
        title: titulo.slice(0, 300),
        type: "Follow-up",
        priority: "Média",
        done: false,
        dueDate: new Date(`${prazo.dia}T00:00:00.000Z`),
        time: `${String(Math.floor(prazo.min / 60)).padStart(2, "0")}:${String(prazo.min % 60).padStart(2, "0")}`,
        ownerId: userId,
        caseId: entrada.caseId,
      },
    ],
    skipDuplicates: true,
  });
  if (criada.count === 0) return false;

  return registrar(prisma, userId, {
    tipo: "lembrete",
    origem: "whatsapp",
    chave: chaveDaAcao.lembrete(id),
    titulo,
    detalhe: `Na agenda para ${prazo.dia.split("-").reverse().slice(0, 2).join("/")}${retorno.quem === "nos" ? " — fecha sozinho quando você responder" : " — fecha sozinho quando o cliente escrever"}.`,
    href: "/agenda",
    desfazer: { tarefa: id },
  });
}

/* ============================================================
   SEGUIR PELA CONVERSA — a ficha completa e a etapa andando (09/10/2026)
============================================================ */

/*
  "Preciso que complete informações e vá seguindo etapas conforme a IA puxa
  da conversa." Duas coisas, as duas só com fato escrito na conversa e com
  desfazer:

  - **completar a ficha**: e-mail, telefone e CPF/CNPJ que o cliente
    escreveu, e o nome do contato onde a reclamação está "Não informado" —
    só campo vazio, pela mesma regra do botão "Completar" e do vigia
    (`completarContato`), que também liga o estabelecimento pelo documento;
  - **o 1º contato**: a primeira mensagem nossa ao cliente, num caso ou NPS
    sem 1º contato registrado, vira o registro — "falei com o cliente" se
    ele respondeu depois, "tentei contato" se ainda não. É o que faz o
    prazo do 1º contato e os passos do documento andarem.
*/

/** No máximo tantas conversas por rodada — cada uma são algumas leituras e escritas. */
const SEGUIR_POR_RODADA = 12;

export async function seguirPelasConversas(
  prisma: PrismaClient,
  userId: string,
  agora = new Date(),
  /** Só estas conversas — é o que deixa a conferência rodar sem tocar nas reais. */
  soConversas?: string[]
): Promise<number> {
  const desde = new Date(agora.getTime() - 2 * 86_400_000);
  const conversas = await prisma.conversa.findMany({
    where: {
      ...(soConversas ? { id: { in: soConversas } } : {}),
      OR: [{ caseId: { not: null } }, { npsResponseId: { not: null } }],
      mensagens: { some: { em: { gte: desde } } },
    },
    select: {
      id: true,
      telefone: true,
      contatoNome: true,
      case: {
        select: {
          id: true,
          protocol: true,
          externalId: true,
          channel: true,
          status: true,
          customer: true,
          companyName: true,
          email: true,
          phone: true,
          document: true,
          city: true,
          state: true,
          establishmentId: true,
          establishmentManual: true,
          primeiroContatoEm: true,
          publicResponse: true,
          recebidaEm: true,
          publishedAt: true,
        },
      },
      npsResponse: { select: { id: true, firstContactAt: true, respondedAt: true, status: true, customerName: true } },
      mensagens: { orderBy: { em: "asc" }, select: { de: true, texto: true, em: true, autor: true, chave: true, criadoEm: true }, take: 300 },
    },
    orderBy: { atualizadoEm: "desc" },
    take: 40,
  });

  const eu = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  let feitas = 0;

  for (const c of conversas) {
    if (feitas >= SEGUIR_POR_RODADA) break;
    /* Sem o que veio de outra conversa (09/10/2026): nem o CNPJ nem o 1º contato saem da conversa de outro cliente. */
    const msgs = semMensagensDeOutraConversa({ telefone: c.telefone, nome: c.contatoNome }, c.mensagens).filter(
      (m): m is typeof m & { de: "nos" | "cliente"; em: Date } => Boolean(m.em) && (m.de === "nos" || m.de === "cliente")
    );
    if (!msgs.length) continue;
    /*
      Para preencher a ficha, só nome de gente: o da agenda ou o que nós
      usamos na conversa ("Boa tarde, Eduardo!"). O número e o "clique para
      mostrar os dados do contato" viraram nome e empresa de quatro
      reclamações em 09/10/2026.
    */
    const nomeParaFicha = nomeDePessoa(c.contatoNome) || nomeDaConversa(msgs);
    const nome = nomeDoCliente(c, c.case?.customer ?? c.npsResponse?.customerName, msgs);

    /* ---------- o caso ---------- */
    if (c.case) {
      const caso = c.case;
      const href = `/${caso.channel === "RECLAME_AQUI" ? "reclame-aqui" : "redes-sociais"}/${caso.externalId ?? caso.protocol}`;

      /* Completar: o que a conversa tem e a ficha não. */
      const achados = dadosDaConversa(msgs, c.telefone);
      const falta = oQueCompletar({ email: caso.email, phone: caso.phone, document: caso.document, customer: caso.customer }, { ...achados, ...(nomeParaFicha ? { nome: nomeParaFicha } : {}) });
      if (falta.length) {
        const chave = `completou:caso:${caso.id}:${falta.map((f) => f.campo).sort().join(",")}`;
        const usadas = await chavesJaUsadas(prisma, userId, [chave]);
        if (!usadas.has(chave)) {
          const antes = { customer: caso.customer, companyName: caso.companyName, email: caso.email, phone: caso.phone, document: caso.document, establishmentId: caso.establishmentId };
          const novo = await registrar(prisma, userId, {
            tipo: "completou",
            origem: "whatsapp",
            chave,
            titulo: `Ficha de ${caso.protocol} completada pela conversa`,
            detalhe: `Preenchido o que estava vazio: ${falta.map((f) => ROTULO_DO_CAMPO[f.campo]).join(", ")}.`,
            href,
          });
          if (novo) {
            const completou = await completarContato(prisma, caso, {
              cliente: falta.some((f) => f.campo === "nome") ? nomeParaFicha : "",
              email: achados.email ?? "",
              telefone: achados.telefone ?? "",
              documento: achados.documento,
              cidade: "",
              estado: "",
            });
            if (completou.length) {
              /* Só as colunas que mudaram de fato voltam no desfazer — o resto da ficha fica como está. */
              const depois = await prisma.case.findUnique({
                where: { id: caso.id },
                select: { customer: true, companyName: true, email: true, phone: true, document: true, establishmentId: true },
              });
              const mudou = (Object.keys(antes) as (keyof typeof antes)[]).filter((k) => depois && depois[k] !== antes[k]);
              await prisma.acaoDaIA.update({
                where: { userId_chave: { userId, chave } },
                data: {
                  detalhe: `Preenchido o que estava vazio: ${completou.join(", ")}.`,
                  desfazer: { caso: caso.id, campos: mudou.join(","), antes: JSON.stringify(antes) },
                },
              });
              feitas += 1;
            } else {
              /* Nada passou na conferência (telefone incompleto, e-mail torto): a ação não aparece e não se repete. */
              await prisma.acaoDaIA.update({ where: { userId_chave: { userId, chave } }, data: { desfeitaEm: new Date(), vistaEm: new Date() } });
            }
          }
        }
      }

      /* O 1º contato: a primeira mensagem nossa depois que a reclamação chegou (o dia dela — o registro pode ter entrado depois, pela planilha). */
      const semPrimeiro = !caso.primeiroContatoEm && !(caso.publicResponse ?? "").trim() && !CLOSED_STATUS.includes(caso.status);
      const chegou = caso.recebidaEm ?? caso.publishedAt;
      const primeira = msgs.find((m) => m.de === "nos" && m.em >= chegou && m.em <= agora);
      if (semPrimeiro && primeira) {
        const chave = `etapa:caso:${caso.id}:primeiro-contato`;
        const respondeu = msgs.some((m) => m.de === "cliente" && m.em > primeira.em);
        const novo = await registrar(prisma, userId, {
          tipo: "etapa",
          origem: "whatsapp",
          chave,
          titulo: `1º contato de ${caso.protocol} registrado pela conversa`,
          detalhe: `${respondeu ? "Falou com" : "Tentou contato com"} ${nome || "o cliente"} pelo WhatsApp em ${descreverRegistro(primeira.em.toISOString())}.`,
          href,
        });
        if (novo) {
          const { contato } = await gravarContato(prisma, {
            caseId: caso.id,
            entrada: {
              tipo: respondeu ? "contato" : "tentativa",
              canal: "WhatsApp",
              resultado: respondeu ? "respondeu" : "aguardando",
              nota: "Registrado pela IA a partir da conversa guardada.",
              em: primeira.em.toISOString(),
            },
            autorId: null,
            autorNome: AUTOR,
          });
          await prisma.acaoDaIA.update({ where: { userId_chave: { userId, chave } }, data: { desfazer: { contato: contato.id, caso: caso.id } } });
          feitas += 1;
        }
      }
    }

    /* ---------- o NPS ---------- */
    const nps = c.npsResponse;
    if (nps && !nps.firstContactAt && !isEncerrado(nps.status)) {
      const primeira = msgs.find((m) => m.de === "nos" && m.em >= nps.respondedAt && m.em <= agora);
      if (primeira) {
        const chave = `etapa:nps:${nps.id}:primeiro-contato`;
        const novo = await registrar(prisma, userId, {
          tipo: "etapa",
          origem: "nps",
          chave,
          titulo: `1º contato do NPS de ${nome || "um cliente"} registrado pela conversa`,
          detalhe: `A primeira mensagem pelo WhatsApp foi em ${descreverRegistro(primeira.em.toISOString())}.`,
          href: `/nps/${nps.id}`,
        });
        if (novo) {
          const tentativa = await registrarTentativa(prisma, {
            responseId: nps.id,
            channel: "whatsapp",
            note: "Registrada pela IA a partir da conversa guardada.",
            actor: eu?.name ?? AUTOR,
            em: primeira.em,
          });
          await prisma.acaoDaIA.update({ where: { userId_chave: { userId, chave } }, data: { desfazer: { tentativaNps: tentativa.id, nps: nps.id } } });
          feitas += 1;
        }
      }
    }
  }

  return feitas;
}

const ROTULO_DO_CAMPO: Record<CampoDoCadastro, string> = { email: "e-mail", telefone: "telefone", documento: "CPF/CNPJ", nome: "nome" };

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
    seguirPelasConversas(prisma, userId, agora),
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

/** O que a IA fez hoje — o "O que eu fiz hoje" do balão do assistente. */
export async function acoesDeHoje(prisma: PrismaClient, userId: string, agora = new Date()): Promise<AcaoDaIAView[]> {
  const hoje = paredeDe(agora).dia;
  const linhas = await prisma.acaoDaIA.findMany({
    where: { userId, criadaEm: { gte: new Date(Date.parse(`${hoje}T03:00:00Z`)) }, tipo: { not: "aviso" } },
    orderBy: { criadaEm: "desc" },
    take: 50,
  });
  /* O que nunca chegou a acontecer (a ficha que não tinha o que completar) não é "o que eu fiz". */
  return linhas.filter((l) => !(l.desfeitaEm && !l.desfazer)).map(paraView);
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
  /* Só o comentário e a nota que esta ação criou — o id vem da própria linha da ação. */
  if (d.comentario) await prisma.caseComment.deleteMany({ where: { id: d.comentario } });
  if (d.notaNps) await prisma.npsNote.deleteMany({ where: { id: d.notaNps } });
  /* A ficha completada (09/10/2026): volta só o que a IA preencheu. */
  if (d.caso && d.campos && d.antes) {
    const antes = JSON.parse(d.antes) as Record<string, string | null>;
    const volta = Object.fromEntries(d.campos.split(",").filter((k) => k in antes).map((k) => [k, antes[k]]));
    if (Object.keys(volta).length) await prisma.case.update({ where: { id: d.caso }, data: volta });
  }
  /* O 1º contato registrado pela conversa: sai o registro e o resumo do caso é refeito. */
  if (d.contato && d.caso) {
    await prisma.caseContato.deleteMany({ where: { id: d.contato } });
    await recalcularResumo(prisma, d.caso);
  }
  if (d.tentativaNps && d.nps) {
    const tentativa = await prisma.npsAttempt.findUnique({ where: { id: d.tentativaNps }, select: { createdAt: true } });
    await prisma.npsAttempt.deleteMany({ where: { id: d.tentativaNps } });
    /* O 1º contato só volta a vazio se era esta tentativa que o marcava. */
    if (tentativa) await prisma.npsResponse.updateMany({ where: { id: d.nps, firstContactAt: tentativa.createdAt }, data: { firstContactAt: null } });
  }
  await prisma.acaoDaIA.update({ where: { id }, data: { desfeitaEm: new Date(), vistaEm: acao.vistaEm ?? new Date() } });
  return { ok: true };
}
