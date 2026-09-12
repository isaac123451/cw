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
import type { ContatoView, ResumoDosContatos } from "@/lib/models/tratativa";

import { expedienteValido, type Expediente } from "@/lib/services/horasUteis";
import { esquecerExpediente } from "@/lib/services/operacao.service";
import {
  contatosDoCaso,
  gravarContato,
  problemaDoContato,
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
