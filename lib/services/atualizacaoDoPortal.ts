/**
 * O que uma planilha do Reclame Aqui pode mudar numa reclamação que já
 * existe — e só isso.
 *
 * **Por que é um módulo, e não mais uma regra dentro do script.** Havia
 * dois caminhos de importação e duas regras. O `ra:atualizar` tocava só
 * o que é fato do portal. O botão **Importar** da tela regravava a linha
 * inteira — e a planilha não traz o que a operação fez. Medido em
 * 10/09/2026, com a última planilha: um clique teria trocado **142
 * respostas públicas reais** pelo marcador de 38 caracteres que o leitor
 * põe no lugar do texto, **tirado o responsável de 141** reclamações e
 * refeito as etiquetas de 71 só com as da planilha.
 *
 * Uma regra, dois chamadores. Quem mudar o que o portal pode tocar muda
 * aqui, e vale para os dois.
 *
 * **Os dois donos de uma reclamação.**
 *
 * - O **portal** é dono do que o consumidor e o público fizeram:
 *   resposta pública e sua data, avaliação, nota, se foi resolvida, se
 *   voltaria a fazer negócio — e a coluna do quadro, quando ela é uma
 *   das que o portal conhece.
 * - A **operação** é dona do que ela decidiu: responsável, time,
 *   etiquetas, prioridade, categoria, rascunho, dossiê, risco de
 *   cancelamento, coluna própria do quadro.
 *
 * Esta regra toca **apenas o primeiro grupo**, e a lista está escrita
 * como código, não como intenção.
 */
import { Case } from "@/lib/models/case";

/* Do módulo leve, não do leitor de planilha — ver raMarcadores. */
import {
  RELATO_SINTETICO,
  RESPOSTA_SINTETICA,
} from "@/lib/services/raMarcadores";

/**
 * Os campos do portal. Nada fora desta lista é tocado.
 *
 * Constante e não embutida no código de gravação porque é a decisão de
 * segurança desta regra: alguém que acrescente um campo aqui está
 * declarando "o portal é dono disto", e é uma linha que se lê numa
 * revisão.
 */
export const DO_PORTAL = [
  "publicResponse",
  "publicResponseAt",
  "evaluated",
  "score",
  "resolved",
  "wouldDoBusiness",
  "evaluatedAt",

  /**
   * A coluna do quadro **é** fato do portal, para reclamação do RA.
   *
   * Na importação ela já nasce de `mapStatus`, que traduz o status do
   * Reclame Aqui. Uma reclamação respondida lá e "Novo" aqui não é
   * escolha de ninguém — é dado velho, e era a origem das "21
   * pendentes que nem tem isso tudo".
   *
   * Entra com duas travas: nada anda para trás, e coluna que a operação
   * inventou não é tocada.
   */
  "status",
] as const;

/**
 * Contato do consumidor: a planilha **completa**, não sobrescreve.
 *
 * Nem é do portal nem da operação de forma limpa. O consumidor informa
 * ao portal, mas a operação pode ter corrigido um telefone à mão — e a
 * planilha devolveria o errado. Por outro lado, a regra antiga
 * comparava contato por um motivo real: uma base gravada com telefone
 * **mascarado** (`(11)•••••-1234`) só se desmascarava reimportando o
 * arquivo completo.
 *
 * A saída é gravar só onde o banco está vazio ou mascarado. Valor real
 * no banco fica; máscara da planilha nunca entra.
 */
export const CONTATO = ["email", "phone", "city", "state"] as const;

const MASCARA = /•/;

export type CampoDoPortal =
  | (typeof DO_PORTAL)[number]
  | (typeof CONTATO)[number];

/**
 * As colunas que o portal conhece.
 *
 * Se a operação moveu o caso para uma coluna própria — "Em análise
 * jurídica", "Aguardando o parceiro" —, o portal não tem opinião sobre
 * ela, e esta regra passa longe. Puxar de volta seria desfazer uma
 * decisão que o Reclame Aqui nem sabe que existe.
 */
export const COLUNAS_DO_PORTAL = new Set([
  "Novo",
  "Aguardando nossa réplica",
  "Aguardando avaliação",
  "Resolvido",
  "Não resolvido",
]);

/**
 * Colunas de onde não se volta.
 *
 * Uma reclamação avaliada não desavalia. Se um export mais **velho** que
 * o banco for importado por engano — coisa de um clique no arquivo
 * errado —, sem esta trava o quadro inteiro andaria para trás e a
 * operação perderia o rastro do que já tinha fechado.
 */
export const COLUNAS_FINAIS = new Set([
  "Resolvido",
  "Não resolvido",
]);

/** O que o banco tem hoje, nos campos que a regra olha. */
export interface NoBancoDoPortal {
  status: string;
  publicResponse: string | null;
  publicResponseAt: Date | null;
  evaluated: boolean;
  score: number | null;
  resolved: boolean;
  wouldDoBusiness: boolean;
  evaluatedAt: Date | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
}

function comparavel(valor: unknown) {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) return valor.toISOString();
  return String(valor).trim();
}

const EH_DATA = new Set<CampoDoPortal>([
  "publicResponseAt",
  "evaluatedAt",
]);

/**
 * O que gravar numa reclamação existente, a partir da linha da planilha.
 *
 * Devolve só os campos que mudaram — vazio quando não há nada a fazer.
 * `diferencas` é o que a simulação mostra, campo a campo.
 */
export function mudancasDoPortal(
  doArquivo: Case,
  atual: NoBancoDoPortal
): {
  dados: Partial<Record<CampoDoPortal, unknown>>;
  diferencas: string[];
} {

  const dados: Partial<Record<CampoDoPortal, unknown>> = {};
  const diferencas: string[] = [];

  for (const campo of DO_PORTAL) {

    const novo = (
      doArquivo as unknown as Record<string, unknown>
    )[campo];

    /*
      Campo ausente no arquivo não apaga o que está no banco.

      A planilha às vezes vem sem uma coluna; tratar ausência como
      "vazio" transformaria um relatório incompleto numa limpeza de
      dados que ninguém pediu.
    */
    if (novo === undefined || novo === null || novo === "") {
      continue;
    }

    /**
     * Marcador não substitui conteúdo.
     *
     * A planilha diz **se** a empresa respondeu, não **o que** respondeu
     * — o leitor preenche com um texto sintético para o índice de
     * resposta não contar errado. Gravá-lo por cima trocaria a resposta
     * de verdade, de centenas de caracteres, pelos 38 do marcador. Foi o
     * que o botão Importar faria com 142 reclamações.
     */
    if (novo === RESPOSTA_SINTETICA || novo === RELATO_SINTETICO) {
      continue;
    }

    const velho = (atual as unknown as Record<string, unknown>)[campo];

    /* As duas travas da coluna do quadro. */
    if (campo === "status") {
      const atualStatus = String(velho ?? "");

      if (!COLUNAS_DO_PORTAL.has(atualStatus)) continue;

      if (
        COLUNAS_FINAIS.has(atualStatus) &&
        !COLUNAS_FINAIS.has(String(novo))
      ) {
        continue;
      }
    }

    const a = comparavel(velho);

    const valor = EH_DATA.has(campo) ? new Date(String(novo)) : novo;

    const b = comparavel(valor);

    if (a === b) continue;

    dados[campo] = valor;

    diferencas.push(
      `${campo}: ${a.slice(0, 30) || "(vazio)"} → ${b.slice(0, 30)}`
    );
  }

  for (const campo of CONTATO) {

    const novo = String(
      (doArquivo as unknown as Record<string, unknown>)[campo] ?? ""
    ).trim();

    if (novo === "" || MASCARA.test(novo)) continue;

    const velho = String(
      (atual as unknown as Record<string, unknown>)[campo] ?? ""
    ).trim();

    /* Valor real no banco fica, mesmo que a planilha diga outro. */
    if (velho !== "" && !MASCARA.test(velho)) continue;

    if (velho === novo) continue;

    dados[campo] = novo;

    diferencas.push(
      `${campo}: ${velho.slice(0, 30) || "(vazio)"} → ${novo.slice(0, 30)}`
    );
  }

  return { dados, diferencas };
}

/** Seleção do Prisma com exatamente os campos que a regra compara. */
export const SELECAO_DO_PORTAL = {
  id: true,
  protocol: true,
  externalId: true,
  status: true,
  publicResponse: true,
  publicResponseAt: true,
  evaluated: true,
  score: true,
  resolved: true,
  wouldDoBusiness: true,
  evaluatedAt: true,
  email: true,
  phone: true,
  city: true,
  state: true,
} as const;
