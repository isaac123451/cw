"use server";

import { unstable_cache } from "next/cache";

import { tryRole } from "@/lib/auth/guard";
import { getPrisma } from "@/lib/prisma";
import { CASES_TAG } from "@/lib/actions/tags";
import { familiaDoAssunto } from "@/lib/models/assuntos";
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
