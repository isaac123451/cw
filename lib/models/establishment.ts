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

  /** CPF ou CNPJ — a Cardápio Web cadastra restaurante das duas formas. */
  document?: string;

  /** Id da conta no CW Engine. */
  externalId?: string;

  /** Endereço da conta no portal, como o CW Engine entrega. */
  portalUrl?: string;

  /** Conversa do restaurante no Crisp — o canal por trás do ManyChat. */
  crispUrl?: string;

  /** WhatsApp de quem responde o NPS. Não é o telefone da loja. */
  npsWhatsapp?: string;

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

/**
 * Só os dígitos do documento, ou `undefined`.
 *
 * O vínculo entre reclamação e estabelecimento é por **CPF ou CNPJ**, e
 * é por isso que esta função existe em vez de uma comparação direta: o
 * RA Forms entrega `12.345.678/0001-90`, o cadastro daqui costuma ter
 * `12345678000190`, e as duas grafias do mesmo número nunca casariam.
 *
 * **Aceita os dois tamanhos**, e isso não é frouxidão. A pergunta do
 * portal é literalmente "CPF ou CNPJ", e a Cardápio Web cadastra
 * restaurante das duas formas — na base real, 122 das 127 reclamações
 * respondem com CPF. Recusar onze dígitos jogaria fora quase todo o
 * vínculo que existe.
 *
 * Recusa qualquer outro tamanho: campo pela metade, "não informado",
 * telefone digitado no lugar errado. Guardar isso criaria vínculo falso
 * entre duas reclamações que só têm em comum o mesmo lixo no campo.
 */
export function digitosDoDocumento(
  valor?: string | null
): string | undefined {

  const digitos = (valor ?? "").replace(/\D/g, "");

  return digitos.length === 11 || digitos.length === 14
    ? digitos
    : undefined;
}

/** Formata CPF ou CNPJ. Para exibir, nunca para comparar. */
export function documentoFormatado(
  valor?: string | null
) {

  const d = digitosDoDocumento(valor);

  if (!d) return valor ?? "";

  return d.length === 11
    ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
    : `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** "CPF" ou "CNPJ", pelo tamanho. Para rotular na tela. */
export function tipoDeDocumento(valor?: string | null) {

  const d = digitosDoDocumento(valor);

  return d ? (d.length === 11 ? "CPF" : "CNPJ") : "";
}
