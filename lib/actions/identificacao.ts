"use server";

import { tryRole } from "@/lib/auth/guard";
import { candidatosPelasPistas, nomeSustentaSugestao, pistasDoTexto } from "@/lib/services/contatoConhecido.service";

/*
  Identificação que acerta mais (1.83): o estabelecimento provável de um
  caso sem vínculo — pelas pistas que o próprio caso tem.
*/

export interface SugestaoDeEstabelecimento {
  id: string;
  nome: string;
  detalhe: string;
  motivo: string;
  semelhanca: number;
}

/**
 * Os estabelecimentos prováveis de um caso sem vínculo.
 *
 * Junta as pistas do caso: o nome de quem reclamou, o @ do perfil (nas
 * Redes), o CPF/CNPJ e o e-mail do cadastro, e o que foi escrito no
 * relato e nas conversas guardadas ligadas a ele (só as falas do
 * cliente) — documento, e-mail e endereço do cardápio. Só sugere; quem
 * vincula é a pessoa, com um clique.
 */
export async function sugestoesDeEstabelecimento(protocolo: string): Promise<SugestaoDeEstabelecimento[]> {
  const ctx = await tryRole("LEITURA").catch(() => null);
  if (!ctx) return [];

  const caso = await ctx.prisma.case.findFirst({
    where: { OR: [{ protocol: protocolo }, { externalId: protocolo }, { id: protocolo }] },
    select: {
      customer: true,
      socialHandle: true,
      title: true,
      description: true,
      email: true,
      document: true,
      establishmentId: true,
      channel: true,
      conversas: { select: { mensagens: { where: { de: "cliente" }, select: { texto: true }, take: 200 } } },
    },
  });
  if (!caso || caso.establishmentId) return [];

  const textos = [caso.title, caso.description ?? "", ...caso.conversas.flatMap((c) => c.mensagens.map((m) => m.texto))].join("\n");
  const doTexto = pistasDoTexto(textos);
  const candidatos = await candidatosPelasPistas(ctx.prisma, {
    nome: caso.customer,
    perfil: caso.socialHandle ?? undefined,
    documentos: [...(caso.document ? [caso.document] : []), ...doTexto.documentos],
    emails: [...(caso.email && !caso.email.includes("•") ? [caso.email] : []), ...doTexto.emails],
    slugs: doTexto.slugs,
  }, 10);

  return candidatos
    .filter((c) => c.tipo === "conta")
    .filter((c) => c.motivo !== "parecido com o nome" || nomeSustentaSugestao(caso.customer, c.titulo))
    .slice(0, 3)
    .map((c) => ({ id: c.ref, nome: c.titulo, detalhe: c.detalhe, motivo: c.motivo, semelhanca: c.semelhanca }));
}
