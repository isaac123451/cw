"use server";

import { requireRole, SemPermissao, tryRole } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/session";
import { OKR_4T_2026, problemaDoOkr, type KrCalculado, type OkrView, type RespostaDeConfianca } from "@/lib/models/okr";
import { calcularOkr, lerOkrsDoBanco, paraOkrView, pendentesDaConfianca, type PendenteDaConfianca } from "@/lib/services/okr.service";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

/**
 * Os OKRs do time (04/11/2026) — ver `lib/models/okr.ts`. Lidos por quem
 * entra na plataforma; montados por administrador (o alvo é decisão de
 * quem responde por ele, como as metas do Reclame Aqui). A pesquisa de
 * confiança é registrada por quem atende o NPS.
 */

type Falha = { ok: false; erro: string };

export interface OkrNaTela {
  okr: OkrView;
  krs: KrCalculado[];
  /** Do KR de confiança: o próximo passo de cada detrator que ainda não conta. */
  pendentes: PendenteDaConfianca[];
}

export async function lerOkrs(): Promise<({ ok: true; okrs: OkrNaTela[]; previa: OkrNaTela | null; podeEditar: boolean; semTabela: boolean; hoje: string }) | Falha> {
  const ctx = await tryRole("LEITURA");
  if (!ctx) return { ok: false, erro: "Entre na aplicação." };
  try {
    const { okrs, semTabela } = await lerOkrsDoBanco(ctx.prisma);
    const hoje = hojeNaOperacao();
    const calculados: OkrNaTela[] = [];
    for (const okr of okrs) {
      const krs = await calcularOkr(ctx.prisma, okr, hoje);
      const doNps = okr.krs.find((k) => k.metrica === "nps-confianca");
      const emVigencia = okr.inicio <= hoje && hoje <= okr.fim;
      const pendentes = doNps && emVigencia ? await pendentesDaConfianca(ctx.prisma, okr.inicio, doNps.corte || okr.fim, hoje) : [];
      calculados.push({ okr, krs, pendentes });
    }
    /*
      Sem OKR guardado, o do 4º tri aparece como prévia, já calculado: o
      número real antes de qualquer cadastro (e antes do db:push).
    */
    let previa: OkrNaTela | null = null;
    if (!calculados.length && hoje <= OKR_4T_2026.fim) {
      const okr = { id: "", ...OKR_4T_2026 };
      previa = { okr, krs: await calcularOkr(ctx.prisma, okr, hoje), pendentes: await pendentesDaConfianca(ctx.prisma, okr.inicio, okr.krs[0].corte!, hoje) };
    }
    return { ok: true, okrs: calculados, previa, podeEditar: ctx.role === "ADMIN", semTabela, hoje };
  } catch (erro) {
    console.error("[okr] ler", erro);
    return { ok: false, erro: "Não deu para calcular os OKRs agora." };
  }
}

async function admin() {
  try {
    return await requireRole("ADMIN");
  } catch (erro) {
    throw new Error(erro instanceof SemPermissao ? "Só administrador monta o OKR." : "Não foi possível confirmar sua sessão.");
  }
}

export async function salvarOkr(entrada: OkrView): Promise<({ ok: true; okr: OkrView }) | Falha> {
  let ctx;
  try {
    ctx = await admin();
  } catch (erro) {
    return { ok: false, erro: (erro as Error).message };
  }
  if (!ctx) return { ok: false, erro: "Sem banco configurado." };
  const problema = problemaDoOkr(entrada);
  if (problema) return { ok: false, erro: problema };

  const krs = entrada.krs.map((k, i) => ({
    id: k.id || `kr${i + 1}`,
    titulo: k.titulo.trim(),
    metrica: k.metrica,
    meta: k.meta,
    linhaDeBase: k.linhaDeBase ?? null,
    linhaDeBaseNota: (k.linhaDeBaseNota ?? "").trim(),
    metasMensais: k.metasMensais ?? {},
    corte: k.corte || null,
    regra: (k.regra ?? "").trim(),
  }));
  const dados = { objetivo: entrada.objetivo.trim(), inicio: entrada.inicio, fim: entrada.fim, contexto: (entrada.contexto ?? "").trim(), krs, atualizadoPor: (await getSession())?.name ?? null };
  try {
    const linha = entrada.id
      ? await ctx.prisma.okr.update({ where: { id: entrada.id }, data: dados })
      : await ctx.prisma.okr.create({ data: dados });
    return { ok: true, okr: paraOkrView(linha) };
  } catch (erro) {
    console.error("[okr] salvar", erro);
    return { ok: false, erro: "O banco não aceitou agora. Se a página avisou que falta o db:push, é isso." };
  }
}

export async function excluirOkr(id: string): Promise<{ ok: true } | Falha> {
  let ctx;
  try {
    ctx = await admin();
  } catch (erro) {
    return { ok: false, erro: (erro as Error).message };
  }
  if (!ctx) return { ok: false, erro: "Sem banco configurado." };
  try {
    await ctx.prisma.okr.delete({ where: { id } });
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não deu para excluir agora." };
  }
}

/* ============================================================
   PESQUISA DE CONFIANÇA (KR1)
============================================================ */

export interface ConfiancaView {
  enviadaEm: string | null;
  resposta: RespostaDeConfianca | null;
  respondidaEm: string | null;
  origem: string;
  por: string | null;
}

export async function lerConfianca(responseId: string): Promise<({ ok: true; confianca: ConfiancaView | null; semTabela?: boolean }) | Falha> {
  const ctx = await tryRole("LEITURA", "nps");
  if (!ctx) return { ok: false, erro: "Entre na aplicação." };
  try {
    const l = await ctx.prisma.confiancaDoNps.findUnique({ where: { responseId } });
    return {
      ok: true,
      confianca: l
        ? { enviadaEm: l.enviadaEm?.toISOString() ?? null, resposta: (l.resposta as RespostaDeConfianca | null) ?? null, respondidaEm: l.respondidaEm?.toISOString() ?? null, origem: l.origem, por: l.por }
        : null,
    };
  } catch {
    return { ok: true, confianca: null, semTabela: true };
  }
}

/**
 * Marca a pesquisa como enviada, grava a resposta ou desfaz. A resposta
 * sem envio registrado conta o envio no mesmo instante — quem perguntou
 * pelo telefone não precisa de dois cliques.
 */
export async function registrarConfianca(
  responseId: string,
  acao: { tipo: "enviada" } | { tipo: "resposta"; resposta: RespostaDeConfianca } | { tipo: "desfazer" }
): Promise<({ ok: true; confianca: ConfiancaView | null }) | Falha> {
  let ctx;
  try {
    ctx = await requireRole("AGENTE", "nps");
  } catch (erro) {
    return { ok: false, erro: erro instanceof SemPermissao ? "Seu acesso ao NPS é só de leitura." : "Não foi possível confirmar sua sessão." };
  }
  if (!ctx) return { ok: false, erro: "Sem banco configurado." };
  const por = (await getSession())?.name ?? null;
  try {
    const existe = await ctx.prisma.npsResponse.findUnique({ where: { id: responseId }, select: { id: true } });
    if (!existe) return { ok: false, erro: "Essa resposta do NPS não existe mais." };
    if (acao.tipo === "desfazer") {
      await ctx.prisma.confiancaDoNps.deleteMany({ where: { responseId } });
      return { ok: true, confianca: null };
    }
    const agora = new Date();
    const atual = await ctx.prisma.confiancaDoNps.findUnique({ where: { responseId } });
    const dados =
      acao.tipo === "enviada"
        ? { enviadaEm: atual?.enviadaEm ?? agora, origem: "manual", por }
        : { enviadaEm: atual?.enviadaEm ?? agora, resposta: acao.resposta, respondidaEm: agora, origem: "manual", por };
    const l = await ctx.prisma.confiancaDoNps.upsert({ where: { responseId }, create: { responseId, ...dados }, update: dados });
    return {
      ok: true,
      confianca: { enviadaEm: l.enviadaEm?.toISOString() ?? null, resposta: (l.resposta as RespostaDeConfianca | null) ?? null, respondidaEm: l.respondidaEm?.toISOString() ?? null, origem: l.origem, por: l.por },
    };
  } catch (erro) {
    console.error("[okr] confiança", erro);
    return { ok: false, erro: "Não foi gravado. Se a página do OKR avisa que falta o db:push, é isso." };
  }
}
