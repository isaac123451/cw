"use server";

import { requireRole, SemPermissao, tryRole } from "@/lib/auth/guard";

import { updateTag } from "next/cache";

import { CASES_TAG } from "@/lib/actions/tags";
import { pedirEstruturado } from "@/lib/services/ia.service";
import { retratarConversaSemIA } from "@/lib/services/motorProprio";
import {
  candidatas,
  conversasDoRegistro,
  corrigirLados,
  gravarMensagens,
  ler,
  listar,
  MAXIMO_DE_MENSAGENS,
  somenteDigitosDoTelefone,
  sugestoesPeloTelefone,
  type ConversaDoRegistro,
  type SugestoesDeVinculo,
} from "@/lib/services/conversas.service";
import { gravarContato, problemaDoContato } from "@/lib/services/tratativa.service";

import * as XLSX from "xlsx";

import {
  assinatura,
  chaveDoConteudo,
  omitirDadosBancarios,
  planilhaDaConversa,
  textoDaConversaExportada,
  type ConversaResumo,
  type ConversaView,
  type MensagemRecebida,
} from "@/lib/models/conversa";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

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

/**
 * Casos, ciclos de NPS e estabelecimentos com o mesmo telefone da
 * conversa — só os que ela ainda não tem ligados.
 */
export async function sugestoesDeVinculo(id: string): Promise<({ ok: true } & SugestoesDeVinculo) | Falha> {
  const ctx = await tryRole("LEITURA", "conversas");
  if (!ctx) return { ok: false, erro: "Sem sessão." };
  try {
    const c = await ctx.prisma.conversa.findUnique({ where: { id }, select: { telefone: true, caseId: true, npsResponseId: true, establishmentId: true } });
    if (!c) return { ok: false, erro: "Esta conversa não existe mais." };
    const s = await sugestoesPeloTelefone(ctx.prisma, c.telefone);
    return {
      ok: true,
      casos: s.casos.filter((x) => x.id !== c.caseId),
      nps: s.nps.filter((x) => x.id !== c.npsResponseId),
      estabelecimentos: s.estabelecimentos.filter((x) => x.id !== c.establishmentId),
    };
  } catch (erro) {
    console.error("[conversas] sugestões de vínculo", erro);
    return { ok: false, erro: "As sugestões não carregaram agora." };
  }
}

/** Qual autor é o nosso lado — regrava a direção das mensagens (ver `corrigirLados`). */
export async function corrigirLadosDaConversa(
  id: string,
  entrada: { nosso: string; avisos: boolean }
): Promise<{ ok: true; conversa: ConversaView; nossas: number; deles: number; avisos: number } | Falha> {
  const quem = await agente();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };
  const nosso = String(entrada.nosso ?? "").trim();
  if (!nosso) return { ok: false, erro: "Escolha qual autor é o nosso lado." };
  try {
    const r = await corrigirLados(quem.ctx.prisma, id, { nosso, avisos: Boolean(entrada.avisos) });
    if (!r) return { ok: false, erro: "Esta conversa não existe mais." };
    const conversa = await ler(quem.ctx.prisma, id);
    return { ok: true, conversa: conversa!, ...r };
  } catch (erro) {
    console.error("[conversas] corrigir lados", erro);
    return { ok: false, erro: "O banco não aceitou a correção agora. Nada foi mudado." };
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
  /*
    Nenhuma IA respondeu (sem chave, fila, cota): o motor próprio lê a
    mesma conversa pelas regras da documentação, em vez de a tela parar
    em "a IA não respondeu". É rascunho do mesmo jeito — a pessoa revisa
    e decide se salva.
  */
  const d: { resumo?: string; pendencia?: string; proximoPasso?: string } =
    r.erro || !r.dados
      ? retratarConversaSemIA(
          conversa.lista
            .filter((m) => m.de !== "sistema")
            .slice(-150)
            .map((m) => ({ de: m.de === "nos" ? ("nos" as const) : ("cliente" as const), texto: m.texto })),
          { nome: conversa.contatoNome }
        )
      : (r.dados as { resumo?: string; pendencia?: string; proximoPasso?: string });

  const texto = [d.resumo?.trim(), d.pendencia?.trim() && `Pendência: ${d.pendencia.trim()}`, d.proximoPasso?.trim() && `Próximo passo: ${d.proximoPasso.trim()}`].filter(Boolean).join("\n\n");
  if (!texto) return { ok: false, erro: r.erro ?? "A conversa não tem texto para resumir." };
  return { ok: true, resumo: texto, provedor: r.erro || !r.dados ? "motor-proprio" : r.provedor };
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

/**
 * A conversa marca o passo que ela prova, no caso ligado.
 *
 * "contato": o 1º contato, com a hora da nossa mensagem que teve
 * resposta; "validacao": o cliente confirmou, com a hora da mensagem
 * dele. Grava pelo mesmo caminho do "Registrar contato" da ficha — o
 * relógio do caso e a trilha mudam juntos —, com a mensagem citada na
 * anotação.
 */
export async function registrarEvidencia(entrada: {
  conversaId: string;
  mensagemId: string;
  tipo: "contato" | "validacao";
}): Promise<{ ok: true; protocolo: string } | Falha> {
  const quem = await agente();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };
  const prisma = quem.ctx.prisma;

  try {
    const conversa = await prisma.conversa.findUnique({
      where: { id: entrada.conversaId },
      select: { caseId: true, case: { select: { protocol: true, primeiroContatoEm: true, validadoEm: true } } },
    });
    if (!conversa) return { ok: false, erro: "Esta conversa não existe mais." };
    if (!conversa.caseId || !conversa.case) return { ok: false, erro: "Vincule a conversa a um caso antes de marcar o passo." };
    if (entrada.tipo === "contato" && conversa.case.primeiroContatoEm) return { ok: false, erro: "O caso já tem o 1º contato registrado." };
    if (entrada.tipo === "validacao" && conversa.case.validadoEm) return { ok: false, erro: "O caso já tem a validação do cliente registrada." };

    const msg = await prisma.mensagemDaConversa.findFirst({
      where: { id: entrada.mensagemId, conversaId: entrada.conversaId },
      select: { de: true, texto: true, em: true },
    });
    if (!msg) return { ok: false, erro: "A mensagem não existe mais nesta conversa." };
    if (!msg.em) return { ok: false, erro: "Esta mensagem não tem a hora — registre o passo pela ficha do caso." };
    if (entrada.tipo === "contato" && msg.de !== "nos") return { ok: false, erro: "O 1º contato é uma mensagem nossa." };
    if (entrada.tipo === "validacao" && msg.de !== "cliente") return { ok: false, erro: "A validação é uma mensagem do cliente." };

    const nota = `Pela conversa do WhatsApp guardada na plataforma: "${msg.texto.replace(/\s+/g, " ").slice(0, 300)}"`;
    const entradaDoContato = { tipo: entrada.tipo, canal: "WhatsApp", resultado: "respondeu", em: msg.em.toISOString(), nota };
    const problema = problemaDoContato(entradaDoContato);
    if (problema) return { ok: false, erro: problema };

    await gravarContato(prisma, { caseId: conversa.caseId, entrada: entradaDoContato, autorId: quem.ctx.userId, autorNome: await nomeDe(quem.ctx) });
    updateTag(CASES_TAG);
    return { ok: true, protocolo: conversa.case.protocol };
  } catch (erro) {
    console.error("[conversas] evidência", erro);
    return { ok: false, erro: "O banco não aceitou o registro agora. Tente de novo em instantes." };
  }
}

/** O que a conversa ligada a um caso prova, e o que o caso já tem — para a tela oferecer só o que falta. */
export async function evidenciaDoCaso(conversaId: string): Promise<
  { ok: true; caso: { protocolo: string; frente: string; primeiroContatoEm?: string; validadoEm?: string } | null } | Falha
> {
  const ctx = await tryRole("LEITURA", "conversas");
  if (!ctx) return { ok: false, erro: "Sem sessão." };
  const c = await ctx.prisma.conversa
    .findUnique({ where: { id: conversaId }, select: { case: { select: { protocol: true, channel: true, primeiroContatoEm: true, validadoEm: true } } } })
    .catch(() => null);
  if (!c) return { ok: false, erro: "Esta conversa não existe mais." };
  return {
    ok: true,
    caso: c.case
      ? {
          protocolo: c.case.protocol,
          frente: c.case.channel === "RECLAME_AQUI" ? "Reclame Aqui" : "Redes Sociais",
          primeiroContatoEm: c.case.primeiroContatoEm?.toISOString(),
          validadoEm: c.case.validadoEm?.toISOString(),
        }
      : null,
  };
}

/** As conversas guardadas de um caso ou de um ciclo de NPS — para a ficha e o pedido de avaliação. */
export async function conversasGuardadasDe(alvo: { protocolo?: string; npsId?: string }): Promise<{ ok: true; conversas: ConversaDoRegistro[] } | Falha> {
  const ctx = await tryRole("LEITURA", "conversas");
  if (!ctx) return { ok: true, conversas: [] };
  try {
    const caso = alvo.protocolo ? await ctx.prisma.case.findUnique({ where: { protocol: alvo.protocolo }, select: { id: true } }) : null;
    return { ok: true, conversas: await conversasDoRegistro(ctx.prisma, { caseId: caso?.id ?? null, npsResponseId: alvo.npsId ?? null }) };
  } catch (erro) {
    console.error("[conversas] do registro", erro);
    return { ok: false, erro: "Não foi possível ler as conversas guardadas." };
  }
}

/**
 * A conversa como arquivo: .txt no formato do WhatsApp ou .xlsx.
 *
 * O .txt é o mesmo formato do "Exportar conversa" — abre em qualquer
 * lugar, dá para anexar num chamado ou num processo, e **volta para cá**
 * pela importação, sem duplicar o que já está guardado. O .xlsx é para
 * quem vai ler em planilha: uma mensagem por linha, com data, hora,
 * quem falou e de onde a mensagem veio.
 */
export async function exportarConversa(
  id: string,
  formato: "txt" | "xlsx"
): Promise<{ ok: true; arquivo: string; nome: string; mensagens: number } | Falha> {
  const ctx = await tryRole("LEITURA", "conversas");
  if (!ctx) return { ok: false, erro: "Sem sessão ou sem acesso às conversas." };

  try {
    const conversa = await ler(ctx.prisma, id);
    if (!conversa) return { ok: false, erro: "Esta conversa não existe mais." };
    if (conversa.lista.length === 0) return { ok: false, erro: "A conversa não tem mensagens para exportar." };

    const usuario = await ctx.prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } });
    const quem = usuario?.name ?? "Operação";

    /* O nome do arquivo é o do WhatsApp: é por ele que a importação reconhece o contato. */
    const contato = (conversa.contatoNome || "contato").replace(/[\/:*?"<>|]/g, "-").slice(0, 60);
    const base = `Conversa do WhatsApp com ${contato} — ${hojeNaOperacao()}`;

    if (formato === "txt") {
      const texto = textoDaConversaExportada(conversa, { exportadaPor: quem, exportadaEm: new Date().toISOString() });
      return { ok: true, arquivo: Buffer.from(texto, "utf8").toString("base64"), nome: `${base}.txt`, mensagens: conversa.lista.length };
    }

    const sheet = XLSX.utils.json_to_sheet(planilhaDaConversa(conversa));
    sheet["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 22 }, { wch: 90 }, { wch: 18 }];
    sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Conversa");
    const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;

    return { ok: true, arquivo: buffer.toString("base64"), nome: `${base}.xlsx`, mensagens: conversa.lista.length };
  } catch (erro) {
    console.error("[conversas] exportar", erro);
    return { ok: false, erro: "Não foi possível montar o arquivo agora. Tente de novo em instantes." };
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
