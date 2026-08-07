export interface CaseTag {
  id: string;
  name: string;
  color: string;
  description: string;
  order: number;
  active: boolean;
}

/**
 * Etiquetas operacionais aplicadas aos casos. Aparecem no Kanban e na
 * lista e servem de base para os filtros salvos.
 */
export const mockTags: CaseTag[] = [
  {
    id: "tag-1",
    name: "Favorável a avaliação",
    color: "#22C55E",
    description:
      "Cliente satisfeito com a tratativa — bom momento para pedir a nota.",
    order: 1,
    active: true,
  },
  {
    id: "tag-2",
    name: "Possível avaliação positiva",
    color: "#0EA5E9",
    description:
      "Sinais de que o consumidor avaliaria bem se for abordado.",
    order: 2,
    active: true,
  },
  {
    id: "tag-3",
    name: "Risco de nota baixa",
    color: "#EF4444",
    description:
      "Consumidor irritado ou com reincidência — avaliar antes de solicitar nota.",
    order: 3,
    active: true,
  },
  {
    id: "tag-4",
    name: "Aguardando área interna",
    color: "#F59E0B",
    description:
      "Tratativa parada dependendo de outro time.",
    order: 4,
    active: true,
  },
  {
    id: "tag-5",
    name: "Reincidente",
    color: "#7C3AED",
    description:
      "Cliente já abriu outras reclamações sobre o mesmo assunto.",
    order: 5,
    active: true,
  },
  {
    id: "tag-6",
    name: "Escalado para jurídico",
    color: "#71717A",
    description:
      "Caso com risco jurídico, resposta precisa de validação.",
    order: 6,
    active: true,
  },
];
