import type { Case, Prioridade } from "@/lib/models/case";
import { primeiroNome, saudacao } from "@/lib/models/mensagens";
import { paredeDe } from "@/lib/services/horasUteis";

/**
 * Ofertas, descontos e renegociações — o documento, em regra.
 *
 * **Oferta** é estratégia de reversão, com autonomia pela criticidade:
 * Urgente, 1 mês gratuito; Alta, 10% por 3 meses — "podendo ser
 * ajustado". Nunca como primeira abordagem, só depois da condução do
 * caso; fora do padrão, validada antes de ir ao cliente.
 *
 * **Renegociação** é "exceção máxima", com autorização da gestão e uma
 * fórmula exata: o proporcional dos dias não utilizados, menos 30% de
 * impostos e encargos. "Se precisou aplicar mais de uma vez no mês,
 * reveja o que está sendo feito."
 */

export type TipoDeNegociacao = "oferta" | "renegociacao";

export type ModeloDeNegociacao =
  | "mes-gratis"
  | "desconto-10-3m"
  | "personalizada"
  | "renegociacao";

export type StatusDaNegociacao = "proposta" | "aceita" | "recusada" | "concluida";

export const ROTULO_DO_STATUS: Record<StatusDaNegociacao, string> = {
  proposta: "Proposta",
  aceita: "Aceita",
  recusada: "Recusada",
  concluida: "Concluída",
};

/* ============================================================
   OFERTA
============================================================ */

/** "Situações comuns para considerar uma oferta." */
export const MOTIVOS_DE_OFERTA = [
  { id: "falha-operacional", texto: "Falha operacional" },
  { id: "ruido-comunicacao", texto: "Ruído de comunicação" },
  { id: "demora", texto: "Demora excessiva na resolução" },
  { id: "agravamento", texto: "Risco de agravamento do caso" },
] as const;

export interface ModeloDeOferta {
  id: Exclude<ModeloDeNegociacao, "renegociacao">;
  titulo: string;
  /** A criticidade para a qual o documento prevê este modelo. */
  prioridade?: Prioridade;
  /** Quanto da mensalidade a oferta custa: 1 mês = 1; 10% por 3 meses = 0,3. */
  fator?: number;
}

export const MODELOS_DE_OFERTA: ModeloDeOferta[] = [
  { id: "mes-gratis", titulo: "1 mês gratuito do sistema", prioridade: "Urgente", fator: 1 },
  { id: "desconto-10-3m", titulo: "10% de desconto por 3 meses", prioridade: "Alta", fator: 0.3 },
  { id: "personalizada", titulo: "Outra condição" },
];

export function modeloDeOferta(id?: string | null) {
  return MODELOS_DE_OFERTA.find((m) => m.id === id);
}

/** A oferta que o documento prevê para a criticidade — Normal não tem. */
export function ofertaSugerida(prioridade: Prioridade): ModeloDeOferta | null {
  return MODELOS_DE_OFERTA.find((m) => m.prioridade === prioridade) ?? null;
}

/** O custo do modelo a partir da mensalidade, em centavos. */
export function custoDoModelo(modelo: ModeloDeOferta | undefined, mensalidadeCents?: number | null) {
  if (!modelo?.fator || !mensalidadeCents || mensalidadeCents <= 0) return null;
  return Math.round(mensalidadeCents * modelo.fator);
}

/**
 * A oferta está fora do padrão e precisa de validação prévia?
 *
 * Dentro do padrão é o modelo que a criticidade prevê, com o custo do
 * modelo ou menor. Outro modelo, caso Normal, ou valor acima do custo do
 * modelo é "condição fora desse padrão" — o documento pede validação
 * interna antes de apresentar ao cliente.
 */
export function precisaDeValidacao(entrada: {
  prioridade: Prioridade;
  modelo: string;
  valorCents: number;
  mensalidadeCents?: number | null;
}): boolean {

  const sugerida = ofertaSugerida(entrada.prioridade);

  if (!sugerida || sugerida.id !== entrada.modelo) return true;

  const padrao = custoDoModelo(sugerida, entrada.mensalidadeCents);

  /* Sem mensalidade conhecida, o valor não tem com o que ser comparado. */
  return padrao !== null && entrada.valorCents > padrao;
}

/**
 * O caso já foi conduzido o bastante para uma oferta?
 *
 * "Nunca como primeira abordagem, mas sim após uma condução adequada do
 * caso." Condução, no documento, é a criticidade decidida e o cliente
 * ouvido: triagem e 1º contato registrados.
 */
export function prontoParaOferta(
  item: Pick<Case, "triadaEm" | "primeiroContatoEm">
): { pronto: boolean; falta: string[] } {

  const falta: string[] = [];

  if (!item.triadaEm) falta.push("a triagem da criticidade");
  if (!item.primeiroContatoEm) falta.push("o 1º contato com o cliente");

  return { pronto: falta.length === 0, falta };
}

/** A mensagem ao cliente, para o canal privado. */
export function mensagemDeOferta(d: { nome?: string; oferta: string; agente?: string; agora?: Date }) {
  const nome = primeiroNome(d.nome);
  return `${saudacao(d.agora)}${nome ? `, ${nome}` : ""}! ${d.agente ? `Aqui é ${primeiroNome(d.agente)}, da Cardápio Web. ` : ""}Sei que a sua experiência com a gente não foi como deveria, e quero reconhecer isso de forma concreta: vamos te conceder ${d.oferta.trim().replace(/\.$/, "")}. Sigo à disposição para o que precisar.`;
}

/* ============================================================
   RENEGOCIAÇÃO
============================================================ */

/** "Desconto referente a impostos e encargos já pagos pela empresa (30%)." */
export const DESCONTO_DE_ENCARGOS = 0.3;

export const RESPONSAVEL_DO_FINANCEIRO = "Gabriela Drebs";

export interface EntradaDaRenegociacao {
  /** Valor total pago na contratação, em centavos. */
  pagoCents: number;
  /** Início e fim da vigência, AAAA-MM-DD. */
  inicio: string;
  fim: string;
  /** Data da solicitação de cancelamento, AAAA-MM-DD. */
  solicitacao: string;
}

export interface CalculoDaRenegociacao extends EntradaDaRenegociacao {
  diasDoPlano: number;
  diasNaoUtilizados: number;
  /** O valor por dia, em centavos — é ele que multiplica os dias. */
  valorPorDiaCents: number;
  proporcionalCents: number;
  descontoCents: number;
  finalCents: number;
}

const DIA_MS = 86_400_000;

function dias(de: string, ate: string) {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / DIA_MS);
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A fórmula do documento, com os passos à vista.
 *
 * valor final = (pago ÷ dias do plano) × dias não utilizados × (1 − 0,30)
 *
 * **O valor por dia é arredondado ao centavo e é ele que multiplica os
 * dias**, como o documento escreve ("valor proporcional por dia × dias
 * não utilizados"). A razão exata daria alguns centavos de diferença num
 * plano anual — e a proposta mostraria "R$ 3,29 × 184 dias = R$ 604,93",
 * uma conta que o cliente refaz na calculadora e não fecha. Cada linha
 * da proposta tem de sair da linha de cima.
 */
export function calcularRenegociacao(
  e: EntradaDaRenegociacao
): CalculoDaRenegociacao | { erro: string } {

  if (![e.inicio, e.fim, e.solicitacao].every((d) => DATA.test(d ?? ""))) {
    return { erro: "Preencha o início e o fim da vigência e a data da solicitação." };
  }

  if (!Number.isInteger(e.pagoCents) || e.pagoCents <= 0) {
    return { erro: "Informe o valor total pago na contratação." };
  }

  const diasDoPlano = dias(e.inicio, e.fim);

  if (diasDoPlano <= 0) return { erro: "O fim da vigência tem de ser depois do início." };

  if (e.solicitacao < e.inicio) {
    return { erro: "A solicitação de cancelamento é anterior ao início do plano — confira as datas." };
  }

  if (e.solicitacao > e.fim) {
    return { erro: "A solicitação é depois do fim da vigência: não há dias a restituir." };
  }

  const diasNaoUtilizados = dias(e.solicitacao, e.fim);

  const valorPorDiaCents = Math.round(e.pagoCents / diasDoPlano);
  const proporcionalCents = valorPorDiaCents * diasNaoUtilizados;
  const descontoCents = Math.round(proporcionalCents * DESCONTO_DE_ENCARGOS);

  return {
    ...e,
    diasDoPlano,
    diasNaoUtilizados,
    valorPorDiaCents,
    proporcionalCents,
    descontoCents,
    finalCents: proporcionalCents - descontoCents,
  };
}

/** "R$ 1.234,56". */
export function reais(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "1.234,56" digitado → centavos; `null` quando não é número. */
export function centavosDoTexto(texto: string): number | null {
  const limpo = String(texto ?? "")
    .replace(/[R$\s]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return null;
  return Math.round(Number(limpo) * 100);
}

function br(dia: string) {
  return dia.split("-").reverse().join("/");
}

/** A proposta do documento, preenchida. */
export function textoDaProposta(d: {
  nome?: string;
  plano: string;
  calculo: CalculoDaRenegociacao;
  /** "30/09/2026 às 18:00". */
  validaAte: string;
}) {

  const c = d.calculo;
  const nome = primeiroNome(d.nome);

  return [
    `Olá${nome ? `, ${nome}` : ""}! Segue a proposta, feita em caráter exclusivo e excepcional:`,
    "",
    `Período contratado do plano: ${d.plano.trim() || "[plano]"}, de ${br(c.inicio)} a ${br(c.fim)}.`,
    `Data da solicitação de cancelamento: ${br(c.solicitacao)}.`,
    "",
    "Cálculos:",
    `• Valor total pago na contratação: ${reais(c.pagoCents)}`,
    `• Total de dias do plano contratado: ${c.diasDoPlano}`,
    `• Valor proporcional por dia: ${reais(c.valorPorDiaCents)}`,
    `• Dias não utilizados: ${c.diasNaoUtilizados}`,
    `• Valor proporcional dos dias não utilizados: ${reais(c.proporcionalCents)}`,
    `• Desconto referente a impostos e encargos já pagos pela empresa (30%): ${reais(c.descontoCents)}`,
    "",
    `Valor final a ser restituído: ${reais(c.finalCents)}.`,
    "",
    "Condições da proposta:",
    "• Forma de restituição: o valor será restituído via Pix, mediante o envio dos dados bancários completos.",
    "• Cobranças no cartão de crédito: não é possível estorno parcial ou proporcional no cartão; parcelas já lançadas continuam na fatura, conforme a compra original.",
    "• Excepcionalidade: proposta exclusiva, considerando as circunstâncias deste atendimento. Não gera precedente nem se aplica a futuras solicitações.",
    `• Validade: até ${d.validaAte}. Depois disso, a condição é cancelada sem aviso adicional.`,
    "• Aplicação: a restituição depende da sua confirmação expressa dentro do prazo.",
  ].join("\n");
}

/**
 * O pedido ao financeiro, depois do aceite.
 *
 * O documento pede portal, chave Pix e valor final. A chave Pix fica
 * como lacuna de propósito: dado bancário do cliente não passa pela
 * plataforma — vai do cliente para o Slack.
 */
export function mensagemAoFinanceiro(d: {
  cliente: string;
  portal?: string;
  valorFinalCents: number;
  protocolo?: string;
  agora?: Date;
}) {
  return [
    `${saudacao(d.agora)}, ${primeiroNome(RESPONSAVEL_DO_FINANCEIRO)}! Renegociação aprovada pela gestão e aceita pelo cliente ${d.cliente}${d.protocolo ? ` (${d.protocolo})` : ""}. Pode seguir com o reembolso?`,
    "",
    `Portal: ${d.portal || "[link da conta no Portal]"}`,
    "Chave Pix (com dados bancários): [cole os dados que o cliente enviou]",
    `Valor final da proposta: ${reais(d.valorFinalCents)}`,
  ].join("\n");
}

export const CHECKLIST_DA_RENEGOCIACAO = [
  { id: "autorizacao", texto: "Obteve autorização formal do gestor" },
  { id: "calculo", texto: "Revisou o cálculo proporcional" },
  { id: "exclusividade", texto: "Informou que a proposta é exclusiva e excepcional" },
  { id: "financeiro", texto: `Após o aceite, pediu o reembolso ao financeiro (${RESPONSAVEL_DO_FINANCEIRO}, pelo Slack)` },
  { id: "recebimento", texto: "Confirmou com o cliente o recebimento do valor" },
] as const;

export type ItemDoChecklist = (typeof CHECKLIST_DA_RENEGOCIACAO)[number]["id"];

/** O mês da operação (Brasília) de um instante — "2026-09". */
export function mesDaOperacao(instante: Date) {
  return paredeDe(instante).dia.slice(0, 7);
}

/* ============================================================
   A VISÃO QUE AS TELAS RECEBEM
============================================================ */

export interface NegociacaoView {
  id: string;
  tipo: TipoDeNegociacao;
  modelo: ModeloDeNegociacao;
  cliente: string;
  descricao: string;
  valorCents: number;
  motivos: string[];
  calculo?: CalculoDaRenegociacao & { plano?: string };
  validadoPor?: string;
  validaAte?: string;
  status: StatusDaNegociacao;
  respondidaEm?: string;
  checklist: string[];
  impactoId?: string;
  autorNome: string;
  criadoEm: string;
  caso?: { protocolo: string; titulo: string; id: string };
}

export interface ResumoDoMes {
  mes: string;
  ofertas: number;
  renegociacoes: number;
  /** Renegociações aceitas ou concluídas — as "aplicadas" do documento. */
  aplicadas: number;
  /** O que foi concedido no mês (ofertas e renegociações aceitas), em centavos. */
  concedidoCents: number;
  /** Aceitas em que o cliente teria cancelado sem a condição — os "casos retidos". */
  retidos: number;
}
