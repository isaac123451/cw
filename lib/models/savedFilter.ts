import type { CaseFilters } from "@/lib/context/CaseContext";

/**
 * Recorte de casos guardado com um nome.
 *
 * A Toolbar já sabia filtrar, mas o time refazia a mesma combinação todo
 * dia ("não resolvidos", "os meus aguardando réplica"). Guardar o critério
 * evita esse retrabalho e padroniza o que cada pessoa olha.
 */
export interface SavedFilter {
  id: string;

  name: string;

  criteria: CaseFilters;

  /** Pré-definido pela operação: vale para todos e não pode ser apagado. */
  builtIn: boolean;

  order: number;
}

/**
 * Rótulo de cada campo, na ordem em que aparece na Toolbar.
 *
 * É um Record da própria CaseFilters de propósito: se alguém acrescentar
 * um filtro novo, o build quebra aqui em vez de o campo sumir do resumo.
 */
const LABELS: Record<keyof CaseFilters, string> = {
  search: "Busca",
  company: "Cliente",
  status: "Status",
  category: "Categoria",
  tag: "Etiqueta",
  owner: "Responsável",
  establishment: "Estabelecimento",
};

const FIELDS = Object.keys(
  LABELS
) as (keyof CaseFilters)[];

/** Critério vazio — base para montar recortes sem herdar o estado atual. */
export const emptyCriteria: CaseFilters = {
  search: "",
  company: "",
  status: "",
  category: "",
  tag: "",
  owner: "",
  establishment: "",
};

/** Quantos campos estão preenchidos — zero significa "sem filtro". */
export function countCriteria(criteria: CaseFilters) {
  return FIELDS.filter(
    (field) => (criteria[field] ?? "") !== ""
  ).length;
}

/**
 * Resumo legível do critério, para a pessoa saber o que vai aplicar
 * antes de clicar.
 *
 * O estabelecimento é guardado por id; mostrar o id não diria nada a
 * ninguém, então aparece só o nome do campo.
 */
export function describeCriteria(
  criteria: CaseFilters
) {
  return FIELDS.filter(
    (field) => (criteria[field] ?? "") !== ""
  ).map((field) =>
    field === "establishment"
      ? "Estabelecimento vinculado"
      : `${LABELS[field]}: ${criteria[field]}`
  );
}

/** Compara dois critérios campo a campo, para destacar o filtro em uso. */
export function sameCriteria(
  a: CaseFilters,
  b: CaseFilters
) {
  return FIELDS.every(
    (field) => (a[field] ?? "") === (b[field] ?? "")
  );
}

/**
 * Recortes que a operação usa todo dia.
 *
 * Ficam no código (e não no localStorage) para chegarem prontos em
 * qualquer máquina e para acompanharem mudanças no fluxo — os nomes
 * batem com os status de lib/services/status.service.ts.
 */
export const BUILT_IN_FILTERS: SavedFilter[] = [
  {
    id: "builtin-replica",
    name: "Aguardando nossa réplica",
    criteria: {
      ...emptyCriteria,
      status: "Aguardando nossa réplica",
    },
    builtIn: true,
    order: 0,
  },
  {
    id: "builtin-avaliacao",
    name: "Aguardando avaliação",
    criteria: {
      ...emptyCriteria,
      status: "Aguardando avaliação",
    },
    builtIn: true,
    order: 1,
  },
  {
    id: "builtin-nao-resolvidos",
    name: "Não resolvidos",
    criteria: {
      ...emptyCriteria,
      status: "Não resolvido",
    },
    builtIn: true,
    order: 2,
  },
];
