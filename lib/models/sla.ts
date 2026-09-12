import { prioridadeNormalizada, type Prioridade } from "@/lib/models/case";

/**
 * Regra de SLA por tipo de caso.
 *
 * Antes o prazo era a string fixa "48h" gravada em cada reclamação, igual
 * para cobrança indevida e para dúvida de cardápio. Aqui o prazo passa a
 * depender da frente, da prioridade e, se for o caso, da categoria — e a
 * tela de Processos administra essas regras.
 *
 * Desde 12/09/2026 os dois prazos são os da documentação: o do **1º
 * contato** com o cliente e o da **solução**, ambos em tempo útil (ver
 * `lib/services/horasUteis.ts`).
 */
export interface SlaRule {
  id: string;

  /** Categoria do caso. `*` vale como regra padrão. */
  category: string;

  /** Refina a regra para uma prioridade específica. */
  priority?: Prioridade;

  /** A frente; vazia vale para todas. */
  canal?: CanalDoPrazo;

  /**
   * Só vale a partir deste alcance — "mais de 10 mil seguidores: 1h".
   * Vazio vale para qualquer perfil.
   */
  seguidoresMin?: number;

  /** Prazo do 1º contato com o cliente, em horas úteis. */
  responseHours: number;

  /**
   * Prazo da solução, em horas úteis. Zero é "a documentação não fixa
   * prazo de solução" — o relógio para no 1º contato.
   */
  solutionHours: number;

  /** Time que responde por este tipo de caso. */
  team?: string;

  note?: string;

  active: boolean;
}

export const ANY_CATEGORY = "*";

export type CanalDoPrazo = "Reclame Aqui" | "Redes Sociais";

export const CANAIS_DO_PRAZO: CanalDoPrazo[] = [
  "Reclame Aqui",
  "Redes Sociais",
];

/** A frente de um caso pela origem dele. */
export function canalDoCaso(origem: string): CanalDoPrazo {
  return origem === "Reclame Aqui" ? "Reclame Aqui" : "Redes Sociais";
}

/** Formata horas como o painel mostra: 48h, 3 dias, 1h. */
export function formatHours(hours: number) {

  if (hours < 1) return "menos de 1h";

  if (hours < 24) return `${hours}h`;

  const dias = Math.round((hours / 24) * 10) / 10;

  return `${dias
    .toString()
    .replace(".", ",")} ${dias === 1 ? "dia" : "dias"}`;
}

/* ============================================================
   OS PRAZOS DA DOCUMENTAÇÃO (agosto/2026)
============================================================ */

export type PrazoDaDocumentacao = Omit<SlaRule, "id" | "active"> & {
  /** De onde saiu, para a tela mostrar e quem revisa conferir. */
  fonte: string;
};

/**
 * A tabela de criticidade do Reclame Aqui e o SLA das Redes Sociais.
 *
 * Leitura adotada da tabela do Reclame Aqui, que no PDF sai com as
 * colunas desalinhadas: Urgente — 1º contato em até 4h úteis, solução em
 * 24h a 48h (usamos o teto, 48h); Alta — até 24h úteis e 3 a 5 dias úteis
 * (teto, 5); Normal — até 48h úteis e até 7 dias úteis.
 *
 * Nas Redes Sociais o documento só fixa o 1º contato: 4h úteis, e 1 hora
 * quando o perfil tem mais de 10 mil seguidores. A solução fica sem prazo
 * (zero) — inventar um aqui seria cobrar o que ninguém combinou.
 */
export const PRAZOS_DA_DOCUMENTACAO: PrazoDaDocumentacao[] = [
  {
    category: ANY_CATEGORY,
    canal: "Reclame Aqui",
    priority: "Urgente",
    responseHours: 4,
    solutionHours: 48,
    note: "Risco jurídico, viralização, operação parada, alto ticket, reincidência ou risco de cancelamento.",
    fonte: "Reclame Aqui · Prazos e Classificação de Criticidade",
  },
  {
    category: ANY_CATEGORY,
    canal: "Reclame Aqui",
    priority: "Alta",
    responseHours: 24,
    solutionHours: 5 * 24,
    note: "Impacto financeiro direto, funcionalidade crítica indisponível ou prazo combinado não cumprido.",
    fonte: "Reclame Aqui · Prazos e Classificação de Criticidade",
  },
  {
    category: ANY_CATEGORY,
    canal: "Reclame Aqui",
    priority: "Normal",
    responseHours: 48,
    solutionHours: 7 * 24,
    note: "Dúvidas operacionais, pedidos de informação, reclamação sem impacto operacional imediato.",
    fonte: "Reclame Aqui · Prazos e Classificação de Criticidade",
  },
  {
    category: ANY_CATEGORY,
    canal: "Redes Sociais",
    responseHours: 4,
    solutionHours: 0,
    note: "Primeiro contato já com o histórico do cliente verificado.",
    fonte: "Redes Sociais · Passo 3",
  },
  {
    category: ANY_CATEGORY,
    canal: "Redes Sociais",
    seguidoresMin: 10_000,
    responseHours: 1,
    solutionHours: 0,
    note: "Perfil com mais de 10 mil seguidores: contato do agente de reputação em no máximo 1 hora.",
    fonte: "Redes Sociais · Passo 3",
  },
];

/** A mesma regra? Frente, categoria, prioridade e alcance iguais. */
export function mesmaRegra(
  a: Pick<SlaRule, "category" | "priority" | "canal" | "seguidoresMin">,
  b: Pick<SlaRule, "category" | "priority" | "canal" | "seguidoresMin">
) {
  return (
    a.category === b.category &&
    (a.priority ?? null) === (b.priority ?? null) &&
    (a.canal ?? null) === (b.canal ?? null) &&
    (a.seguidoresMin ?? null) === (b.seguidoresMin ?? null)
  );
}

/**
 * A linha do banco como a tela usa.
 *
 * Uma função só, para o workspace e para a ação que grava os prazos da
 * documentação devolverem a mesma coisa — inclusive a tradução de
 * "Crítica" e "Média", que regras gravadas antes de 12/09/2026 ainda
 * carregam.
 */
export function slaRuleDoBanco(r: {
  id: string;
  category: string;
  priority: string | null;
  canal: string | null;
  seguidoresMin: number | null;
  responseHours: number;
  solutionHours: number;
  team: string | null;
  note: string | null;
  active: boolean;
}): SlaRule {
  return {
    id: r.id,
    category: r.category,
    priority: r.priority ? prioridadeNormalizada(r.priority) : undefined,
    canal: CANAIS_DO_PRAZO.includes(r.canal as CanalDoPrazo)
      ? (r.canal as CanalDoPrazo)
      : undefined,
    seguidoresMin: r.seguidoresMin ?? undefined,
    responseHours: r.responseHours,
    solutionHours: r.solutionHours,
    team: r.team ?? undefined,
    note: r.note ?? undefined,
    active: r.active,
  };
}
