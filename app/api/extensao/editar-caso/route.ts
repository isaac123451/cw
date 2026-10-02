import { revalidateTag } from "next/cache";

import { CASES_TAG } from "@/lib/actions/tags";
import { autenticar, responder, responderPreVoo, semSessao } from "@/lib/api/extensao";
import { requireRole } from "@/lib/auth/guard";
import { PRIORIDADES, SEM_ESTABELECIMENTO, type Case, type Prioridade } from "@/lib/models/case";
import { getPrisma } from "@/lib/prisma";
import { fetchCaseByProtocol, persistCaseParcial } from "@/lib/services/case.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mexer no caso sem sair da extensão (1.127, Fase 33: "a plataforma dentro
 * da extensão — uma tela na extensão para mexer no caso e preencher o que
 * falta sem ir e voltar").
 *
 * GET devolve o caso, as opções de cada campo e **o que falta preencher**;
 * POST grava pela mesma gravação parcial da plataforma (`persistCaseParcial`
 * com o retrato de antes): só o que mudou, e recusa quando pisaria na
 * edição de outra pessoa feita no meio. Exige AGENTE no módulo do Reclame
 * Aqui, como as telas. Não passa pelo `saveCase` porque ele invalida o
 * cache com `updateTag`, que o Next só aceita dentro de server action —
 * numa rota é `revalidateTag`.
 */

export async function OPTIONS(request: Request) {
  return responderPreVoo(request);
}

/** Os campos que o painel mexe — e o rótulo do que falta. */
const FALTA = {
  owner: "responsável",
  category: "categoria",
  company: "estabelecimento",
  phone: "telefone",
  email: "e-mail",
  document: "CPF/CNPJ",
} as const;

function oQueFalta(c: Case) {
  const falta: string[] = [];
  if (!c.owner) falta.push(FALTA.owner);
  /* "Não classificado" é o padrão de quem chegou sem categoria: falta do mesmo jeito. */
  if (!c.category || /^(sem categoria|n[ãa]o classificad[oa])$/i.test(c.category.trim())) falta.push(FALTA.category);
  if (!c.company || c.company === SEM_ESTABELECIMENTO || !c.establishmentId) falta.push(FALTA.company);
  if (!c.phone) falta.push(FALTA.phone);
  if (!c.email) falta.push(FALTA.email);
  if (!c.document) falta.push(FALTA.document);
  return falta;
}

function retrato(c: Case) {
  return {
    protocolo: c.protocol,
    status: c.status,
    responsavel: c.owner ?? "",
    categoria: c.category ?? "",
    subcategoria: c.subcategory ?? "",
    prioridade: c.priority,
    risco: Boolean(c.churnRisk),
    estabelecimentoId: c.establishmentId ?? "",
    estabelecimento: c.company && c.company !== SEM_ESTABELECIMENTO ? c.company : "",
    telefone: c.phone ?? "",
    email: c.email ?? "",
    documento: c.document ?? "",
  };
}

async function opcoes() {
  const prisma = getPrisma()!;
  const [categorias, subcategorias, pessoas, estabelecimentos] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.subcategory.findMany({ select: { name: true, categoryId: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
    prisma.establishment.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return {
    categorias: categorias.map((c) => ({ nome: c.name, subcategorias: subcategorias.filter((s) => s.categoryId === c.id).map((s) => s.name) })),
    responsaveis: pessoas.map((p) => p.name).filter(Boolean),
    prioridades: PRIORIDADES,
    estabelecimentos: estabelecimentos.map((e) => ({ id: e.id, nome: e.name })),
  };
}

async function acesso(request: Request, escrever: boolean) {
  const { usuario, demonstracao } = await autenticar(request);
  if (!usuario && !demonstracao) return { falha: semSessao(request) };
  if (!usuario) return { falha: responder(request, { ok: false, erro: "No modo demonstração não há caso para editar." }, 403) };
  if (escrever && usuario.papel === "LEITURA") {
    return { falha: responder(request, { ok: false, erro: "Seu acesso é somente leitura — não dá para mexer no caso." }, 403) };
  }
  const prisma = getPrisma();
  if (!prisma) return { falha: responder(request, { ok: false, erro: "Sem banco configurado." }, 503) };
  return { prisma };
}

export async function GET(request: Request) {
  const a = await acesso(request, false);
  if ("falha" in a) return a.falha;
  const protocolo = new URL(request.url).searchParams.get("protocolo")?.trim() ?? "";
  if (!protocolo) return responder(request, { ok: false, erro: "Sem protocolo." }, 400);
  const caso = await fetchCaseByProtocol(a.prisma, protocolo);
  if (!caso) return responder(request, { ok: false, erro: "Caso não encontrado." }, 404);
  return responder(request, { ok: true, caso: retrato(caso), falta: oQueFalta(caso), opcoes: await opcoes() });
}

export async function POST(request: Request) {
  const a = await acesso(request, true);
  if ("falha" in a) return a.falha;
  const corpo = (await request.json().catch(() => ({}))) as { protocolo?: string; mudancas?: Record<string, unknown>; antes?: Record<string, unknown> };
  const protocolo = String(corpo.protocolo ?? "").trim();
  const m = corpo.mudancas ?? {};
  const anterior = protocolo ? await fetchCaseByProtocol(a.prisma, protocolo) : null;
  if (!anterior) return responder(request, { ok: false, erro: "Caso não encontrado." }, 404);

  /*
    O retrato que o painel carregou: se um campo que a pessoa mudou também
    mudou no banco desde então (outra pessoa, na plataforma ou em outra
    extensão), recusa em vez de pisar por cima.
  */
  if (corpo.antes && typeof corpo.antes === "object") {
    const agora = retrato(anterior) as Record<string, unknown>;
    const campos = Object.keys(m).flatMap((k) => (k === "categoria" ? ["categoria", "subcategoria"] : [k]));
    const mexidos = campos.filter((k) => k in agora && String(agora[k] ?? "") !== String(corpo.antes?.[k] ?? ""));
    if (mexidos.length > 0) {
      return responder(request, { ok: false, erro: `Outra pessoa mudou ${mexidos.join(", ")} enquanto você editava. Abra a aba de novo para ver o que mudou.` }, 409);
    }
  }

  const op = await opcoes();
  const novo: Case = { ...anterior };
  const recusar = (erro: string) => responder(request, { ok: false, erro }, 400);

  if ("responsavel" in m) {
    const nome = String(m.responsavel ?? "").trim();
    if (nome && !op.responsaveis.includes(nome)) return recusar("Responsável fora da lista de pessoas ativas.");
    novo.owner = nome || undefined;
  }
  if ("categoria" in m) {
    const nome = String(m.categoria ?? "").trim();
    const categoria = op.categorias.find((c) => c.nome === nome);
    if (!categoria) return recusar("Categoria fora da lista.");
    novo.category = categoria.nome;
    const sub = String(m.subcategoria ?? "").trim();
    if (sub && !categoria.subcategorias.includes(sub)) return recusar("Subcategoria não pertence à categoria.");
    novo.subcategory = sub || undefined;
  }
  if ("prioridade" in m) {
    const p = String(m.prioridade ?? "") as Prioridade;
    if (!PRIORIDADES.includes(p)) return recusar("Prioridade fora da lista.");
    novo.priority = p;
  }
  if ("risco" in m) novo.churnRisk = Boolean(m.risco);
  if ("estabelecimentoId" in m) {
    const id = String(m.estabelecimentoId ?? "").trim();
    if (id) {
      const est = op.estabelecimentos.find((e) => e.id === id);
      if (!est) return recusar("Estabelecimento não encontrado.");
      novo.establishmentId = est.id;
      novo.company = est.nome;
      novo.establishmentManual = true;
    }
  }
  if ("telefone" in m) {
    const tel = String(m.telefone ?? "").replace(/\D/g, "");
    if (tel && (tel.length < 10 || tel.length > 13)) return recusar("Telefone com DDD, só números (10 a 13 dígitos).");
    novo.phone = tel || undefined;
  }
  if ("email" in m) {
    const email = String(m.email ?? "").trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return recusar("E-mail inválido.");
    novo.email = email || undefined;
  }
  if ("documento" in m) {
    const doc = String(m.documento ?? "").replace(/\D/g, "");
    if (doc && doc.length !== 11 && doc.length !== 14) return recusar("CPF tem 11 dígitos e CNPJ, 14.");
    novo.document = doc || undefined;
  }

  /* A mesma régua das telas: AGENTE no módulo, conferido no banco (a sessão vem no cabeçalho). */
  const papel = await requireRole("AGENTE", "reclame-aqui").catch(() => null);
  if (!papel) return responder(request, { ok: false, erro: "Seu acesso no Reclame Aqui é somente leitura — não dá para mexer no caso." }, 403);

  const r = await persistCaseParcial(a.prisma, novo, anterior, { syncTags: false });
  if (!r.ok) {
    return responder(request, { ok: false, erro: "Outra pessoa mexeu neste caso agora há pouco. Abra de novo para ver o que mudou." }, 409);
  }
  if (r.alterados.length > 0) revalidateTag(CASES_TAG, { expire: 0 });
  const atual = await fetchCaseByProtocol(a.prisma, protocolo);
  return responder(request, { ok: true, caso: atual ? retrato(atual) : retrato(novo), falta: oQueFalta(atual ?? novo) });
}
