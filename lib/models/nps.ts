/**
 * NPS — encerramento do ciclo de feedback.
 *
 * O processo inteiro vive aqui, em dados: segmentos, SLA, os sete tipos
 * de tratativa e os status finais de cada um. Espalhar isso pelas telas
 * faria a regra divergir da documentação na primeira mudança.
 *
 * **Não é Reclame Aqui.** A pesquisa é nossa, dentro do portal, e traz o
 * contato do cliente — é o que permite agir antes de virar cancelamento
 * ou reclamação pública.
 */

export type NpsSegment =
  | "Detrator"
  | "Neutro"
  | "Promotor";

export interface SegmentRule {
  label: NpsSegment;
  min: number;
  max: number;
  /** Prazo do primeiro contato, em **horas úteis**. */
  slaHoursUteis: number;
  color: string;
  hint: string;
}

/**
 * Faixas e SLA de primeiro contato, como no guia.
 *
 * O prazo do Promotor é longo de propósito: ali o objetivo é aproveitar
 * o sentimento positivo, não socorrer ninguém.
 */
export const SEGMENTS: SegmentRule[] = [
  {
    label: "Detrator",
    min: 0,
    max: 6,
    slaHoursUteis: 24,
    color: "#EF4444",
    hint: "Risco de cancelamento e de falar mal no mercado. Socorrer primeiro.",
  },
  {
    label: "Neutro",
    min: 7,
    max: 8,
    slaHoursUteis: 48,
    color: "#F59E0B",
    hint: "Satisfeito sem entusiasmo — costuma ser onde mora a sugestão útil.",
  },
  {
    label: "Promotor",
    min: 9,
    max: 10,
    slaHoursUteis: 7 * 24,
    color: "#22C55E",
    hint: "Base para review pública, depoimento e indicação.",
  },
];

export function segmentOf(score: number): SegmentRule {
  return (
    SEGMENTS.find(
      (s) => score >= s.min && score <= s.max
    ) ?? SEGMENTS[0]
  );
}

/* ============================================================
   OS SETE TIPOS DE TRATATIVA
============================================================ */

export type NpsKind =
  | "Reclamação"
  | "Sugestão"
  | "Elogio"
  | "Engano"
  | "Erro no Sistema"
  | "Erro Processual"
  | "Falta de Retorno";

export const STATUS_NOVO = "Novo";
export const STATUS_EM_TRATATIVA = "Em tratativa";
export const STATUS_AGUARDANDO =
  "[Aguardando Resposta]";

/**
 * Promotor calado — nota 9 ou 10, sem uma palavra escrita.
 *
 * Entra na base (o NPS precisa dele para estar certo) mas não abre
 * ciclo: são ~790 respostas por mês vindas do Wootric, e abrir tratativa
 * individual para cada nota 10 muda enterraria os detratores no meio da
 * fila. O rótulo diz exatamente isso, em vez de fingir um encerramento
 * que ninguém trabalhou.
 */
export const STATUS_SEM_TRATATIVA =
  "[Encerrado] Sem tratativa";

export interface KindRule {
  label: NpsKind;
  emoji: string;
  color: string;
  /** O que fazer, resumido do guia. */
  acao: string;
  /** Status finais aceitos para este tipo. */
  finais: string[];
  /**
   * Exige o cliente confirmar que resolveu antes de encerrar como
   * resolvido. Sem isso o loop fica em `[Aguardando Resposta]`.
   */
  exigeConfirmacao: boolean;
  /** Prazo próprio, quando o guia define um diferente do segmento. */
  prazoProprioHoras?: number;
}

export const KINDS: KindRule[] = [
  {
    label: "Reclamação",
    emoji: "🔴",
    color: "#EF4444",
    acao: "Contatar dentro do SLA do segmento, registrar a causa raiz e confirmar com o cliente antes de encerrar.",
    finais: [
      "[Encerrado] Resolvido",
      "[Aguardando Resposta]",
      "[Encerrado] Sem Retorno",
    ],
    exigeConfirmacao: true,
  },
  {
    label: "Sugestão",
    emoji: "🟡",
    color: "#F59E0B",
    acao: "Contatar em até 48 h úteis, registrar, classificar e enviar link de acompanhamento.",
    finais: ["[Encerrado] Sugestão Registrada"],
    exigeConfirmacao: false,
    prazoProprioHoras: 48,
  },
  {
    label: "Elogio",
    emoji: "🟢",
    color: "#22C55E",
    acao: "Agradecer em até 72 h. Sendo Promotor, direcionar para review pública, depoimento e indicação.",
    finais: ["[Encerrado] Elogio"],
    exigeConfirmacao: false,
    prazoProprioHoras: 72,
  },
  {
    label: "Engano",
    emoji: "⚪",
    color: "#A1A1AA",
    acao: "Atualizar o registro para controle interno e agradecer, se couber.",
    finais: ["[Encerrado] Engano"],
    exigeConfirmacao: false,
  },
  {
    label: "Erro no Sistema",
    emoji: "🔵",
    color: "#3B82F6",
    acao: "Encaminhar ao time técnico com prioridade proporcional ao segmento, manter o cliente informado e reenviar a pergunta de satisfação após a correção.",
    finais: [
      "[Encerrado] Resolvido",
      "[Aguardando Resposta]",
      "[Encerrado] Sem Retorno",
    ],
    exigeConfirmacao: true,
  },
  {
    label: "Erro Processual",
    emoji: "⚪",
    color: "#8B5CF6",
    acao: "Identificar o processo que falhou, comunicar o time responsável e reverter com o cliente. Gera revisão de processo automaticamente.",
    finais: ["[Encerrado] Resolvido"],
    exigeConfirmacao: false,
  },
  {
    label: "Falta de Retorno",
    emoji: "⚪",
    color: "#71717A",
    acao: "Mínimo de 3 tentativas em até 7 dias, registrando cada uma.",
    finais: ["[Encerrado] Sem Retorno"],
    exigeConfirmacao: false,
  },
];

export function kindRule(kind?: string | null) {
  return KINDS.find((k) => k.label === kind);
}

/** Todo status que a tela pode exibir, na ordem do fluxo. */
export const ALL_STATUS = [
  STATUS_NOVO,
  STATUS_EM_TRATATIVA,
  STATUS_AGUARDANDO,
  "[Encerrado] Resolvido",
  "[Encerrado] Sugestão Registrada",
  "[Encerrado] Elogio",
  "[Encerrado] Engano",
  "[Encerrado] Sem Retorno",
  STATUS_SEM_TRATATIVA,
];

export function isEncerrado(status: string) {
  return status.startsWith("[Encerrado]");
}

/* ============================================================
   CAUSA RAIZ
============================================================ */

export interface RootCauseOption {
  id: string;
  name: string;
  description?: string;
  order: number;
  active: boolean;
}

/**
 * Os valores de partida.
 *
 * A lista virou cadastro (`NpsRootCause`) para a operação acrescentar
 * causa sem esperar deploy. Estes nomes continuam aqui como semente do
 * banco vazio e como resposta do modo demonstração — mas a tela lê do
 * cadastro, não daqui.
 *
 * Continua sendo **lista fechada**, e não texto livre: causa raiz existe
 * para ver tendência, e "cobrança"/"Cobrança"/"cobranca" viram três
 * problemas diferentes num campo aberto.
 */
export const ROOT_CAUSES = [
  "Bug",
  "Cobrança",
  "Atendimento",
  "Expectativa não atendida",
  "Logística",
  "Implantação",
  "Usabilidade",
  "Preço",
  "Outro",
];

/* ============================================================
   RÉGUA DE HUMOR — O DEPOIS
============================================================ */

/**
 * Como o cliente ficou **depois** do contato.
 *
 * A nota do NPS é de antes: mede o estado em que a pessoa respondeu a
 * pesquisa, e não pode ser reescrita — é ela que compõe o indicador.
 * Sobrescrevê-la depois de uma ligação bem-sucedida maquiaria o NPS.
 *
 * A régua mede outra coisa: se o atendimento moveu a agulha. Um
 * Detrator que continua nota 3 mas sai da conversa em 4 na régua é uma
 * recuperação; um que sai em 1 é um cancelamento a caminho. É a
 * diferença entre saber *que* o cliente estava insatisfeito e saber se
 * a operação conseguiu fazer alguma coisa a respeito.
 */
export interface MoodStep {
  value: number;
  emoji: string;
  label: string;
  color: string;
  hint: string;
}

export const MOODS: MoodStep[] = [
  {
    value: 1,
    emoji: "😡",
    label: "Irritado",
    color: "#DC2626",
    hint: "Saiu do contato pior do que entrou. Escalar.",
  },
  {
    value: 2,
    emoji: "🙁",
    label: "Insatisfeito",
    color: "#F97316",
    hint: "Ouviu, mas não comprou a solução.",
  },
  {
    value: 3,
    emoji: "😐",
    label: "Neutro",
    color: "#A1A1AA",
    hint: "Resolveu sem encantar. Não vira defensor.",
  },
  {
    value: 4,
    emoji: "🙂",
    label: "Satisfeito",
    color: "#22C55E",
    hint: "Recuperado. Vale pedir a reavaliação.",
  },
  {
    value: 5,
    emoji: "🤩",
    label: "Encantado",
    color: "#7B3FBF",
    hint: "Virou promotor no contato — pedir review e indicação.",
  },
];

export function moodOf(value?: number | null) {
  return MOODS.find((m) => m.value === value);
}

/* ============================================================
   REGRAS DE PRAZO E ABANDONO
============================================================ */

/** Tentativas mínimas antes de encerrar por falta de retorno. */
export const TENTATIVAS_MINIMAS = 3;

/** Janela para as três tentativas. */
export const JANELA_TENTATIVAS_DIAS = 7;

/** Sem qualquer resposta do cliente, encerra sozinho. */
export const ABANDONO_DIAS = 30;

export interface NpsResponseView {
  id: string;
  score: number;
  comment: string;
  respondedAt: string;

  customer: string;
  email?: string;
  phone?: string;
  company?: string;
  establishmentId?: string;

  kind?: string;
  rootCause?: string;
  status: string;
  owner?: string;

  firstContactDueAt: string;
  firstContactAt?: string;
  confirmedAt?: string;
  closedAt?: string;
  outcome?: string;

  reviewAsked: boolean;
  testimonialAsked: boolean;
  referralAsked: boolean;

  /** "Manual" ou "Wootric". */
  source: string;
  externalId?: string;

  /** Pós-contato: ver MOODS acima. */
  moodAfter?: number;
  resolvedAfter?: boolean;
  postContactNote?: string;
  postContactAt?: string;
  postContactBy?: string;

  attempts: NpsAttemptView[];
}

export interface NpsAttemptView {
  id: string;
  channel: string;
  note: string;
  actor: string;
  createdAt: string;
}

export const CHANNELS = [
  "E-mail",
  "Telefone",
  "WhatsApp",
];
