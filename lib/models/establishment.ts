/**
 * Estabelecimento — o restaurante que contrata a Cardápio Web.
 *
 * Não confundir com Cliente (lib/models/client.ts), que é a pessoa.
 * Um estabelecimento tem vários clientes: o proprietário, quem opera
 * o caixa, e os consumidores que reclamam dele.
 *
 * O export do Reclame Aqui não traz o estabelecimento, então este
 * cadastro é manual e o vínculo com o caso é feito na tela.
 */

export type EstablishmentStatus =
  | "Ativo"
  | "Em risco"
  | "Trial"
  | "Cancelado";

export type EstablishmentPlan =
  | "Essencial"
  | "Premium"
  | "Enterprise";

export interface Establishment {
  id: string;

  /** Slug estável usado na rota — o nome pode mudar, o vínculo não. */
  slug: string;

  name: string;

  cnpj?: string;

  segment?: string;

  city?: string;

  state?: string;

  plan: EstablishmentPlan;

  status: EstablishmentStatus;

  /** Receita mensal recorrente em reais. */
  mrr?: number;

  /** Pessoa da Cardápio Web que responde por esta conta. */
  owner?: string;

  /** Início do contrato, em ISO (YYYY-MM-DD). */
  startedAt?: string;

  phone?: string;

  email?: string;

  notes?: string;
}

export const ESTABLISHMENT_PLANS: EstablishmentPlan[] = [
  "Essencial",
  "Premium",
  "Enterprise",
];

export const ESTABLISHMENT_STATUSES: EstablishmentStatus[] =
  ["Ativo", "Em risco", "Trial", "Cancelado"];

/** Segmentos usados na base. O campo aceita texto livre também. */
export const ESTABLISHMENT_SEGMENTS = [
  "Pizzaria",
  "Hamburgueria",
  "Japonês",
  "Açaí",
  "Cafeteria",
  "Padaria",
  "Restaurante",
  "Marmitaria",
  "Doceria",
  "Bar",
  "Food truck",
  "Rede / franquia",
];

export const statusTone: Record<
  EstablishmentStatus,
  string
> = {
  Ativo: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  "Em risco": "bg-rose-50 text-rose-700 ring-rose-100",
  Trial: "bg-sky-50 text-sky-700 ring-sky-100",
  Cancelado: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

export const planTone: Record<EstablishmentPlan, string> = {
  Essencial: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  Premium: "bg-violet-50 text-violet-700 ring-violet-100",
  Enterprise: "bg-amber-50 text-amber-700 ring-amber-100",
};
