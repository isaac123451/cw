/**
 * Constantes da integração com o Google Agenda que a **tela** precisa.
 *
 * Separado de `google.service.ts` porque o serviço é `server-only` — a
 * mesma armadilha que derrubou a tela de Integrações: client component
 * importando módulo de servidor quebra a rota em runtime, com `tsc` e
 * `lint` limpos.
 */

/**
 * Permissão pedida ao Google.
 *
 * `calendar.events` cobre ler e criar eventos — não dá acesso a apagar
 * agenda nem a ver contatos. `userinfo.email` existe só para mostrar na
 * tela qual conta foi conectada; sem isso a pessoa não tem como
 * conferir se ligou a conta certa.
 */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export interface GoogleEvent {
  id: string;
  title: string;
  /** ISO. Evento de dia inteiro vem só com a data. */
  start: string;
  end?: string;
  allDay: boolean;
  link?: string;
  description?: string;

  /** `AAAA-MM-DD` do início — o que o formulário edita. */
  date: string;
  /** `HH:MM`; ausente em evento de dia inteiro. */
  time?: string;
  /** Término `HH:MM`; ausente em evento de dia inteiro. */
  endTime?: string;

  /**
   * Evento criado por outra pessoa não pode ser editado aqui: o Google
   * recusaria a gravação, e mostrar o botão seria prometer o que não
   * funciona.
   */
  readOnly: boolean;

  /** Ocorrência de um evento que se repete. */
  recurring: boolean;
}

/**
 * Repetição oferecida na tela.
 *
 * Um conjunto fechado em vez de campo livre de RRULE: cobre o que a
 * operação pede ("toda semana", "a cada 15 dias") sem expor a sintaxe
 * do iCalendar a quem só quer marcar um check point.
 */
export type RepeatKind =
  | "nenhuma"
  | "diaria"
  | "semanal"
  | "quinzenal"
  | "mensal"
  | "personalizada";

export const REPEAT_LABELS: Record<RepeatKind, string> = {
  nenhuma: "Não repete",
  diaria: "Todo dia",
  semanal: "A cada 7 dias",
  quinzenal: "A cada 15 dias",
  mensal: "Todo mês",
  personalizada: "A cada N dias...",
};

export interface RepeatRule {
  kind: RepeatKind;
  /** Só em `personalizada`: intervalo em dias. */
  everyDays?: number;
  /** `AAAA-MM-DD` — em branco repete sem fim. */
  until?: string;
}

/** Campos que a tela envia ao criar ou editar. */
export interface GoogleEventDraft {
  title: string;
  date: string;
  /** Início `HH:MM`; ausente = dia inteiro. */
  time?: string;
  /** Término `HH:MM`. Sem isso, uma hora depois do início. */
  endTime?: string;
  description?: string;
  repeat?: RepeatRule;
}

/** Janela de exibição dos eventos. */
export type RangeKind =
  | "hoje"
  | "7d"
  | "14d"
  | "30d"
  | "custom";

export const RANGE_LABELS: Record<RangeKind, string> = {
  hoje: "Hoje",
  "7d": "7 dias",
  "14d": "14 dias",
  "30d": "30 dias",
  custom: "Escolher",
};

export interface EventRange {
  kind: RangeKind;
  /** Só em `custom`. */
  start?: string;
  end?: string;
}

export interface GoogleConnection {
  email: string;
  conectadoEm: string;
}
