export interface CategoryOption {
  id: string;

  name: string;

  description: string;

  order: number;

  active: boolean;
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
