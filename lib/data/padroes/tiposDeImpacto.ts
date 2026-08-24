import { ImpactTypeOption } from "@/lib/models/impact";

/**
 * Tipos de partida, editáveis na tela de Impacto.
 *
 * "Oferta concedida" é custo: representa dinheiro que a operação abriu
 * mão para resolver o caso. Somá-la ao impacto positivo inflaria o
 * resultado — daí a direção fazer parte do cadastro.
 */
export const TIPOS_DE_IMPACTO: ImpactTypeOption[] = [
  {
    id: "it-1",
    name: "Cancelamento evitado",
    direction: "receita",
    description:
      "Cliente desistiu do cancelamento após a tratativa.",
    order: 1,
    active: true,
  },
  {
    id: "it-2",
    name: "Módulo contratado",
    direction: "receita",
    description:
      "Venda adicional originada do atendimento.",
    order: 2,
    active: true,
  },
  {
    id: "it-3",
    name: "Cliente recuperado",
    direction: "receita",
    description:
      "Conta cancelada que voltou a contratar.",
    order: 3,
    active: true,
  },
  {
    id: "it-4",
    name: "Valor recuperado",
    direction: "receita",
    description:
      "Cobrança em disputa mantida após esclarecimento.",
    order: 4,
    active: true,
  },
  {
    id: "it-5",
    name: "Oferta concedida",
    direction: "custo",
    description:
      "Desconto, cortesia ou estorno dado para resolver.",
    order: 5,
    active: true,
  },
];
