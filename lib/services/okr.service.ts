import type { PrismaClient } from "@prisma/client";

import {
  confiancaRecuperada,
  leituraDoMes,
  mesesDoOkr,
  npsDasNotas,
  ultimoDiaDoMes,
  type DetratorDoKr,
  type KrCalculado,
  type LeituraDoPainel,
  type OkrView,
  type ResultadoChave,
  type RespostaDeConfianca,
} from "@/lib/models/okr";
import { ehDiaUtil, paredeDe, proximoDiaUtil, type Expediente } from "@/lib/services/horasUteis";
import { lerExpediente } from "@/lib/services/operacao.service";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

/**
 * O realizado de cada OKR (04/11/2026) — ver `lib/models/okr.ts`.
 *
 * As tabelas novas (`Okr`, `ConfiancaDoNps`) podem ainda não existir no
 * banco (antes do db:push): a leitura devolve `semTabela` e a tela diz o
 * que falta, em vez de quebrar.
 */

const dia = (d: Date | null | undefined) => (d ? paredeDe(d).dia : null);

function tabelaQueFalta(erro: unknown) {
  const codigo = (erro as { code?: string })?.code;
  return codigo === "P2021" || codigo === "P2022" || /does not exist/i.test(String((erro as Error)?.message ?? ""));
}

export function paraOkrView(l: { id: string; objetivo: string; inicio: string; fim: string; contexto: string; krs: unknown; atualizadoEm: Date; atualizadoPor: string | null }): OkrView {
  return {
    id: l.id,
    objetivo: l.objetivo,
    inicio: l.inicio,
    fim: l.fim,
    contexto: l.contexto,
    krs: Array.isArray(l.krs) ? (l.krs as ResultadoChave[]) : [],
    atualizadoEm: l.atualizadoEm.toISOString(),
    atualizadoPor: l.atualizadoPor,
  };
}

export async function lerOkrsDoBanco(prisma: PrismaClient): Promise<{ okrs: OkrView[]; semTabela: boolean }> {
  try {
    const linhas = await prisma.okr.findMany({ orderBy: [{ inicio: "desc" }, { criadoEm: "asc" }] });
    return { okrs: linhas.map(paraOkrView), semTabela: false };
  } catch (erro) {
    if (tabelaQueFalta(erro)) return { okrs: [], semTabela: true };
    throw erro;
  }
}

/** O último dia útil do mês, pelo expediente da operação (feriados incluídos). */
export function ultimoDiaUtilDoMes(mes: string, expediente: Expediente) {
  let cursor = ultimoDiaDoMes(mes);
  for (let i = 0; i < 31 && !ehDiaUtil(cursor, expediente); i += 1) {
    const d = new Date(`${cursor}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    cursor = d.toISOString().slice(0, 10);
  }
  return cursor;
}

/** A conta do detrator: o id da conta no Wootric, o estabelecimento, o e-mail — nessa ordem. */
const contaDe = (r: { externalCompanyId: string | null; establishmentId: string | null; email: string | null; customer: string; id: string }) =>
  r.externalCompanyId ?? r.establishmentId ?? r.email?.toLowerCase() ?? r.customer ?? r.id;

/** Os detratores da vigência, com a pesquisa de confiança, prontos para o modelo. */
export async function detratoresDoPeriodo(prisma: PrismaClient, inicio: string, fim: string, expediente?: Expediente) {
  const exp = expediente ?? (await lerExpediente(prisma));
  const respostas = await prisma.npsResponse.findMany({
    where: { score: { lte: 6 }, respondedAt: { gte: new Date(`${inicio}T03:00:00Z`), lt: new Date(Date.parse(`${fim}T03:00:00Z`) + 86_400_000) } },
    select: { id: true, respondedAt: true, firstContactAt: true, confirmedAt: true, externalCompanyId: true, establishmentId: true, email: true, customer: true },
  });
  let pesquisas: { responseId: string; enviadaEm: Date | null; resposta: string | null; respondidaEm: Date | null }[] = [];
  let semTabela = false;
  try {
    pesquisas = respostas.length
      ? await prisma.confiancaDoNps.findMany({ where: { responseId: { in: respostas.map((r) => r.id) } }, select: { responseId: true, enviadaEm: true, resposta: true, respondidaEm: true } })
      : [];
  } catch (erro) {
    if (!tabelaQueFalta(erro)) throw erro;
    semTabela = true;
  }
  const pesquisa = new Map(pesquisas.map((p) => [p.responseId, p]));

  const detratores: DetratorDoKr[] = respostas.map((r) => {
    const d = dia(r.respondedAt)!;
    const limite = proximoDiaUtil(proximoDiaUtil(d, exp), exp);
    const contatado = dia(r.firstContactAt);
    const p = pesquisa.get(r.id);
    const resposta = p?.resposta === "sim" || p?.resposta === "parcialmente" || p?.resposta === "nao" ? (p.resposta as RespostaDeConfianca) : null;
    return {
      id: r.id,
      conta: contaDe(r),
      dia: d,
      contatadoDia: contatado,
      contatadoNoPrazo: Boolean(contatado && contatado <= limite),
      confirmadoDia: dia(r.confirmedAt),
      enviadaDia: dia(p?.enviadaEm),
      resposta,
      respondidaDia: resposta ? dia(p?.respondidaEm) ?? dia(p?.enviadaEm) : null,
    };
  });
  return { detratores, semTabela };
}

/** O realizado de cada KR, mês a mês. */
export async function calcularOkr(prisma: PrismaClient, okr: OkrView, hoje = hojeNaOperacao()): Promise<KrCalculado[]> {
  const meses = mesesDoOkr(okr.inicio, okr.fim);
  const mesDeHoje = hoje.slice(0, 7);
  const expediente = await lerExpediente(prisma);
  const precisa = new Set(okr.krs.map((k) => k.metrica));

  const npsNecessario = precisa.has("nps-confianca") || precisa.has("nps-contato-2du");
  const { detratores, semTabela } = npsNecessario ? await detratoresDoPeriodo(prisma, okr.inicio, okr.fim, expediente) : { detratores: [], semTabela: false };

  const notasDoMes = new Map<string, number[]>();
  if (precisa.has("nps-score")) {
    const todas = await prisma.npsResponse.findMany({
      where: { respondedAt: { gte: new Date(`${okr.inicio}T03:00:00Z`), lt: new Date(Date.parse(`${okr.fim}T03:00:00Z`) + 86_400_000) } },
      select: { score: true, respondedAt: true },
    });
    for (const r of todas) {
      const m = dia(r.respondedAt)!.slice(0, 7);
      notasDoMes.set(m, [...(notasDoMes.get(m) ?? []), r.score]);
    }
  }

  const leituras: LeituraDoPainel[] = [];
  if ([...precisa].some((m) => m.startsWith("ra-"))) {
    const linhas = await prisma.painelDoPortal.findMany({
      where: { tipo: "SIX_MONTHS", lidoEm: { gte: new Date(`${okr.inicio}T03:00:00Z`), lt: new Date(Date.parse(`${okr.fim}T03:00:00Z`) + 86_400_000) } },
      orderBy: { lidoEm: "asc" },
      select: { lidoEm: true, dados: true },
    });
    for (const l of linhas) {
      const d = l.dados as { voltaria?: number | null; nota?: number | null; solucao?: number | null; resposta?: number | null };
      leituras.push({ dia: dia(l.lidoEm)!, voltaria: d.voltaria ?? null, nota: d.nota ?? null, solucao: d.solucao ?? null, resposta: d.resposta ?? null });
    }
  }

  return okr.krs.map((kr) => {
    const linhaDoMes = (mes: string): { realizado: number | null; confianca?: ReturnType<typeof confiancaRecuperada> } => {
      if (mes > mesDeHoje) return { realizado: null };
      const fimDoMes = ultimoDiaDoMes(mes);
      const ate = fimDoMes < hoje ? fimDoMes : hoje;
      switch (kr.metrica) {
        case "nps-confianca": {
          const c = confiancaRecuperada(detratores, { inicio: okr.inicio, corte: kr.corte, ate });
          return { realizado: c.elegiveis ? c.percentual ?? 0 : null, confianca: c };
        }
        case "nps-contato-2du": {
          const c = confiancaRecuperada(detratores, { inicio: okr.inicio, corte: kr.corte, ate });
          return { realizado: c.percentualNoPrazo, confianca: c };
        }
        case "nps-score":
          return { realizado: npsDasNotas(notasDoMes.get(mes) ?? []) };
        default: {
          const l = leituraDoMes(leituras, mes, ultimoDiaUtilDoMes(mes, expediente), hoje);
          const campo = kr.metrica === "ra-voltaria" ? "voltaria" : kr.metrica === "ra-nota" ? "nota" : kr.metrica === "ra-solucao" ? "solucao" : "resposta";
          return { realizado: l?.[campo] ?? null };
        }
      }
    };

    const linhas = meses.map((mes) => ({ mes, ...linhaDoMes(mes) }));
    const atualMes = mesDeHoje < okr.inicio.slice(0, 7) ? null : mesDeHoje > okr.fim.slice(0, 7) ? meses[meses.length - 1] : mesDeHoje;
    const atual = atualMes ? linhas.find((l) => l.mes === atualMes) : undefined;
    const metaDeAgora = atualMes ? kr.metasMensais[atualMes] ?? (atualMes === meses[meses.length - 1] ? kr.meta : null) : null;
    const aviso =
      kr.metrica === "nps-confianca" && semTabela
        ? "A pesquisa de confiança ainda não tem onde ser guardada: falta rodar o npm run db:push."
        : kr.metrica.startsWith("ra-") && atual && atual.realizado == null
          ? "O vigia ainda não leu o painel do Reclame Aqui neste mês."
          : undefined;
    return {
      kr,
      atual: atual?.realizado ?? null,
      metaDeAgora,
      meses: linhas.map((l) => ({ mes: l.mes, meta: kr.metasMensais[l.mes] ?? null, realizado: l.realizado, futuro: l.mes > mesDeHoje, emCurso: l.mes === mesDeHoje })),
      confianca: atual?.confianca,
      aviso,
    };
  });
}

export interface PendenteDaConfianca {
  id: string;
  nome: string;
  nota: number;
  /** "confirmar" (contatado, sem a solução confirmada) · "perguntar" (confirmada, sem pesquisa) · "aguardando" (enviada, sem resposta) · "contatar". */
  passo: "contatar" | "confirmar" | "perguntar" | "aguardando";
  desde: string;
}

/**
 * O que falta para o KR1 andar, por pessoa: o próximo passo de cada
 * detrator elegível que ainda não é sucesso. A ordem é a do funil — quem
 * já está perto ("perguntar", "aguardando") vem primeiro, porque é onde
 * um passo vira ponto no KR.
 */
export async function pendentesDaConfianca(prisma: PrismaClient, inicio: string, corte: string, hoje = hojeNaOperacao()): Promise<PendenteDaConfianca[]> {
  const ate = corte < hoje ? corte : hoje;
  const respostas = await prisma.npsResponse.findMany({
    where: { score: { lte: 6 }, respondedAt: { gte: new Date(`${inicio}T03:00:00Z`), lt: new Date(Date.parse(`${ate}T03:00:00Z`) + 86_400_000) } },
    select: { id: true, score: true, customer: true, customerName: true, company: true, respondedAt: true, firstContactAt: true, confirmedAt: true, status: true },
    orderBy: { respondedAt: "asc" },
  });
  let pesquisas: { responseId: string; enviadaEm: Date | null; resposta: string | null }[] = [];
  try {
    pesquisas = respostas.length ? await prisma.confiancaDoNps.findMany({ where: { responseId: { in: respostas.map((r) => r.id) } }, select: { responseId: true, enviadaEm: true, resposta: true } }) : [];
  } catch (erro) {
    if (!tabelaQueFalta(erro)) throw erro;
  }
  const pesquisa = new Map(pesquisas.map((p) => [p.responseId, p]));
  const ORDEM = { perguntar: 0, aguardando: 1, confirmar: 2, contatar: 3 } as const;
  const lista: PendenteDaConfianca[] = [];
  for (const r of respostas) {
    const p = pesquisa.get(r.id);
    if (p?.resposta) continue;
    const passo: PendenteDaConfianca["passo"] = p?.enviadaEm ? "aguardando" : r.confirmedAt ? "perguntar" : r.firstContactAt ? "confirmar" : "contatar";
    lista.push({
      id: r.id,
      nome: r.company || r.customerName || r.customer,
      nota: r.score,
      passo,
      desde: dia(p?.enviadaEm ?? r.confirmedAt ?? r.firstContactAt ?? r.respondedAt)!,
    });
  }
  return lista.sort((a, b) => ORDEM[a.passo] - ORDEM[b.passo] || a.desde.localeCompare(b.desde));
}
