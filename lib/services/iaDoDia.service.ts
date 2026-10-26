import type { Prisma, PrismaClient } from "@prisma/client";

import type { AgendaTask } from "@/lib/models/agenda";
import {
  chaveDaAcao,
  ehMinha,
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
import { isEncerrado, ROOT_CAUSES, tentativasRespondidas } from "@/lib/models/nps";
import { CLOSED_STATUS } from "@/lib/services/case.service";
import { descreverRegistro, paredeDe, prazoUtil } from "@/lib/services/horasUteis";
import { lerExpediente } from "@/lib/services/operacao.service";
import { registrarTentativa } from "@/lib/services/nps.repository";
import { completarContato } from "@/lib/services/raPortal.service";
import { dadosDaConversa, oQueCompletar, type CampoDoCadastro } from "@/lib/services/sinaisDaConversa";
import { gravarContato, recalcularResumo } from "@/lib/services/tratativa.service";
import { pedirEstruturado, temIA } from "@/lib/services/ia.service";
import { aprenderComAsAvaliacoes, aprenderDasConversas, aprendizadosAtivos } from "@/lib/services/aprendizados.service";
import { classeDaAvaliacao } from "@/lib/models/classeDaAvaliacao";
import { classificarAvaliacoes } from "@/lib/services/classeDaAvaliacao.service";
import { relevantes } from "@/lib/models/aprendizados";
import { criarLembretesAutomaticos } from "@/lib/services/lembretesAutomaticos.service";
import { termometrosDoDia } from "@/lib/services/termometro.service";
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

/**
 * O nome com que a extensão guarda as conversas desta pessoa (22/10/2026).
 *
 * A IA do dia roda para quem estiver com o app aberto. Ela lia todas as
 * conversas guardadas — e desde 13/10 a da Thais anotava nas fichas, e
 * recebia lembretes, das conversas do WhatsApp do Carlos, duplicando as
 * anotações dele no mesmo dia. Cada pessoa trata só o que ela guardou.
 */
export async function quemGuardou(prisma: PrismaClient, userId: string): Promise<string | null> {
  const eu = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } }).catch(() => null);
  return eu?.name?.trim() || null;
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
/** Onde o caso termina de verdade — "Aguardando avaliação" ainda pede trabalho. */
const FINAIS_DO_CASO = new Set(["Resolvido", "Não resolvido", "Finalizado"]);

export async function fecharOQueFoiFeito(prisma: PrismaClient, userId: string): Promise<number> {
  const abertas = await prisma.agendaTask.findMany({
    where: { done: false, ownerId: userId },
    select: { id: true, title: true, type: true, dueDate: true, createdAt: true, caseId: true },
    take: 300,
  });
  if (!abertas.length) return 0;

  const usadas = await chavesJaUsadas(prisma, userId, abertas.map((t) => chaveDaAcao.feito(t.id)));
  /*
    O que foi desfeito não volta — a não ser por fato novo (22/10/2026): a
    cobrança "sinalizar avaliação" do Gabriel foi fechada errado em 21/10
    (caso ainda aguardando avaliação), reaberta, e depois ele avaliou nota
    10 — e ela ficava aberta para sempre. A reclamação avaliada e numa
    coluna final é motivo novo: fecha, com uma chave própria.
  */
  const jaUsadas = abertas.filter((t) => usadas.has(chaveDaAcao.feito(t.id)) && t.caseId);
  const avaliadasDepois = jaUsadas.length
    ? new Set(
        (
          await prisma.case.findMany({
            where: { id: { in: jaUsadas.map((t) => t.caseId!) }, evaluated: true, status: { in: [...FINAIS_DO_CASO] } },
            select: { id: true },
          })
        ).map((c) => c.id)
      )
    : new Set<string>();
  const chaveDoFeito = (t: { id: string; caseId: string | null }) =>
    usadas.has(chaveDaAcao.feito(t.id)) && t.caseId && avaliadasDepois.has(t.caseId) ? `${chaveDaAcao.feito(t.id)}:avaliado` : chaveDaAcao.feito(t.id);
  const usadasAvaliado = await chavesJaUsadas(prisma, userId, abertas.map(chaveDoFeito));
  /* Candidata: nunca fechada, ou desfeita e agora com a reclamação avaliada (e essa chave nova ainda livre). */
  const candidatas = abertas.filter((t) => !usadasAvaliado.has(chaveDoFeito(t)));
  if (!candidatas.length) return 0;

  /* Os sinais, em poucas consultas. */
  const idsDeArea = candidatas.filter((t) => t.id.startsWith("auto-area-")).map((t) => t.id.slice("auto-area-".length));
  const COM_MENSAGEM = /^auto-(conversa|pedido|promessa|espera)-/;
  const idsDeMensagem = candidatas.filter((t) => COM_MENSAGEM.test(t.id)).map((t) => t.id.replace(COM_MENSAGEM, ""));
  const idsDeCaso = [...new Set(candidatas.map((t) => t.caseId).filter((x): x is string => Boolean(x)))];

  const [areas, mensagens, casos, contatos] = await Promise.all([
    idsDeArea.length ? prisma.caseMovement.findMany({ where: { id: { in: idsDeArea } }, select: { id: true, returnedAt: true } }) : [],
    idsDeMensagem.length ? prisma.mensagemDaConversa.findMany({ where: { id: { in: idsDeMensagem } }, select: { id: true, conversaId: true } }) : [],
    idsDeCaso.length ? prisma.case.findMany({ where: { id: { in: idsDeCaso } }, select: { id: true, status: true, resolved: true, encerradoEm: true, evaluatedAt: true, updatedAt: true } }) : [],
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
        /*
          Só o caso finalizado depois que a atividade nasceu (21/10/2026).
          "Aguardando avaliação" contava como encerrado — e é justamente
          quando se cobra a avaliação —, e o lembrete criado com o caso já
          fechado morria no mesmo minuto ("Cobrar Gabriel: sinalizar
          avaliação", "Cobrar Fernanda: enviar CSC e ID").
        */
        /*
          A avaliação só tem o dia, sem hora (21/10/2026): avaliado no mesmo
          dia da cobrança, a meia-noite parecia "antes" do lembrete das 15h e
          ele ficava aberto com o caso já avaliado. Com a data da avaliação,
          compara o dia.
        */
        casoEncerrado: c
          ? FINAIS_DO_CASO.has(c.status) &&
            (c.encerradoEm
              ? c.encerradoEm.getTime() >= t.createdAt.getTime()
              : c.evaluatedAt
                ? c.evaluatedAt.toISOString().slice(0, 10) >= paredeDe(t.createdAt).dia
                : c.updatedAt.getTime() >= t.createdAt.getTime())
          : undefined,
      }
    );
    if (!motivo) continue;
    /* Registra antes de fechar: se outra aba já registrou, esta não fecha de novo. */
    const novo = await registrar(prisma, userId, {
      tipo: "feito",
      origem: origemDaTarefa(t.id),
      chave: chaveDoFeito(t),
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
/** O contexto de antes de hoje: as últimas mensagens, dos últimos dias. */
const MENSAGENS_DE_CONTEXTO = 12;
const DIAS_DE_CONTEXTO = 7;

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
  const dono = soConversas ? null : await quemGuardou(prisma, userId);
  if (!soConversas && !dono) return 0;

  const conversas = await prisma.conversa.findMany({
    where: {
      /* Só as conversas que esta pessoa guardou (22/10/2026) — ver `quemGuardou`. */
      ...(soConversas ? { id: { in: soConversas } } : { guardadaPor: dono! }),
      OR: [{ caseId: { not: null } }, { npsResponseId: { not: null } }],
      mensagens: { some: { em: { gte: inicioDoDia } } },
    },
    select: {
      id: true,
      telefone: true,
      contatoNome: true,
      caseId: true,
      npsResponseId: true,
      case: { select: { externalId: true, protocol: true, channel: true, customer: true, title: true, description: true, causaRaiz: true, churnRisk: true, evaluated: true, status: true } },
      npsResponse: { select: { score: true, comment: true, customerName: true, rootCause: true, churnRisk: true, status: true, resolvedAfter: true, confirmedAt: true, reviewAsked: true } },
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
  /*
    Só a leitura até a última mensagem barra (21/10/2026): antes, anotada a
    conversa, o resto do dia era ignorado — o que o cliente dizia à tarde
    não chegava à ficha. Mensagem nova, leitura nova, e a anotação do dia
    é reescrita com o dia inteiro.
  */
  const usadas = await chavesJaUsadas(prisma, userId, prontas.map(lida));
  let feitas = 0;
  /* O que o time já aprendeu com outras conversas — cada leitura recebe só o que tem a ver com ela. */
  const saber = await aprendizadosAtivos(prisma);
  const catalogo = await causasDoCatalogo(prisma);

  for (const c of prontas.filter((x) => !usadas.has(lida(x))).slice(0, ANOTACOES_POR_RODADA)) {
    const nome = nomeDoCliente(c, c.case?.customer ?? c.npsResponse?.customerName, c.mensagens);
    /* A conversa guardada sem nome (só o telefone, ou texto da tela) ganha o nome achado (21/10/2026). */
    if (nome && !nomeDePessoa(c.contatoNome)) {
      await prisma.conversa.update({ where: { id: c.id }, data: { contatoNome: nome.slice(0, 120) } }).catch(() => undefined);
    }
    /*
      As mensagens de antes de hoje vão como contexto (21/10/2026): a
      Fernanda mandou "CSC V DONADIO FILIAL" — o dado que pedimos ontem
      para resolver a reclamação dela — e, lida sozinha, a mensagem "não
      tratava da reclamação". Sem o que veio antes, resposta curta vira
      assunto solto.
    */
    const antes = semMensagensDeOutraConversa(
      { telefone: c.telefone, nome: c.contatoNome },
      await prisma.mensagemDaConversa
        .findMany({
          where: { conversaId: c.id, em: { lt: inicioDoDia, gte: new Date(inicioDoDia.getTime() - DIAS_DE_CONTEXTO * 86_400_000) } },
          orderBy: { em: "desc" },
          select: { id: true, de: true, texto: true, em: true, autor: true, chave: true, criadoEm: true },
          take: MENSAGENS_DE_CONTEXTO,
        })
        .catch(() => [])
    )
      .filter((m): m is typeof m & { em: Date } => Boolean(m.em))
      .reverse();
    const leitura = await ler({
      nome,
      hoje,
      caso: c.case ? { protocolo: c.case.protocol, canal: c.case.channel, titulo: c.case.title, relato: c.case.description } : null,
      nps: c.npsResponse ? { nota: c.npsResponse.score, comentario: c.npsResponse.comment } : null,
      mensagens: c.mensagens,
      antes,
      causas: (paraCasoSemCausa(c) || paraNpsSemCausa(c)) ? catalogo : [],
      saber: relevantes(saber, [c.case?.title, c.case?.description, c.npsResponse?.comment, ...c.mensagens.map((m) => m.texto)].filter(Boolean).join(" ")).map((a) => `${a.assunto}: ${a.texto}`),
    });
    /* A IA não respondeu agora: a próxima volta tenta de novo. */
    if (!leitura) continue;

    /* Sem nome: "o cliente" no texto, e o título não sai "no NPS de o cliente". */
    const chamado = nome || "o cliente";
    const doCliente = nome ? `de ${nome}` : "do cliente";
    const paraNps = leitura.segmento === "nps" && Boolean(c.npsResponseId);
    const paraCaso = leitura.segmento === "reclamacao" && Boolean(c.caseId);

    /* A ficha anda com a conversa, mesmo no dia em que não há o que anotar ("ok, recebi" também é contato). */
    if (leitura.sobreEle && (paraCaso || paraNps)) {
      feitas += await atualizarFicha(prisma, userId, { conversa: c, leitura, paraCaso, hoje, agora, chamado: nome || "o cliente" });
    }

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
    const alvo = paraCaso ? `caso:${c.caseId}` : `nps:${c.npsResponseId}`;
    const chave = chaveDaAcao.anotacaoDoAlvo(alvo, hoje);

    /* A leitura desta mensagem fica marcada (invisível): só volta a ler com mensagem nova. */
    await registrar(prisma, userId, { tipo: "aviso", origem: paraCaso ? "caso" : "nps", chave: lida(c), titulo: `Conversa com ${chamado} lida`, detalhe: "Anotada na ficha." });
    await prisma.acaoDaIA.updateMany({ where: { userId, chave: lida(c) }, data: { vistaEm: agora } });

    /* O pedido de cancelamento vira atividade de retenção no mesmo dia (21/10/2026). */
    if (leitura.cancelamento === "pediu" && (await lembrarRetencao(prisma, userId, { nome: chamado, alvo, caseId: paraCaso ? c.caseId : null, hoje }))) {
      feitas += 1;
    }

    /* Já há anotação do dia neste caso/NPS: reescreve com o dia inteiro, em vez de outra. */
    const doDia = await prisma.acaoDaIA.findUnique({ where: { userId_chave: { userId, chave } }, select: { desfazer: true, desfeitaEm: true } });
    if (doDia) {
      const d = (doDia.desfazer ?? {}) as Record<string, string>;
      if (!doDia.desfeitaEm && d.comentario) await prisma.caseComment.update({ where: { id: d.comentario }, data: { body: texto } }).catch(() => undefined);
      if (!doDia.desfeitaEm && d.notaNps) await prisma.npsNote.update({ where: { id: d.notaNps }, data: { body: texto } }).catch(() => undefined);
      if (!doDia.desfeitaEm) await prisma.acaoDaIA.update({ where: { userId_chave: { userId, chave } }, data: { detalhe: leitura.corpo.slice(0, 280) } });
      if (leitura.retorno && (await lembrarRetorno(prisma, userId, { nome: chamado, caseId: paraCaso ? c.caseId : null, mensagens: c.mensagens, retorno: leitura.retorno, hoje }))) {
        feitas += 1;
      }
      continue;
    }
    const href = paraCaso
      ? `/${c.case?.channel === "RECLAME_AQUI" ? "reclame-aqui" : "redes-sociais"}/${c.case?.externalId ?? c.case?.protocol ?? c.caseId}`
      : `/nps/${c.npsResponseId}`;

    /* Registra antes de anotar: duas abas rodando juntas não anotam duas vezes. */
    const novo = await registrar(prisma, userId, {
      tipo: "anotacao",
      origem: paraCaso ? "caso" : "nps",
      chave,
      titulo: paraCaso ? `Anotei na ficha de ${c.case?.protocol}: conversa com ${chamado}` : `Anotei no NPS ${doCliente}: conversa de hoje`,
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

/* ============================================================
   A FICHA ANDANDO COM A CONVERSA (21/10/2026)
============================================================ */

/*
  "A IA PRECISA atualizar as informações dos casos, notas, etc." Ela lia a
  conversa, anotava e criava atividade — e a ficha ficava parada: o último
  contato de setembro com conversa de hoje, o pedido de avaliação feito no
  WhatsApp sem contar, a causa raiz vazia, o NPS em "Novo" com o cliente
  respondendo. Agora cada conversa lida atualiza o que ela prova, uma vez
  por dia e com desfazer:

  - **caso**: o contato do dia (falou ou tentou), o pedido de avaliação, a
    validação da solução (resolveu ou não), o risco de cancelamento e a
    causa raiz vazia;
  - **NPS**: a etapa sai de "Novo" quando o cliente responde, risco de
    cancelamento, causa raiz vazia, "resolveu depois do contato" e o pedido
    de avaliação.

  A nota do portal e a do NPS não mudam por conversa: são do consumidor,
  ditas no portal e na pesquisa.
*/

async function causasDoCatalogo(prisma: PrismaClient): Promise<string[]> {
  const causas = await prisma.npsRootCause.findMany({ where: { active: true }, select: { name: true }, orderBy: { order: "asc" } }).catch(() => []);
  return causas.length ? causas.map((c) => c.name) : [...ROOT_CAUSES];
}

const paraCasoSemCausa = (c: { case: { causaRaiz: string | null } | null }) => Boolean(c.case && !(c.case.causaRaiz ?? "").trim());
const paraNpsSemCausa = (c: { npsResponse: { rootCause: string | null } | null }) => Boolean(c.npsResponse && !(c.npsResponse.rootCause ?? "").trim());

/** O pedido de avaliação escrito por nós, mesmo quando a IA não marcou: "avaliação" junto de "Reclame Aqui" ou do link dele. */
const PEDIDO_DE_AVALIACAO = /avalia[cç][aã]o|avalie\b|avaliar/i;
const DO_RECLAME_AQUI = /reclame\s*aqui|reclameaqui\.com\.br/i;

interface ConversaDaFicha {
  caseId: string | null;
  npsResponseId: string | null;
  case: { protocol: string; externalId: string | null; channel: string; causaRaiz: string | null; churnRisk: boolean; evaluated: boolean } | null;
  npsResponse: { rootCause: string | null; churnRisk: boolean; status: string; resolvedAfter: boolean | null; confirmedAt: Date | null; reviewAsked: boolean } | null;
  mensagens: { de: string; texto: string; em: Date }[];
}

async function atualizarFicha(
  prisma: PrismaClient,
  userId: string,
  { conversa: c, leitura, paraCaso, hoje, agora, chamado }: { conversa: ConversaDaFicha; leitura: LeituraDoDia; paraCaso: boolean; hoje: string; agora: Date; chamado: string }
): Promise<number> {
  const inicioDoDia = new Date(Date.parse(`${hoje}T03:00:00Z`));
  const nossas = c.mensagens.filter((m) => m.de === "nos");
  const dele = c.mensagens.filter((m) => m.de === "cliente");
  const falou = nossas.length > 0 && dele.length > 0;
  const pediuAvaliacao = leitura.pedimosAvaliacao || nossas.some((m) => PEDIDO_DE_AVALIACAO.test(m.texto) && DO_RECLAME_AQUI.test(m.texto));
  let feitas = 0;

  if (paraCaso && c.caseId && c.case) {
    const caso = c.case;
    const caseId = c.caseId;
    const href = `/${caso.channel === "RECLAME_AQUI" ? "reclame-aqui" : "redes-sociais"}/${caso.externalId ?? caso.protocol}`;
    const deHoje = await prisma.caseContato.findMany({ where: { caseId, em: { gte: inicioDoDia } }, select: { tipo: true, resultado: true } });

    const contato = async (chave: string, titulo: string, detalhe: string, entrada: { tipo: string; resultado: string; em: Date }) => {
      const novo = await registrar(prisma, userId, { tipo: "etapa", origem: "whatsapp", chave, titulo, detalhe, href });
      if (!novo) return;
      const { contato: criado } = await gravarContato(prisma, {
        caseId,
        entrada: { tipo: entrada.tipo, canal: "WhatsApp", resultado: entrada.resultado, nota: "Registrado pela IA a partir da conversa guardada.", em: entrada.em.toISOString() },
        autorId: null,
        autorNome: AUTOR,
      });
      await prisma.acaoDaIA.update({ where: { userId_chave: { userId, chave } }, data: { desfazer: { contato: criado.id, caso: caseId } } });
      feitas += 1;
    };

    /* O contato do dia: falou (o cliente escreveu) ou tentou (só nós). O cliente sozinho é pendência nossa, não contato. */
    const contatoHoje = deHoje.some((d) => d.tipo === "contato" || d.tipo === "atualizacao" || d.tipo === "validacao");
    const tentativaHoje = deHoje.some((d) => d.tipo === "tentativa");
    if (nossas.length && !contatoHoje && (falou || !tentativaHoje)) {
      await contato(
        `contato:caso:${caseId}:${hoje}:${falou ? "falou" : "tentou"}`,
        falou ? `Contato de hoje registrado em ${caso.protocol}` : `Tentativa de contato de hoje registrada em ${caso.protocol}`,
        `${falou ? "Falou com" : "Tentou contato com"} ${chamado} pelo WhatsApp — o último contato do caso fica em dia.`,
        { tipo: falou ? "contato" : "tentativa", resultado: falou ? "respondeu" : "aguardando", em: nossas[0].em }
      );
    }

    /* O pedido de avaliação feito na conversa conta como pedido — o mesmo do botão "Pedi a avaliação". */
    if (pediuAvaliacao && !caso.evaluated && !deHoje.some((d) => d.tipo === "pedido-avaliacao")) {
      const msg = [...nossas].reverse().find((m) => PEDIDO_DE_AVALIACAO.test(m.texto) || DO_RECLAME_AQUI.test(m.texto)) ?? nossas[nossas.length - 1];
      if (msg) {
        await contato(`pedido-avaliacao:caso:${caseId}:${hoje}`, `Pedido de avaliação registrado em ${caso.protocol}`, `Pedimos a avaliação a ${chamado} pelo WhatsApp.`, {
          tipo: "pedido-avaliacao",
          resultado: "enviado",
          em: msg.em,
        });
      }
    }

    /* A validação: o cliente disse que resolveu (valida o caso) ou que continua (pendência). */
    if (leitura.solucao !== "nao" && dele.length && !deHoje.some((d) => d.tipo === "validacao")) {
      const confirmou = leitura.solucao === "confirmou";
      await contato(
        `validacao:caso:${caseId}:${hoje}`,
        confirmou ? `${caso.protocol}: o cliente confirmou que resolveu` : `${caso.protocol}: o cliente diz que ainda não resolveu`,
        confirmou ? `${chamado} confirmou a solução na conversa — o caso fica validado.` : `${chamado} disse na conversa que o problema continua — ficou como pendência na validação.`,
        { tipo: "validacao", resultado: confirmou ? "respondeu" : "pendencia", em: dele[dele.length - 1].em }
      );
    }

    /* Os campos: risco de cancelamento e causa raiz vazia. */
    const dados: { churnRisk?: boolean; causaRaiz?: string } = {};
    if (leitura.cancelamento === "pediu" && !caso.churnRisk) dados.churnRisk = true;
    if (leitura.causa && !(caso.causaRaiz ?? "").trim()) dados.causaRaiz = leitura.causa;
    const campos = Object.keys(dados) as (keyof typeof dados)[];
    if (campos.length) {
      const chave = `ficha:caso:${caseId}:${hoje}:${campos.sort().join(",")}`;
      const novo = await registrar(prisma, userId, {
        tipo: "completou",
        origem: "whatsapp",
        chave,
        titulo: `Ficha de ${caso.protocol} atualizada pela conversa`,
        detalhe: [dados.causaRaiz ? `Causa raiz: ${dados.causaRaiz}.` : null, dados.churnRisk ? "Risco de cancelamento marcado — o cliente pediu para cancelar." : null].filter(Boolean).join(" "),
        href,
      });
      if (novo) {
        await prisma.case.update({ where: { id: caseId }, data: dados });
        const antes = { churnRisk: caso.churnRisk, causaRaiz: caso.causaRaiz };
        await prisma.acaoDaIA.update({ where: { userId_chave: { userId, chave } }, data: { desfazer: { caso: caseId, campos: campos.join(","), antes: JSON.stringify(antes) } } });
        feitas += 1;
      }
    }
  }

  if (!paraCaso && c.npsResponseId && c.npsResponse) {
    const nps = c.npsResponse;
    const npsId = c.npsResponseId;
    const dados: { status?: string; churnRisk?: boolean; rootCause?: string; resolvedAfter?: boolean; confirmedAt?: Date | null; reviewAsked?: boolean } = {};
    const motivos: string[] = [];
    if (!isEncerrado(nps.status)) {
      if (nps.status === "Novo" && falou) {
        dados.status = "Em tratativa";
        motivos.push("etapa: Em tratativa — o cliente respondeu");
      }
      if (leitura.solucao === "confirmou" && nps.resolvedAfter !== true) {
        dados.resolvedAfter = true;
        dados.confirmedAt = nps.confirmedAt ?? agora;
        motivos.push("resolveu depois do contato");
      }
      if (leitura.solucao === "nao-resolveu" && nps.resolvedAfter !== false) {
        dados.resolvedAfter = false;
        dados.confirmedAt = null;
        motivos.push("não resolveu depois do contato");
      }
    }
    if (leitura.cancelamento === "pediu" && !nps.churnRisk) {
      dados.churnRisk = true;
      motivos.push("risco de cancelamento");
    }
    if (leitura.causa && !(nps.rootCause ?? "").trim()) {
      dados.rootCause = leitura.causa;
      motivos.push(`causa raiz: ${leitura.causa}`);
    }
    if (pediuAvaliacao && !nps.reviewAsked) {
      dados.reviewAsked = true;
      motivos.push("avaliação pedida");
    }
    const campos = Object.keys(dados) as (keyof typeof dados)[];
    if (campos.length) {
      const chave = `ficha:nps:${npsId}:${hoje}:${campos.sort().join(",")}`;
      const novo = await registrar(prisma, userId, {
        tipo: "completou",
        origem: "nps",
        chave,
        titulo: `NPS de ${chamado} atualizado pela conversa`,
        detalhe: `${motivos.join("; ")}.`.replace(/^./, (l) => l.toUpperCase()),
        href: `/nps/${npsId}`,
      });
      if (novo) {
        const antes = Object.fromEntries(campos.map((k) => [k, (nps as unknown as Record<string, unknown>)[k] ?? null]));
        await prisma.npsResponse.update({ where: { id: npsId }, data: dados });
        await prisma.acaoDaIA.update({ where: { userId_chave: { userId, chave } }, data: { desfazer: { nps: npsId, camposNps: campos.join(","), antesNps: JSON.stringify(antes) } } });
        feitas += 1;
      }
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
  /** As últimas mensagens de antes de hoje — só contexto, não vão para a anotação. */
  antes?: { de: string; texto: string; em: Date }[];
  /** O que o time já sabe sobre o assunto (aprendido de outras conversas). */
  saber?: string[];
  /** O catálogo de causas — só quando a ficha ainda não tem causa. */
  causas?: string[];
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
export async function lerConversaDoDia(entrada: ConversaParaLer): Promise<LeituraDoDia | null> {
  const quem = entrada.nome || "Cliente";
  const linhas = entrada.mensagens.map((m) => `[${hhmmDe(m.em)}] ${m.de === "nos" ? "Nós" : quem}: ${m.texto.replace(/\s+/g, " ").slice(0, 400)}`);
  const contexto = (entrada.antes ?? []).map(
    (m) => `[${new Date(m.em.getTime() - 3 * 3_600_000).toISOString().slice(8, 10)}/${new Date(m.em.getTime() - 3 * 3_600_000).toISOString().slice(5, 7)} ${hhmmDe(m.em)}] ${m.de === "nos" ? "Nós" : quem}: ${m.texto.replace(/\s+/g, " ").slice(0, 300)}`
  );
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
        ...(entrada.saber?.length
          ? ["", "O que o time já sabe sobre isso (aprendido de outras conversas — use para entender o contexto; não copie para a anotação):", ...entrada.saber.map((x) => `- ${x}`)]
          : []),
        "",
        "Responda:",
        "1. sobre_este_cliente: false se a conversa, ou parte dela, parece ser com outra pessoa (chamada por outro nome, assunto de outro cliente) ou mistura duas conversas.",
        `2. segmento: de qual vínculo a conversa trata — ${segmentos.map((s) => `"${s}"`).join(" ou ")} — ou "outro" se não trata de nenhum deles (ex.: venda, assunto pessoal, dúvida nova sem relação). Resposta que continua o que se tratava antes (o dado que pedimos, o teste combinado, a configuração para resolver o problema) trata do mesmo vínculo.`,
        '3. vale_anotar: false se hoje só houve cumprimento, agradecimento, "ok", tentativa sem resposta ou nada novo.',
        "4. motivo: quando sobre_este_cliente ou vale_anotar for false, por quê, em uma frase; senão, vazio.",
        "5. resumo: até 3 linhas do que foi tratado hoje.",
        '6. pendente: o que ficou por fazer e de quem, ou "nada".',
        "7. importantes: fatos duradouros para a próxima conversa — quantas lojas, sistema ou integração que usa, valor ou prazo combinado, decisão ou pedido do cliente, risco de cancelar, melhor horário ou canal. Lista vazia se não houver.",
        '8. retorno: se alguém ficou de dar retorno — nós ao cliente (quem "nos") ou o cliente a nós (quem "cliente") — e ainda não deu na conversa: precisa true, oque em até 12 palavras começando por verbo, e dia (AAAA-MM-DD) só se a conversa disser o dia, senão vazio. Sem retorno pendente: precisa false.',
        '9. cancelamento: "pediu" se o cliente pede ou anuncia que vai cancelar o plano/sistema da Cardápio Web (não o pedido de comida de um consumidor); "cancelou" se a conversa diz que o cancelamento foi feito; "ficou" se ele desistiu de cancelar; "nao" se não se falou disso.',
        "10. pedimos_avaliacao: true se hoje NÓS pedimos ao cliente que avalie (a reclamação no Reclame Aqui, a pesquisa ou o Google), inclusive mandando o link para avaliar.",
        '11. solucao: "confirmou" se hoje o cliente disse que o problema foi resolvido ou que deu certo; "nao-resolveu" se disse que continua com o problema; "nao" se não se falou disso.',
        ...(entrada.causas?.length
          ? [`12. causa: a causa raiz do problema do cliente, escolhida EXATAMENTE desta lista — ${entrada.causas.map((c) => `"${c}"`).join(", ")} — ou vazio se a conversa não deixa claro.`]
          : ['12. causa: vazio.']),
        "",
        ...(contexto.length ? ["Antes de hoje (só para entender — não resuma nem anote isto):", contexto.join("\n").slice(-2500), ""] : []),
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
          cancelamento: { type: "string", enum: ["nao", "pediu", "cancelou", "ficou"] },
          pedimos_avaliacao: { type: "boolean" },
          solucao: { type: "string", enum: ["nao", "confirmou", "nao-resolveu"] },
          causa: { type: "string" },
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
        required: ["sobre_este_cliente", "segmento", "vale_anotar", "motivo", "resumo", "pendente", "importantes", "retorno", "cancelamento", "pedimos_avaliacao", "solucao", "causa"],
      },
    });
  } catch {
    return null;
  }
  if (r.erro || !r.dados) return null;
  return leituraDaResposta(r.dados, segmentos, entrada.hoje, entrada.causas ?? []);
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
/**
 * O pedido de cancelamento lido na conversa vira atividade de retenção,
 * para hoje, prioridade alta (21/10/2026): "a IA tem que criar atividades
 * ... ela precisa ler corretamente na conversa". Uma por caso/NPS por dia.
 */
async function lembrarRetencao(
  prisma: PrismaClient,
  userId: string,
  entrada: { nome: string; alvo: string; caseId: string | null; hoje: string }
): Promise<boolean> {
  const id = `auto-retencao-${entrada.alvo.replace(/[^\w-]/g, "-")}-${entrada.hoje}`.slice(0, 120);
  const titulo = `Retenção: ${entrada.nome} pediu para cancelar — ligar hoje e entender o motivo`;
  const criada = await prisma.agendaTask.createMany({
    data: [{ id, title: titulo.slice(0, 300), type: "Follow-up", priority: "Alta", done: false, dueDate: new Date(`${entrada.hoje}T00:00:00.000Z`), ownerId: userId, caseId: entrada.caseId }],
    skipDuplicates: true,
  });
  if (criada.count === 0) return false;
  return registrar(prisma, userId, {
    tipo: "lembrete",
    origem: "whatsapp",
    chave: chaveDaAcao.retencao(entrada.alvo, entrada.hoje),
    titulo,
    detalhe: "Na agenda para hoje, prioridade alta. O pedido também entra na Retenção.",
    href: "/agenda",
    desfazer: { tarefa: id },
  });
}

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
      ...(soConversas ? { id: { in: soConversas } } : { guardadaPor: (await quemGuardou(prisma, userId)) ?? "\u0000" }),
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

    /*
      O cliente respondeu pelo WhatsApp (26/10/2026): "a IA precisa
      identificar a resposta de um cliente através do WhatsApp como faz no
      Reclame Aqui". A tentativa que esperava (ou já tinha virado "sem
      retorno") e tem mensagem do cliente depois dela fica "respondeu" — é o
      que conta em "Detratores que responderam".
    */
    if (nps && !isEncerrado(nps.status)) {
      const tentativas = await prisma.npsAttempt.findMany({ where: { responseId: nps.id }, select: { id: true, resultado: true, createdAt: true } });
      const ids = tentativasRespondidas(tentativas, msgs.filter((m) => m.em >= nps.respondedAt)).sort();
      if (ids.length) {
        const chave = `respondeu:nps:${nps.id}:${ids.join(",")}`;
        const novo = await registrar(prisma, userId, {
          tipo: "etapa",
          origem: "nps",
          chave,
          titulo: `${nome || "O cliente"} respondeu ao contato do NPS`,
          detalhe: ids.length === 1 ? "A resposta chegou pelo WhatsApp: a tentativa ficou marcada como respondida." : `A resposta chegou pelo WhatsApp: ${ids.length} tentativas ficaram marcadas como respondidas.`,
          href: `/nps/${nps.id}`,
        });
        if (novo) {
          const antes = tentativas.filter((t) => ids.includes(t.id)).map((t) => `${t.id}=${t.resultado}`).join(",");
          await prisma.npsAttempt.updateMany({ where: { id: { in: ids } }, data: { resultado: "respondeu" } });
          await prisma.acaoDaIA.update({ where: { userId_chave: { userId, chave } }, data: { desfazer: { respondeuNps: antes } } });
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
  /*
    A minha resposta na mesma conversa, depois da pergunta, quer dizer que
    ela já foi respondida (21/10/2026): não vira lembrete, e o lembrete
    aberto daquela conversa, de antes da resposta, fecha.
  */
  const minhaUltima = new Map<string, number>();
  for (const m of mensagens) if (ehMinha(m, usuario.nome)) minhaUltima.set(m.canal, Math.max(minhaUltima.get(m.canal) ?? 0, Number(m.ts)));
  for (const [canal, ts] of minhaUltima) {
    const abertas = await prisma.agendaTask.findMany({ where: { id: { startsWith: `auto-slack-${canal}-` }, done: false, ownerId: usuario.id }, select: { id: true } });
    const respondidas = abertas.filter((t) => Number(t.id.slice(`auto-slack-${canal}-`.length)) < ts).map((t) => t.id);
    if (respondidas.length) await prisma.agendaTask.updateMany({ where: { id: { in: respondidas } }, data: { done: true } });
  }
  const jaRespondida = (m: MensagemDoSlack) => (minhaUltima.get(m.canal) ?? 0) > Number(m.ts);
  const paraMim = mensagens.filter((m) => ehParaMim(m, usuario.nome) && !jaRespondida(m) && Date.parse(m.quando) >= doisDias);
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

  /* O caso citado (protocolo ou nome do cliente): o lembrete nasce nele (09/10/2026). */
  const citados = await casosCitadosNoSlack(prisma, novas.map((m) => m.texto)).catch(() => new Map<string, { id: string; protocol: string }>());

  let criados = 0;
  for (const m of novas) {
    const decidido = decididas.get(m.ts);
    const caso = citados.get(m.texto);
    const l = decidido && caso && !decidido.titulo.includes(caso.protocol) ? { ...decidido, titulo: `${decidido.titulo} [${caso.protocol}]` } : decidido;
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
        data: {
          id,
          title: l.titulo.slice(0, 300),
          type: "Follow-up",
          priority: "Média",
          done: false,
          dueDate: new Date(`${l.dia}T00:00:00.000Z`),
          time: l.hora ?? null,
          ownerId: usuario.id,
          caseId: caso?.id ?? null,
        },
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
/* ============================================================
   AVALIAÇÃO NEGATIVA VIRA ATIVIDADE (22/10/2026)
============================================================ */

/** Até quantos dias depois da avaliação ainda vale abrir a atividade. */
const DIAS_DA_NEGATIVA = 7;

/**
 * A avaliação negativa que chega vira atividade de prioridade alta, para
 * hoje: entender o que pesou, falar com o cliente e ver se cabe moderação.
 * Negativa pela ordem de sempre (`classeDaAvaliacao`): a marca de quem
 * atende, a da IA, ou a nota.
 *
 * De quem: do responsável da reclamação; sem responsável, de quem fez o 1º
 * contato — nunca de quem só estava com o app aberto (a lição da Thais).
 * Uma por reclamação (id fixo); desfeita, não volta.
 */
export async function tratarAvaliacoesNegativas(prisma: PrismaClient, userId: string, agora = new Date()): Promise<number> {
  const eu = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } }).catch(() => null);
  if (!eu?.name) return 0;
  const casos = await prisma.case.findMany({
    where: {
      channel: "RECLAME_AQUI",
      evaluated: true,
      scoreDisregarded: false,
      evaluatedAt: { gte: new Date(agora.getTime() - DIAS_DA_NEGATIVA * 86_400_000) },
      OR: [{ ownerId: userId }, { ownerId: null, primeiroContatoPor: eu.name }],
    },
    select: { id: true, protocol: true, externalId: true, customer: true, score: true, resolved: true, avaliacaoMarca: true, avaliacaoMarcaPor: true, consideracaoFinal: true },
  });
  const hoje = paredeDe(agora).dia;
  let feitas = 0;
  for (const c of casos) {
    if (classeDaAvaliacao({ ...c, evaluated: true, score: c.score ?? undefined, avaliacaoMarca: c.avaliacaoMarca === "positiva" || c.avaliacaoMarca === "negativa" ? c.avaliacaoMarca : undefined, avaliacaoMarcaPor: c.avaliacaoMarcaPor ?? undefined })?.classe !== "negativa") continue;
    const id = `auto-negativa-${c.id}`;
    const chave = chaveDaAcao.lembrete(id);
    const titulo = `Avaliação negativa de ${c.customer || "cliente"} (nota ${c.score ?? "—"}${c.resolved ? "" : ", não resolvida"}) — entender, falar com o cliente e ver se cabe moderação`;
    const novo = await registrar(prisma, userId, {
      tipo: "lembrete",
      origem: "caso",
      chave,
      titulo: `Avaliação negativa em ${c.protocol}: atividade para hoje`,
      detalhe: c.consideracaoFinal ? `O consumidor escreveu: “${c.consideracaoFinal.slice(0, 160)}”` : `Nota ${c.score ?? "—"}${c.resolved ? ", resolvida" : ", não resolvida"}.`,
      href: `/reclame-aqui/${c.externalId ?? c.protocol}`,
      desfazer: { tarefa: id },
    });
    if (!novo) continue;
    await prisma.agendaTask
      .create({ data: { id, title: titulo.slice(0, 300), type: "Follow-up", priority: "Alta", done: false, dueDate: new Date(`${hoje}T00:00:00.000Z`), ownerId: userId, caseId: c.id, frente: "reclame-aqui" } })
      .catch(() => undefined);
    feitas += 1;
  }
  return feitas;
}

export async function rodarIaDoDia(prisma: PrismaClient, userId: string, agora = new Date()) {
  const partes = await Promise.allSettled([
    criarLembretesAutomaticos(prisma, userId, agora).then((criados) => registrarLembretes(prisma, userId, criados)),
    fecharOQueFoiFeito(prisma, userId),
    anotarConversasDoDia(prisma, userId, agora),
    seguirPelasConversas(prisma, userId, agora),
    depoisDasReunioes(prisma, userId, agora),
    /* O termômetro de quem teve mensagem nova (09/10/2026): satisfação e avaliação prevista, gravadas. */
    termometrosDoDia(prisma, agora),
    /* O que o time sabe, tirado das conversas do WhatsApp e do Slack — a cada duas horas (21/10/2026). */
    aprenderDasConversas(prisma, userId, agora),
    /* A avaliação que chegou ganha a marca positiva/negativa da IA onde a nota não basta (21/10/2026). */
    classificarAvaliacoes(prisma, { agora }),
    /* A avaliação negativa vira atividade de hoje, para o responsável (22/10/2026). */
    tratarAvaliacoesNegativas(prisma, userId, agora),
    /* O que separa a avaliação boa da ruim — uma leitura por dia (22/10/2026). */
    aprenderComAsAvaliacoes(prisma, { agora }),
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
  /* O NPS atualizado pela conversa (21/10/2026): volta cada campo ao que era. */
  if (d.nps && d.camposNps && d.antesNps) {
    const antes = JSON.parse(d.antesNps) as Record<string, unknown>;
    const volta = Object.fromEntries(d.camposNps.split(",").filter((k) => k in antes).map((k) => [k, k === "confirmedAt" && antes[k] ? new Date(String(antes[k])) : antes[k]]));
    if (Object.keys(volta).length) await prisma.npsResponse.update({ where: { id: d.nps }, data: volta });
  }
  /* O contato registrado pela conversa: sai o registro e o resumo do caso é refeito. */
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
  /* A resposta do NPS lida na conversa: cada tentativa volta ao que era. */
  if (d.respondeuNps) {
    for (const par of d.respondeuNps.split(",")) {
      const [tentativa, resultado] = par.split("=");
      if (tentativa && resultado) await prisma.npsAttempt.updateMany({ where: { id: tentativa, resultado: "respondeu" }, data: { resultado } });
    }
  }
  await prisma.acaoDaIA.update({ where: { id }, data: { desfeitaEm: new Date(), vistaEm: acao.vistaEm ?? new Date() } });
  return { ok: true };
}

/* ============================================================
   O SLACK GUARDADO E LIGADO AO CASO (09/10/2026)
============================================================ */

const semAcentoSlack = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * O caso que a mensagem do Slack cita: pelo protocolo (RA-…, IG-…) ou pelo
 * nome completo de um cliente com caso aberto. "Lembre de promessas em cada
 * caso conforme o que é visto no Slack": o pedido "vê o RA-x8 até amanhã"
 * vira lembrete **no caso**, e aparece na ficha dele.
 */
export async function casosCitadosNoSlack(prisma: PrismaClient, textos: string[]): Promise<Map<string, { id: string; protocol: string }>> {
  const achados = new Map<string, { id: string; protocol: string }>();
  const protocolos = [...new Set(textos.flatMap((t) => [...t.matchAll(/\b(?:RA|IG|FB|MC)-[A-Za-z0-9_-]{6,30}\b/g)].map((m) => m[0])))];
  const porProtocolo = protocolos.length
    ? await prisma.case.findMany({ where: { protocol: { in: protocolos } }, select: { id: true, protocol: true } })
    : [];
  const abertos = await prisma.case.findMany({
    where: { encerradoEm: null, status: { notIn: [...CLOSED_STATUS] } },
    select: { id: true, protocol: true, customer: true },
    take: 600,
  });
  const nomes = abertos
    .map((c) => ({ c, nome: semAcentoSlack(c.customer).replace(/\s+/g, " ").trim() }))
    .filter((x) => x.nome.split(" ").length >= 2 && x.nome.length >= 8 && !/nao informado/.test(x.nome));
  for (const texto of textos) {
    const p = porProtocolo.find((c) => texto.includes(c.protocol));
    if (p) {
      achados.set(texto, p);
      continue;
    }
    const t = semAcentoSlack(texto);
    const porNome = nomes.filter((x) => t.includes(x.nome));
    if (porNome.length === 1) achados.set(texto, { id: porNome[0].c.id, protocol: porNome[0].c.protocol });
  }
  return achados;
}

/** Guarda o que chegou do Slack (14 dias), com o caso citado. Sem a tabela ainda (falta o db:push), não faz nada. */
export async function guardarMensagensDoSlack(prisma: PrismaClient, userId: string, mensagens: MensagemDoSlack[]): Promise<number> {
  if (!mensagens.length) return 0;
  try {
    const casos = await casosCitadosNoSlack(prisma, mensagens.map((m) => m.texto));
    const r = await prisma.mensagemDoSlack.createMany({
      data: mensagens.map((m) => ({
        userId,
        canal: m.canal,
        ts: m.ts,
        autor: (m.autor ?? "").slice(0, 120),
        texto: m.texto.slice(0, 4000),
        link: m.link ?? null,
        quando: new Date(m.quando),
        caseId: casos.get(m.texto)?.id ?? null,
      })),
      skipDuplicates: true,
    });
    await prisma.mensagemDoSlack.deleteMany({ where: { userId, quando: { lt: new Date(Date.now() - 14 * 86_400_000) } } });
    return r.count;
  } catch (erro) {
    const codigo = (erro as { code?: string })?.code;
    /* Sem a tabela, não guarda — mas diz (21/10/2026): de 09 a 20/10 o Slack não guardou nada e ninguém soube. */
    if (codigo === "P2021") {
      console.error("[slack] a tabela MensagemDoSlack não existe no banco — rode npm run db:push");
      return 0;
    }
    throw erro;
  }
}
