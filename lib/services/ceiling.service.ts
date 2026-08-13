import { Case } from "@/lib/models/case";
import { CategoryOption } from "@/lib/models/settings";

import { parseElapsed } from "@/lib/services/reputation.service";
import { SlaSituation } from "@/lib/services/sla.service";

export interface CategoryTime {
  category: string;

  /** Média do tempo de resposta, em minutos. */
  averageMinutes: number;

  /** Reclamações com tempo preenchido — a base da média. */
  samples: number;

  ceilingHours?: number;

  /** Percentual do teto já consumido. Sem teto, fica indefinido. */
  usage?: number;

  situation: SlaSituation;
}

/**
 * Tempo médio de resposta por categoria, comparado ao teto declarado.
 *
 * O SLA de `sla.service` cobra caso a caso; aqui a unidade é a média do
 * conjunto, que é o número que o Reclame Aqui publica e o que a operação
 * persegue. Um caso isolado pode estourar sem que a média saia do teto —
 * e é justamente essa diferença que justifica os dois indicadores.
 *
 * O teto vem do cadastro de categorias (Configurar fluxo). Categoria que
 * aparece nos casos mas não existe no cadastro fica sem teto, em vez de
 * sumir da tela: é o mesmo problema que `OrphanCategories` já aponta.
 */
export function averageResponseByCategory(
  cases: Case[],
  categories: CategoryOption[]
): CategoryTime[] {

  const soma = new Map<string, number>();
  const contagem = new Map<string, number>();

  for (const item of cases) {

    const minutos = parseElapsed(item.responseTime);

    // Sem tempo preenchido não entra na base. Contar como zero puxaria a
    // média para baixo por falta de dado, não por desempenho.
    if (minutos === null) continue;

    soma.set(
      item.category,
      (soma.get(item.category) ?? 0) + minutos
    );

    contagem.set(
      item.category,
      (contagem.get(item.category) ?? 0) + 1
    );
  }

  const linhas: CategoryTime[] = [];

  for (const [category, total] of soma) {

    const samples = contagem.get(category) ?? 0;

    if (samples === 0) continue;

    const averageMinutes = total / samples;

    const ceilingHours = categories.find(
      (item) => item.name === category
    )?.ceilingHours;

    if (!ceilingHours) {
      linhas.push({
        category,
        averageMinutes,
        samples,
        situation: "sem-regra",
      });
      continue;
    }

    const usage =
      (averageMinutes / (ceilingHours * 60)) * 100;

    linhas.push({
      category,
      averageMinutes,
      samples,
      ceilingHours,
      usage,
      // Mesmo corte do SLA: os últimos 25% do prazo já pedem atenção.
      situation:
        usage > 100
          ? "estourado"
          : usage >= 75
          ? "atencao"
          : "dentro",
    });
  }

  // Pior primeiro: quem estourou o teto encabeça, e entre os que têm
  // teto vale o percentual consumido. Sem teto vai para o fim.
  return linhas.sort((a, b) => {

    if (a.usage === undefined && b.usage === undefined) {
      return b.averageMinutes - a.averageMinutes;
    }

    if (a.usage === undefined) return 1;
    if (b.usage === undefined) return -1;

    return b.usage - a.usage;
  });
}

/** Quantas categorias passaram do teto declarado. */
export function overCeiling(rows: CategoryTime[]) {
  return rows.filter(
    (item) => item.situation === "estourado"
  ).length;
}
