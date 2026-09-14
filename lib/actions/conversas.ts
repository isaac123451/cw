"use server";

import { requireRole, SemPermissao, tryRole } from "@/lib/auth/guard";

import { pedirEstruturado } from "@/lib/services/ia.service";
import {
  candidatas,
  gravarMensagens,
  ler,
  listar,
  MAXIMO_DE_MENSAGENS,
  somenteDigitosDoTelefone,
} from "@/lib/services/conversas.service";

import { assinatura, chaveDoConteudo, omitirDadosBancarios, type ConversaResumo, type ConversaView, type MensagemRecebida } from "@/lib/models/conversa";

/**
 * Conversas do WhatsApp guardadas: a tela de conversas e a importação do
 * arquivo que o WhatsApp exporta. Tudo com resposta (`{ ok }` ou o erro
 * em português) — a tela só confirma depois dela.
 */

type Falha = { ok: false; erro: string };

async function agente() {
  try {
    const ctx = await requireRole("AGENTE", "conversas");
    if (!ctx) return { erro: "Sem banco configurado — nada é gravado no modo demonstração." } as const;
    return { ctx } as const;
  } catch (erro) {
    return { erro: erro instanceof SemPermissao ? erro.message : "Não foi possível confirmar sua sessão. Entre de novo." } as const;
  }
}

async function nomeDe(ctx: { prisma: NonNullable<Awaited<ReturnType<typeof tryRole>>>["prisma"]; userId: string }) {
  const u = await ctx.prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } });
  return u?.name ?? "Operação";
}

export async function listarConversas(termo = ""): Promise<{ ok: true; conversas: ConversaResumo[] } | Falha> {
  const ctx = await tryRole("LEITURA", "conversas");
  if (!ctx) return { ok: false, erro: "Sem sessão ou sem acesso às conversas." };
  try {
    return { ok: true, conversas: await listar(ctx.prisma, termo.slice(0, 120)) };
  } catch (erro) {
    console.error("[conversas] listar", erro);
    return { ok: false, erro: "O banco não respondeu agora. Se o servidor acabou de ser atualizado, reinicie o npm run dev." };
  }
}

export async function lerConversa(id: string): Promise<{ ok: true; conversa: ConversaView } | Falha> {
  const ctx = await tryRole("LEITURA", "conversas");
  if (!ctx) return { ok: false, erro: "Sem sessão ou sem acesso às conversas." };
  try {
    const conversa = await ler(ctx.prisma, id);
    return conversa ? { ok: true, conversa } : { ok: false, erro: "Esta conversa não existe mais." };
  } catch (erro) {
    console.error("[conversas] ler", erro);
    return { ok: false, erro: "O banco não respondeu agora." };
  }
}

/**
 * A prévia antes de guardar o arquivo: com que conversa ele pode se
 * juntar, e quantas mensagens são novas em cada caso. Não grava nada.
 */
export async function previaDaGravacao(entrada: {
  telefone?: string | null;
  contatoNome: string;
  mensagens: MensagemRecebida[];
}): Promise<{ ok: true; candidatas: { id: string; contatoNome: string; telefone?: string; mensagens: number; novas: number }[] } | Falha> {
  const ctx = await tryRole("LEITURA", "conversas");
  if (!ctx) return { ok: false, erro: "Sem sessão ou sem acesso às conversas." };
  try {
    const lista = await candidatas(ctx.prisma, somenteDigitosDoTelefone(entrada.telefone), entrada.contatoNome);
    const resultado = [];
    for (const c of lista) {
      const existentes = await ctx.prisma.mensagemDaConversa.findMany({ where: { conversaId: c.id }, select: { chave: true, de: true, em: true, texto: true } });
      const chaves = new Set(existentes.map((e) => e.chave));
      const assinaturas = new Set(existentes.map((e) => assinatura({ de: e.de, em: e.em?.toISOString(), texto: e.texto })));
      /* O gravado está sem o dado bancário: compara também com o texto já omitido, como a gravação faz. */
      const novas = entrada.mensagens.filter(
        (m) =>
          !chaves.has(m.chave || chaveDoConteudo(m)) &&
          !assinaturas.has(assinatura(m)) &&
          !assinaturas.has(assinatura({ ...m, texto: omitirDadosBancarios(m.texto).texto }))
      ).length;
      resultado.push({ id: c.id, contatoNome: c.contatoNome, telefone: c.telefone ?? undefined, mensagens: c._count.mensagens, novas });
    }
    return { ok: true, candidatas: resultado };
  } catch (erro) {
    console.error("[conversas] prévia", erro);
    return { ok: false, erro: "O banco não respondeu à prévia agora." };
  }
}

/** Guarda as mensagens (do arquivo) numa conversa nova ou numa existente, sem repetir. */
export async function guardarConversa(entrada: {
  destino: "nova" | string;
  telefone?: string | null;
  contatoNome: string;
  nosNome?: string | null;
  mensagens: MensagemRecebida[];
}): Promise<{ ok: true; id: string; novas: number; repetidas: number; omitidos: number } | Falha> {
  if (!entrada.contatoNome.trim() && !somenteDigitosDoTelefone(entrada.telefone)) return { ok: false, erro: "Diga de quem é a conversa (nome ou telefone)." };
  if (entrada.mensagens.length === 0) return { ok: false, erro: "Não há mensagens para guardar." };
  if (entrada.mensagens.length > MAXIMO_DE_MENSAGENS) return { ok: false, erro: `A conversa passa de ${MAXIMO_DE_MENSAGENS} mensagens — exporte um período menor.` };

  const quem = await agente();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const r = await gravarMensagens(quem.ctx.prisma, { ...entrada, origem: "arquivo", autor: await nomeDe(quem.ctx) });
    return { ok: true, ...r };
  } catch (erro) {
    if (erro instanceof Error && erro.message === "CONVERSA_SUMIU") return { ok: false, erro: "A conversa escolhida não existe mais. Guarde como nova." };
    console.error("[conversas] guardar", erro);
    return { ok: false, erro: "O banco não aceitou a gravação agora. Tente de novo em instantes." };
  }
}

/** Liga (ou desliga) a conversa a um caso, a um ciclo de NPS e a um estabelecimento. */
export async function vincularConversa(
  id: string,
  vinculo: { caseId: string | null; npsResponseId: string | null; establishmentId: string | null }
): Promise<{ ok: true; conversa: ConversaView } | Falha> {
  const quem = await agente();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };
  const prisma = quem.ctx.prisma;
  try {
    const [caso, nps, estab] = await Promise.all([
      vinculo.caseId ? prisma.case.findUnique({ where: { id: vinculo.caseId }, select: { id: true } }) : null,
      vinculo.npsResponseId ? prisma.npsResponse.findUnique({ where: { id: vinculo.npsResponseId }, select: { id: true } }) : null,
      vinculo.establishmentId ? prisma.establishment.findUnique({ where: { id: vinculo.establishmentId }, select: { id: true } }) : null,
    ]);
    if ((vinculo.caseId && !caso) || (vinculo.npsResponseId && !nps) || (vinculo.establishmentId && !estab)) return { ok: false, erro: "O registro escolhido não existe mais." };
    const r = await prisma.conversa.updateMany({ where: { id }, data: { caseId: vinculo.caseId, npsResponseId: vinculo.npsResponseId, establishmentId: vinculo.establishmentId } });
    if (r.count === 0) return { ok: false, erro: "Esta conversa não existe mais." };
    const conversa = await ler(prisma, id);
    return { ok: true, conversa: conversa! };
  } catch (erro) {
    console.error("[conversas] vincular", erro);
    return { ok: false, erro: "O banco não aceitou o vínculo agora." };
  }
}

/** O que dá para vincular: casos (RA e redes), ciclos de NPS e estabelecimentos, pelo termo. */
export async function buscarParaVincular(termo: string): Promise<
  | {
      ok: true;
      casos: { id: string; protocolo: string; cliente: string; frente: string }[];
      nps: { id: string; cliente: string; nota: number; quando: string }[];
      estabelecimentos: { id: string; nome: string }[];
    }
  | Falha
> {
  const ctx = await tryRole("LEITURA", "conversas");
  if (!ctx) return { ok: false, erro: "Sem sessão." };
  const t = termo.trim();
  if (t.length < 2) return { ok: true, casos: [], nps: [], estabelecimentos: [] };
  try {
    const [casos, nps, estabelecimentos] = await Promise.all([
      ctx.prisma.case.findMany({
        where: { OR: [{ protocol: { contains: t, mode: "insensitive" } }, { customer: { contains: t, mode: "insensitive" } }, { companyName: { contains: t, mode: "insensitive" } }] },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: { id: true, protocol: true, customer: true, channel: true },
      }),
      ctx.prisma.npsResponse.findMany({
        where: { OR: [{ customerName: { contains: t, mode: "insensitive" } }, { customer: { contains: t, mode: "insensitive" } }, { email: { contains: t, mode: "insensitive" } }, { company: { contains: t, mode: "insensitive" } }] },
        orderBy: { respondedAt: "desc" },
        take: 8,
        select: { id: true, customerName: true, customer: true, score: true, respondedAt: true },
      }),
      ctx.prisma.establishment.findMany({
        where: { name: { contains: t, mode: "insensitive" } },
        orderBy: { name: "asc" },
        take: 8,
        select: { id: true, name: true },
      }),
    ]);
    return {
      ok: true,
      casos: casos.map((c) => ({ id: c.id, protocolo: c.protocol, cliente: c.customer, frente: c.channel === "RECLAME_AQUI" ? "Reclame Aqui" : "Redes Sociais" })),
      nps: nps.map((n) => ({ id: n.id, cliente: n.customerName || n.customer, nota: n.score, quando: n.respondedAt.toISOString() })),
      estabelecimentos: estabelecimentos.map((e) => ({ id: e.id, nome: e.name })),
    };
  } catch (erro) {
    console.error("[conversas] buscar vínculos", erro);
    return { ok: false, erro: "A busca não respondeu agora." };
  }
}

const ESQUEMA_DO_RESUMO = {
  type: "object",
  properties: {
    resumo: { type: "string", description: "O que aconteceu na conversa, em 3 a 6 frases, em português." },
    pendencia: { type: "string", description: "O que ficou pendente, ou vazio." },
    proximoPasso: { type: "string", description: "O próximo passo da operação, ou vazio." },
  },
  required: ["resumo", "pendencia", "proximoPasso"],
} as const;

/**
 * O resumo da conversa pela IA — **só para ler**. Não grava: quem
 * decide guardar é a pessoa, no Salvar (`salvarResumo`).
 */
export async function resumirConversa(id: string): Promise<{ ok: true; resumo: string; provedor: string } | Falha> {
  const ctx = await tryRole("LEITURA", "conversas");
  if (!ctx) return { ok: false, erro: "Sem sessão." };
  const conversa = await ler(ctx.prisma, id).catch(() => null);
  if (!conversa) return { ok: false, erro: "Esta conversa não existe mais." };
  if (conversa.lista.length === 0) return { ok: false, erro: "A conversa não tem mensagens." };

  /* O fim da conversa é o que importa: as últimas 150 mensagens, cada uma com teto. */
  const transcricao = conversa.lista
    .slice(-150)
    .map((m) => `${m.de === "nos" ? "Nós" : m.de === "sistema" ? "Sistema" : "Cliente"}${m.em ? ` (${m.em.slice(0, 16).replace("T", " ")})` : ""}: ${m.texto.slice(0, 800)}`)
    .join("\n");

  const r = await pedirEstruturado({
    sistema:
      "Você lê conversas de WhatsApp entre a equipe de Reputação da Cardápio Web (sistema para restaurantes) e um cliente. Resuma com fatos da conversa, sem inventar, sem dados pessoais (CPF, telefone, e-mail, dados bancários).",
    prompt: `Contato: ${conversa.contatoNome}\n${conversa.caso ? `Caso: ${conversa.caso.protocolo}\n` : ""}\nConversa:\n${transcricao}`,
    esquema: ESQUEMA_DO_RESUMO as unknown as Record<string, unknown>,
    rapido: true,
  });
  if (r.erro || !r.dados) return { ok: false, erro: r.erro ?? "A IA não respondeu agora." };

  const d = r.dados as { resumo?: string; pendencia?: string; proximoPasso?: string };
  const texto = [d.resumo?.trim(), d.pendencia?.trim() && `Pendência: ${d.pendencia.trim()}`, d.proximoPasso?.trim() && `Próximo passo: ${d.proximoPasso.trim()}`].filter(Boolean).join("\n\n");
  return { ok: true, resumo: texto, provedor: r.provedor };
}

export async function salvarResumo(id: string, resumo: string): Promise<{ ok: true; conversa: ConversaView } | Falha> {
  const texto = resumo.trim().slice(0, 4000);
  const quem = await agente();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };
  try {
    const r = await quem.ctx.prisma.conversa.updateMany({
      where: { id },
      data: texto ? { resumo: texto, resumoEm: new Date(), resumoPor: await nomeDe(quem.ctx) } : { resumo: null, resumoEm: null, resumoPor: null },
    });
    if (r.count === 0) return { ok: false, erro: "Esta conversa não existe mais." };
    return { ok: true, conversa: (await ler(quem.ctx.prisma, id))! };
  } catch (erro) {
    console.error("[conversas] salvar resumo", erro);
    return { ok: false, erro: "O banco não aceitou o resumo agora." };
  }
}

export async function excluirConversa(id: string): Promise<{ ok: true } | Falha> {
  const quem = await agente();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };
  try {
    const r = await quem.ctx.prisma.conversa.deleteMany({ where: { id } });
    if (r.count === 0) return { ok: false, erro: "Esta conversa já não existia." };
    return { ok: true };
  } catch (erro) {
    console.error("[conversas] excluir", erro);
    return { ok: false, erro: "O banco não aceitou a exclusão agora." };
  }
}
