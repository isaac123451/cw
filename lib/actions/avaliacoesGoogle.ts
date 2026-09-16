"use server";

import { updateTag } from "next/cache";

import type { Prisma } from "@prisma/client";

import { WORKSPACE_TAG } from "@/lib/actions/tags";
import { requireRole, SemPermissao, tryRole } from "@/lib/auth/guard";

import type { Prioridade } from "@/lib/models/case";
import {
  EXCECOES_GOOGLE,
  type Classificacao,
  type MotivoDeUrgencia,
  type StatusDaAvaliacao,
} from "@/lib/models/avaliacoesGoogle";
import { semelhanca } from "@/lib/services/lgpd";
import {
  gravarAvaliacaoDoGoogle,
  problemaDaAvaliacao,
  type NovaAvaliacaoDoGoogle,
} from "@/lib/services/avaliacoesGoogle.service";

/**
 * Avaliações do Google: registrar, responder, tratar, encerrar.
 *
 * Tudo com resposta do servidor e erro em português. A classificação é
 * refeita aqui, e não confiada à tela: a reincidência ("o mesmo problema
 * em várias avaliações recentes") depende das outras avaliações, que só
 * o banco tem.
 */

type Falha = { ok: false; erro: string };

export interface AvaliacaoGoogleView {
  id: string;
  estrelas: number;
  autor: string;
  texto?: string;
  link?: string;
  publicadaEm: string;
  identificado: boolean;
  classificacao: Classificacao;
  criticidade: Prioridade;
  motivosDeUrgencia: MotivoDeUrgencia[];
  resposta?: string;
  respondidaEm?: string;
  tratativaCanal?: string;
  tratativaResultado?: string;
  notaAtualizada?: number;
  causaRaiz?: string;
  status: StatusDaAvaliacao;
  excecao?: string;
  printDaDenuncia?: string;
  caso?: { protocolo: string; id: string; titulo: string };
  promotorNps?: { id: string; nome: string };
  registradaPor: string;
  createdAt: string;
}

type Linha = Prisma.AvaliacaoGoogleGetPayload<{
  include: {
    case: { select: { protocol: true; externalId: true; id: true; title: true } };
    npsResponse: { select: { id: true; customerName: true; customer: true } };
  };
}>;

const INCLUIR = {
  case: { select: { protocol: true, externalId: true, id: true, title: true } },
  npsResponse: { select: { id: true, customerName: true, customer: true } },
} as const;

function paraView(a: Linha): AvaliacaoGoogleView {
  return {
    id: a.id,
    estrelas: a.estrelas,
    autor: a.autor,
    texto: a.texto ?? undefined,
    link: a.link ?? undefined,
    publicadaEm: a.publicadaEm.toISOString(),
    identificado: a.identificado,
    classificacao: a.classificacao as Classificacao,
    criticidade: a.criticidade as Prioridade,
    motivosDeUrgencia: a.motivosDeUrgencia as MotivoDeUrgencia[],
    resposta: a.resposta ?? undefined,
    respondidaEm: a.respondidaEm?.toISOString(),
    tratativaCanal: a.tratativaCanal ?? undefined,
    tratativaResultado: a.tratativaResultado ?? undefined,
    notaAtualizada: a.notaAtualizada ?? undefined,
    causaRaiz: a.causaRaiz ?? undefined,
    status: a.status as StatusDaAvaliacao,
    excecao: a.excecao ?? undefined,
    printDaDenuncia: a.printDaDenuncia ?? undefined,
    caso: a.case ? { protocolo: a.case.protocol, id: a.case.externalId ?? a.case.id, titulo: a.case.title } : undefined,
    promotorNps: a.npsResponse ? { id: a.npsResponse.id, nome: a.npsResponse.customerName ?? a.npsResponse.customer } : undefined,
    registradaPor: a.registradaPor,
    createdAt: a.createdAt.toISOString(),
  };
}

async function quemGrava() {
  try {
    const ctx = await requireRole("AGENTE", "reclame-aqui");
    if (!ctx) return { erro: "Sem banco configurado — nada é gravado no modo demonstração." } as const;
    const pessoa = await ctx.prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } });
    return { ctx, nome: pessoa?.name ?? "—" } as const;
  } catch (erro) {
    return { erro: erro instanceof SemPermissao ? erro.message : "Não foi possível confirmar sua sessão. Entre de novo." } as const;
  }
}

function falha(erro: unknown, contexto: string): Falha {
  console.error(`[google] ${contexto}`, erro);
  return { ok: false, erro: "O banco não aceitou a gravação agora. Tente de novo em instantes." };
}

/* ============================================================
   LEITURA
============================================================ */

export async function listarAvaliacoesGoogle(): Promise<AvaliacaoGoogleView[]> {
  const ctx = await tryRole("LEITURA", "reclame-aqui");
  if (!ctx) return [];
  const linhas = await ctx.prisma.avaliacaoGoogle.findMany({ include: INCLUIR, orderBy: { publicadaEm: "desc" }, take: 1000 });
  return linhas.map(paraView);
}

/** A resposta já publicada mais parecida com esta — contra a resposta genérica. */
export async function semelhancaComPublicadas(entrada: { id: string; texto: string }): Promise<number> {
  const ctx = await tryRole("LEITURA", "reclame-aqui");
  if (!ctx || entrada.texto.trim().length < 60) return 0;
  const outras = await ctx.prisma.avaliacaoGoogle.findMany({
    where: { id: { not: entrada.id }, resposta: { not: null } },
    select: { resposta: true },
    orderBy: { respondidaEm: "desc" },
    take: 300,
  });
  return outras.reduce((max, o) => Math.max(max, semelhanca(entrada.texto, o.resposta ?? "")), 0);
}

/* ============================================================
   REGISTRO
============================================================ */

export async function registrarAvaliacaoGoogle(
  entrada: NovaAvaliacaoDoGoogle
): Promise<{ ok: true; avaliacao: AvaliacaoGoogleView } | Falha> {

  const problema = problemaDaAvaliacao(entrada);
  if (problema) return { ok: false, erro: problema };

  const quem = await quemGrava();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    /* A regra mora no serviço: a extensão registra pelo mesmo caminho. */
    const { criada, promotor } = await gravarAvaliacaoDoGoogle(
      quem.ctx.prisma,
      entrada,
      quem.nome
    );

    if (promotor) updateTag(WORKSPACE_TAG);

    return { ok: true, avaliacao: paraView(criada) };
  } catch (erro) {
    return falha(erro, "registrar");
  }
}

/* ============================================================
   RESPOSTA, TRATATIVA, ENCERRAMENTO
============================================================ */

export async function responderAvaliacaoGoogle(entrada: {
  id: string;
  resposta: string;
}): Promise<{ ok: true; avaliacao: AvaliacaoGoogleView } | Falha> {

  const resposta = entrada.resposta.trim();
  if (resposta.length < 20) return { ok: false, erro: "Escreva a resposta publicada no Google, como ela ficou no ar." };

  const quem = await quemGrava();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const atual = await quem.ctx.prisma.avaliacaoGoogle.findUnique({ where: { id: entrada.id }, select: { respondidaEm: true, classificacao: true, status: true } });
    if (!atual) return { ok: false, erro: "Esta avaliação não existe mais." };

    const salva = await quem.ctx.prisma.avaliacaoGoogle.update({
      where: { id: entrada.id },
      data: {
        resposta: resposta.slice(0, 4000),
        /* A data é a da primeira publicação; corrigir o texto não a muda. */
        respondidaEm: atual.respondidaEm ?? new Date(),
        /*
          Positiva e neutra encerram com a resposta — não há tratativa
          privada a fazer. A negativa segue aberta até a tratativa.
        */
        status: atual.status === "aberta" && atual.classificacao !== "negativa" ? "respondida" : atual.status,
      },
      include: INCLUIR,
    });

    return { ok: true, avaliacao: paraView(salva) };
  } catch (erro) {
    return falha(erro, "responder");
  }
}

const RESULTADOS_DA_TRATATIVA = ["resolvido", "sem-retorno", "sem-identificacao", "em-andamento"] as const;

export async function registrarTratativaGoogle(entrada: {
  id: string;
  canal: string;
  resultado: string;
  notaAtualizada?: number | null;
  causaRaiz?: string;
}): Promise<{ ok: true; avaliacao: AvaliacaoGoogleView } | Falha> {

  if (!RESULTADOS_DA_TRATATIVA.includes(entrada.resultado as (typeof RESULTADOS_DA_TRATATIVA)[number])) {
    return { ok: false, erro: "Escolha o resultado da tratativa privada." };
  }

  if (entrada.notaAtualizada != null && !(Number.isInteger(entrada.notaAtualizada) && entrada.notaAtualizada >= 1 && entrada.notaAtualizada <= 5)) {
    return { ok: false, erro: "A nota atualizada vai de 1 a 5." };
  }

  const quem = await quemGrava();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const atual = await quem.ctx.prisma.avaliacaoGoogle.findUnique({ where: { id: entrada.id }, select: { respondidaEm: true } });
    if (!atual) return { ok: false, erro: "Esta avaliação não existe mais." };

    /* O final do documento que cada resultado fecha. */
    const status: StatusDaAvaliacao | undefined =
      entrada.resultado === "sem-retorno"
        ? "sem-retorno"
        : entrada.resultado === "sem-identificacao"
          ? "sem-identificacao"
          : entrada.resultado === "resolvido" && atual.respondidaEm
            ? "respondida"
            : undefined;

    const salva = await quem.ctx.prisma.avaliacaoGoogle.update({
      where: { id: entrada.id },
      data: {
        tratativaCanal: entrada.canal.trim().slice(0, 40) || null,
        tratativaResultado: entrada.resultado,
        notaAtualizada: entrada.notaAtualizada ?? null,
        ...(entrada.causaRaiz !== undefined ? { causaRaiz: entrada.causaRaiz.trim() || null } : {}),
        ...(status ? { status } : {}),
      },
      include: INCLUIR,
    });

    return { ok: true, avaliacao: paraView(salva) };
  } catch (erro) {
    return falha(erro, "tratativa");
  }
}

export async function denunciarAvaliacaoGoogle(entrada: {
  id: string;
  excecao: string;
  /** O link do print guardado — o documento pede a prova antes da denúncia. */
  print: string;
}): Promise<{ ok: true; avaliacao: AvaliacaoGoogleView } | Falha> {

  if (!EXCECOES_GOOGLE.some((e) => e.id === entrada.excecao)) return { ok: false, erro: "Diga por que a avaliação é imprópria." };

  const print = entrada.print.trim();
  if (!/^https?:\/\/\S+$/i.test(print)) {
    return { ok: false, erro: "Cole o link do print (Drive, Slack…): se o Google remover a avaliação, a prova some junto." };
  }

  const quem = await quemGrava();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const salva = await quem.ctx.prisma.avaliacaoGoogle.update({
      where: { id: entrada.id },
      data: { status: "denunciada", excecao: entrada.excecao, printDaDenuncia: print.slice(0, 1000) },
      include: INCLUIR,
    });
    return { ok: true, avaliacao: paraView(salva) };
  } catch (erro) {
    return falha(erro, "denunciar");
  }
}

export async function vincularCasoGoogle(entrada: {
  id: string;
  protocolo: string;
}): Promise<{ ok: true; avaliacao: AvaliacaoGoogleView } | Falha> {

  const protocolo = entrada.protocolo.trim();

  const quem = await quemGrava();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const caso = protocolo
      ? await quem.ctx.prisma.case.findFirst({
          where: { OR: [{ protocol: protocolo }, { externalId: protocolo }] },
          select: { id: true },
        })
      : null;

    if (protocolo && !caso) return { ok: false, erro: `Nenhum caso com o protocolo ${protocolo}.` };

    const salva = await quem.ctx.prisma.avaliacaoGoogle.update({
      where: { id: entrada.id },
      data: { caseId: caso?.id ?? null },
      include: INCLUIR,
    });
    return { ok: true, avaliacao: paraView(salva) };
  } catch (erro) {
    return falha(erro, "vincular caso");
  }
}

/** Apagar registro feito por engano — só enquanto não foi respondido. */
export async function apagarAvaliacaoGoogle(id: string): Promise<{ ok: true } | Falha> {

  const quem = await quemGrava();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const atual = await quem.ctx.prisma.avaliacaoGoogle.findUnique({ where: { id }, select: { respondidaEm: true, npsResponseId: true } });
    if (!atual) return { ok: false, erro: "Esta avaliação já tinha sido apagada." };
    if (atual.respondidaEm) return { ok: false, erro: "Avaliação respondida é registro do indicador — não se apaga." };

    await quem.ctx.prisma.avaliacaoGoogle.delete({ where: { id } });
    return { ok: true };
  } catch (erro) {
    return falha(erro, "apagar");
  }
}

