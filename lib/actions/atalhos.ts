"use server";

import { requireRole, SemPermissao, tryRole } from "@/lib/auth/guard";

import { ATALHOS_DO_DOCUMENTO } from "@/lib/documentos/atalhosDoDocumento";
import { chaveDoNome, enderecoValido, normalizarEndereco, type Atalho } from "@/lib/models/atalho";

/**
 * Ferramentas e Acessos: os atalhos que a página e o popup da extensão
 * mostram. Tudo grava com resposta — `{ ok }` ou o erro em português —,
 * e a tela só confirma depois dela.
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

type Linha = {
  id: string;
  chave: string;
  nome: string;
  url: string;
  grupo: string;
  descricao: string;
  acesso: string;
  ordem: number;
  ativo: boolean;
  atualizadoPor: string | null;
  atualizadoEm: Date;
};

function paraView(r: Linha): Atalho {
  return {
    id: r.id,
    chave: r.chave,
    nome: r.nome,
    url: r.url,
    grupo: r.grupo === "planilha" ? "planilha" : "ferramenta",
    descricao: r.descricao,
    acesso: r.acesso,
    ordem: r.ordem,
    ativo: r.ativo,
    atualizadoPor: r.atualizadoPor ?? undefined,
    atualizadoEm: r.atualizadoEm.toISOString(),
  };
}

export async function listarAtalhos(): Promise<{ ok: true; atalhos: Atalho[] } | Falha> {
  const ctx = await tryRole("LEITURA", "documentacao");
  if (!ctx) return { ok: false, erro: "Sem banco configurado." };
  try {
    const linhas = await ctx.prisma.atalho.findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }] });
    return { ok: true, atalhos: linhas.map(paraView) };
  } catch (erro) {
    console.error("[atalhos] listar", erro);
    return { ok: false, erro: "O banco não respondeu agora. Se o servidor acabou de ser atualizado, reinicie o npm run dev." };
  }
}

/** Traz as ferramentas do documento que ainda não estão aqui; as que já estão ficam como foram configuradas. */
export async function importarAtalhosDoDocumento(chaves: string[]): Promise<{ ok: true; criados: number; atalhos: Atalho[] } | Falha> {
  const escolhidos = ATALHOS_DO_DOCUMENTO.filter((a) => chaves.includes(a.chave));
  if (escolhidos.length === 0) return { ok: false, erro: "Escolha ao menos uma ferramenta." };

  const quem = await agente();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };
  const prisma = quem.ctx.prisma;

  try {
    const autor = await prisma.user.findUnique({ where: { id: quem.ctx.userId }, select: { name: true } });
    const existentes = new Set((await prisma.atalho.findMany({ select: { chave: true } })).map((a) => a.chave));
    const novos = escolhidos.filter((a) => !existentes.has(a.chave));
    const ordemDoDocumento = new Map(ATALHOS_DO_DOCUMENTO.map((a, i) => [a.chave, (i + 1) * 10]));

    if (novos.length > 0) {
      await prisma.atalho.createMany({
        data: novos.map((a) => ({ ...a, ordem: ordemDoDocumento.get(a.chave) ?? 999, atualizadoPor: autor?.name ?? null })),
        skipDuplicates: true,
      });
    }

    const linhas = await prisma.atalho.findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }] });
    return { ok: true, criados: novos.length, atalhos: linhas.map(paraView) };
  } catch (erro) {
    console.error("[atalhos] importar", erro);
    return { ok: false, erro: "O banco não aceitou a importação agora. Tente de novo em instantes." };
  }
}

export async function salvarAtalho(entrada: {
  id?: string;
  nome: string;
  url: string;
  grupo: "ferramenta" | "planilha";
  descricao: string;
  acesso: string;
  ativo: boolean;
}): Promise<{ ok: true; atalho: Atalho } | Falha> {
  const nome = entrada.nome.trim().slice(0, 80);
  const url = normalizarEndereco(entrada.url).slice(0, 600);
  if (!nome) return { ok: false, erro: "Dê um nome ao atalho." };
  if (!enderecoValido(url)) return { ok: false, erro: "O endereço precisa começar com https:// (ou ser um caminho da plataforma, como /relatorio)." };

  const quem = await agente();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };
  const prisma = quem.ctx.prisma;

  try {
    const autor = await prisma.user.findUnique({ where: { id: quem.ctx.userId }, select: { name: true } });
    const dados = {
      nome,
      url,
      grupo: entrada.grupo === "planilha" ? "planilha" : "ferramenta",
      descricao: entrada.descricao.trim().slice(0, 300),
      acesso: entrada.acesso.trim().slice(0, 300),
      ativo: entrada.ativo,
      atualizadoPor: autor?.name ?? null,
    };

    if (entrada.id) {
      const r = await prisma.atalho.updateMany({ where: { id: entrada.id }, data: dados });
      if (r.count === 0) return { ok: false, erro: "Este atalho não existe mais." };
      const linha = await prisma.atalho.findUniqueOrThrow({ where: { id: entrada.id } });
      return { ok: true, atalho: paraView(linha) };
    }

    const base = chaveDoNome(nome);
    let chave = base;
    for (let n = 2; await prisma.atalho.findUnique({ where: { chave }, select: { id: true } }); n++) chave = `${base}-${n}`;
    const ultimo = await prisma.atalho.aggregate({ _max: { ordem: true } });
    const linha = await prisma.atalho.create({ data: { chave, ordem: (ultimo._max.ordem ?? 0) + 10, ...dados } });
    return { ok: true, atalho: paraView(linha) };
  } catch (erro) {
    console.error("[atalhos] salvar", erro);
    return { ok: false, erro: "O banco não aceitou a gravação agora. Tente de novo em instantes." };
  }
}

/** Troca a posição com o vizinho — as duas ordens mudam juntas. */
export async function moverAtalho(id: string, direcao: "subir" | "descer"): Promise<{ ok: true; atalhos: Atalho[] } | Falha> {
  const quem = await agente();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };
  const prisma = quem.ctx.prisma;

  try {
    const linhas = await prisma.atalho.findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }] });
    const i = linhas.findIndex((l) => l.id === id);
    if (i === -1) return { ok: false, erro: "Este atalho não existe mais." };
    /* Só dentro do mesmo grupo: a planilha não sobe para o meio das ferramentas. */
    const doGrupo = linhas.filter((l) => l.grupo === linhas[i].grupo);
    const k = doGrupo.findIndex((l) => l.id === id);
    const vizinho = doGrupo[direcao === "subir" ? k - 1 : k + 1];
    if (!vizinho) return { ok: true, atalhos: linhas.map(paraView) };

    /* Ordens repetidas (0 e 0) não trocam nada: renumera o grupo antes. */
    const ordens = doGrupo.map((l, n) => ({ id: l.id, ordem: (n + 1) * 10 + (l.grupo === "planilha" ? 1000 : 0) }));
    const a = ordens[k];
    const b = ordens[direcao === "subir" ? k - 1 : k + 1];
    [a.ordem, b.ordem] = [b.ordem, a.ordem];
    await prisma.$transaction(ordens.map((o) => prisma.atalho.update({ where: { id: o.id }, data: { ordem: o.ordem } })));

    const depois = await prisma.atalho.findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }] });
    return { ok: true, atalhos: depois.map(paraView) };
  } catch (erro) {
    console.error("[atalhos] mover", erro);
    return { ok: false, erro: "O banco não aceitou a mudança de ordem agora." };
  }
}

export async function excluirAtalho(id: string): Promise<{ ok: true } | Falha> {
  const quem = await agente();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };
  try {
    const r = await quem.ctx.prisma.atalho.deleteMany({ where: { id } });
    if (r.count === 0) return { ok: false, erro: "Este atalho já não existia." };
    return { ok: true };
  } catch (erro) {
    console.error("[atalhos] excluir", erro);
    return { ok: false, erro: "O banco não aceitou a exclusão agora." };
  }
}
