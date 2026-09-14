"use server";

import { updateTag } from "next/cache";

import { requireRole, SemPermissao, tryRole } from "@/lib/auth/guard";
import { WORKSPACE_TAG } from "@/lib/actions/tags";

import {
  DOCUMENTOS_DO_TIME,
  ORIGEM_DOS_DOCUMENTOS,
  RESPONSAVEL_DOS_DOCUMENTOS,
  VERSAO_DOS_DOCUMENTOS,
} from "@/lib/documentos/documentosDoTime";
import { ancoraDe, secoesDoDocumento, type Playbook } from "@/lib/models/playbook";

/**
 * Os documentos do time dentro da Documentação.
 *
 * "Importação para a Documentação, com prévia e Salvar; depois ficam
 * editáveis ali." A prévia diz, documento a documento, o que é novo, o
 * que já está igual e o que foi editado aqui — este último não é
 * substituído sem a pessoa marcar. Tudo com resposta do servidor.
 */

type Falha = { ok: false; erro: string };

async function agente() {
  try {
    const ctx = await requireRole("AGENTE", "documentacao");
    if (!ctx) return { erro: "Sem banco configurado — nada é gravado no modo demonstração." } as const;
    return { ctx } as const;
  } catch (erro) {
    return { erro: erro instanceof SemPermissao ? erro.message : "Não foi possível confirmar sua sessão. Entre de novo." } as const;
  }
}

function paraView(r: {
  id: string;
  slug: string;
  title: string;
  summary: string;
  scope: string;
  owner: string;
  version: string;
  steps: unknown;
  rules: string[];
  confluenceUrl: string | null;
  conteudo: string | null;
  origem: string | null;
  updatedAt: Date;
}): Playbook {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    scope: r.scope,
    owner: r.owner,
    version: r.version,
    steps: (r.steps ?? []) as Playbook["steps"],
    rules: r.rules,
    confluenceUrl: r.confluenceUrl ?? undefined,
    conteudo: r.conteudo ?? undefined,
    origem: r.origem ?? undefined,
    updatedAt: r.updatedAt.toISOString().slice(0, 10),
  };
}

export interface DocumentoNaPrevia {
  slug: string;
  titulo: string;
  escopo: string;
  resumo: string;
  secoes: string[];
  /** novo: ainda não está aqui; igual: já importado, sem mudança; editado: mudou aqui depois de importado. */
  situacao: "novo" | "igual" | "editado";
  atualizadoEm?: string;
}

/** O que a importação vai fazer, documento a documento. */
export async function previaDaImportacao(): Promise<{ ok: true; documentos: DocumentoNaPrevia[] } | Falha> {
  const ctx = await tryRole("LEITURA", "documentacao");
  if (!ctx) return { ok: false, erro: "Sem banco configurado." };

  let existentes: { slug: string; conteudo: string | null; updatedAt: Date }[];
  try {
    existentes = await ctx.prisma.playbook.findMany({
      where: { slug: { in: DOCUMENTOS_DO_TIME.map((d) => d.slug) } },
      select: { slug: true, conteudo: true, updatedAt: true },
    });
  } catch (erro) {
    console.error("[documentos] prévia", erro);
    return { ok: false, erro: "O banco não respondeu à prévia agora. Se o servidor acabou de ser atualizado, reinicie o npm run dev e tente de novo." };
  }
  const porSlug = new Map(existentes.map((e) => [e.slug, e]));

  return {
    ok: true,
    documentos: DOCUMENTOS_DO_TIME.map((d) => {
      const aqui = porSlug.get(d.slug);
      return {
        slug: d.slug,
        titulo: d.titulo,
        escopo: d.escopo,
        resumo: d.resumo,
        secoes: secoesDoDocumento(d.conteudo).filter((s) => s.nivel === 2).map((s) => s.titulo),
        situacao: !aqui ? "novo" : (aqui.conteudo ?? "").trim() === d.conteudo.trim() ? "igual" : "editado",
        atualizadoEm: aqui?.updatedAt.toISOString(),
      };
    }),
  };
}

/**
 * Importa os documentos escolhidos. Os que já existem só são trocados
 * pelo texto original quando estão em `substituir` — a edição feita
 * aqui não se perde num clique distraído.
 */
export async function importarDocumentosDoTime(entrada: {
  slugs: string[];
  substituir: string[];
}): Promise<{ ok: true; criados: number; substituidos: number; mantidos: number; documentos: Playbook[] } | Falha> {

  const escolhidos = DOCUMENTOS_DO_TIME.filter((d) => entrada.slugs.includes(d.slug));
  if (escolhidos.length === 0) return { ok: false, erro: "Escolha ao menos um documento." };

  const quem = await agente();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };
  const prisma = quem.ctx.prisma;

  try {
    let criados = 0;
    let substituidos = 0;
    let mantidos = 0;
    const documentos: Playbook[] = [];

    for (const d of escolhidos) {
      const existe = await prisma.playbook.findUnique({ where: { slug: d.slug }, select: { id: true } });
      if (existe && !entrada.substituir.includes(d.slug)) {
        mantidos += 1;
        continue;
      }
      const dados = {
        title: d.titulo,
        summary: d.resumo,
        scope: d.escopo,
        owner: RESPONSAVEL_DOS_DOCUMENTOS,
        version: VERSAO_DOS_DOCUMENTOS,
        conteudo: d.conteudo,
        origem: ORIGEM_DOS_DOCUMENTOS,
      };
      const r = await prisma.playbook.upsert({
        where: { slug: d.slug },
        update: dados,
        create: { slug: d.slug, steps: [], rules: [], ...dados },
      });
      if (existe) substituidos += 1;
      else criados += 1;
      documentos.push(paraView(r));
    }

    updateTag(WORKSPACE_TAG);
    return { ok: true, criados, substituidos, mantidos, documentos };
  } catch (erro) {
    console.error("[documentos] importar", erro);
    return { ok: false, erro: "O banco não aceitou a importação agora. Tente de novo em instantes." };
  }
}

/**
 * Cria ou edita um documento em markdown.
 *
 * O slug nasce do título e não muda depois: é o endereço que o "por
 * quê?" das telas usa, e mudar o título não pode quebrar o link.
 */
export async function salvarDocumento(entrada: {
  id?: string;
  titulo: string;
  escopo: string;
  resumo: string;
  conteudo: string;
  responsavel: string;
  versao: string;
  confluenceUrl: string;
}): Promise<{ ok: true; documento: Playbook } | Falha> {

  const titulo = entrada.titulo.trim().slice(0, 160);
  const conteudo = entrada.conteudo.replace(/\r/g, "").trim();
  const confluenceUrl = entrada.confluenceUrl.trim();
  if (!titulo) return { ok: false, erro: "Dê um título ao documento." };
  if (!conteudo) return { ok: false, erro: "O documento está vazio." };
  if (conteudo.length > 200_000) return { ok: false, erro: "O documento passou de 200 mil caracteres." };
  if (confluenceUrl && !/^https?:\/\//i.test(confluenceUrl)) return { ok: false, erro: "O link do Confluence precisa começar com http:// ou https://." };

  const quem = await agente();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };
  const prisma = quem.ctx.prisma;

  try {
    const autor = await prisma.user.findUnique({ where: { id: quem.ctx.userId }, select: { name: true } });
    const dados = {
      title: titulo,
      scope: entrada.escopo.trim().slice(0, 60) || "Reputação",
      summary: entrada.resumo.trim().slice(0, 400),
      owner: entrada.responsavel.trim().slice(0, 80) || autor?.name || "Reputação",
      version: entrada.versao.trim().slice(0, 30) || "1.0",
      confluenceUrl: confluenceUrl || null,
      conteudo,
    };

    if (entrada.id) {
      const atual = await prisma.playbook.findUnique({ where: { id: entrada.id }, select: { id: true } });
      if (!atual) return { ok: false, erro: "Este documento não existe mais." };
      const r = await prisma.playbook.update({ where: { id: entrada.id }, data: dados });
      updateTag(WORKSPACE_TAG);
      return { ok: true, documento: paraView(r) };
    }

    const base = ancoraDe(titulo).slice(0, 60) || "documento";
    let slug = base;
    for (let n = 2; await prisma.playbook.findUnique({ where: { slug }, select: { id: true } }); n++) slug = `${base}-${n}`;

    const r = await prisma.playbook.create({ data: { slug, steps: [], rules: [], ...dados } });
    updateTag(WORKSPACE_TAG);
    return { ok: true, documento: paraView(r) };
  } catch (erro) {
    console.error("[documentos] salvar", erro);
    return { ok: false, erro: "O banco não aceitou a gravação agora. Tente de novo em instantes." };
  }
}

/** Exclui o documento; a tela só o tira da lista depois desta resposta. */
export async function excluirDocumento(id: string): Promise<{ ok: true } | Falha> {
  const quem = await agente();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const r = await quem.ctx.prisma.playbook.deleteMany({ where: { id } });
    if (r.count === 0) return { ok: false, erro: "Este documento já não existia." };
    updateTag(WORKSPACE_TAG);
    return { ok: true };
  } catch (erro) {
    console.error("[documentos] excluir", erro);
    return { ok: false, erro: "O banco não aceitou a exclusão agora. Tente de novo em instantes." };
  }
}
