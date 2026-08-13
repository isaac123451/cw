/**
 * Tipo de impacto.
 *
 * Texto livre, e não união fechada: a operação cria e edita os tipos na
 * própria tela. Os cinco de partida ficam abaixo como semente.
 */
export type ImpactType = string;

/**
 * Como o valor do tipo entra na conta.
 *
 * "receita" soma ao que foi preservado ou gerado; "custo" é dinheiro que
 * a operação concedeu para resolver — desconto, cortesia, estorno. Sem a
 * distinção, uma oferta concedida inflaria o impacto positivo.
 */
export type ImpactDirection = "receita" | "custo";

export interface ImpactTypeOption {
  id: string;

  name: string;

  direction: ImpactDirection;

  description?: string;

  order: number;

  active: boolean;
}

export const IMPACT_DIRECTIONS: {
  value: ImpactDirection;
  label: string;
  hint: string;
}[] = [
  {
    value: "receita",
    label: "Receita",
    hint: "Soma ao impacto: valor preservado ou gerado.",
  },
  {
    value: "custo",
    label: "Custo",
    hint: "Subtrai: valor concedido para resolver o caso.",
  },
];

export interface ImpactRecord {
  id: string;

  type: ImpactType;

  /** Nome de quem gerou o impacto — cliente ou estabelecimento. */
  company: string;

  /** Estabelecimento vinculado, quando o impacto veio de uma conta. */
  establishmentId?: string;

  /** Slug do cliente vinculado — ver lib/services/client.service.ts. */
  clientSlug?: string;

  description: string;

  /** Valor em reais. Negativo representa custo concedido pela operação. */
  amount: number;

  owner: string;

  date: string;

  relatedCase?: string;
}
