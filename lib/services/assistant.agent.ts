import { PrismaClient } from "@prisma/client";

import { Case } from "@/lib/models/case";

import {
  pedirEstruturado,
  provedorDeIA,
} from "@/lib/services/ia.service";

import {
  caminhoParaNota,
  formatElapsed,
  getRange,
  getRawCounts,
  getReputation,
  inRange,
  ptBR,
  scoreFrom,
  hojeNaOperacao,
} from "@/lib/services/reputation.service";

import {
  getCausasNoTempo,
  getDistribuicaoDeResposta,
} from "@/lib/services/charts.service";

import {
  isOpen,
  isReclameAqui,
  isSocial,
  naSituacao,
  seteDiasAtras,
} from "@/lib/services/case.service";

/**
 * O agente do assistente: o modelo escolhe o que medir, nós medimos.
 *
 * **O que existia antes.** Duas coisas, e nenhuma resolvia o meio do
 * caminho. As rotinas determinísticas de `assistant.service` respondem
 * exato e de graça — mas só as nove perguntas que alguém previu; o que
 * sai delas recebe "não entendi". E o caminho pela IA mandava um
 * **retrato fixo** da operação no prompt: se o número que a pergunta
 * pedia não estivesse ali, o modelo dizia que não sabia ou, pior,
 * arredondava a partir do que tinha.
 *
 * **O que isto faz.** Publica um catálogo de medições — cada uma uma
 * função sobre a base real — e pergunta ao modelo **quais rodar** para
 * a pergunta que chegou. As escolhidas rodam aqui, no servidor, contra
 * o Postgres. O que volta para o modelo são números, e a resposta dele
 * é escrita só com eles.
 *
 * **O modelo nunca calcula.** Ele escolhe e redige; a conta é sempre
 * nossa, e é a mesma que a tela mostra — as medições delegam para
 * `reputation.service`, `charts.service` e `case.service`, sem uma
 * segunda implementação. Assistente e tela discordarem sobre um número
 * é pior do que o assistente não responder.
 *
 * **Só entra quando as rotinas exatas não cobrem.** Elas são instantâneas
 * e não custam chamada; este caminho custa uma ida ao modelo só para
 * decidir o que medir.
 *
 * **Sem `server-only`, de propósito.** Ele é de servidor por construção
 * — recebe um `PrismaClient` — e a mesma convenção vale para
 * `ia.service`, que guarda as chaves. Poder ser importado por um script
 * é o que permite ao `check:agente` rodar cada medição contra a base
 * real e conferir que o número do agente é o número da tela. Um guarda
 * que impedisse essa conferência trocaria uma proteção teórica por uma
 * verificação de verdade.
 */

/* ============================================================
   O QUE DÁ PARA MEDIR
============================================================ */

export interface DadosDaOperacao {
  cases: Case[];
  nps: {
    score: number;
    status: string;
    churnRisk: boolean;
    respondedAt: string;
    kind: string | null;
    rootCause: string | null;
  }[];
}

interface Medicao {
  nome: string;

  /** O que ela responde, em uma linha. É o que o modelo lê para escolher. */
  descricao: string;

  /**
   * O que o argumento significa, quando ela aceita um.
   *
   * Sem isto o modelo manda qualquer coisa: a descrição do argumento é
   * o que faz "quantas avaliações para 9,5" virar `argumento: "9.5"`.
   */
  argumento?: string;

  rodar: (
    dados: DadosDaOperacao,
    argumento?: string
  ) => string;
}

/** Janela oficial de 6 meses — a que define a nota pública. */
function janela(cases: Case[]) {
  const r = getRange("6m", "vigente");
  return cases.filter((item) =>
    inRange(item, r.start, r.end)
  );
}

export const CATALOGO: Medicao[] = [

  {
    nome: "reputacao",
    descricao:
      "Nota atual do Reclame Aqui e os quatro índices que a compõem, na janela oficial de 6 meses.",
    rodar: ({ cases }) => {

      const base = getRawCounts(janela(cases));
      const s = scoreFrom(base);

      return [
        `nota ${ptBR(s.raScore)} de 10`,
        `índice de resposta ${ptBR(s.responseIndex)}%`,
        `nota do consumidor ${ptBR(s.consumerScore)}`,
        `índice de solução ${ptBR(s.solutionIndex)}%`,
        `voltaria a fazer negócio ${ptBR(s.wouldReturnIndex)}%`,
        `${base.received} reclamações na janela, ${base.received - base.answered} sem resposta`,
      ].join(" · ");
    },
  },

  {
    nome: "caminho_para_nota",
    descricao:
      "O que falta para chegar a uma nota alvo: quantas respostas e quantas avaliações, e se a meta cabe no período.",
    argumento:
      "A nota desejada, de 0 a 10. Aceita decimal: \"9\", \"9.5\".",
    rodar: ({ cases }, argumento) => {

      const alvo = Number(
        (argumento ?? "9").replace(",", ".")
      );

      if (!Number.isFinite(alvo)) {
        return "argumento inválido — esperava uma nota de 0 a 10.";
      }

      const c = caminhoParaNota(
        getRawCounts(janela(cases)),
        alvo
      );

      if (c.jaAlcancada) {
        return `a nota ${ptBR(c.atual)} já está em ${ptBR(c.alvo)} ou acima — não falta nada.`;
      }

      return [
        `alvo ${ptBR(c.alvo)}, atual ${ptBR(c.atual)}`,
        `${c.pendentes} reclamação(ões) sem resposta`,
        c.respondendoBasta
          ? "só responder o que está parado já alcança a meta"
          : `respondendo tudo, a nota vai a ${ptBR(c.soRespondendo)}`,
        `faltam ${c.avaliacoesDepoisDeResponder} avaliação(ões) nota 10 depois de responder (${c.avaliacoesSemResponder} sem responder nada)`,
      ].join(" · ");
    },
  },

  {
    nome: "espera_do_consumidor",
    descricao:
      "Quanto o consumidor esperou pela resposta: mediana, pior caso e a distribuição por faixa. Use no lugar da média.",
    rodar: ({ cases }) => {

      const d = getDistribuicaoDeResposta(
        cases,
        getRange("6m", "vigente")
      );

      if (d.medidas === 0) {
        return "nenhuma reclamação da janela tem tempo de resposta registrado.";
      }

      return [
        `${d.medidas} respostas com tempo medido`,
        `mediana ${formatElapsed(d.mediana ?? 0)}`,
        `pior ${formatElapsed(d.pior ?? 0)}`,
        ...d.faixas.map(
          (f) =>
            `${f.label}: ${f.quantidade} (${f.parte.toFixed(0)}%)`
        ),
      ].join(" · ");
    },
  },

  {
    nome: "causas_no_tempo",
    descricao:
      "As maiores categorias de reclamação mês a mês — responde qual causa está crescendo, não só qual é a maior.",
    rodar: ({ cases }) => {

      const c = getCausasNoTempo(
        cases,
        getRange("12m", "vigente")
      );

      if (c.series.length === 0) {
        return "nenhuma reclamação categorizada no período.";
      }

      return [
        `meses: ${c.labels.join(", ")}`,
        ...c.series.map(
          (s) =>
            `${s.categoria} (${s.total} no total): ${s.valores.join(", ")}`
        ),
        c.outras > 0
          ? `mais ${c.outras} categoria(s) fora do recorte`
          : "",
      ]
        .filter(Boolean)
        .join(" · ");
    },
  },

  {
    nome: "fila_da_operacao",
    descricao:
      "O que depende de ação agora: sem resposta pública, vencidas há mais de 7 dias, em aberto e marcadas para retenção.",
    rodar: ({ cases }) => {

      const corte = seteDiasAtras();

      const conta = (
        s: "sem-resposta" | "vencidas" | "na-fila" | "risco"
      ) =>
        cases.filter((item) =>
          naSituacao(item, s, corte)
        ).length;

      return [
        `sem resposta pública: ${conta("sem-resposta")}`,
        `vencidas há +7 dias: ${conta("vencidas")}`,
        `em aberto: ${conta("na-fila")}`,
        `marcadas para retenção: ${conta("risco")}`,
        `total na base: ${cases.length}`,
      ].join(" · ");
    },
  },

  {
    nome: "por_frente",
    descricao:
      "Como o trabalho se divide entre as três frentes: Reclame Aqui, Redes Sociais e NPS.",
    rodar: ({ cases, nps }) => {

      const ra = cases.filter(isReclameAqui);
      const social = cases.filter(isSocial);

      const semTratativa = nps.filter((n) =>
        n.status.toLowerCase().includes("novo")
      ).length;

      return [
        `Reclame Aqui: ${ra.length} casos, ${ra.filter(isOpen).length} em aberto`,
        `Redes Sociais: ${social.length} casos, ${social.filter(isOpen).length} em aberto`,
        `NPS: ${nps.length} respostas, ${semTratativa} sem tratativa`,
      ].join(" · ");
    },
  },

  {
    nome: "nps",
    descricao:
      "Indicador de NPS, promotores, neutros, detratores, causa raiz mais comum e contas marcadas para retenção.",
    rodar: ({ nps }) => {

      if (nps.length === 0) {
        return "nenhuma resposta de NPS na base.";
      }

      const promotores = nps.filter(
        (n) => n.score >= 9
      ).length;

      const detratores = nps.filter(
        (n) => n.score <= 6
      ).length;

      const causas = new Map<string, number>();

      for (const n of nps) {
        if (!n.rootCause) continue;
        causas.set(
          n.rootCause,
          (causas.get(n.rootCause) ?? 0) + 1
        );
      }

      const topo = [...causas.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([nome, n]) => `${nome} (${n})`)
        .join(", ");

      return [
        `NPS ${Math.round(((promotores - detratores) / nps.length) * 100)}`,
        `${nps.length} respostas`,
        `${promotores} promotores, ${nps.length - promotores - detratores} neutros, ${detratores} detratores`,
        topo
          ? `causas mais comuns: ${topo}`
          : "nenhuma causa raiz classificada",
        `${nps.filter((n) => n.churnRisk).length} marcadas para retenção`,
      ].join(" · ");
    },
  },

  {
    nome: "por_categoria",
    descricao:
      "Quantas reclamações por categoria, e quantas de cada uma seguem sem resposta.",
    rodar: ({ cases }) => {

      const mapa = new Map<
        string,
        { total: number; semResposta: number }
      >();

      for (const item of cases) {

        const nome = item.category || "Sem categoria";

        const atual = mapa.get(nome) ?? {
          total: 0,
          semResposta: 0,
        };

        atual.total += 1;

        if (
          isReclameAqui(item) &&
          (item.publicResponse ?? "").trim() === ""
        ) {
          atual.semResposta += 1;
        }

        mapa.set(nome, atual);
      }

      return [...mapa.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 12)
        .map(
          ([nome, v]) =>
            `${nome}: ${v.total} (${v.semResposta} sem resposta)`
        )
        .join(" · ");
    },
  },

  {
    nome: "movimento_recente",
    descricao:
      "Quantas reclamações entraram, foram respondidas e avaliadas nos últimos N dias.",
    argumento:
      "Quantos dias olhar para trás. Padrão 30.",
    rodar: ({ cases }, argumento) => {

      const dias = Math.min(
        Math.max(Number(argumento ?? 30) || 30, 1),
        365
      );

      const limite = new Date(
        `${hojeNaOperacao()}T00:00:00Z`
      );

      limite.setUTCDate(limite.getUTCDate() - dias);

      const desde = limite.toISOString().slice(0, 10);

      const recentes = cases.filter(
        (item) => item.createdAt >= desde
      );

      const respondidas = recentes.filter(
        (item) => (item.publicResponse ?? "").trim() !== ""
      ).length;

      return [
        `últimos ${dias} dias (desde ${desde})`,
        `${recentes.length} reclamação(ões) entraram`,
        `${respondidas} já respondidas`,
        `${recentes.filter((i) => i.evaluated).length} avaliadas`,
        `${recentes.filter(isSocial).length} vieram das redes sociais`,
      ].join(" · ");
    },
  },

  /* ---------------------------------------------------------------
     As medições abaixo ampliam o alcance do agente sem modelo.

     Cada uma é uma pergunta a mais que ele responde exato e de graça.
     É assim que este agente fica mais inteligente — não treinando um
     modelo, mas tendo mais coisas que sabe medir de verdade.
  --------------------------------------------------------------- */

  {
    nome: "desfecho",
    descricao:
      "Quantas reclamações foram resolvidas, quantas o consumidor disse que voltaria a fazer negócio, e quantas ficaram avaliadas — os três números que formam a reputação no Reclame Aqui.",
    rodar: ({ cases }) => {

      if (cases.length === 0) {
        return "nenhuma reclamação na base.";
      }

      const avaliadas = cases.filter(
        (item) => item.evaluated
      );

      const resolvidas = cases.filter(
        (item) => item.resolved
      ).length;

      const voltaria = cases.filter(
        (item) => item.wouldDoBusiness
      ).length;

      const pct = (n: number, de: number) =>
        de === 0 ? "—" : `${Math.round((n / de) * 100)}%`;

      return [
        `${cases.length} reclamação(ões)`,
        `${resolvidas} resolvidas (${pct(resolvidas, cases.length)})`,
        `${voltaria} voltariam a fazer negócio (${pct(voltaria, cases.length)})`,
        `${avaliadas.length} avaliadas (${pct(avaliadas.length, cases.length)})`,
      ].join(" · ");
    },
  },

  {
    nome: "por_prioridade",
    descricao:
      "Quantas reclamações em cada prioridade (Crítica, Alta, Média, Baixa) e quantas de cada uma ainda estão sem resposta pública.",
    rodar: ({ cases }) => {

      const ordem = [
        "Crítica",
        "Alta",
        "Média",
        "Baixa",
      ];

      const linhas = ordem
        .map((nivel) => {

          const doNivel = cases.filter(
            (item) => item.priority === nivel
          );

          if (doNivel.length === 0) return "";

          const semResposta = doNivel.filter(
            (item) =>
              (item.publicResponse ?? "").trim() === ""
          ).length;

          return `${nivel}: ${doNivel.length} (${semResposta} sem resposta)`;
        })
        .filter(Boolean);

      return linhas.length > 0
        ? linhas.join(" · ")
        : "nenhuma reclamação classificada por prioridade.";
    },
  },

  {
    nome: "por_regiao",
    descricao:
      "De onde vêm as reclamações: os estados e as cidades que mais aparecem.",
    rodar: ({ cases }) => {

      const contar = (
        pegar: (c: (typeof cases)[number]) => string
      ) => {

        const mapa = new Map<string, number>();

        for (const item of cases) {
          const chave = pegar(item).trim();
          if (!chave) continue;
          mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
        }

        return [...mapa.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([nome, n]) => `${nome} (${n})`)
          .join(", ");
      };

      const estados = contar((c) => c.state ?? "");
      const cidades = contar((c) => c.city ?? "");

      if (!estados && !cidades) {
        return "nenhuma reclamação tem cidade ou estado preenchidos.";
      }

      return [
        estados ? `estados: ${estados}` : "",
        cidades ? `cidades: ${cidades}` : "",
      ]
        .filter(Boolean)
        .join(" · ");
    },
  },

  {
    nome: "reincidencia",
    descricao:
      "Consumidores que reclamaram mais de uma vez — quantos são e quantas reclamações concentram.",
    rodar: ({ cases }) => {

      /*
        A identidade é o documento, e o e-mail só quando não há
        documento.

        O nome não entra: dois "João Silva" diferentes viram um
        reincidente que não existe, e é exatamente o erro que o
        vínculo por documento existe para não cometer.
      */
      const mapa = new Map<string, number>();

      for (const item of cases) {

        const chave = (
          item.document ||
          item.email ||
          ""
        )
          .trim()
          .toLowerCase();

        if (!chave) continue;

        mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
      }

      const repetidos = [...mapa.values()].filter(
        (n) => n > 1
      );

      if (repetidos.length === 0) {
        return `nenhum consumidor identificado reclamou duas vezes (${mapa.size} identificados por documento ou e-mail).`;
      }

      const concentradas = repetidos.reduce(
        (soma, n) => soma + n,
        0
      );

      return [
        `${repetidos.length} consumidor(es) reclamaram mais de uma vez`,
        `concentram ${concentradas} reclamação(ões)`,
        `o mais recorrente tem ${Math.max(...repetidos)}`,
        `base de ${mapa.size} identificados por documento ou e-mail`,
      ].join(" · ");
    },
  },

  {
    nome: "mais_antigas_sem_resposta",
    descricao:
      "As reclamações sem resposta pública há mais tempo, com a idade de cada uma em dias.",
    rodar: ({ cases }) => {

      const hoje = new Date(
        `${hojeNaOperacao()}T00:00:00Z`
      ).getTime();

      const paradas = cases
        .filter(
          (item) =>
            (item.publicResponse ?? "").trim() === ""
        )
        .sort((a, b) =>
          a.createdAt.localeCompare(b.createdAt)
        )
        .slice(0, 5);

      if (paradas.length === 0) {
        return "nenhuma reclamação sem resposta pública.";
      }

      return paradas
        .map((item) => {

          const dias = Math.round(
            (hoje -
              new Date(
                `${item.createdAt.slice(0, 10)}T00:00:00Z`
              ).getTime()) /
              86_400_000
          );

          return `${item.protocol} (${item.category}, ${dias} dia(s))`;
        })
        .join(" · ");
    },
  },

  {
    nome: "retencao",
    descricao:
      "Casos marcados como risco de cancelamento — quantos, em que frentes, e quantos seguem sem resposta.",
    rodar: ({ cases, nps }) => {

      const emRisco = cases.filter((item) => item.churnRisk);

      const npsEmRisco = nps.filter((n) => n.churnRisk);

      if (
        emRisco.length === 0 &&
        npsEmRisco.length === 0
      ) {
        return "nenhum caso marcado para retenção.";
      }

      const semResposta = emRisco.filter(
        (item) => (item.publicResponse ?? "").trim() === ""
      ).length;

      return [
        `${emRisco.length} reclamação(ões) marcadas para retenção`,
        `${semResposta} delas ainda sem resposta`,
        `${npsEmRisco.length} resposta(s) de NPS marcadas`,
        `${emRisco.filter(isSocial).length} vieram das redes sociais`,
      ].join(" · ");
    },
  },

  {
    nome: "por_responsavel",
    descricao:
      "Como a carga está dividida entre as pessoas do time, e quantas reclamações de cada uma seguem sem resposta.",
    rodar: ({ cases }) => {

      const mapa = new Map<
        string,
        { total: number; semResposta: number }
      >();

      for (const item of cases) {

        const dono = (item.owner ?? "").trim();

        if (!dono) continue;

        const atual = mapa.get(dono) ?? {
          total: 0,
          semResposta: 0,
        };

        atual.total += 1;

        if ((item.publicResponse ?? "").trim() === "") {
          atual.semResposta += 1;
        }

        mapa.set(dono, atual);
      }

      const semDono = cases.filter(
        (item) => !(item.owner ?? "").trim()
      ).length;

      if (mapa.size === 0) {
        return `nenhuma reclamação tem responsável definido (${cases.length} no total).`;
      }

      const linhas = [...mapa.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 8)
        .map(
          ([nome, n]) =>
            `${nome}: ${n.total} (${n.semResposta} sem resposta)`
        );

      return [
        ...linhas,
        `sem responsável: ${semDono}`,
      ].join(" · ");
    },
  },

  {
    nome: "etiquetas",
    descricao:
      "As etiquetas mais usadas nas reclamações, para ver o que a operação vem marcando.",
    rodar: ({ cases }) => {

      const mapa = new Map<string, number>();

      for (const item of cases) {
        for (const etiqueta of item.tags ?? []) {
          const chave = etiqueta.trim();
          if (!chave) continue;
          mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
        }
      }

      if (mapa.size === 0) {
        return "nenhuma reclamação foi etiquetada.";
      }

      return [...mapa.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([nome, n]) => `${nome} (${n})`)
        .join(", ");
    },
  },
];

/* ============================================================
   ESCOLHER E MEDIR
============================================================ */

export interface Escolha {
  nome: string;
  argumento?: string;
}

const ESQUEMA = {
  type: "object",
  properties: {
    medicoes: {
      type: "array",
      description:
        "As medições necessárias para responder. Vazio se a pergunta não for sobre a operação.",
      items: {
        type: "object",
        properties: {
          nome: {
            type: "string",
            enum: CATALOGO.map((m) => m.nome),
          },
          argumento: {
            type: "string",
            description:
              "Só quando a medição aceita um. Vazio caso contrário.",
          },
        },
        required: ["nome"],
      },
    },
  },
  required: ["medicoes"],
};

/* =================================================================
   O SELETOR LOCAL — o agente sem API nenhuma
   ================================================================= */

/**
 * Gatilhos por medição, para escolher sem modelo.
 *
 * **Por que existe.** O catálogo e as contas sempre foram locais: o
 * modelo nunca viu um dado, ele só escolhia **quais** medições rodar.
 * Era um passo de classificação entre nove opções — e era o único
 * motivo de o agente inteiro depender de uma API externa.
 *
 * Com estes gatilhos a escolha acontece aqui. A consequência é que o
 * assistente responde com números reais mesmo sem chave nenhuma
 * configurada, sem cota, sem rede e sem custo. O modelo passa a ser o
 * que ele deveria ter sido desde o começo: uma melhoria opcional na
 * escolha e na redação, não um requisito para funcionar.
 *
 * Ficam num mapa à parte, e não dentro de cada medição, para que a
 * conferência possa exigir que **toda** medição do catálogo tenha
 * gatilhos. Uma medição sem gatilho seria inalcançável localmente, e
 * ninguém notaria: ela simplesmente nunca seria escolhida.
 */
const GATILHOS: Record<string, string[]> = {
  reputacao: [
    "nota",
    "reputacao",
    "score",
    "nota atual",
    "como esta a nota",
    "avaliacao media",
  ],

  caminho_para_nota: [
    "quantas avaliacoes",
    "quantas notas",
    "quantas respostas",
    "para chegar",
    "para alcancar",
    "para atingir",
    "faltam",
    "meta de nota",
    "caminho para a nota",
    "o que falta",
  ],

  espera_do_consumidor: [
    "tempo de resposta",
    "quanto tempo",
    "demora",
    "demorando",
    "demorado",
    "espera",
    "esperou",
    "primeira resposta",
    "rapidez",
    "agilidade",
  ],

  causas_no_tempo: [
    "crescendo",
    "aumentando",
    "subindo",
    "tendencia",
    "ao longo do tempo",
    "por mes",
    "nos ultimos meses",
    "evolucao",
    "piorando",
    "melhorando",
  ],

  fila_da_operacao: [
    "fila",
    "sem resposta",
    "vencidas",
    "vencidos",
    "fora do prazo",
    "atrasadas",
    "atrasados",
    "pendentes",
    "em aberto",
    "sla",
    "prazo",
  ],

  por_frente: [
    "por frente",
    /*
      "frente" no singular também.
      "como está cada frente?" não casava com "frentes" nem com "por
      frente", e a medição ficava inalcançável para a forma mais
      natural da pergunta.
    */
    "frente",
    "cada frente",
    "frentes",
    "por canal",
    "canais",
    "redes sociais",
    "manychat",
    "reclame aqui e nps",
  ],

  nps: [
    "nps",
    "detratores",
    "detrator",
    "promotores",
    "promotor",
    "satisfacao",
    "pesquisa de satisfacao",
  ],

  por_categoria: [
    "categoria",
    "categorias",
    "causa raiz",
    "causas",
    "assunto",
    "assuntos",
    "motivo",
    "motivos",
    "tipo de reclamacao",
  ],

  desfecho: [
    "resolvida",
    "resolvidas",
    "resolvido",
    "resolvidos",
    "resolucao",
    "voltaria a fazer negocio",
    "voltariam",
    "indice de solucao",
    "taxa de resolucao",
    "avaliadas",
  ],

  por_prioridade: [
    "prioridade",
    "prioridades",
    /*
      As quatro formas, e não só o feminino.

      "temos casos **críticos** parados?" não casava com "criticas" nem
      com "critica", e a medição ficava muda para a pergunta mais
      urgente que a operação faz.
    */
    "criticas",
    "critica",
    "criticos",
    "critico",
    "urgentes",
    "urgencia",
    "gravidade",
  ],

  por_regiao: [
    "regiao",
    "regioes",
    "estado",
    "estados",
    "cidade",
    "cidades",
    "de onde",
    "onde vem",
    "geografia",
    "uf",
  ],

  reincidencia: [
    "reincidencia",
    "reincidente",
    "reincidentes",
    "mais de uma vez",
    "repetiu",
    "repetidas",
    "mesmo cliente",
    "voltou a reclamar",
  ],

  mais_antigas_sem_resposta: [
    "mais antigas",
    "mais antigo",
    "ha mais tempo",
    "paradas",
    "parada",
    "parados",
    "parado",
    "esquecidas",
    "esquecida",
    "encalhadas",
  ],

  retencao: [
    "retencao",
    "cancelamento",
    "cancelar",
    "churn",
    "risco de cancelamento",
    "reter",
    "evasao",
  ],

  por_responsavel: [
    "responsavel",
    "responsaveis",
    "por pessoa",
    "carga",
    "time",
    "equipe",
    "quem esta cuidando",
    "quem tem mais",
    "atendente",
    "dono do caso",
  ],

  etiquetas: [
    "etiqueta",
    "etiquetas",
    "marcacoes",
    "tags",
    "rotulos",
    "etiquetando",
  ],

  movimento_recente: [
    "ultimos dias",
    "ultimos",
    "recente",
    "recentes",
    "esta semana",
    "movimento",
    "chegaram",
    "entraram",
    "novos casos",
    "casos novos",
  ],
};

/** Sem acento, minúsculo, espaços colapsados. */
function simplificar(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A raiz aproximada de uma palavra em português.
 *
 * **Por que existe.** Duas vezes seguidas uma medição ficou muda pela
 * forma da palavra: "críticos" não casava com "criticas", "parados"
 * não casava com "paradas". A correção na hora foi escrever as quatro
 * formas à mão — o que resolve o caso e deixa o defeito inteiro de pé,
 * porque a próxima palavra vai chegar em outra conjugação.
 *
 * Recortar o plural e a marca de gênero resolve a classe: "vencida",
 * "vencidos", "esquecido", "demorados" e "antiga" passam a encontrar o
 * gatilho sem ninguém precisar prever a forma.
 *
 * **Conservadora de propósito.** O corte de gênero só vale a partir de
 * seis letras, e é isso que mantém "caso" e "casa" distintos — em
 * quatro letras a poda juntaria os dois numa raiz só. Perde-se alguma
 * flexão rara; não se ganha uma colisão que faria o agente responder
 * sobre outra coisa.
 */
function raiz(palavra: string) {

  let p = palavra;

  if (p.length > 4) {
    p = p.replace(/(oes|aes)$/, "ao");
    p = p.replace(/ais$/, "al");
    p = p.replace(/eis$/, "el");
    p = p.replace(/s$/, "");
  }

  if (p.length >= 6) {
    p = p.replace(/[oa]$/, "");
  }

  return p;
}

/** A frase virada em raízes, na ordem. */
function raizes(texto: string) {
  return simplificar(texto)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(raiz);
}

/**
 * A sequência do gatilho aparece inteira e em ordem na pergunta?
 *
 * Sequência, e não conjunto: "quanto tempo" tem de casar com "quanto
 * tempo demora" e **não** com "qual a previsão do tempo amanhã". Se a
 * ordem não importasse, qualquer frase com as duas palavras soltas
 * receberia números da operação — que é exatamente o erro que a
 * fronteira de palavra veio evitar, só que pior.
 */
function contemSequencia(
  frase: string[],
  gatilho: string[]
) {

  if (gatilho.length === 0) return false;

  for (
    let i = 0;
    i + gatilho.length <= frase.length;
    i += 1
  ) {

    let bate = true;

    for (let j = 0; j < gatilho.length; j += 1) {
      if (frase[i + j] !== gatilho[j]) {
        bate = false;
        break;
      }
    }

    if (bate) return true;
  }

  return false;
}

/**
 * O número que a pergunta carrega, quando ela carrega um.
 *
 * "quantas avaliações para **9,5**" precisa virar `argumento: "9.5"`,
 * e "o que mudou nos últimos **15** dias" precisa virar `"15"`. Sem
 * isto o seletor local rodaria sempre com o padrão, e responderia
 * sobre a nota 9 uma pergunta que era sobre a 9,5.
 */
function argumentoDaPergunta(
  texto: string,
  medicao: string
): string | undefined {

  if (medicao === "movimento_recente") {
    const dias = texto.match(/(\d{1,3})\s*dias?/);
    return dias?.[1];
  }

  if (medicao === "caminho_para_nota") {

    /*
      "nota 9,5" e "para 9.5" contam; "últimos 30 dias" não.
      Por isso o número precisa estar perto de uma palavra de nota, ou
      ser um decimal — 30 dias não vira nota 30.
    */
    const comContexto = texto.match(
      /(?:nota|para|chegar a|alcancar|atingir)\s*(\d{1,2}(?:[.,]\d)?)/
    );

    const valor = comContexto?.[1];

    if (!valor) return undefined;

    return valor.replace(",", ".");
  }

  return undefined;
}

/**
 * Escolhe as medições sem chamar modelo nenhum.
 *
 * Mesma saída de `escolherMedicoes`, mesmo teto de quatro. Devolve
 * lista vazia quando nada casa — e isso é uma resposta, não uma falha:
 * é o que faz "qual a previsão do tempo amanhã?" não receber números
 * da operação.
 */
export function escolherMedicoesLocalmente(
  pergunta: string
): Escolha[] {

  const texto = simplificar(pergunta);

  /* A pergunta em raízes, uma vez só, reaproveitada por todas. */
  const frase = raizes(pergunta);

  const pontuadas = CATALOGO.map((medicao) => {

    const gatilhos = GATILHOS[medicao.nome] ?? [];

    /*
      Ganha o gatilho mais específico, medido pelo comprimento.

      "quantas avaliacoes" (18) tem de passar na frente de "nota" (4)
      numa pergunta que contém as duas — senão "quantas avaliações
      faltam para a nota 9" responderia a nota atual, que é outra
      pergunta.
    */
    const peso = gatilhos.reduce(
      (maior, gatilho) =>
        contemSequencia(frase, raizes(gatilho))
          ? Math.max(maior, gatilho.length)
          : maior,
      0
    );

    return { medicao, peso };
  })
    .filter((item) => item.peso > 0)
    .sort((a, b) => b.peso - a.peso)
    .slice(0, 4);

  return pontuadas.map(({ medicao }) => ({
    nome: medicao.nome,
    argumento: medicao.argumento
      ? argumentoDaPergunta(texto, medicao.nome)
      : undefined,
  }));
}

/** Toda medição do catálogo é alcançável pelo seletor local? */
export function medicoesSemGatilho() {
  return CATALOGO.filter(
    (m) => (GATILHOS[m.nome] ?? []).length === 0
  ).map((m) => m.nome);
}

/**
 * Quais medições respondem esta pergunta?
 *
 * Uma chamada curta e barata: o modelo vê só os nomes e as descrições,
 * nunca os dados. Ele escolhe; quem calcula somos nós.
 *
 * **Teto de quatro.** Sem limite, o modelo pede o catálogo inteiro
 * "por garantia", e a resposta vira um despejo de números em que a
 * pergunta se perde.
 */
export async function escolherMedicoes(
  pergunta: string
): Promise<Escolha[]> {

  /*
    Sem provedor, o agente **não** desiste: escolhe aqui mesmo.

    Antes esta linha era `return []`, e com ela o agente inteiro
    dependia de uma API externa para um passo que nunca precisou de
    uma — classificar uma frase entre nove opções. O efeito prático era
    que, sem chave, o assistente só respondia as perguntas
    pré-escritas.
  */
  if (!provedorDeIA()) {
    return escolherMedicoesLocalmente(pergunta);
  }

  const catalogo = CATALOGO.map(
    (m) =>
      `- ${m.nome}: ${m.descricao}${m.argumento ? ` (argumento: ${m.argumento})` : ""}`
  ).join("\n");

  const r = await pedirEstruturado({
    sistema:
      "Você escolhe quais medições rodar para responder a uma pergunta sobre a operação de Customer Experience da Cardápio Web. Não responda a pergunta; apenas escolha. Escolha no máximo 4, só as que a pergunta realmente precisa. Se a pergunta não for sobre a operação, devolva lista vazia.",
    prompt: `Medições disponíveis:\n${catalogo}\n\nPergunta: "${pergunta}"`,
    esquema: ESQUEMA,

    /*
      Via rápida: escolher entre nove opções é classificação, não
      julgamento. O modelo menor acerta igual e responde em cerca de um
      segundo — e este passo acontece **antes** de a pessoa ver
      qualquer texto, então ele é espera pura.
    */
    rapido: true,
  });

  /*
    Modelo fora do ar cai no seletor local, não no vazio.

    Cota estourada, 503 de congestionamento, rede caída: nada disso é
    motivo para o assistente deixar de responder, já que as contas são
    locais. O que **não** cai para o local é a lista vazia com resposta
    bem-sucedida — ali o modelo disse "isto não é sobre a operação", e
    essa é uma resposta legítima que precisa ser respeitada.
  */
  if (r.erro || !r.dados) {
    return escolherMedicoesLocalmente(pergunta);
  }

  const bruto = (r.dados.medicoes ?? []) as Escolha[];

  const validas = CATALOGO.map((m) => m.nome);

  return bruto
    .filter((e) => validas.includes(e.nome))
    .slice(0, 4);
}

/**
 * Roda o que foi escolhido e devolve os números, em texto.
 *
 * O bloco vai para a instrução de sistema junto do retrato geral. Cada
 * linha começa pelo nome da medição para o modelo poder citar de onde
 * tirou o número — e para quem lê o log conseguir conferir.
 *
 * Medição que falha vira uma linha dizendo isso. Sumir em silêncio
 * deixaria o modelo respondendo sem o dado que ele pediu, sem saber que
 * não o recebeu.
 */
export function medir(
  dados: DadosDaOperacao,
  escolhas: Escolha[]
): string {

  if (escolhas.length === 0) return "";

  const linhas = escolhas.map((escolha) => {

    const medicao = CATALOGO.find(
      (m) => m.nome === escolha.nome
    );

    if (!medicao) {
      return `${escolha.nome}: medição desconhecida.`;
    }

    try {
      return `${medicao.nome}: ${medicao.rodar(dados, escolha.argumento)}`;
    } catch (erro) {
      return `${medicao.nome}: falhou (${
        erro instanceof Error ? erro.message : "erro"
      }).`;
    }
  });

  return linhas.join("\n");
}

/* ============================================================
   OS DADOS, DO BANCO
============================================================ */

/**
 * A base para as medições, lida no servidor.
 *
 * **Não vem do cliente.** O retrato que a tela manda é montado lá, e
 * para um texto de apoio isso é aceitável. Um número que o assistente
 * afirma como fato, não: ele tem de sair do banco, pelo mesmo caminho
 * que as telas usam.
 */
export async function dadosParaMedir(
  prisma: PrismaClient,
  cases: Case[]
): Promise<DadosDaOperacao> {

  const nps = await prisma.npsResponse.findMany({
    select: {
      score: true,
      status: true,
      churnRisk: true,
      respondedAt: true,
      kind: true,
      rootCause: true,
    },
  });

  return {
    cases,
    nps: nps.map((n) => ({
      score: n.score,
      status: n.status,
      churnRisk: n.churnRisk,
      respondedAt: n.respondedAt.toISOString(),
      kind: n.kind,
      rootCause: n.rootCause,
    })),
  };
}

/** Só para o retrato geral continuar disponível a quem quiser. */
export { getReputation };
