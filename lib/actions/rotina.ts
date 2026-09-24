"use server";

import { requireRole, SemPermissao, tryRole } from "@/lib/auth/guard";
import { cicloDe } from "@/lib/models/ciclo";
import type { PrismaClient } from "@prisma/client";

import {
  ROTINA_PADRAO,
  type AtividadeDaRotina,
  type CategoriaDaRotina,
  type ChaveDaRotina,
  type Frequencia,
} from "@/lib/models/rotina";
import { persistencia, ROTULO_DO_PERIODO, faixaDoPeriodo } from "@/lib/models/cadencia";
import type { ItemDaRotina, MarcaDeItem, TipoDeMarcaDeItem } from "@/lib/models/meuDia";
import { ADIAR_NO_MAXIMO_DIAS, ateDoAdiamento } from "@/lib/models/meuDia";
import type { LinhaDeMetrica } from "@/lib/actions/metricas";

import { lerExpediente } from "@/lib/services/operacao.service";
import { SOCIAL_SOURCES } from "@/lib/services/case.service";
import { CANAL_PARA_ORIGEM } from "@/lib/services/case.mapper";
import { descreverRegistro, paredeDe, ehDiaUtil } from "@/lib/services/horasUteis";
import { ESPERA_DO_RETORNO_MIN } from "@/lib/models/tratativa";

/**
 * A rotina do agente: o cadastro das atividades e as marcas de feito.
 *
 * O cadastro é da equipe (a rotina é uma só, a do documento, ajustada);
 * as marcas são de cada pessoa — o que eu fiz hoje não é o que o colega
 * fez. Tudo com resposta do servidor e erro em português.
 */

type Falha = { ok: false; erro: string };

const FREQUENCIAS: Frequencia[] = ["diaria", "semanal", "continua"];
const CATEGORIAS: CategoriaDaRotina[] = ["Operacional", "Organização", "Demandas Internas", "Gestão"];

async function quem(minimo: "AGENTE" | "LEITURA" = "AGENTE") {
  try {
    const ctx = minimo === "LEITURA" ? await tryRole("LEITURA") : await requireRole("AGENTE");
    if (!ctx) return { erro: "Sem banco configurado — nada é gravado no modo demonstração." } as const;
    return { ctx } as const;
  } catch (erro) {
    return { erro: erro instanceof SemPermissao ? erro.message : "Não foi possível confirmar sua sessão. Entre de novo." } as const;
  }
}

function paraView(r: {
  id: string;
  titulo: string;
  descricao: string | null;
  frequencia: string;
  diasDaSemana: number[];
  horario: string | null;
  duracaoMin: number;
  categoria: string;
  chave: string | null;
  link: string | null;
  ordem: number;
  ativa: boolean;
}): AtividadeDaRotina {
  return {
    id: r.id,
    titulo: r.titulo,
    descricao: r.descricao ?? undefined,
    frequencia: r.frequencia as Frequencia,
    diasDaSemana: r.diasDaSemana,
    horario: r.horario ?? undefined,
    duracaoMin: r.duracaoMin,
    categoria: r.categoria as CategoriaDaRotina,
    chave: (r.chave ?? undefined) as ChaveDaRotina | undefined,
    link: r.link ?? undefined,
    ordem: r.ordem,
    ativa: r.ativa,
  };
}

/**
 * Grava as do documento, quando o banco ainda não tem nenhuma.
 *
 * Devolve o mapa "padrao-rotina-N" → id de verdade, para uma marca feita
 * antes de alguém salvar o cadastro encontrar a atividade que ela marca.
 */
async function semearRotina(prisma: PrismaClient) {
  const existentes = await prisma.atividadeDaRotina.count();
  const mapa = new Map<string, string>();
  if (existentes > 0) return mapa;
  for (const a of ROTINA_PADRAO) {
    const criada = await prisma.atividadeDaRotina.create({
      data: {
        titulo: a.titulo,
        descricao: a.descricao ?? null,
        frequencia: a.frequencia,
        diasDaSemana: a.diasDaSemana,
        horario: a.horario ?? null,
        duracaoMin: a.duracaoMin,
        categoria: a.categoria,
        chave: a.chave ?? null,
        link: a.link ?? null,
        ordem: a.ordem,
        ativa: a.ativa,
      },
      select: { id: true },
    });
    mapa.set(a.id, criada.id);
  }
  return mapa;
}

function problemaDa(a: AtividadeDaRotina): string | null {
  if (!a.titulo.trim()) return "Toda atividade precisa de um nome.";
  if (!FREQUENCIAS.includes(a.frequencia)) return `"${a.titulo}": frequência inválida.`;
  if (!CATEGORIAS.includes(a.categoria)) return `"${a.titulo}": categoria inválida.`;
  if (a.frequencia === "semanal" && a.diasDaSemana.length === 0) return `"${a.titulo}" é semanal: escolha ao menos um dia da semana.`;
  if (a.diasDaSemana.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) return `"${a.titulo}": dia da semana inválido.`;
  if (a.horario && !/^([01]\d|2[0-3]):[0-5]\d$/.test(a.horario)) return `"${a.titulo}": horário no formato 09:30.`;
  if (!Number.isInteger(a.duracaoMin) || a.duracaoMin < 0 || a.duracaoMin > 480) return `"${a.titulo}": duração de 0 a 480 minutos.`;
  if (a.link && !a.link.startsWith("/") && !/^https?:\/\//.test(a.link)) return `"${a.titulo}": o atalho começa com / (tela da plataforma) ou http.`;
  return null;
}

/** As atividades cadastradas — ou as do documento, com o banco vazio. */
export async function listarRotina(): Promise<AtividadeDaRotina[]> {
  const ctx = await tryRole("LEITURA");
  if (!ctx) return ROTINA_PADRAO;
  const linhas = await ctx.prisma.atividadeDaRotina.findMany({ orderBy: [{ ordem: "asc" }, { titulo: "asc" }] });
  return linhas.length ? linhas.map(paraView) : ROTINA_PADRAO;
}

/**
 * Grava o cadastro inteiro da rotina.
 *
 * O que sai da lista não é apagado: vira inativo. As marcas de quem já
 * fez a atividade são histórico (a sequência de dias depende delas), e
 * reativar depois devolve tudo.
 */
export async function salvarRotina(
  lista: AtividadeDaRotina[]
): Promise<{ ok: true; atividades: AtividadeDaRotina[]; criadas: number; alteradas: number; desativadas: number } | Falha> {

  for (const a of lista) {
    const p = problemaDa(a);
    if (p) return { ok: false, erro: p };
  }

  const q = await quem();
  if ("erro" in q) return { ok: false, erro: q.erro! };
  const prisma = q.ctx.prisma;

  try {
    const mapa = await semearRotina(prisma);
    const atuais = await prisma.atividadeDaRotina.findMany();
    const porId = new Map(atuais.map((r) => [r.id, r]));

    let criadas = 0;
    let alteradas = 0;
    const mantidas = new Set<string>();

    for (const [i, a] of lista.entries()) {
      const dados = {
        titulo: a.titulo.trim().slice(0, 140),
        descricao: a.descricao?.trim() || null,
        frequencia: a.frequencia,
        diasDaSemana: a.frequencia === "semanal" ? [...new Set(a.diasDaSemana)].sort() : [],
        horario: a.horario || null,
        duracaoMin: a.duracaoMin,
        categoria: a.categoria,
        chave: a.chave ?? null,
        link: a.link?.trim() || null,
        ordem: i,
        ativa: a.ativa,
      };

      const id = mapa.get(a.id) ?? a.id;
      const atual = porId.get(id);

      if (atual) {
        mantidas.add(id);
        const mudou = (Object.keys(dados) as (keyof typeof dados)[]).some((k) => JSON.stringify(atual[k]) !== JSON.stringify(dados[k]));
        if (mudou) {
          await prisma.atividadeDaRotina.update({ where: { id }, data: dados });
          alteradas += 1;
        }
      } else {
        const criada = await prisma.atividadeDaRotina.create({ data: dados, select: { id: true } });
        mantidas.add(criada.id);
        criadas += 1;
      }
    }

    const fora = atuais.filter((r) => !mantidas.has(r.id) && r.ativa).map((r) => r.id);
    if (fora.length) await prisma.atividadeDaRotina.updateMany({ where: { id: { in: fora } }, data: { ativa: false } });

    const atividades = (await prisma.atividadeDaRotina.findMany({ orderBy: { ordem: "asc" } })).map(paraView);
    return { ok: true, atividades, criadas, alteradas, desativadas: fora.length };
  } catch (erro) {
    console.error("[rotina] salvar", erro);
    return { ok: false, erro: "O banco não aceitou a gravação agora. Tente de novo em instantes." };
  }
}

/* ============================================================
   O MEU DIA — marcas, métrica, ligações e o resumo de ontem
============================================================ */

export interface ResumoDeOntem {
  dia: string;
  contatos: number;
  primeirosContatos: number;
  respostasPublicas: number;
  pedidosDeAvaliacao: number;
  tentativasNps: number;
  googleRespondidas: number;
  atividadesFeitas: number;
}

export interface CargaDoMeuDia {
  marcas: { atividadeId: string; dia: string }[];
  /** Os itens tirados das atividades que ainda valem hoje. */
  marcasDeItens: MarcaDeItem[];
  /** Casos com tentativa aguardando retorno há mais de 2 horas. */
  aguardandoRetorno: ItemDaRotina[];
  metricaHoje: LinhaDeMetrica | null;
  ligacoes: ItemDaRotina[];
  ontem: ResumoDeOntem | null;
  /** O relatório do ciclo de hoje: se já foi salvo. */
  relatorio: { ciclo: string; rotulo: string; salvo: boolean } | null;
}

function diaUtilAnterior(dia: string, expediente: Parameters<typeof ehDiaUtil>[1]) {
  let cursor = dia;
  for (let guarda = 0; guarda < 30; guarda++) {
    cursor = new Date(Date.parse(`${cursor}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    if (ehDiaUtil(cursor, expediente)) return cursor;
  }
  return cursor;
}

/**
 * Tudo o que o Meu dia precisa do servidor, numa ida só.
 *
 * - As marcas de quem abriu, dos últimos 60 dias (a sequência precisa).
 * - A métrica de hoje, para dizer o que falta preencher.
 * - As ligações do dia: a cadência de persistência de cada caso em
 *   aberto com tentativa sem resposta, pelo registro de contatos — é o
 *   mesmo cálculo da tela do caso, com o período ainda pouco tentado.
 * - O resumo do último dia útil, para o checkpoint com a gestão.
 */
export async function lerMeuDia(): Promise<CargaDoMeuDia> {

  const ctx = await tryRole("LEITURA");
  if (!ctx) return { marcas: [], marcasDeItens: [], aguardandoRetorno: [], metricaHoje: null, ligacoes: [], ontem: null, relatorio: null };

  const prisma = ctx.prisma;
  const agora = new Date();
  const hoje = paredeDe(agora).dia;
  const expediente = await lerExpediente(prisma);
  const desde = new Date(Date.parse(`${hoje}T00:00:00Z`) - 60 * 86_400_000).toISOString().slice(0, 10);
  const ontem = diaUtilAnterior(hoje, expediente);

  /* Os limites de "ontem" em Brasília, como instantes. */
  const ontemIni = new Date(Date.parse(`${ontem}T03:00:00Z`));
  const ontemFim = new Date(ontemIni.getTime() + 86_400_000);

  const ciclo = cicloDe(hoje);

  const [marcas, marcasDeItens, pendentes, metrica, emCadencia, contatosOntem, publicadasOntem, npsOntem, googleOntem, relatorioSalvo] = await Promise.all([
    prisma.marcaDaRotina.findMany({ where: { userId: ctx.userId, dia: { gte: desde } }, select: { atividadeId: true, dia: true } }),
    prisma.marcaDeItemDaRotina.findMany({
      where: { userId: ctx.userId, dia: { lte: hoje }, OR: [{ ate: null }, { ate: { gte: hoje } }] },
      orderBy: { criadoEm: "desc" },
      take: 2000,
    }),
    /* A tentativa que passou de 2 horas sem resposta: marcar sem retorno ou registrar a resposta. */
    prisma.caseContato.findMany({
      where: { tipo: "tentativa", resultado: "aguardando", em: { lte: new Date(agora.getTime() - ESPERA_DO_RETORNO_MIN * 60_000) }, case: { resolved: false } },
      select: { em: true, canal: true, case: { select: { id: true, protocol: true, externalId: true, title: true, customer: true, channel: true } } },
      orderBy: { em: "asc" },
      take: 200,
    }),
    prisma.metricaDiaria.findUnique({ where: { dia: hoje } }),
    prisma.case.findMany({
      where: { tentativasSemResposta: { gt: 0 }, resolved: false },
      select: { id: true, protocol: true, externalId: true, title: true, customer: true, channel: true, status: true, contatos: { select: { tipo: true, resultado: true, em: true } } },
      take: 200,
    }),
    prisma.caseContato.findMany({ where: { em: { gte: ontemIni, lt: ontemFim } }, select: { tipo: true } }),
    prisma.case.count({ where: { publicResponseAt: { gte: ontemIni, lt: ontemFim } } }),
    prisma.npsAttempt.count({ where: { createdAt: { gte: ontemIni, lt: ontemFim } } }),
    prisma.avaliacaoGoogle.count({ where: { respondidaEm: { gte: ontemIni, lt: ontemFim } } }),
    prisma.relatorioDoCiclo.count({ where: { ciclo: ciclo.id } }),
  ]);

  const ligacoes: ItemDaRotina[] = [];
  for (const c of emCadencia) {
    const p = persistencia(
      c.contatos.map((k) => ({ tipo: k.tipo as never, resultado: (k.resultado ?? undefined) as never, em: k.em.toISOString() })),
      agora,
      expediente
    );
    if (p.esgotada || !p.proximoDia || p.proximoDia > hoje) continue;
    const social = SOCIAL_SOURCES.includes(CANAL_PARA_ORIGEM[c.channel] ?? "");
    ligacoes.push({
      id: c.id,
      frente: social ? "redes" : "reclame-aqui",
      titulo: c.title,
      detalhe: `tentativa ${p.tentativas + 1} · ${p.periodo ? `${ROTULO_DO_PERIODO[p.periodo]} (${faixaDoPeriodo(p.periodo, expediente)})` : "hoje"} · ${c.customer}`,
      href: social ? `/redes-sociais/${c.externalId ?? c.protocol}` : `/reclame-aqui/${c.externalId ?? c.protocol}`,
      atrasado: p.proximoDia < hoje,
    });
  }

  const vistos = new Set<string>();
  const aguardandoRetorno: ItemDaRotina[] = [];
  for (const p of pendentes) {
    if (vistos.has(p.case.id)) continue;
    vistos.add(p.case.id);
    const social = SOCIAL_SOURCES.includes(CANAL_PARA_ORIGEM[p.case.channel] ?? "");
    aguardandoRetorno.push({
      id: p.case.id,
      frente: social ? "redes" : "reclame-aqui",
      titulo: p.case.title,
      detalhe: `tentativa por ${p.canal} de ${descreverRegistro(p.em.toISOString())} sem resposta há 2h — marcar sem retorno · ${p.case.customer}`,
      href: social ? `/redes-sociais/${p.case.externalId ?? p.case.protocol}` : `/reclame-aqui/${p.case.externalId ?? p.case.protocol}`,
    });
  }

  const marcasOntem = marcas.filter((m) => m.dia === ontem).length;

  return {
    marcas,
    marcasDeItens: marcasDeItens.map(paraMarcaDeItem),
    aguardandoRetorno,
    metricaHoje: metrica
      ? {
          dia: metrica.dia,
          entrantes: metrica.entrantes,
          notaReputacao: metrica.notaReputacao,
          respondidas: metrica.respondidas,
          naoRespondidas: metrica.naoRespondidas,
          notaConsumidor: metrica.notaConsumidor,
          voltariam: metrica.voltariam,
          resolvidasPct: metrica.resolvidasPct,
          tempoMedioHoras: metrica.tempoMedioHoras,
          churn: metrica.churn,
          retidos: metrica.retidos,
          visualizacoes: metrica.visualizacoes,
          ciclosComSelo: metrica.ciclosComSelo,
          desativadas: metrica.desativadas,
          resolvidasCiclo: metrica.resolvidasCiclo,
          preenchidoPor: metrica.preenchidoPor,
        }
      : null,
    ligacoes,
    relatorio: { ciclo: ciclo.id, rotulo: ciclo.rotulo, salvo: relatorioSalvo > 0 },
    ontem: {
      dia: ontem,
      contatos: contatosOntem.length,
      primeirosContatos: contatosOntem.filter((k) => k.tipo === "contato").length,
      respostasPublicas: publicadasOntem,
      pedidosDeAvaliacao: contatosOntem.filter((k) => k.tipo === "pedido-avaliacao").length,
      tentativasNps: npsOntem,
      googleRespondidas: googleOntem,
      atividadesFeitas: marcasOntem,
    },
  };
}

/**
 * As atividades feitas hoje por quem está logado — o conjunto inteiro.
 *
 * A tela manda o que ficou marcado; o que saiu, sai. Uma marca feita
 * antes de alguém salvar o cadastro (ids "padrao-…") materializa as
 * atividades do documento primeiro.
 */
export async function salvarMarcas(entrada: {
  dia: string;
  feitas: string[];
}): Promise<{ ok: true; feitas: string[]; marcadas: number; desmarcadas: number; atividades?: AtividadeDaRotina[] } | Falha> {

  if (!/^\d{4}-\d{2}-\d{2}$/.test(entrada.dia)) return { ok: false, erro: "Dia inválido." };

  const hoje = paredeDe(new Date()).dia;
  if (entrada.dia > hoje) return { ok: false, erro: "Não dá para marcar um dia que ainda não chegou." };

  const q = await quem();
  if ("erro" in q) return { ok: false, erro: q.erro! };
  const prisma = q.ctx.prisma;

  try {
    const mapa = entrada.feitas.some((id) => id.startsWith("padrao-")) ? await semearRotina(prisma) : new Map<string, string>();
    const feitas = [...new Set(entrada.feitas.map((id) => mapa.get(id) ?? id))];

    const validas = await prisma.atividadeDaRotina.findMany({ where: { id: { in: feitas } }, select: { id: true } });
    const ids = validas.map((v) => v.id);

    const antes = await prisma.marcaDaRotina.findMany({ where: { userId: q.ctx.userId, dia: entrada.dia }, select: { atividadeId: true } });
    const tinha = new Set(antes.map((m) => m.atividadeId));

    const novas = ids.filter((id) => !tinha.has(id));
    const saem = [...tinha].filter((id) => !ids.includes(id));

    if (novas.length) {
      await prisma.marcaDaRotina.createMany({
        data: novas.map((atividadeId) => ({ atividadeId, userId: q.ctx.userId, dia: entrada.dia })),
        skipDuplicates: true,
      });
    }
    if (saem.length) {
      await prisma.marcaDaRotina.deleteMany({ where: { userId: q.ctx.userId, dia: entrada.dia, atividadeId: { in: saem } } });
    }

    const atividades = mapa.size ? (await prisma.atividadeDaRotina.findMany({ orderBy: { ordem: "asc" } })).map(paraView) : undefined;

    return { ok: true, feitas: ids, marcadas: novas.length, desmarcadas: saem.length, atividades };
  } catch (erro) {
    console.error("[rotina] marcas", erro);
    return { ok: false, erro: "O banco não aceitou a gravação agora. Tente de novo em instantes." };
  }
}

/* ============================================================
   OS ITENS DE CADA ATIVIDADE — feito hoje, ou dispensado
============================================================ */

const CHAVES_DE_ITENS = new Set(["novos", "em-aberto", "fups", "moderacoes", "avaliacoes", "ligacoes", "concluidos", "areas", "pendencias", "metricas", "relatorio"]);

function paraMarcaDeItem(m: { id: string; chave: string; item: string; tipo: string; dia: string; ate: string | null; titulo: string }): MarcaDeItem {
  return { id: m.id, chave: m.chave as ChaveDaRotina, item: m.item, tipo: m.tipo as TipoDeMarcaDeItem, dia: m.dia, ate: m.ate, titulo: m.titulo };
}

/** Por quanto tempo vale a marca: só hoje, uma semana, ou até desfazer. */
export type DuracaoDaMarca = "hoje" | "semana" | "sempre";

function somarDias(dia: string, dias: number) {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Tira itens das atividades de hoje — "feito" ou "não se aplica".
 *
 * Nada é apagado nem muda no caso: a marca só diz ao Meu dia que aquele
 * item não é trabalho de hoje (ou desta semana, ou mais). Uma marca por
 * atividade: o mesmo caso em "novos" e em "FUPs" sai dos dois quando a
 * fila manda as duas chaves.
 */
export async function marcarItensDaRotina(entrada: {
  itens: { chave: string; item: string; titulo: string }[];
  tipo: TipoDeMarcaDeItem;
  duracao: DuracaoDaMarca;
  /** Só no `adiado`: o dia em que o item volta (AAAA-MM-DD, Brasília). */
  volta?: string;
}): Promise<{ ok: true; marcas: MarcaDeItem[] } | Falha> {

  if (entrada.tipo !== "feito" && entrada.tipo !== "dispensado" && entrada.tipo !== "adiado") return { ok: false, erro: "Marca inválida." };
  if (entrada.tipo !== "adiado" && !["hoje", "semana", "sempre"].includes(entrada.duracao)) return { ok: false, erro: "Duração inválida." };
  if (entrada.tipo === "feito" && entrada.duracao !== "hoje") return { ok: false, erro: "\"Feito\" vale só para hoje: amanhã a conta decide de novo." };
  if (!entrada.itens.length || entrada.itens.length > 200) return { ok: false, erro: "Escolha de 1 a 200 itens." };
  for (const i of entrada.itens) {
    if (!CHAVES_DE_ITENS.has(i.chave) || !i.item || i.item.length > 200) return { ok: false, erro: "Item inválido." };
  }

  const q = await quem();
  if ("erro" in q) return { ok: false, erro: q.erro! };
  const prisma = q.ctx.prisma;

  const hoje = paredeDe(new Date()).dia;
  let ate = entrada.duracao === "hoje" ? hoje : entrada.duracao === "semana" ? somarDias(hoje, 6) : null;
  if (entrada.tipo === "adiado") {
    ate = ateDoAdiamento(hoje, entrada.volta ?? "");
    if (!ate) return { ok: false, erro: `Escolha um dia depois de hoje, em até ${ADIAR_NO_MAXIMO_DIAS} dias.` };
  }

  try {
    const gravadas = await prisma.$transaction(
      entrada.itens.map((i) =>
        prisma.marcaDeItemDaRotina.upsert({
          where: { userId_chave_item_dia: { userId: q.ctx.userId, chave: i.chave, item: i.item, dia: hoje } },
          create: { userId: q.ctx.userId, chave: i.chave, item: i.item, tipo: entrada.tipo, dia: hoje, ate, titulo: i.titulo.slice(0, 200) },
          update: { tipo: entrada.tipo, ate, titulo: i.titulo.slice(0, 200) },
        })
      )
    );
    return { ok: true, marcas: gravadas.map(paraMarcaDeItem) };
  } catch (erro) {
    console.error("[rotina] marcar item", erro);
    return { ok: false, erro: "O banco não aceitou a gravação agora. Tente de novo em instantes." };
  }
}

/** Devolve o item à atividade: apaga a marca (só a de quem está logado). */
export async function desfazerMarcasDeItens(ids: string[]): Promise<{ ok: true; removidas: number } | Falha> {

  if (!ids.length || ids.length > 200) return { ok: false, erro: "Escolha de 1 a 200 marcas." };

  const q = await quem();
  if ("erro" in q) return { ok: false, erro: q.erro! };

  try {
    const r = await q.ctx.prisma.marcaDeItemDaRotina.deleteMany({ where: { id: { in: ids }, userId: q.ctx.userId } });
    if (r.count === 0) return { ok: false, erro: "Essa marca já não existe — a lista pode estar desatualizada. Recarregue a página." };
    return { ok: true, removidas: r.count };
  } catch (erro) {
    console.error("[rotina] desfazer item", erro);
    return { ok: false, erro: "O banco não aceitou agora. Tente de novo em instantes." };
  }
}
