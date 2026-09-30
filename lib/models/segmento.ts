/**
 * Comparação com o segmento (Fase 30, 1.107) — a parte sem banco.
 *
 * "A reputação de empresas parecidas lida das páginas públicas do Reclame
 * Aqui, lado a lado com a da Cardápio Web." A extensão lê a lista pública
 * de cada empresa uma vez por dia; aqui ficam o endereço curto de cada uma
 * e a ordem da tabela.
 */

export const SLUG_DA_EMPRESA = /^[a-z0-9-]{2,80}$/;

/** O selo como o portal o nomeia na página. */
export const SELO_DO_PORTAL: Record<string, string> = {
  RA1000: "RA1000",
  GREAT: "Ótimo",
  GOOD: "Bom",
  REGULAR: "Regular",
  BAD: "Ruim",
  NOT_RECOMMENDED: "Não recomendada",
};

/** Até quantas empresas parecidas a extensão lê por dia. */
export const MAXIMO_DE_CONCORRENTES = 10;

/**
 * O endereço curto a partir do que a pessoa colou: o link da página da
 * empresa no Reclame Aqui (qualquer aba dela) ou o próprio endereço curto.
 * `null` quando não dá para saber qual empresa é.
 */
export function slugDoEndereco(texto: string): string | null {
  const limpo = texto.trim().toLowerCase();
  const doLink = limpo.match(/reclameaqui\.com\.br\/empresa\/([a-z0-9-]+)/);
  const slug = doLink ? doLink[1] : limpo.replace(/^\/+|\/+$/g, "");
  return SLUG_DA_EMPRESA.test(slug) ? slug : null;
}

export interface PosicaoNoSegmento {
  posicao: number;
  /** "BEST" no ranking das melhores, "WORST" no das piores. */
  tipo: string;
  segmento: string;
}

export interface LinhaDoSegmento {
  slug: string;
  nome: string;
  casa: boolean;
  nota: number | null;
  resposta: number | null;
  solucao: number | null;
  voltaria: number | null;
  notaConsumidor: number | null;
  recebidas: number | null;
  tempoMedio: string;
  selo: string;
  posicao: PosicaoNoSegmento | null;
  /** A nota do mesmo período cerca de 30 dias antes, quando já havia leitura. */
  notaAntes: number | null;
  lidoEm: string;
}

/**
 * A ordem da tabela: nota do período, da maior para a menor; sem nota
 * (empresa com poucas reclamações) no fim. A Cardápio Web fica onde a
 * nota a põe — é essa posição que interessa ver.
 */
export function ordenarSegmento(linhas: LinhaDoSegmento[]) {
  return [...linhas].sort((a, b) => (b.nota ?? -1) - (a.nota ?? -1) || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Em que lugar a Cardápio Web fica entre as empresas comparadas (1 = melhor). */
export function lugarDaCasa(linhas: LinhaDoSegmento[]) {
  const comNota = ordenarSegmento(linhas).filter((l) => l.nota !== null);
  const i = comNota.findIndex((l) => l.casa);
  return i < 0 ? null : { lugar: i + 1, de: comNota.length };
}
