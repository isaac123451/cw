"use server";

import { unstable_cache } from "next/cache";

import { tryRole } from "@/lib/auth/guard";
import { getPrisma } from "@/lib/prisma";
import { CASES_TAG, WORKSPACE_TAG } from "@/lib/actions/tags";
import { familiaDoAssunto } from "@/lib/models/assuntos";
import { medirRegua, motorDaCausa, type RegistroClassificavel, type Regua } from "@/lib/models/catalogoDeCausas";
import { ROOT_CAUSES } from "@/lib/models/nps";
import { SOCIAL_SOURCES } from "@/lib/services/case.service";
import { CANAL_PARA_ORIGEM } from "@/lib/services/case.mapper";
import {
  REGRAS_DE_ASSUNTO,
  criarIndice,
  medirAcerto,
  sugerir,
  type Exemplo,
  type Sugestao,
} from "@/lib/models/sugestaoPorTexto";

/**
 * A sugestão de assunto do Reclame Aqui, pelo relato (roadmap 2.0, Fase
 * 15). "A parte de triagem dos casos achei interessante, você pode
 * enxergar margens que possa melhorar."
 *
 * **Por que é ação de servidor, e não conta na tela.** O relato de cada
 * caso (`description`) é texto pesado, deixado fora da carga normal da
 * lista por desempenho (ver `lib/actions/cases.ts`). Trazer os 356
 * relatos para o navegador só para sugerir um assunto pesaria a
 * abertura da plataforma inteira. Aqui o índice mora no servidor,
 * cacheado, e só o resultado da sugestão viaja.
 *
 * **A taxa de acerto é medida, não prometida** (`medirAcerto`): cada
 * relato recente é tirado da base e sugerido pelos outros — 356
 * relatos, medido em 17/09/2026: 64,6% de acerto cobrindo 97,5%, contra
 * 50,3% de chutar sempre a categoria mais comum (`npm run medir:sugestao`).
 */

/**
 * Só `getPrisma()` aqui, nunca `tryRole` — funções dentro de
 * `unstable_cache` não podem ler `cookies()` (é o que `tryRole` faz para
 * saber quem pergunta), porque o cache é para qualquer requisição, não
 * para uma sessão. A permissão é checada uma vez em
 * `sugerirAssuntoDoRelato`, fora do cache; aqui é leitura pura.
 */
async function lerExemplosRA(): Promise<Exemplo[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  const linhas = await prisma.case.findMany({
    where: { channel: "RECLAME_AQUI", categoryId: { not: null } },
    select: { id: true, protocol: true, title: true, description: true, category: { select: { name: true } } },
    take: 2000,
  });

  return linhas
    .filter((l) => l.category?.name)
    .map((l) => ({
      id: l.id,
      referencia: l.protocol,
      texto: `${l.title}\n${l.description ?? ""}`,
      rotulo: familiaDoAssunto(l.category!.name),
    }));
}

/**
 * A consulta é cacheada 5 min por etiqueta de caso: mexer num caso
 * invalida na hora, e o índice inteiro não se recalcula a cada tecla.
 */
const exemplosCacheados = unstable_cache(lerExemplosRA, ["sugestao-ra-assunto"], { tags: [CASES_TAG], revalidate: 300 });

const acertoCacheado = unstable_cache(
  async () => {
    const exemplos = await lerExemplosRA();
    return medirAcerto(exemplos, { ultimos: exemplos.length, regras: REGRAS_DE_ASSUNTO });
  },
  ["sugestao-ra-assunto-acerto"],
  { tags: [CASES_TAG], revalidate: 300 }
);

export interface SugestaoComAcerto {
  sugestao: Sugestao | null;
  /** `null` até haver base suficiente para a taxa dizer algo. */
  acerto: { taxa: number; base: number } | null;
}

/** Abaixo disto, a taxa medida é ruído — melhor não afirmar um número. */
const BASE_MINIMA_PARA_TAXA = 30;

export async function sugerirAssuntoDoRelato(entrada: { texto: string; excluirProtocol?: string }): Promise<SugestaoComAcerto> {

  const texto = entrada.texto.trim();
  if (texto.length < 8) return { sugestao: null, acerto: null };

  const ctx = await tryRole("LEITURA", "reclame-aqui");
  if (!ctx) return { sugestao: null, acerto: null };

  const exemplos = await exemplosCacheados();
  const indice = criarIndice(exemplos);
  const excluirId = entrada.excluirProtocol ? exemplos.find((e) => e.referencia === entrada.excluirProtocol)?.id : undefined;

  const sugestao = sugerir(texto, { indice, regras: REGRAS_DE_ASSUNTO, excluirId });
  const medida = await acertoCacheado();

  return {
    sugestao,
    acerto: medida.taxa !== null && medida.sugeridos >= BASE_MINIMA_PARA_TAXA ? { taxa: medida.taxa, base: medida.sugeridos } : null,
  };
}

/* ============================================================
   CAUSA RAIZ — A MESMA RÉGUA NAS QUATRO FRENTES (Fase 27)
============================================================ */

/**
 * Os registros das quatro frentes, com o texto e a causa gravada.
 *
 * Mesma regra de `lerExemplosRA`: só `getPrisma()` dentro do cache. O
 * relato e o post das redes não estão na carga da lista — por isso a
 * sugestão de causa é do servidor, e não conta da tela.
 */
async function lerRegistrosDasCausas(): Promise<RegistroClassificavel[]> {
  const prisma = getPrisma();
  if (!prisma) return [];
  const [casos, nps, google] = await Promise.all([
    prisma.case.findMany({ select: { id: true, title: true, description: true, causaRaiz: true, channel: true }, orderBy: { createdAt: "desc" }, take: 4000 }),
    prisma.npsResponse.findMany({ where: { comment: { not: "" } }, select: { id: true, comment: true, rootCause: true }, orderBy: { respondedAt: "desc" }, take: 3000 }),
    prisma.avaliacaoGoogle.findMany({ where: { texto: { not: null } }, select: { id: true, texto: true, causaRaiz: true }, orderBy: { publicadaEm: "desc" }, take: 3000 }),
  ]);
  return [
    ...casos.map((c) => ({
      id: c.id,
      frente: SOCIAL_SOURCES.includes(CANAL_PARA_ORIGEM[c.channel] ?? "") ? ("redes" as const) : ("reclame-aqui" as const),
      texto: `${c.title}\n${c.description ?? ""}`,
      causa: c.causaRaiz,
    })),
    ...nps.map((n) => ({ id: n.id, frente: "nps" as const, texto: n.comment, causa: n.rootCause })),
    ...google.map((g) => ({ id: g.id, frente: "google" as const, texto: g.texto ?? "", causa: g.causaRaiz })),
  ];
}

/** O catálogo com as palavras — sem elas enquanto o `db:push` da Fase 27 não roda. */
async function lerCatalogoDasCausas(): Promise<{ name: string; active: boolean; palavras?: string[] }[]> {
  const prisma = getPrisma();
  if (!prisma) return [];
  let linhas: { name: string; active: boolean; palavras?: string[] }[];
  try {
    linhas = await prisma.npsRootCause.findMany({ select: { name: true, active: true, palavras: true }, orderBy: { order: "asc" } });
  } catch (erro) {
    if ((erro as { code?: string })?.code !== "P2022") throw erro;
    linhas = await prisma.npsRootCause.findMany({ select: { name: true, active: true }, orderBy: { order: "asc" } });
  }
  return linhas.length ? linhas : ROOT_CAUSES.map((name) => ({ name, active: true }));
}

const registrosCacheados = unstable_cache(lerRegistrosDasCausas, ["causa-raiz-registros"], { tags: [CASES_TAG, WORKSPACE_TAG], revalidate: 300 });
const catalogoCacheado = unstable_cache(lerCatalogoDasCausas, ["causa-raiz-catalogo"], { tags: [WORKSPACE_TAG], revalidate: 300 });
const reguaCacheada = unstable_cache(
  async () => medirRegua(await lerRegistrosDasCausas(), await lerCatalogoDasCausas()),
  ["causa-raiz-regua"],
  { tags: [CASES_TAG, WORKSPACE_TAG], revalidate: 300 }
);

/*
  O índice não passa pelo cache do Next (Map e RegExp não viajam em
  JSON): fica neste módulo por um minuto, para a sugestão não refazer a
  conta a cada tecla.
*/
let motorEmMemoria: { em: number; motor: ReturnType<typeof motorDaCausa> } | null = null;

async function motorAtual() {
  if (motorEmMemoria && Date.now() - motorEmMemoria.em < 60_000) return motorEmMemoria.motor;
  const motor = motorDaCausa(await registrosCacheados(), await catalogoCacheado());
  motorEmMemoria = { em: Date.now(), motor };
  return motor;
}

/**
 * A causa raiz sugerida pelo texto — a mesma conta no Reclame Aqui, nas
 * redes, no NPS e no Google. `excluirId`: o próprio registro, para a
 * sugestão não se apoiar na causa que ele já tem.
 */
export async function sugerirCausaRaiz(entrada: { texto: string; excluirId?: string }): Promise<SugestaoComAcerto> {
  const texto = entrada.texto.trim();
  if (texto.length < 8) return { sugestao: null, acerto: null };

  const ctx = await tryRole("LEITURA");
  if (!ctx) return { sugestao: null, acerto: null };

  const motor = await motorAtual();
  const sugestao = sugerir(texto, { indice: motor.indice, regras: motor.regras, valoresValidos: motor.validos, excluirId: entrada.excluirId, k: 5 });

  const regua = await reguaCacheada();
  const frentes = Object.values(regua.porFrente);
  const sugeridos = frentes.reduce((n, f) => n + f.sugeridos, 0);
  const acertos = frentes.reduce((n, f) => n + f.acertos, 0);

  return { sugestao, acerto: sugeridos >= BASE_MINIMA_PARA_TAXA ? { taxa: acertos / sugeridos, base: sugeridos } : null };
}

/** A régua de cada frente, para a tela Causas raiz. */
export async function medirReguaDasCausas(): Promise<{ ok: true; regua: Regua } | { ok: false; erro: string }> {
  const ctx = await tryRole("LEITURA");
  if (!ctx) return { ok: false, erro: "Sem banco configurado — a régua é medida nos registros do banco." };
  try {
    return { ok: true, regua: await reguaCacheada() };
  } catch (erro) {
    console.error("[causa raiz] régua", erro);
    return { ok: false, erro: "O banco não respondeu agora. Tente de novo em instantes." };
  }
}
