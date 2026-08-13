export interface CategoryOption {
  id: string;

  name: string;

  description: string;

  order: number;

  active: boolean;

  /**
   * Teto do tempo médio de resposta da categoria, em horas.
   *
   * Diferente do SLA, que cobra caso a caso: aqui o alvo é a média do
   * conjunto — o número que o Reclame Aqui publica. Sem teto declarado,
   * "19 dias e 17 horas" é só um dado; com teto, vira meta.
   *
   * Opcional de propósito: categoria sem teto simplesmente não é cobrada.
   */
  ceilingHours?: number;
}

export interface SubcategoryOption {
  id: string;

  /** Nome da categoria à qual a subcategoria pertence. */
  category: string;

  name: string;

  description: string;

  order: number;

  active: boolean;
}

export interface TeamOption {
  id: string;

  name: string;

  /** Nome antigo preservado das planilhas importadas. */
  legacyValue: string;

  order: number;

  active: boolean;
}

export interface ChecklistItem {
  id: string;

  label: string;

  /** Chave técnica usada para salvar o preenchimento por reclamação. */
  key: string;

  required: boolean;

  order: number;

  active: boolean;
}
