/**
 * A calculadora responde a verdade sobre a base real?
 *
 *   npm run check:calculadora
 *
 * `check:reputacao` prova que a **nota atual** fecha. Isto é outra
 * pergunta: a calculadora é a tela onde alguém decide o que fazer no
 * mês — quantas avaliações pedir, quais reclamações levar para
 * moderação, se vale responder as pendentes. Ela projeta um futuro, e
 * projeção errada custa trabalho jogado fora.
 *
 * A regra que o Isaac deu vale aqui inteira: **campo que não move a
 * nota é bug**. Então cada campo do cenário é mexido sozinho, sobre a
 * base real do período vigente, e o efeito é medido.
 *
 * Sete perguntas:
 *
 *   1. Todo campo do cenário move a nota — nenhum é decorativo.
 *   2. Cada um move para o lado certo (responder pendente sobe;
 *      reclamação nova sem resposta desce; nota 0 desce; nota 10 sobe).
 *   3. Remover uma nota 1 **melhora** a nota do consumidor. É o motivo
 *      de existir o pedido de moderação; se não melhorasse, a tela
 *      estaria recomendando trabalho inútil.
 *   4. O número que a tela mostra em "faltam N avaliações" é honesto:
 *      digitando N no cenário, a nota bate a faixa.
 *   5. Nenhum invariante quebra por exagero — cenário absurdo não
 *      produz negativo, NaN, nem avaliada acima de recebida.
 *   6. A nota do cenário confere com a fórmula oficial recalculada
 *      aqui, à mão, sem passar por `scoreFrom`.
 *   7. Zerado, o cenário devolve exatamente a nota atual. É a âncora:
 *      se isto falhar, todo o resto está medindo ruído.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { toCaseModel } from "../lib/services/case.mapper";

import {
  emptyRemoval,
  emptySimulation,
  evaluationsToReach,
  getRange,
  getRawCounts,
  inRange,
  pendingEvaluations,
  RA1000_BAND,
  ReputationRaw,
  scoreBands,
  scoreFrom,
  simulate,
  SimulationInput,
} from "../lib/services/reputation.service";

const url =
  process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!url) {
  console.error("\n  DATABASE_URL não definido.\n");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

let falhas = 0;

function ok(titulo: string, detalhe = "") {
  console.log(
    `  ok     ${titulo}${detalhe ? "  ·  " + detalhe : ""}`
  );
}

function falhar(titulo: string, detalhe: string) {
  falhas += 1;
  console.log(`FALHA    ${titulo}\n         ${detalhe}`);
}

/** Um cenário vazio, mas com cópia própria dos campos mutáveis. */
function cenario(
  ajuste: Partial<SimulationInput> = {}
): SimulationInput {
  return {
    ...emptySimulation,
    ratings: {},
    removed: [],
    ...ajuste,
  };
}

/**
 * A fórmula oficial escrita de novo, sem tocar em `scoreFrom`.
 *
 * Reimplementar é o ponto: se as duas concordarem, o número não depende
 * de uma leitura só do documento do Reclame Aqui.
 *
 *   AR = ((IR × 2) + (MA × 10 × 3) + (IS × 3) + (IN × 2)) / 100
 */
function notaOficial(raw: ReputationRaw) {

  const arred = (v: number) => Math.round(v * 1000) / 10;

  const ir =
    raw.received === 0
      ? null
      : arred(raw.answered / raw.received);

  const ma =
    raw.evaluated === 0
      ? null
      : Math.round(
          (raw.scoreSum / raw.evaluated) * 100
        ) / 100;

  const is =
    raw.evaluated === 0
      ? null
      : arred(raw.resolved / raw.evaluated);

  const inn =
    raw.evaluated === 0
      ? null
      : arred(raw.wouldReturn / raw.evaluated);

  const partes: [number | null, number][] = [
    [ir === null ? null : ir / 10, 2],
    [ma, 3],
    [is === null ? null : is / 10, 3],
    [inn === null ? null : inn / 10, 2],
  ];

  const validas = partes.filter(
    ([valor]) => valor !== null
  );

  const pesoTotal = validas.reduce(
    (s, [, peso]) => s + peso,
    0
  );

  if (pesoTotal === 0) return 0;

  const soma = validas.reduce(
    (s, [valor, peso]) => s + (valor as number) * peso,
    0
  );

  return Math.round((soma / pesoTotal) * 10) / 10;
}

async function main() {

  console.log(
    "\n  CALCULADORA — o cenário projeta a verdade?\n"
  );

  const linhas = await prisma.case.findMany({
    include: {
      category: { select: { name: true } },
      subcategory: { select: { name: true } },
      owner: { select: { name: true } },
      team: { select: { name: true } },
      tags: {
        include: { tag: { select: { name: true } } },
      },
    },
  });

  const casos = linhas.map((r) => toCaseModel(r));

  const range = getRange("6m", "vigente");

  const doPeriodo = casos.filter((item) =>
    inRange(item, range.start, range.end)
  );

  const base = getRawCounts(doPeriodo);
  const atual = scoreFrom(base);

  console.log(
    `  base: ${doPeriodo.length} reclamações no período vigente de 6 meses` +
      ` · recebidas ${base.received} · respondidas ${base.answered}` +
      ` · avaliadas ${base.evaluated} · nota ${atual.raScore}\n`
  );

  if (base.received === 0) {
    falhar(
      "0. há base para simular",
      "nenhuma reclamação no período vigente — o resto não mede nada"
    );
    return;
  }

  /* ----------------------------------------------------------
     7 (primeiro, porque é a âncora). Zerado devolve o atual.
  ---------------------------------------------------------- */

  const zerado = scoreFrom(simulate(base, cenario()));

  if (zerado.raScore === atual.raScore) {
    ok(
      "cenário zerado devolve a nota atual",
      `${atual.raScore}`
    );
  } else {
    falhar(
      "cenário zerado devolve a nota atual",
      `atual ${atual.raScore}, cenário vazio ${zerado.raScore} — a tela parte de um número que não é o de hoje`
    );
  }

  /* ----------------------------------------------------------
     1 e 2. Todo campo move a nota, e para o lado certo.
  ---------------------------------------------------------- */

  const pendentes = Math.max(
    base.received - base.answered,
    0
  );

  const umRemovidoRuim = {
    ...emptyRemoval("x"),
    answered: true,
    evaluated: true,
    score: 1,
    resolved: false,
    wouldReturn: false,
  };

  const campos: {
    nome: string;
    cenario: SimulationInput;
    sentido: "sobe" | "desce";
    pulaSe?: boolean;
    motivo?: string;
  }[] = [
    {
      nome: "answerPending (responder as pendentes)",
      cenario: cenario({ answerPending: pendentes }),
      sentido: "sobe",
      pulaSe: pendentes === 0,
      motivo:
        "não há reclamação sem resposta na base — o campo não tem o que mover",
    },
    {
      nome: "addUnanswered (nova sem resposta)",
      cenario: cenario({ addUnanswered: 20 }),
      sentido: "desce",
    },
    {
      nome: "ratings nota 0",
      cenario: cenario({ ratings: { 0: 20 } }),
      sentido: "desce",
    },
    {
      nome: "ratings nota 10",
      cenario: cenario({ ratings: { 10: 20 } }),
      sentido: "sobe",
    },
    {
      nome: "removed (moderar uma nota 1 ruim)",
      cenario: cenario({
        removed: Array.from(
          { length: 10 },
          (_, i) => ({
            ...umRemovidoRuim,
            id: `r${i}`,
          })
        ),
      }),
      sentido: "sobe",
      pulaSe: base.evaluated < 10,
      motivo:
        "menos de 10 avaliadas na base — remover mais do que existe não é cenário válido",
    },
  ];

  /**
   * `addAnswered` fica de fora da tabela porque o efeito depende da
   * base: uma reclamação nova **respondida** melhora o índice de
   * resposta quando ele está abaixo de 100% e o piora quando está em
   * 100% (passa a ser 1 recebida a mais que ainda conta). Os dois
   * comportamentos estão certos; o que não pode é ficar parado.
   */
  const comAddAnswered = scoreFrom(
    simulate(base, cenario({ addAnswered: 30 }))
  );

  const respostaAntes = atual.responseIndex;

  const respostaDepois = comAddAnswered.responseIndex;

  if (respostaDepois !== respostaAntes) {
    ok(
      "addAnswered move o índice de resposta",
      `${respostaAntes}% → ${respostaDepois}%`
    );
  } else if (respostaAntes === 100) {
    ok(
      "addAnswered não move (base já em 100% de resposta)",
      "correto: entra 1 respondida para 1 recebida"
    );
  } else {
    falhar(
      "addAnswered move o índice de resposta",
      `parado em ${respostaAntes}% com 30 novas respondidas — campo decorativo`
    );
  }

  /**
   * `resolved` e `wouldReturn` precisam de outro controle.
   *
   * Uma primeira versão deste script comparou os dois contra a nota da
   * **base** e acusou os dois de mover para o lado errado. Era o teste
   * que estava errado: para ligar o override é preciso ter avaliações
   * novas, e vinte notas 5 derrubam a nota do consumidor sozinhas — o
   * que se media era a queda das notas 5, não o efeito do campo.
   *
   * O controle certo é o **mesmo cenário sem o override**.
   */
  const controle = scoreFrom(
    simulate(base, cenario({ ratings: { 5: 20 } }))
  );

  for (const [campo, rotulo] of [
    ["resolved", "Índice de solução"],
    ["wouldReturn", "Voltaria a fazer negócio"],
  ] as ["resolved" | "wouldReturn", string][]) {

    const comOverride = scoreFrom(
      simulate(
        base,
        cenario({ ratings: { 5: 20 }, [campo]: 20 })
      )
    );

    const delta =
      Math.round(
        (comOverride.raScore - controle.raScore) * 100
      ) / 100;

    if (delta > 0) {
      ok(
        `${campo} fixado à mão (${rotulo})`,
        `mesmo cenário sem override ${controle.raScore} → ${comOverride.raScore} (+${delta})`
      );
    } else {
      falhar(
        `${campo} fixado à mão (${rotulo})`,
        `20 avaliações com ${campo}=20 dão ${comOverride.raScore}, iguais às ${controle.raScore} sem o override — campo decorativo`
      );
    }
  }

  for (const campo of campos) {

    if (campo.pulaSe) {
      console.log(
        `  pulou  ${campo.nome}\n         ${campo.motivo}`
      );
      continue;
    }

    const depois = scoreFrom(
      simulate(base, campo.cenario)
    );

    const delta =
      Math.round(
        (depois.raScore - atual.raScore) * 100
      ) / 100;

    const certo =
      campo.sentido === "sobe" ? delta > 0 : delta < 0;

    if (certo) {
      ok(
        campo.nome,
        `${atual.raScore} → ${depois.raScore} (${delta > 0 ? "+" : ""}${delta})`
      );
    } else if (delta === 0) {
      falhar(
        campo.nome,
        `não moveu a nota (${atual.raScore}) — campo decorativo`
      );
    } else {
      falhar(
        campo.nome,
        `moveu para o lado errado: esperava ${campo.sentido}, foi ${atual.raScore} → ${depois.raScore}`
      );
    }
  }

  /* ----------------------------------------------------------
     3. Moderar nota baixa melhora a nota do consumidor.
  ---------------------------------------------------------- */

  if (base.evaluated >= 5) {

    const comRemocao = scoreFrom(
      simulate(
        base,
        cenario({
          removed: Array.from(
            { length: 5 },
            (_, i) => ({
              ...umRemovidoRuim,
              id: `m${i}`,
            })
          ),
        })
      )
    );

    if (
      comRemocao.consumerScore > atual.consumerScore
    ) {
      ok(
        "moderar 5 avaliações nota 1 sobe a nota do consumidor",
        `${atual.consumerScore} → ${comRemocao.consumerScore}`
      );
    } else {
      falhar(
        "moderar 5 avaliações nota 1 sobe a nota do consumidor",
        `${atual.consumerScore} → ${comRemocao.consumerScore} — a tela estaria recomendando moderação que não ajuda`
      );
    }
  }

  /* ----------------------------------------------------------
     4. "Faltam N avaliações" é honesto.

     A tela mostra o N de `evaluationsToReach` e a pessoa digita esse
     número no campo de nota 10. Os dois caminhos são código diferente,
     e só coincidem se estiverem de acordo — foi por isso que virou
     conferência.
  ---------------------------------------------------------- */

  const metas = [
    ...[...scoreBands].reverse(),
    RA1000_BAND,
  ];

  for (const meta of metas) {

    const selo = meta.label === RA1000_BAND.label;

    const alvo = evaluationsToReach(base, meta, selo);

    if (!alvo.reachable) {
      ok(
        `meta "${meta.label}" declarada inalcançável`,
        "sem promessa falsa"
      );
      continue;
    }

    if (alvo.needed === 0) {
      ok(
        `meta "${meta.label}" já atingida`,
        `nota ${atual.raScore}`
      );
      continue;
    }

    /**
     * O mesmo N, mas pelo caminho do usuário: N notas 10, todas
     * resolvidas e favoráveis.
     */
    const digitado = scoreFrom(
      simulate(
        base,
        cenario({
          ratings: { 10: alvo.needed },
          resolved: alvo.needed,
          wouldReturn: alvo.needed,
        })
      )
    );

    const bateu = selo
      ? digitado.raScore >= alvo.projected - 0.05
      : digitado.raScore >= meta.min;

    if (bateu) {
      ok(
        `meta "${meta.label}": ${alvo.needed} avaliações levam a nota a ${digitado.raScore}`,
        `mínimo da faixa ${meta.min}`
      );
    } else {
      falhar(
        `meta "${meta.label}": ${alvo.needed} avaliações`,
        `a tela promete ${alvo.projected} mas digitar ${alvo.needed} no cenário dá ${digitado.raScore} (faixa pede ${meta.min})`
      );
    }
  }

  /* ----------------------------------------------------------
     4b. O teto de avaliações é respeitado.

     Uma avaliação pertence a uma reclamação. Sem esse limite a
     calculadora aceitava 200 avaliações nota 10 sobre 129 reclamações e
     prometia 9,5 — um plano que não tem como acontecer, entregue com
     cara de número exato.
  ---------------------------------------------------------- */

  const teto = pendingEvaluations(base);

  const exagerado = simulate(
    base,
    cenario({ ratings: { 10: teto + 200 } })
  );

  const notaExagerada = scoreFrom(exagerado).raScore;

  /**
   * A nota tem que ser conferida junto com a contagem.
   *
   * A primeira tentativa de teto travou só `evaluated` e olhou só a
   * contagem aqui. Passou verde — e a tela mostrava **12,9** numa
   * escala de 0 a 10, porque o denominador parou e o numerador não.
   * Contagem coerente com nota impossível é exatamente o que uma
   * conferência de calculadora existe para não deixar passar.
   */
  const noTeto = scoreFrom(
    simulate(base, cenario({ ratings: { 10: teto } }))
  ).raScore;

  const problemasDoTeto: string[] = [];

  if (exagerado.evaluated > exagerado.received) {
    problemasDoTeto.push(
      `${exagerado.evaluated} avaliações sobre ${exagerado.received} reclamações`
    );
  }

  if (notaExagerada > 10 || notaExagerada < 0) {
    problemasDoTeto.push(
      `nota ${notaExagerada} fora da escala 0–10`
    );
  }

  if (Math.abs(notaExagerada - noTeto) > 0.05) {
    problemasDoTeto.push(
      `pedir ${teto + 200} dá ${notaExagerada}, mas pedir ${teto} (o teto) dá ${noTeto} — o excedente ainda mexe na nota`
    );
  }

  if (problemasDoTeto.length === 0) {
    ok(
      "avaliações acima do teto não inflam a nota",
      `teto ${teto} · pedi ${teto + 200} · avaliadas ${exagerado.evaluated} de ${exagerado.received} · nota ${notaExagerada}, igual à do teto`
    );
  } else {
    falhar(
      "avaliações acima do teto não inflam a nota",
      problemasDoTeto.join("; ")
    );
  }

  /**
   * E o corte preserva a média do que foi digitado: 200 notas 10 viram
   * `teto` notas 10, não `teto` notas quaisquer.
   */
  const dezes = scoreFrom(
    simulate(base, cenario({ ratings: { 10: 500 } }))
  );

  const zeros = scoreFrom(
    simulate(base, cenario({ ratings: { 0: 500 } }))
  );

  if (dezes.consumerScore > zeros.consumerScore) {
    ok(
      "o corte preserva a nota digitada",
      `500 notas 10 → consumidor ${dezes.consumerScore} · 500 notas 0 → ${zeros.consumerScore}`
    );
  } else {
    falhar(
      "o corte preserva a nota digitada",
      `500 notas 10 dão ${dezes.consumerScore} e 500 notas 0 dão ${zeros.consumerScore} — o teto está descartando a nota junto com a contagem`
    );
  }

  /**
   * E o teto sobe junto quando o cenário traz reclamações novas — elas
   * nascem podendo ser avaliadas.
   */
  const comNovas = simulate(
    base,
    cenario({
      addAnswered: 50,
      ratings: { 10: teto + 50 },
    })
  );

  if (comNovas.evaluated === base.evaluated + teto + 50) {
    ok(
      "reclamações novas aumentam o teto",
      `${base.evaluated} + ${teto + 50} avaliações cabem em ${comNovas.received} recebidas`
    );
  } else {
    falhar(
      "reclamações novas aumentam o teto",
      `esperava ${base.evaluated + teto + 50} avaliadas, veio ${comNovas.evaluated} — o teto está preso à base em vez do cenário`
    );
  }

  /* ----------------------------------------------------------
     5. Exagero não quebra invariante.
  ---------------------------------------------------------- */

  const absurdos: {
    nome: string;
    input: SimulationInput;
  }[] = [
    {
      nome: "remover mais do que existe",
      input: cenario({
        removed: Array.from(
          { length: base.received + 500 },
          (_, i) => ({
            ...emptyRemoval(`z${i}`),
            id: `z${i}`,
          })
        ),
      }),
    },
    {
      nome: "responder mais pendentes do que há",
      input: cenario({
        answerPending: base.received * 10 + 1000,
      }),
    },
    {
      nome: "resolvidas acima do número de avaliações",
      input: cenario({
        ratings: { 10: 5 },
        resolved: 5000,
        wouldReturn: 5000,
      }),
    },
    {
      nome: "valores negativos digitados",
      input: cenario({
        answerPending: -50,
        addAnswered: -50,
        addUnanswered: -50,
        ratings: { 3: -20 },
      }),
    },
  ];

  for (const caso of absurdos) {

    const raw = simulate(base, caso.input);
    const nota = scoreFrom(raw);

    const problemas: string[] = [];

    for (const [chave, valor] of Object.entries(raw)) {
      if (!Number.isFinite(valor as number)) {
        problemas.push(`${chave} = ${valor}`);
      }
      if ((valor as number) < 0) {
        problemas.push(`${chave} negativo (${valor})`);
      }
    }

    if (raw.answered > raw.received) {
      problemas.push(
        `respondidas ${raw.answered} > recebidas ${raw.received}`
      );
    }

    if (raw.evaluated > raw.received) {
      problemas.push(
        `avaliadas ${raw.evaluated} > recebidas ${raw.received}`
      );
    }

    if (raw.resolved > raw.evaluated) {
      problemas.push(
        `resolvidas ${raw.resolved} > avaliadas ${raw.evaluated}`
      );
    }

    if (
      !Number.isFinite(nota.raScore) ||
      nota.raScore < 0 ||
      nota.raScore > 10
    ) {
      problemas.push(
        `nota fora de 0–10 (${nota.raScore})`
      );
    }

    if (problemas.length === 0) {
      ok(
        `exagero: ${caso.nome}`,
        `nota ${nota.raScore}, contagens coerentes`
      );
    } else {
      falhar(
        `exagero: ${caso.nome}`,
        problemas.join("; ")
      );
    }
  }

  /* ----------------------------------------------------------
     5b. Em nenhum cenário a nota sai de 0–10.

     Varredura ampla em vez de casos escolhidos a dedo: os casos a dedo
     foram justamente o que deixou passar a nota 12,9.
  ---------------------------------------------------------- */

  let forasDaEscala = 0;
  let pior = "";
  let combinacoes = 0;

  for (const novas of [0, 10, 100, 500]) {
    for (const nota of [0, 5, 10]) {
      for (const extras of [0, 50, 300]) {
        for (const remover of [0, 20]) {

          combinacoes += 1;

          const raw = simulate(
            base,
            cenario({
              addAnswered: extras,
              ratings: { [nota]: novas },
              removed: Array.from(
                { length: remover },
                (_, i) => ({
                  ...umRemovidoRuim,
                  id: `v${i}`,
                })
              ),
            })
          );

          const n = scoreFrom(raw).raScore;

          if (
            !Number.isFinite(n) ||
            n < 0 ||
            n > 10 ||
            raw.evaluated > raw.received
          ) {
            forasDaEscala += 1;
            if (!pior) {
              pior = `${novas}× nota ${nota}, +${extras} novas, −${remover} removidas → nota ${n} com ${raw.evaluated} avaliadas de ${raw.received}`;
            }
          }
        }
      }
    }
  }

  if (forasDaEscala === 0) {
    ok(
      `${combinacoes} combinações de cenário, todas dentro de 0–10`,
      "nenhuma com mais avaliações do que reclamações"
    );
  } else {
    falhar(
      `${combinacoes} combinações de cenário`,
      `${forasDaEscala} fora da escala. Primeira: ${pior}`
    );
  }

  /* ----------------------------------------------------------
     6. A nota do cenário confere com a fórmula recalculada.
  ---------------------------------------------------------- */

  const amostras: [string, SimulationInput][] = [
    ["zerado", cenario()],
    [
      "20 notas 10",
      cenario({ ratings: { 10: 20 } }),
    ],
    [
      "misto",
      cenario({
        answerPending: Math.min(pendentes, 5),
        addAnswered: 7,
        addUnanswered: 3,
        ratings: { 0: 4, 5: 6, 9: 2, 10: 11 },
      }),
    ],
  ];

  let divergiu = 0;

  for (const [nome, entrada] of amostras) {

    const raw = simulate(base, entrada);

    const daTela = scoreFrom(raw).raScore;
    const oficial = notaOficial(raw);

    if (Math.abs(daTela - oficial) < 0.051) {
      ok(
        `fórmula oficial confere · ${nome}`,
        `${daTela} vs ${oficial}`
      );
    } else {
      divergiu += 1;
      falhar(
        `fórmula oficial confere · ${nome}`,
        `a tela mostra ${daTela}, a fórmula 2/3/3/2 dá ${oficial}`
      );
    }
  }

  if (divergiu === 0) {
    console.log(
      "\n  A nota do cenário sai igual pelos dois caminhos: `scoreFrom` e a fórmula reescrita à mão."
    );
  }

  console.log(
    falhas === 0
      ? "\n  Calculadora conferida contra a base real. Nenhum campo decorativo.\n"
      : `\n  ${falhas} problema(s) na calculadora.\n`
  );
}

main()
  .catch((erro) => {
    console.error("\n  Erro:", erro);
    falhas += 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(falhas === 0 ? 0 : 1);
  });
