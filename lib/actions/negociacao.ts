"use server";

import { updateTag } from "next/cache";

import type { Prisma } from "@prisma/client";

import { CASES_TAG, WORKSPACE_TAG } from "@/lib/actions/tags";
import { requireRole, SemPermissao, tryRole } from "@/lib/auth/guard";
import type { Modulo } from "@/lib/auth/modules";

import { prioridadeNormalizada, type Prioridade } from "@/lib/models/case";
import {
  calcularRenegociacao,
  CHECKLIST_DA_RENEGOCIACAO,
  mesDaOperacao,
  modeloDeOferta,
  MOTIVOS_DE_OFERTA,
  precisaDeValidacao,
  prontoParaOferta,
  type CalculoDaRenegociacao,
  type ModeloDeNegociacao,
  type NegociacaoView,
  type ResumoDoMes,
  type StatusDaNegociacao,
  type TipoDeNegociacao,
} from "@/lib/models/negociacao";
import { instanteDe } from "@/lib/services/horasUteis";

/**
 * Ofertas e renegociações, gravadas com a resposta do servidor.
 *
 * O Impacto grava por sincronização em segundo plano; aqui não. Uma
 * oferta registrada é um compromisso com o cliente, e a tela só diz
 * "registrada" depois que o banco disse. Erro volta como valor, em
 * português.
 */

const MODULO: Modulo = "reclame-aqui";

type Falha = { ok: false; erro: string };

const PRIORIDADE_DO_ENUM: Record<string, Prioridade> = {
  CRITICA: "Urgente",
  ALTA: "Alta",
  MEDIA: "Normal",
  BAIXA: "Normal",
};

async function quemGrava() {
  try {
    const ctx = await requireRole("AGENTE", MODULO);

    if (!ctx) return { erro: "Sem banco configurado — nada é gravado no modo demonstração." } as const;

    const pessoa = await ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { name: true },
    });

    return { ctx, nome: pessoa?.name ?? "—" } as const;
  } catch (erro) {
    return {
      erro: erro instanceof SemPermissao ? erro.message : "Não foi possível confirmar sua sessão. Entre de novo.",
    } as const;
  }
}

function falha(erro: unknown, contexto: string): Falha {
  console.error(`[negociacao] ${contexto}`, erro);
  return { ok: false, erro: "O banco não aceitou a gravação agora. Tente de novo em instantes." };
}

type Linha = Prisma.NegociacaoGetPayload<{
  include: { case: { select: { protocol: true; title: true; externalId: true; id: true } } };
}>;

function paraView(n: Linha): NegociacaoView {
  return {
    id: n.id,
    tipo: n.tipo as TipoDeNegociacao,
    modelo: n.modelo as ModeloDeNegociacao,
    cliente: n.cliente,
    descricao: n.descricao,
    valorCents: n.valorCents,
    motivos: n.motivos,
    calculo: (n.calculo as unknown as NegociacaoView["calculo"]) ?? undefined,
    validadoPor: n.validadoPor ?? undefined,
    validaAte: n.validaAte?.toISOString(),
    status: n.status as StatusDaNegociacao,
    respondidaEm: n.respondidaEm?.toISOString(),
    checklist: n.checklist,
    impactoId: n.impactoId ?? undefined,
    autorNome: n.autorNome,
    criadoEm: n.criadoEm.toISOString(),
    caso: n.case
      ? { protocolo: n.case.protocol, titulo: n.case.title, id: n.case.externalId ?? n.case.id }
      : undefined,
  };
}

const INCLUIR = { case: { select: { protocol: true, title: true, externalId: true, id: true } } } as const;

/** O começo e o fim do mês da operação (Brasília), como instantes. */
function limitesDoMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  const proximo = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
  return { de: instanteDe(`${mes}-01`, 0), ate: instanteDe(`${proximo}-01`, 0) };
}

/* ============================================================
   LEITURA
============================================================ */

export async function listarNegociacoes(protocol: string): Promise<NegociacaoView[]> {

  const ctx = await tryRole("LEITURA", MODULO);
  if (!ctx || !protocol) return [];

  const linhas = await ctx.prisma.negociacao.findMany({
    where: { case: { protocol } },
    include: INCLUIR,
    orderBy: { criadoEm: "desc" },
  });

  return linhas.map(paraView);
}

/**
 * O mês em números: ofertas, renegociações (propostas e aplicadas) e o
 * que foi concedido. É o contador do "mais de uma vez no mês".
 */
export async function resumoDoMes(mes?: string): Promise<ResumoDoMes & { lista: NegociacaoView[] }> {

  const alvo = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : mesDaOperacao(new Date());
  const vazio = { mes: alvo, ofertas: 0, renegociacoes: 0, aplicadas: 0, concedidoCents: 0, retidos: 0, lista: [] };

  const ctx = await tryRole("LEITURA", MODULO);
  if (!ctx) return vazio;

  const { de, ate } = limitesDoMes(alvo);

  const linhas = await ctx.prisma.negociacao.findMany({
    where: { criadoEm: { gte: de, lt: ate } },
    include: { ...INCLUIR, impacto: { select: { wouldHaveChurned: true } } },
    orderBy: { criadoEm: "desc" },
  });

  const lista = linhas.map(paraView);
  const aceitas = lista.filter((n) => n.status === "aceita" || n.status === "concluida");

  return {
    mes: alvo,
    ofertas: lista.filter((n) => n.tipo === "oferta").length,
    renegociacoes: lista.filter((n) => n.tipo === "renegociacao").length,
    aplicadas: aceitas.filter((n) => n.tipo === "renegociacao").length,
    concedidoCents: aceitas.reduce((s, n) => s + n.valorCents, 0),
    retidos: linhas.filter((n) => n.impacto?.wouldHaveChurned === true).length,
    lista,
  };
}

/* ============================================================
   OFERTA
============================================================ */

export async function registrarOferta(entrada: {
  protocol: string;
  modelo: string;
  descricao: string;
  valorCents: number;
  motivos: string[];
  validadoPor?: string;
}): Promise<{ ok: true; negociacao: NegociacaoView; foraDoPadrao: boolean } | Falha> {

  const modelo = modeloDeOferta(entrada.modelo);
  if (!modelo) return { ok: false, erro: "Escolha o modelo da oferta." };

  const descricao = entrada.descricao.trim();
  if (descricao.length < 6) return { ok: false, erro: "Descreva a oferta como ela vai ser apresentada ao cliente." };

  if (!Number.isInteger(entrada.valorCents) || entrada.valorCents < 0 || entrada.valorCents > 100_000_000) {
    return { ok: false, erro: "O custo estimado precisa ser um valor em reais, zero ou mais." };
  }

  const motivos = [...new Set(entrada.motivos)].filter((m) => MOTIVOS_DE_OFERTA.some((x) => x.id === m));
  if (motivos.length === 0) {
    return { ok: false, erro: "Marque o que justifica a oferta — o documento pede impacto real na experiência do cliente." };
  }

  const quem = await quemGrava();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const caso = await quem.ctx.prisma.case.findUnique({
      where: { protocol: entrada.protocol },
      select: {
        id: true,
        priority: true,
        customer: true,
        companyName: true,
        triadaEm: true,
        primeiroContatoEm: true,
        establishmentId: true,
        establishment: { select: { name: true, mrrCents: true } },
      },
    });

    if (!caso) return { ok: false, erro: `O caso ${entrada.protocol} não existe mais.` };

    /*
      "Nunca como primeira abordagem." A regra vale no servidor também:
      a extensão ou uma aba antiga não passam por cima dela.
    */
    const pronto = prontoParaOferta({
      triadaEm: caso.triadaEm?.toISOString(),
      primeiroContatoEm: caso.primeiroContatoEm?.toISOString(),
    });

    if (!pronto.pronto) {
      return { ok: false, erro: `A oferta vem depois da condução do caso. Falta ${pronto.falta.join(" e ")}.` };
    }

    const prioridade = PRIORIDADE_DO_ENUM[caso.priority] ?? prioridadeNormalizada(caso.priority);

    const foraDoPadrao = precisaDeValidacao({
      prioridade,
      modelo: modelo.id,
      valorCents: entrada.valorCents,
      mensalidadeCents: caso.establishment?.mrrCents,
    });

    const validadoPor = entrada.validadoPor?.trim() || null;

    if (foraDoPadrao && (!validadoPor || validadoPor.length < 3)) {
      return {
        ok: false,
        erro: "Esta condição está fora do padrão da criticidade: diga quem validou antes de apresentar ao cliente.",
      };
    }

    const criada = await quem.ctx.prisma.negociacao.create({
      data: {
        caseId: caso.id,
        establishmentId: caso.establishmentId,
        cliente: caso.establishment?.name ?? caso.companyName ?? caso.customer,
        tipo: "oferta",
        modelo: modelo.id,
        descricao: descricao.slice(0, 1000),
        valorCents: entrada.valorCents,
        motivos,
        validadoPor: foraDoPadrao ? validadoPor : null,
        autorNome: quem.nome,
      },
      include: INCLUIR,
    });

    updateTag(CASES_TAG);

    return { ok: true, negociacao: paraView(criada), foraDoPadrao };
  } catch (erro) {
    return falha(erro, "oferta");
  }
}

/* ============================================================
   RENEGOCIAÇÃO
============================================================ */

export async function registrarRenegociacao(entrada: {
  protocol: string;
  plano: string;
  pagoCents: number;
  inicio: string;
  fim: string;
  solicitacao: string;
  /** "2026-09-30T18:00", hora de Brasília. */
  validaAte: string;
  autorizadoPor: string;
}): Promise<{ ok: true; negociacao: NegociacaoView; doMes: number } | Falha> {

  const calculo = calcularRenegociacao(entrada);
  if ("erro" in calculo) return { ok: false, erro: calculo.erro };

  const autorizadoPor = entrada.autorizadoPor.trim();
  if (autorizadoPor.length < 3) {
    return { ok: false, erro: "A renegociação só existe com autorização expressa da gestão: diga quem autorizou." };
  }

  const plano = entrada.plano.trim();
  if (plano.length < 3) return { ok: false, erro: "Informe o plano contratado." };

  const validade = entrada.validaAte.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  const validaAte = validade ? instanteDe(validade[1], Number(validade[2]) * 60 + Number(validade[3])) : null;

  if (!validaAte) return { ok: false, erro: "Informe até quando a proposta vale — data e hora." };
  if (validaAte.getTime() <= Date.now()) return { ok: false, erro: "A validade da proposta já passou." };

  const quem = await quemGrava();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const caso = await quem.ctx.prisma.case.findUnique({
      where: { protocol: entrada.protocol },
      select: {
        id: true,
        customer: true,
        companyName: true,
        establishmentId: true,
        establishment: { select: { name: true } },
      },
    });

    if (!caso) return { ok: false, erro: `O caso ${entrada.protocol} não existe mais.` };

    const guardado: CalculoDaRenegociacao & { plano: string } = { ...calculo, plano };

    const criada = await quem.ctx.prisma.negociacao.create({
      data: {
        caseId: caso.id,
        establishmentId: caso.establishmentId,
        cliente: caso.establishment?.name ?? caso.companyName ?? caso.customer,
        tipo: "renegociacao",
        modelo: "renegociacao",
        descricao: `Renegociação do plano ${plano}: restituição de ${(calculo.finalCents / 100).toFixed(2).replace(".", ",")} via Pix.`,
        valorCents: calculo.finalCents,
        calculo: guardado as unknown as Prisma.InputJsonValue,
        validadoPor: autorizadoPor,
        validaAte,
        /* Quem autorizou está registrado: o primeiro item do checklist nasce feito. */
        checklist: ["autorizacao"],
        autorNome: quem.nome,
      },
      include: INCLUIR,
    });

    const { de, ate } = limitesDoMes(mesDaOperacao(new Date()));
    const doMes = await quem.ctx.prisma.negociacao.count({
      where: { tipo: "renegociacao", criadoEm: { gte: de, lt: ate } },
    });

    updateTag(CASES_TAG);

    return { ok: true, negociacao: paraView(criada), doMes };
  } catch (erro) {
    return falha(erro, "renegociação");
  }
}

export async function marcarChecklist(entrada: {
  id: string;
  item: string;
  feito: boolean;
}): Promise<{ ok: true; negociacao: NegociacaoView } | Falha> {

  if (!CHECKLIST_DA_RENEGOCIACAO.some((c) => c.id === entrada.item)) {
    return { ok: false, erro: "Item de checklist desconhecido." };
  }

  const quem = await quemGrava();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const atual = await quem.ctx.prisma.negociacao.findUnique({
      where: { id: entrada.id },
      select: { checklist: true, status: true, tipo: true },
    });

    if (!atual) return { ok: false, erro: "Esta negociação não existe mais." };
    if (atual.tipo !== "renegociacao") return { ok: false, erro: "O checklist é da renegociação." };

    /* Pedir ao financeiro e confirmar o recebimento só existem depois do aceite. */
    if (entrada.feito && ["financeiro", "recebimento"].includes(entrada.item) && atual.status === "proposta") {
      return { ok: false, erro: "Registre primeiro que o cliente aceitou a proposta." };
    }

    const checklist = entrada.feito
      ? [...new Set([...atual.checklist, entrada.item])]
      : atual.checklist.filter((c) => c !== entrada.item);

    /* O recebimento confirmado encerra a renegociação. */
    const status =
      atual.status === "aceita" && checklist.includes("recebimento")
        ? "concluida"
        : atual.status === "concluida" && !checklist.includes("recebimento")
          ? "aceita"
          : atual.status;

    const salva = await quem.ctx.prisma.negociacao.update({
      where: { id: entrada.id },
      data: { checklist, status },
      include: INCLUIR,
    });

    updateTag(CASES_TAG);

    return { ok: true, negociacao: paraView(salva) };
  } catch (erro) {
    return falha(erro, "checklist");
  }
}

/* ============================================================
   RESPOSTA DO CLIENTE
============================================================ */

const TIPO_NO_IMPACTO: Record<TipoDeNegociacao, string> = {
  oferta: "Oferta concedida",
  renegociacao: "Renegociação",
};

/**
 * O cliente aceitou ou recusou.
 *
 * Aceita, a negociação vira lançamento de custo em Impacto, ligado ao
 * caso e ao estabelecimento — com as duas perguntas que separam retenção
 * de cortesia: o cliente teria cancelado? como ficou depois?
 */
export async function responderNegociacao(entrada: {
  id: string;
  resultado: "aceita" | "recusada";
  teriaCancelado?: boolean | null;
  humor?: number | null;
}): Promise<{ ok: true; negociacao: NegociacaoView } | Falha> {

  if (entrada.humor != null && !(Number.isInteger(entrada.humor) && entrada.humor >= 1 && entrada.humor <= 5)) {
    return { ok: false, erro: "Como o cliente ficou vai de 1 a 5." };
  }

  const quem = await quemGrava();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const atual = await quem.ctx.prisma.negociacao.findUnique({ where: { id: entrada.id } });

    if (!atual) return { ok: false, erro: "Esta negociação não existe mais." };
    if (atual.status !== "proposta") {
      return { ok: false, erro: "Esta negociação já foi respondida." };
    }

    if (entrada.resultado === "recusada") {
      const salva = await quem.ctx.prisma.negociacao.update({
        where: { id: atual.id },
        data: { status: "recusada", respondidaEm: new Date() },
        include: INCLUIR,
      });
      updateTag(CASES_TAG);
      return { ok: true, negociacao: paraView(salva) };
    }

    const tipo = TIPO_NO_IMPACTO[atual.tipo as TipoDeNegociacao] ?? "Oferta concedida";

    /* O tipo de custo existe ou nasce agora — sem trocar a direção de quem já existe. */
    const existente = await quem.ctx.prisma.impactType.findUnique({ where: { name: tipo } });
    if (!existente) {
      await quem.ctx.prisma.impactType.create({
        data: {
          name: tipo,
          direction: "custo",
          description:
            tipo === "Renegociação"
              ? "Restituição proporcional em renegociação autorizada pela gestão."
              : "Desconto, cortesia ou estorno dado para resolver.",
          order: 10,
        },
      });
    }

    const impacto = await quem.ctx.prisma.impactRecord.create({
      data: {
        type: tipo,
        companyName: atual.cliente,
        description: atual.descricao,
        amountCents: -Math.abs(atual.valorCents),
        owner: quem.nome,
        date: new Date(),
        establishmentId: atual.establishmentId,
        caseId: atual.caseId,
        moodAfter: entrada.humor ?? null,
        wouldHaveChurned: entrada.teriaCancelado ?? null,
      },
      select: { id: true },
    });

    const salva = await quem.ctx.prisma.negociacao.update({
      where: { id: atual.id },
      data: { status: "aceita", respondidaEm: new Date(), impactoId: impacto.id },
      include: INCLUIR,
    });

    updateTag(CASES_TAG);
    updateTag(WORKSPACE_TAG);

    return { ok: true, negociacao: paraView(salva) };
  } catch (erro) {
    return falha(erro, "resposta da negociação");
  }
}

/** Apagar uma negociação registrada por engano — só enquanto é proposta. */
export async function apagarNegociacao(id: string): Promise<{ ok: true } | Falha> {

  const quem = await quemGrava();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const atual = await quem.ctx.prisma.negociacao.findUnique({ where: { id }, select: { status: true } });

    if (!atual) return { ok: false, erro: "Esta negociação já tinha sido apagada." };
    if (atual.status !== "proposta") {
      return { ok: false, erro: "Negociação respondida é registro financeiro — não se apaga. Ajuste o lançamento em Impacto, se preciso." };
    }

    await quem.ctx.prisma.negociacao.delete({ where: { id } });
    updateTag(CASES_TAG);

    return { ok: true };
  } catch (erro) {
    return falha(erro, "apagar negociação");
  }
}
