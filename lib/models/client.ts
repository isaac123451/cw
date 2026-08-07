/**
 * Cliente — a pessoa.
 *
 * Diferente de Estabelecimento (lib/models/establishment.ts), que é o
 * restaurante. A base real vem das reclamações do Reclame Aqui: cada
 * reclamante vira um cliente, com histórico próprio.
 *
 * O que o export não traz (vínculo com estabelecimento, tipo de relação,
 * notas) é preenchido na tela e guardado como enriquecimento por cima
 * do dado real — ver lib/context/ClientsContext.tsx.
 */

export type ClientKind =
  | "Consumidor"
  | "Proprietário"
  | "Operador"
  | "Parceiro";

/** Campos que a operação preenche à mão sobre um cliente. */
export interface ClientEnrichment {
  kind?: ClientKind;

  /** Estabelecimento ao qual esta pessoa está ligada. */
  establishmentId?: string;

  document?: string;

  notes?: string;

  tags?: string[];
}

/** Cliente cadastrado manualmente, sem reclamação de origem. */
export interface ManualClient extends ClientEnrichment {
  id: string;
  slug: string;
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  createdAt: string;
}

export const CLIENT_KINDS: ClientKind[] = [
  "Consumidor",
  "Proprietário",
  "Operador",
  "Parceiro",
];

export const kindTone: Record<ClientKind, string> = {
  Consumidor: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  Proprietário:
    "bg-violet-50 text-violet-700 ring-violet-100",
  Operador: "bg-sky-50 text-sky-700 ring-sky-100",
  Parceiro: "bg-amber-50 text-amber-700 ring-amber-100",
};
