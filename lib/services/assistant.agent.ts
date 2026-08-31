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

  if (!provedorDeIA()) return [];

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

  if (r.erro || !r.dados) return [];

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
