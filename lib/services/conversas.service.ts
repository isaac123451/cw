import "server-only";

import type { PrismaClient } from "@prisma/client";

import {
  assinatura,
  chaveDoConteudo,
  omitirDadosBancarios,
  type ConversaResumo,
  type ConversaView,
  type Lado,
  type MensagemRecebida,
} from "@/lib/models/conversa";

/**
 * Gravar e ler conversas — o mesmo caminho para a tela (arquivo
 * exportado) e para a extensão ("Guardar a conversa").
 *
 * **Guardar de novo acrescenta só o que é novo.** Cada mensagem tem uma
 * chave (o id do WhatsApp, ou a impressão do conteúdo para o arquivo) e
 * a tabela não aceita a mesma chave duas vezes na mesma conversa. Entre
 * as duas portas — a mesma conversa guardada pela extensão e depois pelo
 * arquivo — as chaves são diferentes, e quem segura a repetição é a
 * assinatura: o mesmo lado, o mesmo minuto e o mesmo começo de texto.
 */

export const MAXIMO_DE_MENSAGENS = 5000;
const MAXIMO_POR_MENSAGEM = 4000;

type Db = PrismaClient;

export function somenteDigitosDoTelefone(valor?: string | null) {
  const d = String(valor ?? "").replace(/\D/g, "");
  return d.length >= 8 ? d : null;
}

/** As conversas que podem ser a mesma: pelo telefone (8 últimos dígitos) ou pelo nome do contato. */
export async function candidatas(prisma: Db, telefone: string | null, contatoNome: string) {
  const ou: object[] = [];
  if (telefone) ou.push({ telefone: { endsWith: telefone.slice(-8) } });
  if (contatoNome.trim()) ou.push({ contatoNome: { equals: contatoNome.trim(), mode: "insensitive" } });
  if (ou.length === 0) return [];
  return prisma.conversa.findMany({
    where: { OR: ou },
    orderBy: { atualizadoEm: "desc" },
    take: 5,
    select: { id: true, contatoNome: true, telefone: true, _count: { select: { mensagens: true } } },
  });
}

export interface ResultadoDaGravacao {
  id: string;
  novas: number;
  repetidas: number;
  omitidos: number;
}

export async function gravarMensagens(
  prisma: Db,
  entrada: {
    destino: "nova" | string;
    telefone?: string | null;
    contatoNome: string;
    nosNome?: string | null;
    origem: "extensao" | "arquivo";
    mensagens: MensagemRecebida[];
    vinculo?: { caseId?: string | null; npsResponseId?: string | null; establishmentId?: string | null };
    autor: string;
  }
): Promise<ResultadoDaGravacao> {
  const telefone = somenteDigitosDoTelefone(entrada.telefone);
  const lados: Lado[] = ["cliente", "nos", "sistema"];

  const limpas = entrada.mensagens
    .slice(-MAXIMO_DE_MENSAGENS)
    .filter((m) => lados.includes(m.de) && typeof m.texto === "string" && m.texto.trim())
    .map((m) => {
      const r = omitirDadosBancarios(m.texto.slice(0, MAXIMO_POR_MENSAGEM));
      const em = m.em && !Number.isNaN(Date.parse(m.em)) ? new Date(m.em).toISOString() : null;
      const base = { de: m.de, autor: m.autor?.slice(0, 120) ?? null, texto: r.texto, em, omitidos: r.omitidos };
      /*
        A chave e a assinatura saem do texto original (antes da omissão):
        guardar de novo precisa reconhecer a mesma mensagem, com ou sem o
        dado bancário que ela tinha.
      */
      return { ...base, chave: m.chave?.slice(0, 200) || chaveDoConteudo({ ...m, em }), assinatura: assinatura({ de: m.de, em, texto: m.texto }) };
    });

  return prisma.$transaction(async (tx) => {
    let id = entrada.destino;
    if (id === "nova") {
      const criada = await tx.conversa.create({
        data: {
          telefone,
          contatoNome: entrada.contatoNome.trim().slice(0, 120),
          nosNome: entrada.nosNome?.slice(0, 120) ?? null,
          guardadaPor: entrada.autor,
          caseId: entrada.vinculo?.caseId ?? null,
          npsResponseId: entrada.vinculo?.npsResponseId ?? null,
          establishmentId: entrada.vinculo?.establishmentId ?? null,
        },
        select: { id: true },
      });
      id = criada.id;
    } else {
      const existe = await tx.conversa.findUnique({ where: { id }, select: { id: true, telefone: true, caseId: true, npsResponseId: true, establishmentId: true } });
      if (!existe) throw new Error("CONVERSA_SUMIU");
      /* O que a conversa ainda não tinha, a gravação completa; o que já tinha, fica. */
      await tx.conversa.update({
        where: { id },
        data: {
          telefone: existe.telefone ?? telefone,
          ...(entrada.nosNome ? { nosNome: entrada.nosNome.slice(0, 120) } : {}),
          ...(existe.caseId || !entrada.vinculo?.caseId ? {} : { caseId: entrada.vinculo.caseId }),
          ...(existe.npsResponseId || !entrada.vinculo?.npsResponseId ? {} : { npsResponseId: entrada.vinculo.npsResponseId }),
          ...(existe.establishmentId || !entrada.vinculo?.establishmentId ? {} : { establishmentId: entrada.vinculo.establishmentId }),
        },
      });
    }

    const existentes = await tx.mensagemDaConversa.findMany({ where: { conversaId: id }, select: { chave: true, de: true, em: true, texto: true } });
    const chaves = new Set(existentes.map((e) => e.chave));
    const assinaturas = new Set(existentes.map((e) => assinatura({ de: e.de, em: e.em?.toISOString(), texto: e.texto })));

    const novas = [];
    for (const m of limpas) {
      /* A gravada já está sem o dado bancário: compara pelas duas formas. */
      const a = assinatura(m);
      if (chaves.has(m.chave) || assinaturas.has(a) || assinaturas.has(m.assinatura)) continue;
      chaves.add(m.chave);
      assinaturas.add(a);
      assinaturas.add(m.assinatura);
      novas.push(m);
    }

    if (novas.length > 0) {
      await tx.mensagemDaConversa.createMany({
        data: novas.map((m) => ({ conversaId: id, chave: m.chave, de: m.de, autor: m.autor, texto: m.texto, em: m.em ? new Date(m.em) : null, origem: entrada.origem })),
        skipDuplicates: true,
      });
      await tx.conversa.update({ where: { id }, data: { atualizadoEm: new Date() } });
    }

    /* Só conta o que de fato entrou: a repetida não foi gravada, nem o dado dela. */
    return { id, novas: novas.length, repetidas: limpas.length - novas.length, omitidos: novas.reduce((n, m) => n + m.omitidos, 0) };
  });
}

/* ============================================================
   AS CONVERSAS DE UM REGISTRO (caso, NPS) E DO DOSSIÊ
============================================================ */

export interface ConversaDoRegistro {
  id: string;
  contatoNome: string;
  mensagens: number;
  ultimaEm?: string;
  /** A última mensagem do cliente — o gancho do pedido de avaliação. */
  ultimaDoCliente?: { texto: string; em?: string };
  resumo?: string;
}

/** As conversas guardadas ligadas a um caso ou a um ciclo de NPS. */
export async function conversasDoRegistro(prisma: Db, alvo: { caseId?: string | null; npsResponseId?: string | null }): Promise<ConversaDoRegistro[]> {
  const ou: object[] = [];
  if (alvo.caseId) ou.push({ caseId: alvo.caseId });
  if (alvo.npsResponseId) ou.push({ npsResponseId: alvo.npsResponseId });
  if (ou.length === 0) return [];
  const linhas = await prisma.conversa.findMany({
    where: { OR: ou },
    orderBy: { atualizadoEm: "desc" },
    take: 5,
    select: {
      id: true,
      contatoNome: true,
      telefone: true,
      resumo: true,
      _count: { select: { mensagens: true } },
      mensagens: { orderBy: [{ em: "desc" }, { criadoEm: "desc" }], take: 30, select: { de: true, texto: true, em: true } },
    },
  });
  return linhas.map((c) => {
    const ultimaDoCliente = c.mensagens.find((m) => m.de === "cliente");
    return {
      id: c.id,
      contatoNome: c.contatoNome || (c.telefone ? `+${c.telefone}` : "Contato"),
      mensagens: c._count.mensagens,
      ultimaEm: c.mensagens[0]?.em?.toISOString(),
      ultimaDoCliente: ultimaDoCliente ? { texto: ultimaDoCliente.texto.slice(0, 280), em: ultimaDoCliente.em?.toISOString() } : undefined,
      resumo: c.resumo ?? undefined,
    };
  });
}

/**
 * As conversas que entram no dossiê: as ligadas ao caso e, quando o
 * painel sabe o telefone inteiro do WhatsApp, as do mesmo número. Cada
 * uma com as últimas mensagens, na ordem em que aconteceram.
 */
export async function conversasParaODossie(prisma: Db, alvo: { caseId?: string | null; telefone?: string | null }) {
  const ou: object[] = [];
  if (alvo.caseId) ou.push({ caseId: alvo.caseId });
  const fone = somenteDigitosDoTelefone(alvo.telefone);
  if (fone) ou.push({ telefone: { endsWith: fone.slice(-8) } });
  if (ou.length === 0) return [];
  const linhas = await prisma.conversa.findMany({
    where: { OR: ou },
    orderBy: { atualizadoEm: "desc" },
    take: 3,
    select: {
      id: true,
      contatoNome: true,
      resumo: true,
      guardadaPor: true,
      _count: { select: { mensagens: true } },
      mensagens: { orderBy: [{ em: "desc" }, { criadoEm: "desc" }], take: 120, select: { de: true, texto: true, em: true } },
    },
  });
  return linhas.map((c) => ({ ...c, mensagens: [...c.mensagens].reverse() }));
}

/* ============================================================
   LEITURA
============================================================ */

const VINCULOS = {
  case: { select: { id: true, protocol: true, channel: true } },
  npsResponse: { select: { id: true, customerName: true, customer: true, score: true } },
  establishment: { select: { id: true, name: true, slug: true } },
} as const;

type LinhaDaConversa = {
  id: string;
  contatoNome: string;
  telefone: string | null;
  nosNome: string | null;
  resumo: string | null;
  resumoEm: Date | null;
  resumoPor: string | null;
  guardadaPor: string;
  atualizadoEm: Date;
  case: { id: string; protocol: string; channel: string } | null;
  npsResponse: { id: string; customerName: string | null; customer: string; score: number } | null;
  establishment: { id: string; name: string; slug: string } | null;
};

function resumoDe(c: LinhaDaConversa, total: number, ultima?: { em: Date | null; texto: string }): ConversaResumo {
  return {
    id: c.id,
    contatoNome: c.contatoNome || (c.telefone ? `+${c.telefone}` : "Contato sem nome"),
    telefone: c.telefone ?? undefined,
    mensagens: total,
    ultimaEm: ultima?.em?.toISOString(),
    ultimoTexto: ultima?.texto.slice(0, 140),
    caso: c.case ? { id: c.case.id, protocolo: c.case.protocol, frente: c.case.channel === "RECLAME_AQUI" ? "Reclame Aqui" : "Redes Sociais" } : undefined,
    nps: c.npsResponse ? { id: c.npsResponse.id, cliente: c.npsResponse.customerName || c.npsResponse.customer, nota: c.npsResponse.score } : undefined,
    estabelecimento: c.establishment ? { id: c.establishment.id, nome: c.establishment.name, slug: c.establishment.slug } : undefined,
    temResumo: Boolean(c.resumo),
    guardadaPor: c.guardadaPor,
    atualizadoEm: c.atualizadoEm.toISOString(),
  };
}

export async function listar(prisma: Db, termo: string) {
  const t = termo.trim();
  const digitos = t.replace(/\D/g, "");
  const where = t
    ? {
        OR: [
          { contatoNome: { contains: t, mode: "insensitive" as const } },
          ...(digitos.length >= 4 ? [{ telefone: { contains: digitos } }] : []),
          { mensagens: { some: { texto: { contains: t, mode: "insensitive" as const } } } },
          { case: { protocol: { contains: t, mode: "insensitive" as const } } },
          { establishment: { name: { contains: t, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const linhas = await prisma.conversa.findMany({
    where,
    orderBy: { atualizadoEm: "desc" },
    take: 200,
    include: {
      ...VINCULOS,
      _count: { select: { mensagens: true } },
      mensagens: { orderBy: [{ em: "desc" }, { criadoEm: "desc" }], take: 1, select: { em: true, texto: true } },
    },
  });
  return linhas.map((c) => resumoDe(c, c._count.mensagens, c.mensagens[0]));
}

export async function ler(prisma: Db, id: string): Promise<ConversaView | null> {
  const c = await prisma.conversa.findUnique({
    where: { id },
    include: { ...VINCULOS, mensagens: { orderBy: [{ em: "asc" }, { criadoEm: "asc" }] } },
  });
  if (!c) return null;
  const lista = c.mensagens.map((m) => ({
    id: m.id,
    de: (["cliente", "nos", "sistema"].includes(m.de) ? m.de : "cliente") as Lado,
    autor: m.autor ?? undefined,
    texto: m.texto,
    em: m.em?.toISOString(),
    origem: (m.origem === "arquivo" ? "arquivo" : "extensao") as "arquivo" | "extensao",
  }));
  const ultima = c.mensagens[c.mensagens.length - 1];
  return {
    ...resumoDe(c, c.mensagens.length, ultima),
    nosNome: c.nosNome ?? undefined,
    resumo: c.resumo ?? undefined,
    resumoEm: c.resumoEm?.toISOString(),
    resumoPor: c.resumoPor ?? undefined,
    lista,
  };
}
