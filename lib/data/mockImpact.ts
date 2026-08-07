import { ImpactRecord } from "@/lib/models/impact";

export const mockImpact: ImpactRecord[] = [
  {
    id: "im-1",
    type: "Cancelamento evitado",
    company: "Grill & Cia",
    description:
      "Cliente desistiu do cancelamento após negociação de plano.",
    amount: 14400,
    owner: "Juliana",
    date: "2026-08-04",
    relatedCase: "RA-20260009",
  },
  {
    id: "im-2",
    type: "Cancelamento evitado",
    company: "Doce Encanto",
    description:
      "Renovação revertida com ajuste de contrato.",
    amount: 9600,
    owner: "Juliana",
    date: "2026-08-04",
    relatedCase: "RA-20260025",
  },
  {
    id: "im-3",
    type: "Cliente recuperado",
    company: "Cantina do Chef",
    description:
      "Cliente retomou uso após correção da indisponibilidade.",
    amount: 12000,
    owner: "Juliana",
    date: "2026-08-03",
    relatedCase: "RA-20260004",
  },
  {
    id: "im-4",
    type: "Módulo contratado",
    company: "Sushi House",
    description:
      "Contratação do módulo fiscal após tratativa de SPED.",
    amount: 3600,
    owner: "Marcos",
    date: "2026-08-02",
    relatedCase: "RA-20260019",
  },
  {
    id: "im-5",
    type: "Módulo contratado",
    company: "Padaria Aurora",
    description:
      "Upgrade para plano com relatórios avançados.",
    amount: 2400,
    owner: "Carlos",
    date: "2026-07-29",
  },
  {
    id: "im-6",
    type: "Valor recuperado",
    company: "Burger Prime",
    description:
      "Cobrança duplicada identificada e reconciliada.",
    amount: 1180,
    owner: "Carlos",
    date: "2026-08-03",
    relatedCase: "RA-20260002",
  },
  {
    id: "im-7",
    type: "Valor recuperado",
    company: "Café Central",
    description:
      "Boleto indevido cancelado antes do vencimento.",
    amount: 890,
    owner: "Marcos",
    date: "2026-07-24",
    relatedCase: "RA-20260022",
  },
  {
    id: "im-8",
    type: "Oferta concedida",
    company: "Mar & Terra",
    description:
      "Desconto de 3 meses para reverter insatisfação com reajuste.",
    amount: -1350,
    owner: "Marcos",
    date: "2026-08-01",
    relatedCase: "RA-20260015",
  },
  {
    id: "im-9",
    type: "Oferta concedida",
    company: "Grill & Cia",
    description:
      "Isenção de mensalidade durante correção da migração.",
    amount: -980,
    owner: "Carlos",
    date: "2026-07-31",
    relatedCase: "RA-20260021",
  },
  {
    id: "im-10",
    type: "Cliente recuperado",
    company: "Empório Verde",
    description:
      "Cliente reengajado após regularização fiscal.",
    amount: 7200,
    owner: "Marcos",
    date: "2026-07-30",
    relatedCase: "RA-20260006",
  },
  {
    id: "im-11",
    type: "Cancelamento evitado",
    company: "Pizzaria Itália",
    description:
      "Downgrade aplicado no lugar do cancelamento total.",
    amount: 6000,
    owner: "Carlos",
    date: "2026-07-13",
    relatedCase: "RA-20260027",
  },
  {
    id: "im-12",
    type: "Oferta concedida",
    company: "Taco Loco",
    description:
      "Crédito por indisponibilidade de repasse via Pix.",
    amount: -640,
    owner: "Carlos",
    date: "2026-08-03",
    relatedCase: "RA-20260007",
  },
];
