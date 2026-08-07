export type ImpactType =
  | "Cancelamento evitado"
  | "Módulo contratado"
  | "Cliente recuperado"
  | "Oferta concedida"
  | "Valor recuperado";

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
