import type { PrismaClient } from "@prisma/client";

import { chaveDoAprendizado, ehSensivel, semDadoSensivel, type Aprendizado } from "@/lib/models/aprendizados";
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

/** Os aprendizados ativos, para a IA usar ao ler uma conversa. */
export async function aprendizadosAtivos(prisma: PrismaClient): Promise<Aprendizado[]> {
  return prisma.aprendizadoDaIA
    .findMany({ where: { ativo: true }, orderBy: [{ vezes: "desc" }, { atualizadoEm: "desc" }], take: 300, select: { assunto: true, texto: true, vezes: true } })
    .catch(() => []);
}
