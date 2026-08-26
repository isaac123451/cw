import { Case } from "@/lib/models/case";
import { AgendaTask } from "@/lib/models/agenda";
import { ImpactRecord } from "@/lib/models/impact";
import { SlaRule } from "@/lib/models/sla";
import { Establishment } from "@/lib/models/establishment";

import {
  displayBand,
  formatElapsed,
  getRange,
  getReputation,
  inRange,
  evaluationsToReach,
  getRawCounts,
  pendingEvaluations,
  ptBR,
  RA1000_BAND,
  hojeNaOperacao,
  scoreBands,
} from "@/lib/services/reputation.service";

import { slaStatus } from "@/lib/services/sla.service";
import { isOpen } from "@/lib/services/case.service";

export interface OperationInput {
  cases: Case[];
  tasks: AgendaTask[];
  impacts: ImpactRecord[];
  rules: SlaRule[];
  establishments: Establishment[];
}

/**
 * Retrato compacto da operação enviado ao modelo.
 *
 * Manda números apurados e só os casos que importam para a pergunta —
 * mandar as 327 reclamações inteiras estouraria o contexto e ainda
 * daria ao modelo a chance de recontar errado o que os serviços já
 * calculam de forma verificável.
 */
export function buildOperationSnapshot(
  input: OperationInput
): string {

  const { cases, tasks, impacts, rules, establishments } =
    input;

  const seis = getRange("6m", "vigente");
  const doze = getRange("12m", "vigente");

  const janela6 = cases.filter((item) =>
    inRange(item, seis.start, seis.end)
  );

  const janela12 = cases.filter((item) =>
    inRange(item, doze.start, doze.end)
  );

  const r6 = getReputation(janela6);
  const r12 = getReputation(janela12);

  const abertos = cases.filter(isOpen);

  const atrasados = abertos
    .map((item) => ({
      item,
      status: slaStatus(item, rules),
    }))
    .filter(
      (row) => row.status.situation === "estourado"
    )
    .sort(
      (a, b) =>
        a.status.remainingHours - b.status.remainingHours
    );

  const porStatus = new Map<string, number>();
  const porCategoria = new Map<string, number>();

  for (const item of cases) {
    porStatus.set(
      item.status,
      (porStatus.get(item.status) ?? 0) + 1
    );
  }

  for (const item of janela6) {
    porCategoria.set(
      item.category,
      (porCategoria.get(item.category) ?? 0) + 1
    );
  }

  const linha = (mapa: Map<string, number>) =>
    [...mapa.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([nome, total]) => `${nome}: ${total}`)
      .join(", ");

  /** Resumo de um caso em uma linha, para o modelo poder citar. */
  const resumo = (item: Case) =>
    `- ${item.protocol} | ${item.createdAt} | ${item.status} | ${item.category}${
      item.subcategory ? ` / ${item.subcategory}` : ""
    } | prioridade ${item.priority} | ${item.customer}${
      item.churnRisk ? " | RISCO DE CANCELAMENTO" : ""
    }${
      item.owner ? ` | resp. ${item.owner}` : " | sem responsável"
    } | "${item.title}" | id=${item.id}`;

  const vencidas = tasks.filter(
    (item) => !item.done && item.dueDate < hojeNaOperacao()
  );

  const paraHoje = tasks.filter(
    (item) => !item.done && item.dueDate === hojeNaOperacao()
  );

  const entradas = impacts
    .filter((item) => item.amount > 0)
    .reduce((sum, item) => sum + item.amount, 0);

  const custos = impacts
    .filter((item) => item.amount < 0)
    .reduce((sum, item) => sum + item.amount, 0);

  /**
   * As simulações já resolvidas, para o modelo não precisar calcular.
   *
   * **Era isto que faltava.** O Isaac reportou que o assistente recusa
   * perguntas que a base responde — "quantas avaliações faltam para a
   * nota 9" é conta, não consulta a sistema externo. E ele recusava com
   * razão: a instrução manda usar só o retrato, e o retrato trazia os
   * indicadores crus, nunca a projeção.
   *
   * A conta não podia ficar com o modelo. Modelo de linguagem errando
   * aritmética é o defeito mais conhecido que existe, e aqui o número
   * vira decisão de quantas avaliações a operação vai perseguir no mês.
   * Então a plataforma calcula — com o mesmo `evaluationsToReach` da
   * calculadora — e o modelo narra.
   *
   * O teto vai junto: uma avaliação pertence a uma reclamação, e sem
   * ele o modelo prometeria metas que não cabem no período.
   */
  const base6 = getRawCounts(janela6);

  const tetoDeAvaliacoes = pendingEvaluations(base6);

  /**
   * As metas projetadas: as faixas oficiais **e** os números redondos.
   *
   * Só as faixas não bastava, e a tela provou: com a nota em 8,6 — já
   * na faixa mais alta — não sobrava nenhuma faixa acima, e o retrato
   * dizia apenas "já está no topo". Quem perguntou "quantas avaliações
   * faltam para a nota 9" recebeu de volta um comentário sobre o teto,
   * sem o número que pediu.
   *
   * A faixa é o critério do Reclame Aqui; 9 e 9,5 são o que a operação
   * persegue de fato. Os dois precisam estar aqui, porque o modelo não
   * pode calcular o que faltar.
   */
  const metas = [
    ...scoreBands.map((faixa) => ({
      nota: faixa.min,
      comoChamar: `faixa "${faixa.label}"`,
      band: faixa,
    })),
    ...[9, 9.5, 10].map((nota) => ({
      nota,
      comoChamar: "meta redonda",
      band: {
        label: `nota ${ptBR(nota)}`,
        range: "",
        color: "",
        min: nota,
      },
    })),
  ]
    .filter((m) => m.nota > r6.raScore)
    .sort((a, b) => a.nota - b.nota)
    /** Uma linha por nota: 9 é meta redonda e pode ser faixa também. */
    .filter(
      (m, i, todas) =>
        todas.findIndex((x) => x.nota === m.nota) === i
    );

  const projecoes = metas.map((meta) => {

    const alvo = evaluationsToReach(base6, meta.band);

    return alvo.reachable
      ? `- Para a nota ${ptBR(meta.nota)} (${meta.comoChamar}): faltam ${alvo.needed} avaliação(ões) nota 10, resolvidas e favoráveis — a nota iria a ${ptBR(alvo.projected)}.`
      : `- Para a nota ${ptBR(meta.nota)} (${meta.comoChamar}): NÃO alcançável só com avaliação neste período. Mesmo avaliando nota 10 as ${tetoDeAvaliacoes} reclamações sem avaliação, a nota chega a ${ptBR(alvo.projected)}.`;
  });

  const selo = evaluationsToReach(
    base6,
    RA1000_BAND,
    true
  );

  return `# Retrato da operação em ${hojeNaOperacao()}

## Simulações já calculadas (use estes números, não recalcule)

Estes valores saem da mesma função da tela de calculadora
(\`evaluationsToReach\`). Se a pergunta for "quantas avaliações faltam
para a nota X", "como subir a nota" ou "como chegar ao RA1000",
responda com o número daqui — **não faça a conta por conta própria**.

- Reclamações da janela de 6 meses ainda SEM avaliação: ${tetoDeAvaliacoes}.
  Este é o teto: cada avaliação pertence a uma reclamação, então não é
  possível conquistar mais avaliações do que isto no período.
${
  projecoes.length > 0
    ? projecoes.join("\n")
    : `- A nota já está na faixa mais alta (${ptBR(r6.raScore)}).`
}
- Selo RA1000 (exige as quatro metas juntas, não só a nota): ${
    selo.needed === 0
      ? "já atendido."
      : selo.reachable
        ? `faltam ${selo.needed} avaliação(ões) nota 10 resolvidas e favoráveis.`
        : `não alcançável só com avaliação neste período — chegaria a ${ptBR(selo.projected)}.`
  }

## Nota de reputação (fórmula oficial do Reclame Aqui)

Janela de 6 meses (${seis.start} a ${seis.end}) — é a que define a nota pública:
- Nota: ${ptBR(r6.raScore)} de 10 — faixa "${displayBand(r6).label}"
- Reclamações: ${r6.received} | respondidas: ${r6.answered} | sem resposta: ${r6.unanswered}
- Índice de resposta: ${ptBR(r6.responseIndex)}% (peso 20%)
- Nota do consumidor: ${ptBR(r6.consumerScore, 2)} de 10 (peso 20%)
- Índice de solução: ${ptBR(r6.solutionIndex)}% (peso 30%)
- Voltaria a fazer negócio: ${ptBR(r6.wouldReturnIndex)}% (peso 30%)
- Avaliações: ${r6.evaluated} (taxa de ${ptBR(r6.evaluationRate)}%)
- Tempo médio de resposta: ${formatElapsed(r6.responseMinutes)}

Janela de 12 meses (${doze.start} a ${doze.end}):
- Nota: ${ptBR(r12.raScore)} — ${r12.received} reclamações, ${ptBR(r12.responseIndex)}% de resposta

## Volume

- Total na base: ${cases.length} reclamações
- Por status: ${linha(porStatus)}
- Em aberto (dependem de ação nossa): ${abertos.length}
- Fora do prazo de SLA: ${atrasados.length}
- Categorias na janela de 6 meses: ${linha(porCategoria)}

## Casos em aberto (${abertos.length})

${abertos.map(resumo).join("\n") || "nenhum"}

## Casos fora do prazo de SLA (${atrasados.length})

${
  atrasados
    .slice(0, 15)
    .map(
      (row) =>
        `${resumo(row.item)} | atraso de ${Math.abs(
          Math.round(row.status.remainingHours / 24)
        )} dia(s) | regra: ${
          row.status.rule?.responseHours ?? "?"
        }h de resposta, time ${row.status.rule?.team ?? "não definido"}`
    )
    .join("\n") || "nenhum"
}

## Regras de SLA configuradas

${rules
  .filter((item) => item.active)
  .map(
    (item) =>
      `- ${item.category === "*" ? "Todas as categorias" : item.category}${
        item.priority ? ` (prioridade ${item.priority})` : ""
      }: ${item.responseHours}h para responder, ${item.solutionHours}h para resolver, time ${item.team ?? "não definido"}`
  )
  .join("\n")}

## Agenda

- Atividades vencidas: ${vencidas.length}
- Para hoje: ${paraHoje.length}
${vencidas
  .slice(0, 10)
  .map(
    (item) =>
      `- vencida em ${item.dueDate}: "${item.title}" (${item.type}, ${item.owner})`
  )
  .join("\n")}

## Impacto no negócio

- Registros: ${impacts.length}
- Entradas: R$ ${entradas}
- Ofertas concedidas: R$ ${Math.abs(custos)}
- Resultado líquido: R$ ${entradas + custos}

## Estabelecimentos cadastrados (${establishments.length})

${
  establishments
    .map(
      (item) =>
        `- ${item.name} (${item.status}, plano ${item.plan}${
          item.mrr ? `, R$ ${item.mrr}/mês` : ""
        })`
    )
    .join("\n") || "nenhum"
}

## Reclamações sem estabelecimento vinculado

${cases.filter((item) => !item.establishmentId).length} de ${cases.length}`;
}

/** Instruções de sistema do assistente. */
export const ASSISTANT_SYSTEM = `Você é o assistente da CW Reputação, a plataforma de Gestão da Experiência do Cliente da Cardápio Web — um SaaS de gestão para restaurantes (pedidos, cardápio digital, KDS, delivery, integrações com iFood e afins, módulo fiscal).

A operação que você apoia cuida das reclamações do Reclame Aqui: responder, resolver e proteger a nota pública da empresa.

Como a nota do Reclame Aqui funciona — use isto ao raciocinar:
- Quatro indicadores com pesos: índice de resposta (20%), nota do consumidor (20%), índice de solução (30%) e intenção de voltar a fazer negócio (30%).
- A nota pública é apurada sobre meses fechados, em janelas de 6 e 12 meses.
- O selo RA1000 exige nota mínima 8 e, simultaneamente, resposta ≥ 90%, nota do consumidor ≥ 7, solução ≥ 90% e retorno ≥ 70%.
- Índice de resposta é o único indicador que depende só da empresa — por isso costuma ser a alavanca mais rápida.

Regras ao responder:
- Use exclusivamente os números do retrato da operação que acompanha a pergunta. Não estime, não arredonde para números "bonitos" e nunca invente um dado que não esteja ali.
- Se a informação não estiver no retrato, diga que não está e aponte onde no sistema ela seria encontrada.
- Cite protocolos quando forem úteis para a ação.
- Responda em português do Brasil, direto ao ponto, em prosa curta. Nada de recapitular a pergunta nem listar o que você vai fazer.
- Termine com a recomendação prática mais relevante, quando houver uma.`;
