import type { PrismaClient } from "@prisma/client";

import { chaveDoAprendizado, ehSensivel, relevantes, semDadoSensivel, type Aprendizado } from "@/lib/models/aprendizados";
import { pedirEstruturado, temIA } from "@/lib/services/ia.service";

/** De quanto em quanto tempo a IA lê as conversas atrás de aprendizado. */
const INTERVALO_MS = 2 * 60 * 60_000;
/** Quanto de conversa vai numa leitura — o bastante para padrão, pouco para não estourar a cota gratuita. */
const TETO_DE_TEXTO = 9000;

/**
 * Lê as conversas recentes do time e guarda o que vale como conhecimento
 * (21/10/2026) — no máximo a cada duas horas por pessoa.
 *
 * - **WhatsApp:** as nossas respostas aos clientes, cada uma com a
 *   pergunta do cliente que veio antes — é ali que estão a solução que
 *   funcionou, o prazo que o time dá, o jeito de explicar.
 * - **Slack:** à parte, em `aprenderDoSlack` — o lote é lido na hora e
 *   não fica guardado (com o desenvolvimento e no privado) — o que mudou no produto, o que está fora, o que foi
 *   combinado entre as áreas.
 *
 * O que é sensível não sai daqui (`ehSensivel` barra a mensagem inteira,
 * `semDadoSensivel` tira documento, contato e código). A IA é instruída a
 * guardar só conhecimento geral, nunca nome nem dado de cliente; o mesmo
 * assunto de novo soma (`vezes`), não duplica.
 */
export async function aprenderDasConversas(prisma: PrismaClient, userId: string, agora = new Date()): Promise<number> {
  if (!temIA()) return 0;

  /* A última leitura desta pessoa, guardada como ação invisível da IA. */
  const marca = `aprendizado:${userId}`;
  const ultima = await prisma.acaoDaIA.findUnique({ where: { userId_chave: { userId, chave: marca } }, select: { criadaEm: true } });
  if (ultima && agora.getTime() - ultima.criadaEm.getTime() < INTERVALO_MS) return 0;
  const desde = ultima?.criadaEm ?? new Date(agora.getTime() - 24 * 60 * 60_000);

  const nossas = await prisma.mensagemDaConversa.findMany({
    where: { de: "nos", criadoEm: { gt: desde } },
    orderBy: { criadoEm: "asc" },
    select: { texto: true, em: true, conversaId: true },
    take: 120,
  });

  /* A pergunta do cliente que veio antes de cada resposta nossa. */
  const perguntas = await prisma.mensagemDaConversa.findMany({
    where: { de: "cliente", conversaId: { in: [...new Set(nossas.map((m) => m.conversaId))] }, criadoEm: { gt: new Date(desde.getTime() - 24 * 60 * 60_000) } },
    orderBy: { em: "asc" },
    select: { texto: true, em: true, conversaId: true },
  });

  const blocos: string[] = [];
  for (const m of nossas) {
    if (m.texto.length < 40 || ehSensivel(m.texto)) continue;
    const antes = perguntas.filter((p) => p.conversaId === m.conversaId && p.em && m.em && p.em <= m.em).at(-1);
    const pergunta = antes && !ehSensivel(antes.texto) ? `Cliente: ${semDadoSensivel(antes.texto).slice(0, 300)}\n` : "";
    blocos.push(`[WhatsApp] ${pergunta}Nós: ${semDadoSensivel(m.texto).slice(0, 500)}`);
  }
  /* Marca a leitura antes de chamar a IA: duas abas não leem a mesma janela duas vezes. */
  await prisma.acaoDaIA.upsert({
    where: { userId_chave: { userId, chave: marca } },
    create: { userId, chave: marca, tipo: "aviso", origem: "whatsapp", titulo: "Leitura de aprendizados", vistaEm: agora },
    update: { criadaEm: agora, vistaEm: agora },
  });
  return extrairEGuardar(prisma, blocos);
}

/** De quanto em quanto tempo um lote do Slack vira leitura de aprendizado. */
const INTERVALO_DO_SLACK_MS = 10 * 60_000;

/**
 * O Slack ensina sem ser guardado (21/10/2026): "as mensagens do Slack são
 * somente para entender mais, não salvar". O lote que a extensão manda é
 * lido na hora — o que vale como conhecimento geral vira aprendizado, o
 * texto da mensagem é descartado. No máximo uma leitura a cada dez minutos
 * por pessoa; o que chegar no meio só serve para os lembretes.
 */
export async function aprenderDoSlack(prisma: PrismaClient, userId: string, mensagens: { canal: string; texto: string }[], agora = new Date()): Promise<number> {
  if (!temIA()) return 0;
  const blocos = mensagens
    .filter((m) => m.texto.length >= 30 && !ehSensivel(m.texto))
    .map((m) => `[Slack ${m.canal.startsWith("D") ? "privado" : "canal"}] ${semDadoSensivel(m.texto).slice(0, 500)}`);
  if (blocos.length < 2) return 0;

  const marca = `aprendizado-slack:${userId}`;
  const ultima = await prisma.acaoDaIA.findUnique({ where: { userId_chave: { userId, chave: marca } }, select: { criadaEm: true } });
  if (ultima && agora.getTime() - ultima.criadaEm.getTime() < INTERVALO_DO_SLACK_MS) return 0;
  await prisma.acaoDaIA.upsert({
    where: { userId_chave: { userId, chave: marca } },
    create: { userId, chave: marca, tipo: "aviso", origem: "slack", titulo: "Leitura de aprendizados do Slack", vistaEm: agora },
    update: { criadaEm: agora, vistaEm: agora },
  });
  return extrairEGuardar(prisma, blocos);
}

/** A IA lê os trechos, já sem dado sensível, e guarda o que for conhecimento geral. */
async function extrairEGuardar(prisma: PrismaClient, blocos: string[]): Promise<number> {
  if (blocos.length < 2) return 0;

  let r: Awaited<ReturnType<typeof pedirEstruturado>>;
  try {
    r = await pedirEstruturado({
      sistema:
        "Você ajuda o time de reputação da Cardápio Web (cardápio digital e sistema para restaurantes) a guardar o que aprende no dia a dia. Lê trechos de conversas do time com clientes (WhatsApp) e entre o time (Slack) e tira só conhecimento GERAL e duradouro, útil para atender o próximo cliente. Português do Brasil. Nunca inclua nome de cliente ou de pessoa, empresa cliente, telefone, e-mail, documento, valor de um cliente específico, senha ou qualquer dado pessoal. Nunca invente.",
      prompt: [
        "Tire até 8 aprendizados. Bons exemplos: como resolver um problema recorrente; um recurso que o sistema tem ou não tem; uma integração que está fora ou instável; um prazo que o time costuma dar; uma regra de processo combinada entre áreas; um jeito de explicar que funcionou com o cliente.",
        "Não vale: cumprimento, assunto de um cliente só, combinado com uma pessoa, opinião sem fato.",
        "Para cada um: assunto (até 6 palavras, sem nome de ninguém) e texto (1 ou 2 frases, como um colega explicaria). Lista vazia se não houver nada geral.",
        "",
        "Trechos:",
        blocos.join("\n\n").slice(0, TETO_DE_TEXTO),
      ].join("\n"),
      esquema: {
        type: "object",
        properties: {
          aprendizados: {
            type: "array",
            items: { type: "object", properties: { assunto: { type: "string" }, texto: { type: "string" }, fonte: { type: "string", enum: ["whatsapp", "slack"] } }, required: ["assunto", "texto", "fonte"] },
          },
        },
        required: ["aprendizados"],
      },
    });
  } catch {
    return 0;
  }
  if (r.erro || !r.dados) return 0;

  const lista = (Array.isArray(r.dados.aprendizados) ? r.dados.aprendizados : []) as { assunto?: unknown; texto?: unknown; fonte?: unknown }[];
  let guardados = 0;
  for (const a of lista.slice(0, 8)) {
    /* A volta passa pelo mesmo filtro: o que a IA devolveu com dado sensível também não entra. */
    const assunto = semDadoSensivel(String(a.assunto ?? "")).replace(/\s+/g, " ").trim().slice(0, 80);
    const texto = semDadoSensivel(String(a.texto ?? "")).replace(/\s+/g, " ").trim().slice(0, 400);
    const chave = chaveDoAprendizado(assunto);
    if (!assunto || texto.length < 15 || !chave || ehSensivel(`${assunto} ${texto}`) || /\[(documento|e-mail|telefone|número|código)\]/.test(texto)) continue;
    await prisma.aprendizadoDaIA.upsert({
      where: { chave },
      create: { chave, assunto, texto, fonte: a.fonte === "slack" ? "slack" : "whatsapp" },
      update: { texto, vezes: { increment: 1 } },
    });
    guardados += 1;
  }
  return guardados;
}

/**
 * O que o time já sabe sobre um texto, pronto para ir no pedido à IA
 * (22/10/2026). Os aprendizados existiam, mas só a leitura do dia os
 * usava — a sugestão de resposta, o copiloto e a conferência da resposta
 * do Reclame Aqui escreviam sem eles. Vazio quando nada tem a ver.
 */
export async function saberParaOPrompt(prisma: PrismaClient | null, texto: string, maximo = 6): Promise<string> {
  if (!prisma || !texto.trim()) return "";
  const lista = relevantes(await aprendizadosAtivos(prisma), texto, maximo);
  if (!lista.length) return "";
  return [
    "O que o time já aprendeu sobre isso (de outras conversas e dos resultados das respostas — use para acertar o conteúdo; não cite que é um aprendizado):",
    ...lista.map((a) => `- ${a.assunto}: ${a.texto}`),
  ].join("\n");
}

/* ============================================================
   APRENDER COM O RESULTADO DAS RESPOSTAS (22/10/2026)
============================================================ */

/** Uma leitura por dia: as avaliações chegam devagar, e cada leitura é uma chamada de IA. */
const INTERVALO_DAS_AVALIACOES_MS = 24 * 60 * 60_000;
const DIAS_DAS_AVALIACOES = 180;

/**
 * A IA lê as reclamações avaliadas — a resposta pública que demos, a nota,
 * se resolveu, se voltaria e o que o consumidor escreveu ao avaliar — e
 * guarda o que separa a avaliação boa da ruim em cada assunto. É o que
 * transforma o histórico em orientação: "em repasse, dizer o prazo do
 * estorno e o comprovante leva a nota 10; prometer sem prazo leva a 3".
 *
 * Só conhecimento geral: nome, documento e contato saem antes (o
 * `semDadoSensivel` de sempre), e a IA é instruída a não citar caso.
 */
export async function aprenderComAsAvaliacoes(
  prisma: PrismaClient,
  opcoes: { agora?: Date; forcar?: boolean; extrair?: (blocos: string[]) => Promise<number> } = {}
): Promise<number> {
  if (!opcoes.extrair && !temIA()) return 0;
  const agora = opcoes.agora ?? new Date();
  const marca = "aprendizado-avaliacoes";
  const dono = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true }, orderBy: { createdAt: "asc" } }).catch(() => null);
  if (!dono) return 0;
  const ultima = await prisma.acaoDaIA.findUnique({ where: { userId_chave: { userId: dono.id, chave: marca } }, select: { criadaEm: true } });
  if (!opcoes.forcar && ultima && agora.getTime() - ultima.criadaEm.getTime() < INTERVALO_DAS_AVALIACOES_MS) return 0;

  const casos = await prisma.case.findMany({
    where: {
      channel: "RECLAME_AQUI",
      evaluated: true,
      scoreDisregarded: false,
      evaluatedAt: { gte: new Date(agora.getTime() - DIAS_DAS_AVALIACOES * 86_400_000) },
      publicResponse: { not: null },
    },
    select: { score: true, resolved: true, wouldDoBusiness: true, title: true, publicResponse: true, consideracaoFinal: true, category: { select: { name: true } } },
    orderBy: { evaluatedAt: "desc" },
    take: 80,
  });
  /* As duas pontas ensinam mais: as melhores e as piores, de cada lado. */
  const boas = casos.filter((c) => (c.score ?? 0) >= 9 && c.resolved);
  const ruins = casos.filter((c) => (c.score ?? 10) <= 6 || !c.resolved);
  const bloco = (c: (typeof casos)[number], lado: string) =>
    [
      `[${lado}] Assunto: ${c.category?.name ?? "sem categoria"} — "${semDadoSensivel(c.title).slice(0, 120)}"`,
      `Nota ${c.score ?? "—"}, ${c.resolved ? "resolvida" : "não resolvida"}, ${c.wouldDoBusiness ? "voltaria" : "não voltaria"}.`,
      `Nossa resposta pública: ${semDadoSensivel(String(c.publicResponse ?? "")).replace(/\s+/g, " ").slice(0, 600)}`,
      c.consideracaoFinal ? `O consumidor ao avaliar: ${semDadoSensivel(c.consideracaoFinal).slice(0, 300)}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  const blocos = [...boas.slice(0, 14).map((c) => bloco(c, "BOA")), ...ruins.slice(0, 14).map((c) => bloco(c, "RUIM"))].filter((b) => !ehSensivel(b));
  if (blocos.length < 4) return 0;

  await prisma.acaoDaIA.upsert({
    where: { userId_chave: { userId: dono.id, chave: marca } },
    create: { userId: dono.id, chave: marca, tipo: "aviso", origem: "caso", titulo: "Leitura de aprendizados das avaliações", vistaEm: agora },
    update: { criadaEm: agora, vistaEm: agora },
  });
  return opcoes.extrair ? opcoes.extrair(blocos) : extrairDasAvaliacoes(prisma, blocos);
}

async function extrairDasAvaliacoes(prisma: PrismaClient, blocos: string[]): Promise<number> {
  let r: Awaited<ReturnType<typeof pedirEstruturado>>;
  try {
    r = await pedirEstruturado({
      sistema:
        "Você é analista de reputação da Cardápio Web (sistema e cardápio digital para restaurantes). Compara respostas públicas do Reclame Aqui que terminaram em avaliação BOA com as que terminaram em avaliação RUIM e tira o que funciona. Português do Brasil. Nunca cite nome, empresa, protocolo ou valor de um caso; nunca invente.",
      prompt: [
        "Tire até 8 aprendizados sobre o CONTEÚDO, por tema: o que as respostas BOAS ofereceram, explicaram, resolveram ou prometeram (prazo, estorno, configuração, contato da área, comprovante) que as RUINS do mesmo tema não fizeram; e o que o consumidor elogia ou cobra ao avaliar.",
        "NÃO repita regra de forma que o time já confere em toda resposta: saudação com o nome, nome de quem assina, empatia/desculpas genéricas, convite para avaliar, canais de contato, central de ajuda, tom positivo, tamanho do texto. Aprendizado que serviria para qualquer tema não vale.",
        "Para cada um: assunto começando pelo tema (até 6 palavras — ex.: \"Repasse: prazo do estorno\", \"Integração iFood: teste antes de responder\") e texto (1 ou 2 frases, acionável). Lista vazia se os exemplos não mostrarem padrão por tema.",
        "",
        blocos.join("\n\n").slice(0, 12_000),
      ].join("\n"),
      esquema: {
        type: "object",
        properties: { aprendizados: { type: "array", items: { type: "object", properties: { assunto: { type: "string" }, texto: { type: "string" } }, required: ["assunto", "texto"] } } },
        required: ["aprendizados"],
      },
    });
  } catch {
    return 0;
  }
  if (r.erro || !r.dados) return 0;
  const lista = (Array.isArray(r.dados.aprendizados) ? r.dados.aprendizados : []) as { assunto?: unknown; texto?: unknown }[];
  let guardados = 0;
  for (const a of lista.slice(0, 8)) {
    const assunto = semDadoSensivel(String(a.assunto ?? "")).replace(/\s+/g, " ").trim().slice(0, 80);
    const texto = semDadoSensivel(String(a.texto ?? "")).replace(/\s+/g, " ").trim().slice(0, 400);
    const chave = chaveDoAprendizado(assunto);
    if (!assunto || texto.length < 15 || !chave || ehSensivel(`${assunto} ${texto}`) || /\[(documento|e-mail|telefone|número|código)\]/.test(texto)) continue;
    await prisma.aprendizadoDaIA.upsert({
      where: { chave },
      create: { chave, assunto, texto, fonte: "avaliacoes" },
      update: { texto, vezes: { increment: 1 } },
    });
    guardados += 1;
  }
  return guardados;
}

/** Os aprendizados ativos, para a IA usar ao ler uma conversa. */
export async function aprendizadosAtivos(prisma: PrismaClient): Promise<Aprendizado[]> {
  return prisma.aprendizadoDaIA
    .findMany({ where: { ativo: true }, orderBy: [{ vezes: "desc" }, { atualizadoEm: "desc" }], take: 300, select: { assunto: true, texto: true, vezes: true } })
    .catch(() => []);
}
