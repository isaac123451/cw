import { Case } from "@/lib/models/case";
import { CategoryOption } from "@/lib/models/settings";

import { parseElapsed } from "@/lib/services/reputation.service";
import { SlaSituation } from "@/lib/services/sla.service";

export interface CategoryTime {
  category: string;

  /**
   * O **pior** tempo de resposta da categoria, em minutos.
   *
   * É este que decide a situação, e não a média. Ver o comentário de
   * `responseByCategory`.
   */
  worstMinutes: number;

  /** Média do tempo de resposta, em minutos. Contexto, não veredito. */
  averageMinutes: number;

  /** Reclamações com tempo preenchido — a base do cálculo. */
  samples: number;

  /** Quantas passaram do teto. Zero quando não há teto declarado. */
  breaches: number;

  ceilingHours?: number;

  /**
   * Percentual do teto consumido **pelo pior caso**.
   *
   * Passa de 100 quando alguma reclamação estourou — que é o que a
   * palavra "teto" promete medir.
   */
  usage?: number;

  situation: SlaSituation;
}

/**
 * Tempo de resposta por categoria, comparado ao teto declarado.
 *
 * **O teto é um máximo, e a média não o mede.** Esta tela comparava a
 * média contra o teto, e o Isaac apontou: "sobre o teto não é média,
 * mas sim sobre o máximo". A diferença não é de vocabulário — é o que
 * a tela deixava de mostrar.
 *
 * Dez reclamações respondidas em uma hora e uma esquecida por cem horas
 * dão média de dez horas. Contra um teto de vinte e quatro, a tela
 * dizia "dentro do teto", em verde, enquanto um consumidor esperou
 * quatro dias. A média de um conjunto que contém um desastre é a
 * maneira mais confiável de esconder o desastre — e é justamente o caso
 * esquecido que vira reclamação sem resposta, nota baixa e, no Reclame
 * Aqui, queda no índice de resposta, que é o item de maior peso da nota.
 *
 * Então o veredito passa a ser do pior caso, e a média fica como
 * contexto ao lado. As duas leituras juntas respondem coisas
 * diferentes: o pior diz se alguém foi abandonado, a média diz se a
 * categoria vai bem no geral. Uma categoria pode estar boa na média e
 * ter abandonado alguém — e é isso que precisava aparecer.
 *
 * `breaches` acompanha porque um estouro isolado e trinta estouros
 * pedem reações diferentes: o primeiro é um caso, o segundo é um
 * processo quebrado.
 *
 * O teto vem do cadastro de categorias (Configurar fluxo). Categoria que
 * aparece nos casos mas não existe no cadastro fica sem teto, em vez de
 * sumir da tela: é o mesmo problema que `OrphanCategories` já aponta.
 */
export function responseByCategory(
  cases: Case[],
  categories: CategoryOption[]
): CategoryTime[] {

  const soma = new Map<string, number>();
  const contagem = new Map<string, number>();
  const pior = new Map<string, number>();

  /** Os minutos de cada caso, guardados para contar os estouros. */
  const tempos = new Map<string, number[]>();

  for (const item of cases) {

    const minutos = parseElapsed(item.responseTime);

    // Sem tempo preenchido não entra na base. Contar como zero puxaria
    // os números para baixo por falta de dado, não por desempenho.
    if (minutos === null) continue;

    soma.set(
      item.category,
      (soma.get(item.category) ?? 0) + minutos
    );

    contagem.set(
      item.category,
      (contagem.get(item.category) ?? 0) + 1
    );

    pior.set(
      item.category,
      Math.max(pior.get(item.category) ?? 0, minutos)
    );

    tempos.set(item.category, [
      ...(tempos.get(item.category) ?? []),
      minutos,
    ]);
  }

  const linhas: CategoryTime[] = [];

  for (const [category, total] of soma) {

    const samples = contagem.get(category) ?? 0;

    if (samples === 0) continue;

    const averageMinutes = total / samples;
    const worstMinutes = pior.get(category) ?? 0;

    const ceilingHours = categories.find(
      (item) => item.name === category
    )?.ceilingHours;

    if (!ceilingHours) {
      linhas.push({
        category,
        worstMinutes,
        averageMinutes,
        samples,
        breaches: 0,
        situation: "sem-regra",
      });
      continue;
    }

    const tetoEmMinutos = ceilingHours * 60;

    const breaches = (tempos.get(category) ?? []).filter(
      (m) => m > tetoEmMinutos
    ).length;

    const usage = (worstMinutes / tetoEmMinutos) * 100;

    linhas.push({
      category,
      worstMinutes,
      averageMinutes,
      samples,
      breaches,
      ceilingHours,
      usage,

      /*
        Um estouro já é estouro.

        Não há graduação por quantidade aqui de propósito: a pergunta
        que esta linha responde é "alguém passou do teto?", e a
        resposta é sim ou não. Quantos passaram fica em `breaches`.
      */
      situation:
        breaches > 0
          ? "estourado"
          : usage >= 75
            ? "atencao"
            : "dentro",
    });
  }

  // Pior primeiro: quem estourou o teto encabeça, e entre os que têm
  // teto vale o percentual consumido pelo pior caso. Sem teto vai para
  // o fim.
  return linhas.sort((a, b) => {

    if (a.usage === undefined && b.usage === undefined) {
      return b.worstMinutes - a.worstMinutes;
    }

    if (a.usage === undefined) return 1;
    if (b.usage === undefined) return -1;

    return b.usage - a.usage;
  });
}

/**
 * O nome antigo, mantido para não quebrar quem ainda chama.
 *
 * @deprecated Use `responseByCategory` — o nome antigo prometia média e
 * a função agora julga pelo máximo, que é o que "teto" significa.
 */
export const averageResponseByCategory =
  responseByCategory;

/** Quantas categorias passaram do teto declarado. */
export function overCeiling(rows: CategoryTime[]) {
  return rows.filter(
    (item) => item.situation === "estourado"
  ).length;
}

/** Quantas reclamações, ao todo, passaram do teto da sua categoria. */
export function totalBreaches(rows: CategoryTime[]) {
  return rows.reduce(
    (soma, item) => soma + item.breaches,
    0
  );
}
