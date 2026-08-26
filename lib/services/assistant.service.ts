import { Case } from "@/lib/models/case";
import { AgendaTask } from "@/lib/models/agenda";
import { ImpactRecord } from "@/lib/models/impact";
import { SlaRule } from "@/lib/models/sla";

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
  hojeNaOperacao,
  scoreBands,
  scoreFrom,
} from "@/lib/services/reputation.service";

import { slaStatus } from "@/lib/services/sla.service";
import { isOpen } from "@/lib/services/case.service";
import { parseElapsedText } from "@/lib/services/case.mapper";
import { slugify } from "@/lib/services/slug";

export interface AssistantLink {
  label: string;
  href: string;
}

export interface AssistantAnswer {
  /** Texto em parágrafos já prontos para exibição. */
  paragraphs: string[];
  links: AssistantLink[];
  /** Nome da rotina que respondeu — usado para depurar. */
  intent: string;
}

export interface AssistantInput {
  cases: Case[];

  /**
   * As respostas de NPS, quando a tela as tem.
   *
   * Opcional porque o assistente é chamado de mais de um lugar e nem
   * todos carregam o NPS. As rotinas que dependem dele dizem que não
   * têm o dado em vez de responder sobre uma lista vazia — "o NPS está
   * em 0" seria uma afirmação falsa dita com a mesma confiança das
   * verdadeiras.
   */
  nps?: {
    score: number;
    status: string;
    churnRisk?: boolean;
    respondedAt: string;
    customer: string;
    comment?: string;
  }[];

  tasks: AgendaTask[];
  impacts: ImpactRecord[];
  rules: SlaRule[];
}

interface Skill {
  intent: string;
  /** Palavras que ativam a rotina. */
  triggers: string[];

  /**
   * A pergunta chega junto, e não só os dados.
   *
   * Antes a assinatura era `(input) => AssistantAnswer`, e por isso
   * nenhuma rotina conseguia ler um número do que a pessoa escreveu.
   * "Quantas avaliações faltam para a nota 9" não tinha como saber que
   * o alvo era 9 — a pergunta que o Isaac deu de exemplo era, na
   * prática, impossível de responder por construção.
   */
  run: (
    input: AssistantInput,
    pergunta: string
  ) => AssistantAnswer;
}

/**
 * O número que a pessoa escreveu, quando escreveu um.
 *
 * Aceita vírgula e ponto — "nota 8,5" e "nota 8.5" são a mesma coisa
 * para quem digita. Ignora número fora da escala: "quantas avaliações
 * para 2026" não está pedindo nota 2026.
 */
function notaPedida(pergunta: string): number | null {

  const m = pergunta.match(
    /\b(\d{1,2})(?:[.,](\d))?\b/
  );

  if (!m) return null;

  const valor = Number(
    m[2] ? `${m[1]}.${m[2]}` : m[1]
  );

  return valor >= 0 && valor <= 10 ? valor : null;
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function brDate(iso: string) {
  return iso.split("-").reverse().join("/");
}

/** Casos do período oficial de 6 meses, base da nota pública. */
function currentWindow(cases: Case[]) {
  const range = getRange("6m", "vigente");
  return cases.filter((item) =>
    inRange(item, range.start, range.end)
  );
}

const skills: Skill[] = [

  /**
   * Quantas avaliações faltam para uma meta.
   *
   * Era a pergunta que o Isaac deu de exemplo — "quantas avaliações
   * faltam para a nota 9" — e que caía num resumo genérico. É conta, e
   * a plataforma sabe fazê-la exata.
   *
   * Os gatilhos são frases, não palavras: "quantas avaliacoes" tem 17
   * letras e ganha de "nota", que tem 4, na escolha por especificidade
   * lá embaixo. A posição no array não importa.
   *
   * A conta é a mesma da calculadora (`evaluationsToReach`), não uma
   * segunda implementação: assistente e tela discordarem sobre quantas
   * avaliações faltam seria pior do que o assistente não responder.
   */
  {
    intent: "meta-de-nota",
    triggers: [
      "quantas avaliacoes",
      "quantas avaliacao",
      "faltam para",
      "falta para",
      "chegar na nota",
      "chegar a nota",
      "subir a nota",
      "aumentar a nota",
      "atingir a nota",
      "como melhorar a nota",
    ],
    run: ({ cases }, pergunta) => {

      const janela = currentWindow(cases);
      const base = getRawCounts(janela);
      const atual = scoreFrom(base);

      const alvo = notaPedida(pergunta);

      /**
       * Sem número na pergunta, a meta é a próxima faixa acima.
       *
       * "Como subir a nota?" não diz até onde, e responder "faltam N
       * para 10" seria desanimador e inútil. A faixa seguinte é a meta
       * que a operação persegue de fato.
       */
      const proxima = [...scoreBands]
        .sort((a, b) => a.min - b.min)
        .find((b) => b.min > atual.raScore);

      const meta = alvo ?? proxima?.min ?? 10;

      const teto = pendingEvaluations(base);

      if (atual.raScore >= meta) {
        return {
          intent: "meta-de-nota",
          paragraphs: [
            `A nota já está em ${ptBR(atual.raScore)}, acima de ${ptBR(meta)} — não falta nenhuma avaliação para essa meta.`,
            base.received - base.answered > 0
              ? `Para segurar: ${base.received - base.answered} reclamação(ões) da janela ainda estão sem resposta, e resposta é o único indicador que depende só de nós.`
              : "Todas as reclamações da janela foram respondidas.",
          ],
          links: [
            {
              label: "Simular na calculadora",
              href: "/reclame-aqui/calculadora",
            },
          ],
        };
      }

      const resultado = evaluationsToReach(base, {
        label: `nota ${ptBR(meta)}`,
        range: `${ptBR(meta)} a 10`,
        color: "",
        min: meta,
      });

      /**
       * O teto do período entra na resposta, não só o número.
       *
       * Uma avaliação pertence a uma reclamação: se faltam 40 e só há
       * 12 reclamações sem avaliação, "faltam 40" é uma meia-verdade
       * que manda alguém perseguir o impossível. É a mesma trava que a
       * calculadora ganhou.
       */
      if (!resultado.reachable) {
        return {
          intent: "meta-de-nota",
          paragraphs: [
            `Não dá para chegar a ${ptBR(meta)} só com avaliação neste período. Mesmo avaliando nota 10 as ${teto} reclamações que ainda não têm avaliação, a nota chega a ${ptBR(resultado.projected)}.`,
            `Hoje a nota é ${ptBR(atual.raScore)}, com índice de resposta em ${ptBR(atual.responseIndex)}% e solução em ${ptBR(atual.solutionIndex)}%. O caminho é responder o que está parado e pedir moderação das notas baixas.`,
          ],
          links: [
            {
              label: "Simular na calculadora",
              href: "/reclame-aqui/calculadora",
            },
            {
              label: "Ver o que está sem resposta",
              href: "/reclame-aqui?status=Novo",
            },
          ],
        };
      }

      return {
        intent: "meta-de-nota",
        paragraphs: [
          `Faltam ${resultado.needed} avaliação(ões) nota 10, resolvidas e favoráveis, para a nota sair de ${ptBR(atual.raScore)} e chegar a ${ptBR(resultado.projected)}.`,
          `Cabem no período: há ${teto} reclamação(ões) da janela ainda sem avaliação, e cada avaliação pertence a uma reclamação.`,
          base.received - base.answered > 0
            ? `Antes disso, ${base.received - base.answered} reclamação(ões) seguem sem resposta — responder é mais rápido do que conquistar avaliação, e o índice de resposta pesa 20% da nota.`
            : "Todas as reclamações da janela já foram respondidas, então o ganho vem mesmo de avaliação.",
        ],
        links: [
          {
            label: "Simular na calculadora",
            href: "/reclame-aqui/calculadora",
          },
        ],
      };
    },
  },

  {
    intent: "nota",
    triggers: [
      "nota",
      "reputacao",
      "ra1000",
      "score",
      "pontuacao",
    ],
    run: ({ cases }) => {

      const janela = currentWindow(cases);
      const resumo = getReputation(janela);
      const band = displayBand(resumo);

      return {
        intent: "nota",
        paragraphs: [
          `A nota atual é ${ptBR(resumo.raScore)} de 10, faixa "${band.label}", apurada sobre ${resumo.received} reclamações da janela oficial de 6 meses.`,
          `Índice de resposta em ${ptBR(resumo.responseIndex)}% (${resumo.answered} respondidas, ${resumo.unanswered} sem resposta), índice de solução em ${ptBR(resumo.solutionIndex)}% e intenção de retorno em ${ptBR(resumo.wouldReturnIndex)}%.`,
          resumo.unanswered > 0
            ? `Responder as ${resumo.unanswered} reclamações em aberto é a alavanca mais rápida: resposta tem peso 20% e é o único indicador que depende só de nós.`
            : "Todas as reclamações da janela foram respondidas — o ganho agora vem de solução e avaliação.",
        ],
        links: [
          {
            label: "Ver analytics de reputação",
            href: "/reclame-aqui/analytics",
          },
          {
            label: "Simular na calculadora",
            href: "/reclame-aqui/calculadora",
          },
        ],
      };
    },
  },

  {
    intent: "sem-resposta",
    triggers: [
      "sem resposta",
      "nao respondida",
      "responder",
      "pendente",
      "fila",
    ],
    run: ({ cases }) => {

      const semResposta = cases
        .filter((item) => item.status === "Novo")
        .sort((a, b) =>
          a.createdAt.localeCompare(b.createdAt)
        );

      if (semResposta.length === 0) {
        return {
          intent: "sem-resposta",
          paragraphs: [
            "Não há reclamações sem resposta no momento.",
          ],
          links: [
            {
              label: "Abrir a fila",
              href: "/reclame-aqui",
            },
          ],
        };
      }

      const antigo = semResposta[0];

      const dias = Math.round(
        (Date.parse(`${hojeNaOperacao()}T00:00:00Z`) -
          Date.parse(`${antigo.createdAt}T00:00:00Z`)) /
          86400000
      );

      return {
        intent: "sem-resposta",
        paragraphs: [
          `Existem ${semResposta.length} reclamações sem resposta pública.`,
          `A mais antiga é "${antigo.title}" (${antigo.protocol}), de ${antigo.customer}, publicada em ${brDate(antigo.createdAt)} — ${dias} dias parada.`,
          `As próximas na fila: ${semResposta
            .slice(1, 4)
            .map((item) => item.protocol)
            .join(", ")}.`,
        ],
        links: [
          {
            label: "Abrir a mais antiga",
            href: `/reclame-aqui/${antigo.id}`,
          },
          {
            label: "Ver toda a fila",
            href: "/reclame-aqui",
          },
        ],
      };
    },
  },

  {
    intent: "sla",
    triggers: [
      "sla",
      "prazo",
      "atrasado",
      "fora do prazo",
      "vencido",
    ],
    run: ({ cases, rules }) => {

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
            a.status.remainingHours -
            b.status.remainingHours
        );

      if (atrasados.length === 0) {
        return {
          intent: "sla",
          paragraphs: [
            `Nenhum dos ${abertos.length} casos em aberto está fora do prazo.`,
          ],
          links: [
            {
              label: "Ver regras de SLA",
              href: "/processos",
            },
          ],
        };
      }

      const pior = atrasados[0];

      return {
        intent: "sla",
        paragraphs: [
          `${atrasados.length} dos ${abertos.length} casos em aberto estão fora do prazo da regra aplicável.`,
          `O mais crítico é "${pior.item.title}" (${pior.item.protocol}), categoria ${pior.item.category}, com ${Math.abs(
            Math.round(pior.status.remainingHours / 24)
          )} dias de atraso.`,
          `Regra aplicada: ${pior.status.rule?.responseHours}h para resposta, sob responsabilidade de ${pior.status.rule?.team ?? "ninguém definido"}.`,
        ],
        links: [
          {
            label: "Abrir o caso mais atrasado",
            href: `/reclame-aqui/${pior.item.id}`,
          },
          {
            label: "Ver todos os atrasos",
            href: "/processos",
          },
        ],
      };
    },
  },

  {
    intent: "churn",
    triggers: [
      "churn",
      "cancelamento",
      "cancelar",
      "risco de",
      "perder cliente",
    ],
    run: ({ cases }) => {

      const risco = cases.filter(
        (item) => item.churnRisk
      );

      const abertos = risco.filter(isOpen);

      const porCliente = new Map<string, number>();

      for (const item of risco) {
        porCliente.set(
          item.customer,
          (porCliente.get(item.customer) ?? 0) + 1
        );
      }

      const top = [...porCliente.entries()].sort(
        (a, b) => b[1] - a[1]
      )[0];

      return {
        intent: "churn",
        paragraphs: [
          `${risco.length} reclamações estão sinalizadas como risco de cancelamento, sendo ${abertos.length} ainda em aberto.`,
          top
            ? `${top[0]} é quem mais aparece, com ${top[1]} ocorrência(s) de risco — vale um contato direto.`
            : "Nenhum cliente concentra ocorrências de risco.",
          "Cada cancelamento evitado pode ser registrado em Impacto no Negócio para medir o retorno da operação.",
        ],
        links: top
          ? [
              {
                label: `Ver perfil de ${top[0]}`,
                href: `/clientes/${slugify(top[0])}`,
              },
              {
                label: "Registrar impacto",
                href: "/impacto",
              },
            ]
          : [
              {
                label: "Ver impacto no negócio",
                href: "/impacto",
              },
            ],
      };
    },
  },

  {
    intent: "causa-raiz",
    triggers: [
      "causa",
      "categoria",
      "assunto",
      "motivo das reclamacoes",
      "reclamam",
      "recorrente",
    ],
    run: ({ cases }) => {

      const janela = currentWindow(cases);

      const contagem = new Map<string, number>();

      for (const item of janela) {
        contagem.set(
          item.category,
          (contagem.get(item.category) ?? 0) + 1
        );
      }

      const ranking = [...contagem.entries()].sort(
        (a, b) => b[1] - a[1]
      );

      const [primeira, segunda, terceira] = ranking;

      if (!primeira) {
        return {
          intent: "causa-raiz",
          paragraphs: [
            "Não há reclamações suficientes na janela para apontar causa raiz.",
          ],
          links: [],
        };
      }

      const pct = (valor: number) =>
        ptBR((valor / janela.length) * 100);

      return {
        intent: "causa-raiz",
        paragraphs: [
          `Na janela de 6 meses, "${primeira[0]}" concentra ${primeira[1]} reclamações (${pct(primeira[1])}% do total).`,
          [segunda, terceira]
            .filter(Boolean)
            .map(
              (item) =>
                `"${item[0]}" com ${item[1]} (${pct(item[1])}%)`
            )
            .join(" e ") +
            " completam o topo do ranking.",
          "Clicar na categoria dentro do Analytics filtra toda a tela e mostra as subcategorias por trás dela.",
        ],
        links: [
          {
            label: "Abrir ranking por categoria",
            href: "/reclame-aqui/analytics",
          },
          {
            label: "Ver regras de SLA da categoria",
            href: "/processos",
          },
        ],
      };
    },
  },

  {
    intent: "impacto",
    triggers: [
      "impacto",
      "receita",
      "financeiro",
      "retorno financeiro",
      "dinheiro",
    ],
    run: ({ impacts }) => {

      const money = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      });

      if (impacts.length === 0) {
        return {
          intent: "impacto",
          paragraphs: [
            "Nenhum impacto financeiro foi registrado ainda.",
            "O registro pode ser feito direto da reclamação, pelo botão “Registrar impacto” no topo do caso.",
          ],
          links: [
            {
              label: "Abrir Impacto no Negócio",
              href: "/impacto",
            },
          ],
        };
      }

      const entradas = impacts
        .filter((item) => item.amount > 0)
        .reduce((sum, item) => sum + item.amount, 0);

      const custos = impacts
        .filter((item) => item.amount < 0)
        .reduce((sum, item) => sum + item.amount, 0);

      const vinculados = impacts.filter(
        (item) => item.relatedCase
      ).length;

      return {
        intent: "impacto",
        paragraphs: [
          `Há ${impacts.length} registros de impacto: ${money.format(entradas)} de entrada e ${money.format(Math.abs(custos))} em ofertas concedidas, resultado líquido de ${money.format(entradas + custos)}.`,
          `${vinculados} de ${impacts.length} registros estão amarrados a uma reclamação específica — quanto maior essa proporção, mais defensável é o número.`,
        ],
        links: [
          {
            label: "Abrir Impacto no Negócio",
            href: "/impacto",
          },
        ],
      };
    },
  },

  {
    intent: "agenda",
    triggers: [
      "agenda",
      "atividade",
      "tarefa",
      "para hoje",
      "vencida",
      "follow",
    ],
    run: ({ tasks }) => {

      const vencidas = tasks.filter(
        (item) =>
          !item.done && item.dueDate < hojeNaOperacao()
      );

      const hoje = tasks.filter(
        (item) =>
          !item.done && item.dueDate === hojeNaOperacao()
      );

      return {
        intent: "agenda",
        paragraphs: [
          `A agenda tem ${vencidas.length} atividade(s) vencida(s) e ${hoje.length} para hoje.`,
          vencidas.length > 0
            ? `A mais antiga é "${
                [...vencidas].sort((a, b) =>
                  a.dueDate.localeCompare(b.dueDate)
                )[0].title
              }", de ${brDate(
                [...vencidas].sort((a, b) =>
                  a.dueDate.localeCompare(b.dueDate)
                )[0].dueDate
              )}.`
            : "Nada em atraso.",
        ],
        links: [
          { label: "Abrir agenda", href: "/agenda" },
        ],
      };
    },
  },

  /**
   * O tempo de resposta pela **distribuição**, e não pela média.
   *
   * A resposta era a média, e a média mente aqui: medido na base real,
   * ela dá 21 dias enquanto a mediana é 7 e a pior levou 171. Quem
   * ouve "21 dias" imagina que os casos se parecem uns com os outros;
   * na verdade 30% passaram de quinze dias e é essa cauda que gera
   * avaliação baixa.
   *
   * Foi a mesma correção que o Isaac fez sobre o teto: "não é média,
   * mas sim sobre o máximo".
   */
  {
    intent: "tempo-resposta",
    triggers: [
      "tempo de resposta",
      "tempo medio",
      "demora",
      "quanto tempo",
      "rapidez",
      "media",
      "estamos demorando",
      "demorando muito",
    ],
    run: ({ cases }) => {

      const janela = currentWindow(cases);
      const resumo = getReputation(janela);

      const minutos = janela
        .filter(
          (item) =>
            (item.publicResponse ?? "").trim() !== ""
        )
        .map((item) =>
          parseElapsedText(item.responseTime)
        )
        .filter(
          (valor): valor is number => valor !== null
        )
        .sort((a, b) => a - b);

      if (minutos.length === 0) {
        return {
          intent: "tempo-resposta",
          paragraphs: [
            "Nenhuma reclamação da janela de 6 meses tem tempo de resposta registrado, então não dá para dizer quanto estamos demorando.",
            "O tempo vem da importação do Reclame Aqui; sem ele, o que sobra é o índice de resposta, que hoje está em " +
              `${ptBR(scoreFrom(getRawCounts(janela)).responseIndex)}%.`,
          ],
          links: [
            {
              label: "Ver gráficos",
              href: "/reclame-aqui/graficos",
            },
          ],
        };
      }

      const mediana =
        minutos[Math.floor(minutos.length / 2)];

      const pior = minutos[minutos.length - 1];

      const acimaDeQuinze = minutos.filter(
        (valor) => valor > 21600
      ).length;

      const dentroDeUmDia = minutos.filter(
        (valor) => valor <= 1440
      ).length;

      const parte = (n: number) =>
        Math.round((n / minutos.length) * 100);

      return {
        intent: "tempo-resposta",
        paragraphs: [
          `Metade das respostas saiu em até ${formatElapsed(mediana)}, e a pior levou ${formatElapsed(pior)} — sobre ${minutos.length} reclamação(ões) respondidas da janela de 6 meses.`,
          `${dentroDeUmDia} (${parte(dentroDeUmDia)}%) foram respondidas em até 24 h; ${acimaDeQuinze} (${parte(acimaDeQuinze)}%) passaram de 15 dias, que é onde a avaliação vem baixa mesmo com a resposta certa.`,
          `A média é ${formatElapsed(resumo.responseMinutes)}, e ela esconde essa cauda: alguns casos muito longos puxam o número sem que a maioria se pareça com ele. Prefira a mediana para decidir.`,
        ],
        links: [
          {
            label: "Ver a distribuição",
            href: "/reclame-aqui/graficos",
          },
          {
            label: "Ver o que está sem resposta",
            href: "/reclame-aqui?situacao=sem-resposta",
          },
        ],
      };
    },
  },

  /**
   * Como está o NPS.
   *
   * O assistente não sabia falar da pesquisa — respondia sobre o
   * Reclame Aqui a quem perguntasse "como está o NPS", porque "nota"
   * casava com o gatilho da reputação. Duas frentes com a palavra
   * "nota" e uma resposta só é como se dá a informação errada com
   * segurança.
   */
  {
    intent: "nps",
    triggers: [
      "nps",
      "pesquisa",
      "detratores",
      "detrator",
      "promotores",
      "promotor",
      "como esta o nps",
    ],
    run: ({ nps }) => {

      if (!nps) {
        return {
          intent: "nps",
          paragraphs: [
            "Não recebi as respostas de NPS nesta tela, então não vou arriscar um número.",
            "A tela do NPS tem o indicador do período, a fila sem tratativa e os detratores por causa raiz.",
          ],
          links: [
            { label: "Abrir NPS", href: "/nps" },
            {
              label: "Análise do NPS",
              href: "/nps/analise",
            },
          ],
        };
      }

      if (nps.length === 0) {
        return {
          intent: "nps",
          paragraphs: [
            "Não há nenhuma resposta de NPS na base — não é nota zero, é ausência de resposta.",
            "A importação do Wootric roda na rotina agendada; se ela não estiver trazendo nada, a tela do NPS mostra o motivo.",
          ],
          links: [{ label: "Abrir NPS", href: "/nps" }],
        };
      }

      const promotores = nps.filter(
        (item) => item.score >= 9
      ).length;

      const neutros = nps.filter(
        (item) => item.score >= 7 && item.score <= 8
      ).length;

      const detratores = nps.filter(
        (item) => item.score <= 6
      ).length;

      const indicador = Math.round(
        ((promotores - detratores) / nps.length) * 100
      );

      const semTratativa = nps.filter((item) =>
        item.status.toLowerCase().includes("novo")
      ).length;

      const emRisco = nps.filter(
        (item) => item.churnRisk
      ).length;

      return {
        intent: "nps",
        paragraphs: [
          `O NPS da base é ${indicador}, sobre ${nps.length} resposta(s): ${promotores} promotor(es), ${neutros} neutro(s) e ${detratores} detrator(es).`,
          semTratativa > 0
            ? `${semTratativa} resposta(s) ainda estão sem tratativa — é a fila que fecha o ciclo, e detrator sem retorno vira reclamação pública.`
            : "Todas as respostas já entraram em tratativa.",
          emRisco > 0
            ? `${emRisco} conta(s) estão marcadas como caso de retenção a partir da pesquisa.`
            : "Nenhuma conta foi marcada como retenção a partir da pesquisa.",
        ],
        links: [
          { label: "Abrir NPS", href: "/nps" },
          {
            label: "Análise do NPS",
            href: "/nps/analise",
          },
        ],
      };
    },
  },

  /**
   * Quem precisa de retenção, nas três frentes.
   *
   * A rotina de churn existente olha só as reclamações. A marca de
   * retenção agora existe também no NPS, e a pergunta "quem está para
   * cancelar" não é sobre um canal — é sobre a carteira.
   */
  {
    intent: "retencao",
    triggers: [
      "quem vai cancelar",
      "retencao",
      "reter",
      "para cancelar",
      "casos de retencao",
      "risco de cancelamento",
    ],
    run: ({ cases, nps }) => {

      /*
        Conta **todas** as marcadas, e diz quantas seguem abertas.

        A primeira versão filtrava por `isOpen`, e sobre a base real
        isso dava zero: as 28 reclamações marcadas estão todas em "Não
        resolvido", que é status de encerrado. O assistente diria
        "nenhuma" enquanto o painel dizia 28, e as duas telas estariam
        certas pela própria régua — que é exatamente como se perde a
        confiança numa ferramenta.

        A régua passa a ser a mesma do painel e da fila
        (`naSituacao`): marcada é marcada. O quanto ainda está aberto
        entra como detalhe, porque é informação e não critério — uma
        reclamação encerrada como "não resolvido" com o cliente
        falando em cancelar continua sendo trabalho de retenção.
      */
      const doRa = cases.filter((item) => item.churnRisk);

      const abertas = doRa.filter(isOpen);

      const doNps = (nps ?? []).filter(
        (item) => item.churnRisk
      );

      const total = doRa.length + doNps.length;

      if (total === 0) {
        return {
          intent: "retencao",
          paragraphs: [
            "Nenhuma conta está marcada como caso de retenção — nem nas reclamações, nem no NPS.",
            "A marca é manual: quem ouve o cliente falar em cancelar aperta o botão na ficha, e é ele que junta essas contas numa fila só.",
          ],
          links: [
            {
              label: "Ver a fila",
              href: "/reclame-aqui?situacao=risco",
            },
          ],
        };
      }

      return {
        intent: "retencao",
        paragraphs: [
          `${total} conta(s) estão marcadas como retenção: ${doRa.length} vinda(s) de reclamação e ${doNps.length} do NPS. É o mesmo número do cartão "Risco de cancelamento" no painel.`,
          abertas.length > 0
            ? `Dessas, ${abertas.length} reclamação(ões) ainda estão em aberto — a mais antiga é de ${brDate([...abertas].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0].createdAt)}.`
            : `Nenhuma das ${doRa.length} reclamações marcadas segue em aberto: foram encerradas, a maioria como "não resolvido". A conta continua precisando de retenção mesmo assim — o caso fechou, a relação não.`,
          nps === undefined
            ? "Não recebi as respostas de NPS nesta tela, então a contagem acima cobre só as reclamações."
            : "A conta cobre as duas frentes que têm a marca.",
        ],
        links: [
          {
            label: "Reclamações em retenção",
            href: "/reclame-aqui?situacao=risco",
          },
          { label: "Abrir NPS", href: "/nps" },
        ],
      };
    },
  },
];

/**
 * Quando nenhuma rotina reconhece a pergunta.
 *
 * **Isto não devolve mais um resumo genérico.** Devolver "a nota é 8,4
 * e há 13 sem resposta" para quem perguntou outra coisa é pior do que
 * dizer "não sei": parece resposta, então quem lê acredita que foi
 * respondido e vai embora com o número errado na cabeça.
 *
 * Agora diz que não entendeu, lista o que sabe fazer, e — quando a
 * pergunta tem cara de conta sobre a nota — sugere a formulação que
 * funciona, em vez de deixar a pessoa adivinhar.
 */
function fallback(
  input: AssistantInput,
  pergunta: string
): AssistantAnswer {

  const texto = normalize(pergunta);

  const pareceConta =
    /quant|falta|preciso|chegar|subir|meta|melhorar/.test(
      texto
    );

  return {
    intent: "nao-entendi",
    paragraphs: [
      "Não entendi essa. Respondo com número da base, e prefiro dizer que não sei a chutar.",
      "Sei falar de: nota e reputação, quantas avaliações faltam para uma meta, fila sem resposta, prazos e SLA, contas que precisam de retenção nas três frentes, causa raiz por categoria, NPS e detratores, impacto financeiro, agenda, e quanto tempo o consumidor esperou de verdade — pela mediana e pela cauda, não pela média.",
      pareceConta
        ? "Se for conta sobre a nota, tente “quantas avaliações faltam para a nota 9?” — eu simulo sobre a base real e digo o teto do período."
        : "Tente “quais casos estão fora do prazo?” ou “qual a causa raiz mais recorrente?”.",
    ],
    links: [
      {
        label: "Simular na calculadora",
        href: "/reclame-aqui/calculadora",
      },
    ],
  };
}

/**
 * Responde a partir dos dados reais da operação.
 *
 * Não há chamada de modelo: cada rotina consulta a base e monta a
 * resposta com números verificáveis. É determinístico de propósito —
 * um número inventado aqui viraria decisão errada na operação.
 */
export function ask(
  question: string,
  input: AssistantInput
): AssistantAnswer {

  const texto = normalize(question);

  /**
   * Ganha o gatilho **mais específico**, não o primeiro da lista.
   *
   * Duas coisas estavam erradas aqui.
   *
   * A primeira: a comparação era `texto.includes(gatilho)`, sem
   * fronteira de palavra. "Qual a previsão do **tempo** amanhã?" casava
   * com o gatilho "tempo" e recebia o tempo médio de primeira resposta
   * — uma resposta impecável para outra pergunta, que é o pior tipo de
   * erro que um assistente pode cometer.
   *
   * A segunda: `find` devolvia a **primeira** rotina que casasse, então
   * a resposta dependia da ordem do array. "Quantas avaliações faltam
   * para a nota 9" casa com "nota" e com "quantas avaliacoes"; qual
   * vencia era acidente de posição.
   *
   * Agora o gatilho mais longo vence, o que na prática é o mais
   * específico: "quantas avaliacoes" (17 letras) passa na frente de
   * "nota" (4). Ordenar o array deixa de importar.
   */
  const casar = (gatilho: string) => {

    const g = normalize(gatilho);

    const escapado = g.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    return new RegExp(
      `(^|[^a-z0-9])${escapado}([^a-z0-9]|$)`
    ).test(texto)
      ? g.length
      : 0;
  };

  let melhor: Skill | null = null;
  let peso = 0;

  for (const skill of skills) {
    for (const gatilho of skill.triggers) {

      const p = casar(gatilho);

      if (p > peso) {
        peso = p;
        melhor = skill;
      }
    }
  }

  return melhor
    ? melhor.run(input, question)
    : fallback(input, question);
}

/** Perguntas sugeridas na tela. */
export const suggestions = [
  "Como está a nota da reputação agora?",
  "Quantas avaliações faltam para a nota 9?",
  "Quais reclamações estão sem resposta?",
  "O que está fora do prazo de SLA?",
  "Qual a causa raiz mais recorrente?",
  "Quais clientes têm risco de cancelamento?",
  "Qual o impacto financeiro registrado?",
];
