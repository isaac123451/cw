"use server";

import { updateTag } from "next/cache";

import { CASES_TAG, WORKSPACE_TAG } from "@/lib/actions/tags";
import { requireRole, SemPermissao, tryRole } from "@/lib/auth/guard";
import type { Modulo } from "@/lib/auth/modules";

import {
  ANY_CATEGORY,
  mesmaRegra,
  PRAZOS_DA_DOCUMENTACAO,
  slaRuleDoBanco,
  type SlaRule,
} from "@/lib/models/sla";
import type { ContatoView, ResultadoDoContato, ResumoDosContatos } from "@/lib/models/tratativa";

import { expedienteValido, type Expediente } from "@/lib/services/horasUteis";
import type { Prisma } from "@prisma/client";
import type { Prioridade } from "@/lib/models/case";
import { digitosDoDocumento, linkDoPortal, type Establishment } from "@/lib/models/establishment";
import { conversasDoRegistro } from "@/lib/services/conversas.service";
import { slugify } from "@/lib/services/slug";
import type { CaseMovement, PrazosDeArea } from "@/lib/models/movement";
import { AREAS_INTERNAS } from "@/lib/models/mensagens";
import { LIMITE_DE_REPETICAO, semelhanca } from "@/lib/services/lgpd";
import { RESPOSTA_SINTETICA } from "@/lib/services/raMarcadores";
import { diaNaOperacao } from "@/lib/services/reputation.service";
import { esquecerExpediente, prazosDeAreaDoBanco } from "@/lib/services/operacao.service";
import {
  contatosDoCaso,
  gravarContato,
  problemaDoContato,
  marcarSemRetorno,
  removerContato,
  triar,
  type NovoContato,
  type ResultadoDaTriagem,
} from "@/lib/services/tratativa.service";

/**
 * As ações da tratativa: triagem, contatos, prazos e expediente.
 *
 * **Erro volta como valor.** Em produção o Next troca a mensagem de
 * qualquer exceção de server action por um texto genérico — e "An error
 * occurred in the Server Components render" não diz a quem está na tela
 * se faltou permissão, se a data está no futuro ou se o banco caiu.
 * Cada ação devolve `{ ok: false, erro }` em português.
 */

const MODULO: Modulo = "reclame-aqui";

type Falha = { ok: false; erro: string };

async function quemGrava(minimo: "AGENTE" | "ADMIN" = "AGENTE", modulo?: Modulo) {
  try {
    const ctx = await requireRole(minimo, modulo);

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
  console.error(`[tratativa] ${contexto}`, erro);
  return { ok: false, erro: "O banco não aceitou a gravação agora. Tente de novo em instantes." };
}

/* ============================================================
   TRIAGEM
============================================================ */

export async function triarCaso(entrada: {
  protocol: string;
  prioridade: string;
  criterios: string[];
}): Promise<({ ok: true } & ResultadoDaTriagem) | Falha> {

  const quem = await quemGrava("AGENTE", MODULO);
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const caso = await quem.ctx.prisma.case.findUnique({
      where: { protocol: entrada.protocol },
      select: { id: true },
    });

    if (!caso) return { ok: false, erro: `O caso ${entrada.protocol} não existe mais.` };

    const feito = await triar(quem.ctx.prisma, {
      caseId: caso.id,
      prioridade: entrada.prioridade,
      criterios: entrada.criterios,
      autorNome: quem.nome,
    });

    updateTag(CASES_TAG);

    return { ok: true, ...feito };
  } catch (erro) {
    return falha(erro, "triagem");
  }
}

/* ============================================================
   CONTATOS
============================================================ */

export async function listarContatos(protocol: string): Promise<ContatoView[]> {

  const ctx = await tryRole("LEITURA", MODULO);

  if (!ctx || !protocol) return [];

  const caso = await ctx.prisma.case.findUnique({
    where: { protocol },
    select: { id: true },
  });

  return caso ? contatosDoCaso(ctx.prisma, caso.id) : [];
}

export async function registrarContato(
  entrada: NovoContato & { protocol: string }
): Promise<{ ok: true; contato: ContatoView; resumo: ResumoDosContatos } | Falha> {

  const problema = problemaDoContato(entrada);
  if (problema) return { ok: false, erro: problema };

  const quem = await quemGrava("AGENTE", MODULO);
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const caso = await quem.ctx.prisma.case.findUnique({
      where: { protocol: entrada.protocol },
      select: { id: true },
    });

    if (!caso) return { ok: false, erro: `O caso ${entrada.protocol} não existe mais.` };

    const feito = await gravarContato(quem.ctx.prisma, {
      caseId: caso.id,
      entrada,
      autorId: quem.ctx.userId,
      autorNome: quem.nome,
    });

    updateTag(CASES_TAG);

    return { ok: true, ...feito };
  } catch (erro) {
    return falha(erro, "contato");
  }
}

/**
 * A tentativa aguardando retorno vira "sem retorno" — só depois de 2
 * horas. É o que faz a tentativa contar na cadência de persistência.
 */
export async function marcarTentativaSemRetorno(entrada: {
  id: string;
  resultado: ResultadoDoContato;
}): Promise<{ ok: true; contato: ContatoView; resumo: ResumoDosContatos } | Falha> {

  const quem = await quemGrava("AGENTE", MODULO);
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const feito = await marcarSemRetorno(quem.ctx.prisma, entrada.id, entrada.resultado);
    if (!feito) return { ok: false, erro: "Este contato não existe mais." };
    if ("erro" in feito) return { ok: false, erro: feito.erro };
    updateTag(CASES_TAG);
    return { ok: true, ...feito };
  } catch (erro) {
    return falha(erro, "sem retorno");
  }
}

export async function apagarContato(
  id: string
): Promise<{ ok: true; resumo: ResumoDosContatos } | Falha> {

  const quem = await quemGrava("AGENTE", MODULO);
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    /*
      Só quem registrou, ou um administrador.

      Apagar o contato de outra pessoa reescreve a história do caso — e
      a meta de 1º contato dela com ele.
    */
    const contato = await quem.ctx.prisma.caseContato.findUnique({
      where: { id },
      select: { autorId: true },
    });

    if (!contato) return { ok: false, erro: "Este contato já tinha sido apagado." };

    if (contato.autorId !== quem.ctx.userId && quem.ctx.role !== "ADMIN") {
      return { ok: false, erro: "Só quem registrou o contato, ou um administrador, pode apagá-lo." };
    }

    const feito = await removerContato(quem.ctx.prisma, id);

    updateTag(CASES_TAG);

    return feito
      ? { ok: true, resumo: feito.resumo }
      : { ok: false, erro: "Este contato já tinha sido apagado." };
  } catch (erro) {
    return falha(erro, "apagar contato");
  }
}

/* ============================================================
   PRAZOS DA DOCUMENTAÇÃO
============================================================ */

/**
 * Grava os prazos da documentação: cria o que falta, atualiza o que
 * já existe com a mesma frente, prioridade e alcance.
 *
 * Regra que a operação criou para outra combinação — uma categoria
 * específica, por exemplo — não é tocada.
 */
export async function aplicarPrazosDaDocumentacao(): Promise<
  { ok: true; criadas: number; atualizadas: number; regras: SlaRule[] } | Falha
> {

  const quem = await quemGrava("ADMIN");
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const existentes = await quem.ctx.prisma.slaRule.findMany();

    let criadas = 0;
    let atualizadas = 0;

    for (const prazo of PRAZOS_DA_DOCUMENTACAO) {

      const igual = existentes.find((r) => mesmaRegra(slaRuleDoBanco(r), prazo));

      const dados = {
        category: prazo.category || ANY_CATEGORY,
        priority: prazo.priority ?? null,
        canal: prazo.canal ?? null,
        seguidoresMin: prazo.seguidoresMin ?? null,
        responseHours: prazo.responseHours,
        solutionHours: prazo.solutionHours,
        note: prazo.note ?? null,
        active: true,
      };

      if (igual) {
        await quem.ctx.prisma.slaRule.update({ where: { id: igual.id }, data: dados });
        atualizadas += 1;
      } else {
        await quem.ctx.prisma.slaRule.create({ data: dados });
        criadas += 1;
      }
    }

    updateTag(WORKSPACE_TAG);

    /* A lista inteira volta: os ids novos só o banco conhece. */
    const regras = (await quem.ctx.prisma.slaRule.findMany()).map(slaRuleDoBanco);

    return { ok: true, criadas, atualizadas, regras };
  } catch (erro) {
    return falha(erro, "prazos da documentação");
  }
}

/* ============================================================
   EXPEDIENTE
============================================================ */

export async function salvarExpediente(
  entrada: Expediente
): Promise<{ ok: true; expediente: Expediente } | Falha> {

  const quem = await quemGrava("ADMIN");
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  const valido = expedienteValido(entrada);

  /*
    O que não faz sentido é recusado aqui, e não trocado em silêncio pelo
    padrão: quem salvou 18h–08h precisa saber que não foi isso que ficou.
  */
  if (
    valido.inicioMin !== entrada.inicioMin ||
    valido.fimMin !== entrada.fimMin ||
    valido.dias.length !== new Set(entrada.dias).size
  ) {
    return {
      ok: false,
      erro: "O expediente precisa abrir antes de fechar, ter pelo menos meia hora e um dia útil na semana.",
    };
  }

  try {
    await quem.ctx.prisma.operacaoConfig.upsert({
      where: { id: "unico" },
      update: {
        expedienteInicio: valido.inicioMin,
        expedienteFim: valido.fimMin,
        diasUteis: valido.dias,
        pularFacultativos: valido.pularFacultativos,
        updatedBy: quem.nome,
      },
      create: {
        id: "unico",
        expedienteInicio: valido.inicioMin,
        expedienteFim: valido.fimMin,
        diasUteis: valido.dias,
        pularFacultativos: valido.pularFacultativos,
        updatedBy: quem.nome,
      },
    });

    esquecerExpediente();
    updateTag(WORKSPACE_TAG);

    return { ok: true, expediente: valido };
  } catch (erro) {
    return falha(erro, "expediente");
  }
}

/* ============================================================
   PASSOS MARCADOS À MÃO — imersão
============================================================ */

/**
 * Marca (ou desmarca) um passo que só a pessoa sabe que fez.
 *
 * A imersão (Passo 2) não deixa rastro em lugar nenhum que a plataforma
 * leia. O clique carimba quem e quando — e desmarcar existe porque
 * clique errado acontece.
 */
export async function marcarPasso(entrada: {
  protocol: string;
  passo: "imersao";
  desfazer?: boolean;
}): Promise<{ ok: true; em?: string; por?: string } | Falha> {

  const quem = await quemGrava("AGENTE", MODULO);
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const agora = new Date();
    const valor = entrada.desfazer ? null : agora;
    const por = entrada.desfazer ? null : quem.nome;

    await quem.ctx.prisma.case.update({
      where: { protocol: entrada.protocol },
      data: { imersaoEm: valor, imersaoPor: por },
      select: { id: true },
    });

    updateTag(CASES_TAG);

    return entrada.desfazer
      ? { ok: true }
      : { ok: true, em: agora.toISOString(), por: quem.nome };
  } catch (erro) {
    return falha(erro, `passo ${entrada.passo}`);
  }
}

/**
 * Tira (ou devolve) o caso da fila de pedir avaliação.
 *
 * **Por que existe.** A cadência da documentação insiste por até 6
 * meses, e nem todo caso merece insistência: o consumidor pediu para
 * não ser mais procurado, a reclamação era duplicada, o caso foi
 * resolvido por fora. Sem uma saída, a fila de hoje acumulava linhas que
 * ninguém ia tratar — e uma fila com lixo dentro deixa de ser lida.
 *
 * Não apaga nada: os pedidos já registrados continuam na lista de
 * contatos e na contagem. O que muda é a cadência parar de chamar este
 * caso. Desfazer devolve à fila no mesmo ponto em que estava.
 */
export async function dispensarPedidoDeAvaliacao(entrada: {
  protocol: string;
  desfazer?: boolean;
}): Promise<{ ok: true; em?: string; por?: string } | Falha> {

  const quem = await quemGrava("AGENTE", MODULO);
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const agora = new Date();

    await quem.ctx.prisma.case.update({
      where: { protocol: entrada.protocol },
      data: entrada.desfazer
        ? { avaliacaoDispensadaEm: null, avaliacaoDispensadaPor: null }
        : { avaliacaoDispensadaEm: agora, avaliacaoDispensadaPor: quem.nome },
      select: { id: true },
    });

    updateTag(CASES_TAG);

    return entrada.desfazer
      ? { ok: true }
      : { ok: true, em: agora.toISOString(), por: quem.nome };
  } catch (erro) {
    return falha(erro, "dispensar pedido de avaliação");
  }
}

/* ============================================================
   MODERAÇÃO
============================================================ */

export async function registrarModeracao(entrada: {
  protocol: string;
  motivo?: string;
  resultado?: "pendente" | "aceita" | "negada";
  limpar?: boolean;
}): Promise<
  | {
      ok: true;
      moderacaoPedidaEm?: string;
      moderacaoMotivo?: string;
      moderacaoResultado?: "pendente" | "aceita" | "negada";
      moderacaoRespondidaEm?: string;
    }
  | Falha
> {

  const quem = await quemGrava("AGENTE", MODULO);
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    if (entrada.limpar) {
      await quem.ctx.prisma.case.update({
        where: { protocol: entrada.protocol },
        data: { moderacaoPedidaEm: null, moderacaoMotivo: null, moderacaoResultado: null, moderacaoRespondidaEm: null },
        select: { id: true },
      });
      updateTag(CASES_TAG);
      return { ok: true };
    }

    const atual = await quem.ctx.prisma.case.findUnique({
      where: { protocol: entrada.protocol },
      select: { moderacaoPedidaEm: true, moderacaoMotivo: true },
    });

    if (!atual) return { ok: false, erro: `O caso ${entrada.protocol} não existe mais.` };

    const motivo = (entrada.motivo ?? atual.moderacaoMotivo ?? "").trim();

    if (!atual.moderacaoPedidaEm && motivo.length < 10) {
      return { ok: false, erro: "Descreva o motivo do pedido de moderação — é ele que o Reclame Aqui vai avaliar." };
    }

    const resultado = entrada.resultado ?? "pendente";
    const pedida = atual.moderacaoPedidaEm ?? new Date();
    const respondida = resultado === "pendente" ? null : new Date();

    await quem.ctx.prisma.case.update({
      where: { protocol: entrada.protocol },
      data: {
        moderacaoPedidaEm: pedida,
        moderacaoMotivo: motivo.slice(0, 2000),
        moderacaoResultado: resultado,
        moderacaoRespondidaEm: respondida,
      },
      select: { id: true },
    });

    updateTag(CASES_TAG);

    return {
      ok: true,
      moderacaoPedidaEm: pedida.toISOString(),
      moderacaoMotivo: motivo,
      moderacaoResultado: resultado,
      moderacaoRespondidaEm: respondida?.toISOString(),
    };
  } catch (erro) {
    return falha(erro, "moderação");
  }
}

/* ============================================================
   ÁREAS INTERNAS
============================================================ */

function movimentoView(r: {
  id: string;
  destination: string;
  reason: string;
  actor: string;
  startedAt: Date;
  dueHours: number;
  returnedAt: Date | null;
  outcome: string | null;
  prioridade: string | null;
  escalonadoEm: Date | null;
  chamado: string | null;
  case: { externalId: string | null; id: string };
}): CaseMovement {
  return {
    id: r.id,
    caseId: r.case.externalId ?? r.case.id,
    destination: r.destination,
    reason: r.reason,
    actor: r.actor,
    startedAt: r.startedAt.toISOString(),
    dueHours: r.dueHours,
    returnedAt: r.returnedAt?.toISOString(),
    outcome: r.outcome ?? undefined,
    prioridade: r.prioridade ?? undefined,
    escalonadoEm: r.escalonadoEm?.toISOString(),
    chamado: r.chamado ?? undefined,
  };
}

const PRIORIDADE_DO_ENUM: Record<string, Prioridade> = {
  CRITICA: "Urgente",
  ALTA: "Alta",
  MEDIA: "Normal",
  BAIXA: "Normal",
};

/**
 * Aciona uma área interna, com o prazo da documentação.
 *
 * O prazo sai da criticidade do caso — Urgente 4h, Alta 1 dia útil,
 * Normal 2 dias úteis — e fica congelado no acionamento. Destino que não
 * é área (o próprio cliente, por exemplo) usa a regra cadastrada dele.
 */
export async function acionarArea(entrada: {
  protocol: string;
  area: string;
  tratativa: string;
  /** O número do chamado, quando a área abre um — o documento das Redes pede. */
  chamado?: string;
}): Promise<{ ok: true; movimento: CaseMovement } | Falha> {

  const area = entrada.area.trim();
  const tratativa = entrada.tratativa.trim();
  const chamado = entrada.chamado?.trim().slice(0, 60) || null;

  if (!area) return { ok: false, erro: "Escolha a área que vai tratar o caso." };
  if (tratativa.length < 8) {
    return { ok: false, erro: "Diga o que a área precisa fazer — é o que ela vai ler primeiro." };
  }

  const quem = await quemGrava("AGENTE", MODULO);
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const caso = await quem.ctx.prisma.case.findUnique({
      where: { protocol: entrada.protocol },
      select: { id: true, priority: true },
    });

    if (!caso) return { ok: false, erro: `O caso ${entrada.protocol} não existe mais.` };

    const aberta = await quem.ctx.prisma.caseMovement.findFirst({
      where: { caseId: caso.id, returnedAt: null },
      select: { destination: true },
    });

    if (aberta) {
      return {
        ok: false,
        erro: `O caso ainda está com ${aberta.destination}. Registre o retorno antes de acionar outra área — dois relógios no mesmo caso não dizem quem está com a bola.`,
      };
    }

    const prioridade = PRIORIDADE_DO_ENUM[caso.priority] ?? "Normal";

    const [operacao, regra] = await Promise.all([
      quem.ctx.prisma.operacaoConfig.findUnique({ where: { id: "unico" } }),
      quem.ctx.prisma.movementRule.findFirst({ where: { destination: area, active: true } }),
    ]);

    const ehArea = AREAS_INTERNAS.some((a) => a.nome === area);
    const horas = ehArea || !regra ? prazosDeAreaDoBanco(operacao)[prioridade] : regra.hours;

    const criado = await quem.ctx.prisma.caseMovement.create({
      data: {
        caseId: caso.id,
        destination: area,
        reason: tratativa.slice(0, 2000),
        actor: quem.nome,
        startedAt: new Date(),
        dueHours: horas,
        prioridade,
        chamado,
      },
      include: { case: { select: { externalId: true, id: true } } },
    });

    updateTag(WORKSPACE_TAG);

    return { ok: true, movimento: movimentoView(criado) };
  } catch (erro) {
    return falha(erro, "acionar área");
  }
}

export async function registrarRetornoDaArea(entrada: {
  id: string;
  retorno: string;
}): Promise<{ ok: true; movimento: CaseMovement } | Falha> {

  const retorno = entrada.retorno.trim();

  if (retorno.length < 8) {
    return { ok: false, erro: "Registre o que a área fez — a solução ou o parecer técnico. É o que se valida com o cliente depois." };
  }

  const quem = await quemGrava("AGENTE", MODULO);
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const salvo = await quem.ctx.prisma.caseMovement.update({
      where: { id: entrada.id },
      data: { returnedAt: new Date(), outcome: retorno.slice(0, 4000) },
      include: { case: { select: { externalId: true, id: true } } },
    });

    updateTag(WORKSPACE_TAG);

    return { ok: true, movimento: movimentoView(salvo) };
  } catch (erro) {
    return falha(erro, "retorno da área");
  }
}

export async function registrarEscalonamento(
  id: string
): Promise<{ ok: true; movimento: CaseMovement } | Falha> {

  const quem = await quemGrava("AGENTE", MODULO);
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const salvo = await quem.ctx.prisma.caseMovement.update({
      where: { id },
      data: { escalonadoEm: new Date() },
      include: { case: { select: { externalId: true, id: true } } },
    });

    updateTag(WORKSPACE_TAG);

    return { ok: true, movimento: movimentoView(salvo) };
  } catch (erro) {
    return falha(erro, "escalonamento");
  }
}

/** Apaga um acionamento feito por engano — com a resposta do servidor. */
export async function apagarMovimento(
  id: string
): Promise<{ ok: true } | Falha> {

  const quem = await quemGrava("AGENTE", MODULO);
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    await quem.ctx.prisma.caseMovement.delete({ where: { id }, select: { id: true } });
    updateTag(WORKSPACE_TAG);
    return { ok: true };
  } catch (erro) {
    return falha(erro, "apagar acionamento");
  }
}

export async function salvarPrazosDeArea(
  entrada: PrazosDeArea
): Promise<{ ok: true; prazos: PrazosDeArea } | Falha> {

  const quem = await quemGrava("ADMIN");
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  const valores = [entrada.Urgente, entrada.Alta, entrada.Normal];

  if (valores.some((n) => !Number.isInteger(n) || n <= 0 || n > 24 * 30)) {
    return { ok: false, erro: "Cada prazo precisa ser um número inteiro de horas úteis, entre 1 e 720." };
  }

  if (!(entrada.Urgente <= entrada.Alta && entrada.Alta <= entrada.Normal)) {
    return { ok: false, erro: "O prazo de Urgente não pode ser maior que o de Alta, nem o de Alta maior que o de Normal." };
  }

  try {
    await quem.ctx.prisma.operacaoConfig.upsert({
      where: { id: "unico" },
      update: { prazoAreaUrgente: entrada.Urgente, prazoAreaAlta: entrada.Alta, prazoAreaNormal: entrada.Normal, updatedBy: quem.nome },
      create: { id: "unico", prazoAreaUrgente: entrada.Urgente, prazoAreaAlta: entrada.Alta, prazoAreaNormal: entrada.Normal, updatedBy: quem.nome },
    });

    updateTag(WORKSPACE_TAG);

    return { ok: true, prazos: entrada };
  } catch (erro) {
    return falha(erro, "prazos das áreas");
  }
}

/* ============================================================
   QUEM É ESTE CLIENTE — o Passo 2
============================================================ */

export interface RetratoDoCliente {
  estabelecimento?: {
    id: string;
    nome: string;
    slug: string;
    plano?: string;
    situacao?: string;
    fase: string;
    responsavel?: string;
    mrr?: number;
    cidade?: string;
    desde?: string;
    portal?: string;
    crisp?: string;
    notas?: string;
  };
  outrasReclamacoes: { protocolo: string; titulo: string; status: string; dia: string; nota?: number }[];
  redes: { protocolo: string; titulo: string; status: string; dia: string; canal: string }[];
  nps: { nota: number; status: string; dia: string; comentario: string }[];
  /**
   * As avaliações do Google desta conta — ligadas a um dos casos, ao NPS
   * dela ou ao estabelecimento. É a quarta frente: o que o cliente disse
   * em público, fora do Reclame Aqui.
   */
  google: { id: string; estrelas: number; status: string; dia: string; texto: string }[];
  /** A fase quando não há estabelecimento vinculado — só pelo que o caso diz. */
  faseSemCadastro?: string;
  /** As conversas do WhatsApp guardadas do caso ou da conta, e a última fala do cliente. */
  conversas: { total: number; ultimaFala?: { texto: string; em?: string } };
}

/**
 * O retrato para a imersão: conta, fase e jornada de atendimento.
 *
 * "Localize a conta… Em qual fase o cliente está? (Implantação, uso
 * ativo, solicitação de cancelamento)… Verifique se ele já abriu
 * chamados, se passou por falhas de comunicação ou experiências
 * negativas anteriores." Tudo o que a plataforma sabe, num lugar só.
 */
export async function retratoDoCliente(protocol: string): Promise<RetratoDoCliente | null> {

  const ctx = await tryRole("LEITURA", MODULO);
  if (!ctx) return null;

  const caso = await ctx.prisma.case.findUnique({
    where: { protocol },
    select: {
      id: true,
      document: true,
      email: true,
      phone: true,
      churnRisk: true,
      establishment: true,
    },
  });

  if (!caso) return null;

  const est = caso.establishment;
  const digitos = (caso.phone ?? "").replace(/\D/g, "");
  const email = caso.email && !caso.email.includes("•") ? caso.email : null;

  const vinculo: Prisma.CaseWhereInput[] = [];
  if (est) vinculo.push({ establishmentId: est.id });
  if (caso.document) vinculo.push({ document: caso.document });
  if (email) vinculo.push({ email });
  if (digitos.length >= 10) vinculo.push({ phone: { contains: digitos.slice(-8) } });

  const vinculoNps: Prisma.NpsResponseWhereInput[] = [];
  if (est) vinculoNps.push({ establishmentId: est.id });
  /* O Wootric manda o id da conta; é o mesmo `externalId` do cadastro do estabelecimento. */
  if (est?.externalId) vinculoNps.push({ externalCompanyId: est.externalId });
  if (email) vinculoNps.push({ email });

  const [casos, nps] = await Promise.all([
    vinculo.length === 0
      ? Promise.resolve([])
      : ctx.prisma.case.findMany({
          where: { id: { not: caso.id }, OR: vinculo },
          select: { id: true, protocol: true, title: true, status: true, publishedAt: true, score: true, evaluated: true, channel: true },
          orderBy: { publishedAt: "desc" },
          take: 20,
        }),
    vinculoNps.length === 0
      ? Promise.resolve([])
      : ctx.prisma.npsResponse.findMany({
          where: { OR: vinculoNps },
          select: { id: true, score: true, status: true, respondedAt: true, comment: true },
          orderBy: { respondedAt: "desc" },
          take: 10,
        }),
  ]);

  const vinculoGoogle: Prisma.AvaliacaoGoogleWhereInput[] = [
    { caseId: { in: [caso.id, ...casos.map((c) => c.id)] } },
  ];
  if (est) vinculoGoogle.push({ establishmentId: est.id });
  if (nps.length) vinculoGoogle.push({ npsResponseId: { in: nps.map((r) => r.id) } });

  const [google, conversas] = await Promise.all([
    ctx.prisma.avaliacaoGoogle.findMany({
      where: { OR: vinculoGoogle },
      select: { id: true, estrelas: true, notaAtualizada: true, status: true, publicadaEm: true, texto: true },
      orderBy: { publicadaEm: "desc" },
      take: 10,
    }),
    conversasDoRegistro(ctx.prisma, { caseId: caso.id, establishmentId: est?.id ?? null }).catch(() => []),
  ]);

  const dia = (d: Date) => d.toISOString().slice(0, 10);

  /* A fase do cliente, como a documentação pergunta. */
  const desde = est?.startedAt ? dia(est.startedAt) : undefined;
  const recente = desde ? Date.now() - Date.parse(`${desde}T00:00:00Z`) < 60 * 86_400_000 : false;

  const fase = !est
    ? caso.churnRisk
      ? "Risco de cancelamento"
      : "Sem cadastro vinculado"
    : est.status === "Cancelado"
      ? "Cancelado"
      : caso.churnRisk || est.status === "Em risco"
        ? "Risco de cancelamento"
        : est.status === "Trial" || recente
          ? "Implantação"
          : "Uso ativo";

  return {
    estabelecimento: est
      ? {
          id: est.id,
          nome: est.name,
          slug: est.slug,
          plano: est.plan,
          situacao: est.status,
          fase,
          responsavel: est.owner ?? undefined,
          mrr: est.mrrCents === null ? undefined : est.mrrCents / 100,
          cidade: [est.city, est.state].filter(Boolean).join("/") || undefined,
          desde,
          portal: linkDoPortal({ portalUrl: est.portalUrl ?? undefined, portalId: est.portalId ?? undefined }) || undefined,
          crisp: est.crispUrl ?? undefined,
          notas: est.notes ?? undefined,
        }
      : undefined,
    faseSemCadastro: est ? undefined : fase,
    outrasReclamacoes: casos
      .filter((c) => c.channel === "RECLAME_AQUI")
      .map((c) => ({
        protocolo: c.protocol,
        titulo: c.title,
        status: c.status,
        dia: dia(c.publishedAt),
        nota: c.evaluated ? (c.score ?? undefined) : undefined,
      })),
    redes: casos
      .filter((c) => c.channel !== "RECLAME_AQUI")
      .map((c) => ({ protocolo: c.protocol, titulo: c.title, status: c.status, dia: dia(c.publishedAt), canal: c.channel })),
    nps: nps.map((r) => ({
      nota: r.score,
      status: r.status,
      dia: diaNaOperacao(r.respondedAt),
      comentario: r.comment.slice(0, 160),
    })),
    google: google.map((a) => ({
      id: a.id,
      estrelas: a.notaAtualizada ?? a.estrelas,
      status: a.status,
      dia: diaNaOperacao(a.publicadaEm),
      texto: (a.texto ?? "").slice(0, 160),
    })),
    conversas: {
      total: conversas.length,
      ultimaFala: conversas.find((c) => c.ultimaDoCliente)?.ultimaDoCliente,
    },
  };
}

/* ============================================================
   IMERSÃO QUE PREPARA O CONTATO (1.40)
============================================================ */

/*
  O Isaac: "que seja possível criar o estabelecimento na ferramenta na
  parte da imersão, adição do Crisp por lá também para facilitar o
  preenchimento". Sem conta vinculada, a imersão só avisava; agora ela
  vincula, cria e completa os links — cada um gravado no servidor antes
  de a tela dizer que foi.
*/

const LINKS_DA_CONTA = {
  crispUrl: { padrao: /^https:\/\/(app\.)?crisp\.chat\/\S+$/, nome: "do Crisp", exemplo: "https://app.crisp.chat/…" },
  portalUrl: { padrao: /^https:\/\/portal\.cardapioweb\.com\/\S+$/, nome: "do portal", exemplo: "https://portal.cardapioweb.com/…" },
} as const;

function linkDaConta(campo: keyof typeof LINKS_DA_CONTA, valor?: string): { ok: true; valor: string | null } | Falha {
  const limpo = String(valor ?? "").trim();
  if (!limpo) return { ok: true, valor: null };
  const regra = LINKS_DA_CONTA[campo];
  if (limpo.length > 500 || !regra.padrao.test(limpo)) return { ok: false, erro: `Cole o link ${regra.nome} inteiro, como ${regra.exemplo}` };
  return { ok: true, valor: limpo };
}

/** Liga a reclamação a uma conta que já existe — escolha de quem trabalha, que nada automático desfaz. */
export async function vincularEstabelecimentoDoCaso(entrada: { protocol: string; establishmentId: string }): Promise<{ ok: true } | Falha> {
  const quem = await quemGrava("AGENTE", MODULO);
  if ("erro" in quem) return { ok: false, erro: quem.erro! };
  try {
    const existe = await quem.ctx.prisma.establishment.findUnique({ where: { id: entrada.establishmentId }, select: { id: true } });
    if (!existe) return { ok: false, erro: "Este estabelecimento não existe mais." };
    const r = await quem.ctx.prisma.case.updateMany({
      where: { protocol: entrada.protocol },
      data: { establishmentId: existe.id, establishmentManual: true },
    });
    if (r.count === 0) return { ok: false, erro: "Esta reclamação não existe mais." };
    updateTag(CASES_TAG);
    return { ok: true };
  } catch (erro) {
    return falha(erro, "vínculo do estabelecimento");
  }
}

/**
 * Cria a conta a partir da reclamação e já liga as duas.
 *
 * O nome e o CPF/CNPJ vêm preenchidos da reclamação; telefone, e-mail,
 * cidade e UF também, quando não estão mascarados. Documento que já é de
 * outra conta não cria duplicata: devolve o nome dela, para vincular.
 */
export async function criarEstabelecimentoDoCaso(entrada: {
  protocol: string;
  nome: string;
  documento?: string;
  crispUrl?: string;
  portalUrl?: string;
}): Promise<{ ok: true; estabelecimento: Establishment } | Falha> {
  const nome = String(entrada.nome ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (nome.length < 2) return { ok: false, erro: "Escreva o nome do estabelecimento." };

  const documento = digitosDoDocumento(entrada.documento);
  if (String(entrada.documento ?? "").trim() && !documento) return { ok: false, erro: "O CPF/CNPJ precisa ter 11 ou 14 dígitos." };

  const crisp = linkDaConta("crispUrl", entrada.crispUrl);
  if (!crisp.ok) return crisp;
  const portal = linkDaConta("portalUrl", entrada.portalUrl);
  if (!portal.ok) return portal;

  const quem = await quemGrava("AGENTE", "estabelecimentos");
  if ("erro" in quem) return { ok: false, erro: quem.erro! };
  const prisma = quem.ctx.prisma;

  try {
    const caso = await prisma.case.findUnique({ where: { protocol: entrada.protocol }, select: { id: true, phone: true, email: true, city: true, state: true } });
    if (!caso) return { ok: false, erro: "Esta reclamação não existe mais." };

    if (documento) {
      const mesma = await prisma.establishment.findFirst({ where: { document: documento }, select: { name: true } });
      if (mesma) return { ok: false, erro: `${mesma.name} já tem este CPF/CNPJ — procure pelo nome e vincule.` };
    }

    const base = slugify(nome) || "estabelecimento";
    let slug = base;
    for (let n = 2; await prisma.establishment.findUnique({ where: { slug }, select: { id: true } }); n += 1) slug = `${base}-${n}`;

    const limpo = (v: string | null) => (v && !v.includes("•") ? v : null);
    const criado = await prisma.establishment.create({
      data: {
        slug,
        name: nome,
        document: documento,
        crispUrl: crisp.valor,
        portalUrl: portal.valor,
        plan: "",
        status: "Ativo",
        city: caso.city,
        state: caso.state,
        phone: limpo(caso.phone),
        email: limpo(caso.email),
      },
    });
    await prisma.case.update({ where: { id: caso.id }, data: { establishmentId: criado.id, establishmentManual: true } });

    updateTag(WORKSPACE_TAG);
    updateTag(CASES_TAG);

    return {
      ok: true,
      estabelecimento: {
        id: criado.id,
        slug: criado.slug,
        name: criado.name,
        document: criado.document ?? undefined,
        crispUrl: criado.crispUrl ?? undefined,
        portalUrl: criado.portalUrl ?? undefined,
        city: criado.city ?? undefined,
        state: criado.state ?? undefined,
        plan: criado.plan,
        status: criado.status as Establishment["status"],
        phone: criado.phone ?? undefined,
        email: criado.email ?? undefined,
      },
    };
  } catch (erro) {
    return falha(erro, "criação do estabelecimento");
  }
}

/** O link do Crisp ou do portal de uma conta — o campo que grava ao sair. Vazio apaga. */
export async function salvarLinkDaConta(entrada: { id: string; campo: "crispUrl" | "portalUrl"; valor: string }): Promise<{ ok: true } | Falha> {
  if (entrada.campo !== "crispUrl" && entrada.campo !== "portalUrl") return { ok: false, erro: "Campo desconhecido." };
  const link = linkDaConta(entrada.campo, entrada.valor);
  if (!link.ok) return link;

  const quem = await quemGrava("AGENTE", "estabelecimentos");
  if ("erro" in quem) return { ok: false, erro: quem.erro! };
  try {
    const r = await quem.ctx.prisma.establishment.updateMany({ where: { id: entrada.id }, data: { [entrada.campo]: link.valor } });
    if (r.count === 0) return { ok: false, erro: "Este estabelecimento não existe mais." };
    updateTag(WORKSPACE_TAG);
    return { ok: true };
  } catch (erro) {
    return falha(erro, "link da conta");
  }
}

/* ============================================================
   RESPOSTA REPETIDA — a regra de ouro sem macros
============================================================ */

/**
 * A resposta pública mais parecida com este texto, entre as publicadas.
 *
 * "Esqueça respostas padronizadas, mensagens prontas ou linguagem
 * corporativa fria. Cada cliente vivenciou um problema único." Compara
 * com as últimas 400 respostas publicadas.
 */
export async function respostaParecida(entrada: {
  protocol: string;
  texto: string;
}): Promise<{ protocolo: string; titulo: string; percentual: number } | null> {

  const ctx = await tryRole("LEITURA", MODULO);
  if (!ctx || entrada.texto.trim().length < 80) return null;

  const outras = await ctx.prisma.case.findMany({
    where: {
      protocol: { not: entrada.protocol },
      publicResponse: { not: null },
    },
    select: { protocol: true, title: true, publicResponse: true },
    orderBy: { publishedAt: "desc" },
    take: 400,
  });

  let melhor: { protocolo: string; titulo: string; percentual: number } | null = null;

  for (const o of outras) {
    const texto = o.publicResponse ?? "";
    if (!texto || texto === RESPOSTA_SINTETICA) continue;

    const p = semelhanca(entrada.texto, texto);

    if (!melhor || p > melhor.percentual) {
      melhor = { protocolo: o.protocol, titulo: o.title, percentual: p };
    }
  }

  return melhor && melhor.percentual >= LIMITE_DE_REPETICAO ? melhor : null;
}

/**
 * O nome do consumidor, direto na ficha — para a reclamação que chegou
 * "Não informado" (a leitura do portal nem sempre traz o nome). Grava
 * ao sair do campo; desfazer é gravar o anterior.
 */
export async function nomearConsumidor(entrada: { protocol: string; nome: string }): Promise<{ ok: true } | Falha> {
  const nome = String(entrada.nome ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (nome.length < 2) return { ok: false, erro: "Escreva o nome do consumidor." };

  const quem = await quemGrava("AGENTE", MODULO);
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const r = await quem.ctx.prisma.case.updateMany({ where: { protocol: entrada.protocol }, data: { customer: nome } });
    if (r.count === 0) return { ok: false, erro: "Esta reclamação não existe mais." };
    updateTag(CASES_TAG);
    return { ok: true };
  } catch (erro) {
    return falha(erro, "nome do consumidor");
  }
}
