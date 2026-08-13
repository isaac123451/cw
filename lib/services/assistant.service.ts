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
  ptBR,
  REFERENCE_DATE,
} from "@/lib/services/reputation.service";

import { slaStatus } from "@/lib/services/sla.service";
import { isOpen } from "@/lib/services/case.service";
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
  tasks: AgendaTask[];
  impacts: ImpactRecord[];
  rules: SlaRule[];
}

interface Skill {
  intent: string;
  /** Palavras que ativam a rotina. */
  triggers: string[];
  run: (input: AssistantInput) => AssistantAnswer;
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
        (Date.parse(`${REFERENCE_DATE}T00:00:00Z`) -
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
      "risco",
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
      "motivo",
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
      "retorno",
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
      "hoje",
      "vencida",
      "follow",
    ],
    run: ({ tasks }) => {

      const vencidas = tasks.filter(
        (item) =>
          !item.done && item.dueDate < REFERENCE_DATE
      );

      const hoje = tasks.filter(
        (item) =>
          !item.done && item.dueDate === REFERENCE_DATE
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

  {
    intent: "tempo-resposta",
    triggers: [
      "tempo",
      "demora",
      "rapidez",
      "quanto tempo",
      "media",
    ],
    run: ({ cases }) => {

      const janela = currentWindow(cases);
      const resumo = getReputation(janela);

      return {
        intent: "tempo-resposta",
        paragraphs: [
          `O tempo médio até a primeira resposta pública é de ${formatElapsed(resumo.responseMinutes)}, calculado sobre as reclamações respondidas da janela de 6 meses.`,
          "O tempo não entra direto na fórmula da nota, mas atraso costuma virar réplica do consumidor e avaliação baixa.",
        ],
        links: [
          {
            label: "Ver evolução do tempo",
            href: "/reclame-aqui/graficos",
          },
        ],
      };
    },
  },
];

/** Resposta padrão quando nenhuma rotina reconhece a pergunta. */
function fallback(
  input: AssistantInput
): AssistantAnswer {

  const janela = currentWindow(input.cases);
  const resumo = getReputation(janela);

  return {
    intent: "resumo",
    paragraphs: [
      `Resumo da operação: nota ${ptBR(resumo.raScore)}, ${resumo.received} reclamações na janela de 6 meses, ${resumo.unanswered} ainda sem resposta.`,
      "Consigo responder sobre nota e reputação, fila sem resposta, prazos e SLA, risco de cancelamento, causa raiz por categoria, impacto financeiro, agenda e tempo de resposta.",
      "Pergunte por exemplo: “quais casos estão fora do prazo?” ou “qual a causa raiz mais recorrente?”.",
    ],
    links: [
      {
        label: "Ver analytics",
        href: "/reclame-aqui/analytics",
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

  const encontrada = skills.find((skill) =>
    skill.triggers.some((trigger) =>
      texto.includes(normalize(trigger))
    )
  );

  return encontrada
    ? encontrada.run(input)
    : fallback(input);
}

/** Perguntas sugeridas na tela. */
export const suggestions = [
  "Como está a nota da reputação agora?",
  "Quais reclamações estão sem resposta?",
  "O que está fora do prazo de SLA?",
  "Qual a causa raiz mais recorrente?",
  "Quais clientes têm risco de cancelamento?",
  "Qual o impacto financeiro registrado?",
];
