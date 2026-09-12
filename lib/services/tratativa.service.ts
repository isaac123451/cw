import type { PrismaClient } from "@prisma/client";

import {
  CRITERIOS,
  Prioridade,
  prioridadeNormalizada,
} from "@/lib/models/case";
import {
  ContatoView,
  ResultadoDoContato,
  resumirContatos,
  ResumoDosContatos,
  TipoDeContato,
  tipoDeContato,
} from "@/lib/models/tratativa";

/**
 * A tratativa gravada: triagem e contatos com o cliente.
 *
 * Fora das server actions para servir também à extensão — que autentica
 * de outro jeito — e aos checks, que exercitam o banco sem cookie.
 * Quem chama cuida de quem pode; aqui se cuida do que é válido.
 */

const PRIORIDADE_PARA_ENUM: Record<Prioridade, "CRITICA" | "ALTA" | "MEDIA"> = {
  Urgente: "CRITICA",
  Alta: "ALTA",
  Normal: "MEDIA",
};

/** O resumo como o caso guarda — `null` apaga o que não existe mais. */
function colunasDoResumo(r: ResumoDosContatos) {
  return {
    primeiroContatoEm: r.primeiroContatoEm ? new Date(r.primeiroContatoEm) : null,
    primeiroContatoCanal: r.primeiroContatoCanal ?? null,
    primeiroContatoPor: r.primeiroContatoPor ?? null,
    ultimoContatoEm: r.ultimoContatoEm ? new Date(r.ultimoContatoEm) : null,
    ultimaRespostaEm: r.ultimaRespostaEm ? new Date(r.ultimaRespostaEm) : null,
    tentativasSemResposta: r.tentativasSemResposta,
  };
}

function paraView(c: {
  id: string;
  tipo: string;
  canal: string;
  resultado: string | null;
  nota: string | null;
  em: Date;
  autorNome: string;
  autor?: { name: string } | null;
}): ContatoView {
  return {
    id: c.id,
    tipo: c.tipo as TipoDeContato,
    canal: c.canal,
    resultado: (c.resultado as ResultadoDoContato) ?? undefined,
    nota: c.nota ?? undefined,
    em: c.em.toISOString(),
    autor: c.autor?.name ?? c.autorNome,
  };
}

export async function contatosDoCaso(
  prisma: PrismaClient,
  caseId: string
): Promise<ContatoView[]> {

  const linhas = await prisma.caseContato.findMany({
    where: { caseId },
    include: { autor: { select: { name: true } } },
    orderBy: { em: "desc" },
    take: 200,
  });

  return linhas.map(paraView);
}

/** Relê os contatos e regrava o resumo no caso. */
export async function recalcularResumo(
  prisma: PrismaClient,
  caseId: string
): Promise<ResumoDosContatos> {

  const todos = await prisma.caseContato.findMany({
    where: { caseId },
    select: {
      tipo: true,
      canal: true,
      resultado: true,
      em: true,
      autorNome: true,
    },
  });

  const resumo = resumirContatos(
    todos.map((c) => ({
      tipo: c.tipo as TipoDeContato,
      canal: c.canal,
      resultado: (c.resultado as ResultadoDoContato) ?? undefined,
      em: c.em.toISOString(),
      autor: c.autorNome,
    }))
  );

  await prisma.case.update({
    where: { id: caseId },
    data: colunasDoResumo(resumo),
    select: { id: true },
  });

  return resumo;
}

export interface NovoContato {
  tipo: string;
  canal: string;
  resultado?: string;
  nota?: string;
  /** ISO. Ausente é agora. */
  em?: string;
}

/**
 * O que está errado no contato, em português — ou `null`.
 *
 * Data no futuro é o erro mais comum (o seletor de hora do navegador
 * aceita qualquer coisa), e um contato "amanhã" cumpriria a meta de 1º
 * contato antes de ele acontecer.
 */
export function problemaDoContato(
  entrada: NovoContato,
  agora = new Date()
): string | null {

  const tipo = tipoDeContato(entrada.tipo);

  if (!tipo) return "Escolha o que aconteceu no contato.";

  if (!String(entrada.canal ?? "").trim()) {
    return "Diga por onde foi o contato — WhatsApp, telefone, e-mail…";
  }

  if (entrada.resultado && !tipo.resultados.includes(entrada.resultado as ResultadoDoContato)) {
    return `"${entrada.resultado}" não combina com "${tipo.rotulo}".`;
  }

  if (entrada.em) {
    const t = Date.parse(entrada.em);

    if (!Number.isFinite(t)) return "A data do contato não é válida.";

    if (t > agora.getTime() + 5 * 60_000) {
      return "O contato não pode estar no futuro. Registre quando ele acontecer.";
    }
  }

  if ((entrada.nota ?? "").length > 2000) {
    return "A anotação passou de 2.000 caracteres — resuma o essencial.";
  }

  return null;
}

export async function gravarContato(
  prisma: PrismaClient,
  {
    caseId,
    entrada,
    autorId,
    autorNome,
  }: {
    caseId: string;
    entrada: NovoContato;
    autorId: string | null;
    autorNome: string;
  }
): Promise<{ contato: ContatoView; resumo: ResumoDosContatos }> {

  const tipo = tipoDeContato(entrada.tipo)!;

  const criado = await prisma.caseContato.create({
    data: {
      caseId,
      tipo: tipo.id,
      canal: entrada.canal.trim().slice(0, 40),
      resultado: entrada.resultado || tipo.resultadoPadrao,
      nota: entrada.nota?.trim() || null,
      em: entrada.em ? new Date(entrada.em) : new Date(),
      autorId,
      autorNome,
    },
    include: { autor: { select: { name: true } } },
  });

  const resumo = await recalcularResumo(prisma, caseId);

  return { contato: paraView(criado), resumo };
}

export async function removerContato(
  prisma: PrismaClient,
  id: string
): Promise<{ caseId: string; resumo: ResumoDosContatos } | null> {

  const achado = await prisma.caseContato.findUnique({
    where: { id },
    select: { caseId: true },
  });

  if (!achado) return null;

  await prisma.caseContato.delete({ where: { id } });

  return {
    caseId: achado.caseId,
    resumo: await recalcularResumo(prisma, achado.caseId),
  };
}

export interface ResultadoDaTriagem {
  priority: Prioridade;
  criterios: string[];
  triadaEm: string;
  triadaPor: string;
}

/**
 * A triagem do Passo 1: criticidade e os critérios que a justificam.
 *
 * Critério desconhecido é descartado, e não recusado: a lista vive no
 * código, e uma extensão de versão anterior mandando um id que saiu não
 * pode travar a triagem inteira.
 */
export async function triar(
  prisma: PrismaClient,
  {
    caseId,
    prioridade,
    criterios,
    autorNome,
  }: {
    caseId: string;
    prioridade: string;
    criterios: string[];
    autorNome: string;
  }
): Promise<ResultadoDaTriagem> {

  const nivel = prioridadeNormalizada(prioridade);

  const validos = [
    ...new Set(
      (criterios ?? []).filter((id) => CRITERIOS.some((c) => c.id === id))
    ),
  ];

  const agora = new Date();

  await prisma.case.update({
    where: { id: caseId },
    data: {
      priority: PRIORIDADE_PARA_ENUM[nivel],
      criterios: validos,
      triadaEm: agora,
      triadaPor: autorNome,
    },
    select: { id: true },
  });

  return {
    priority: nivel,
    criterios: validos,
    triadaEm: agora.toISOString(),
    triadaPor: autorNome,
  };
}
