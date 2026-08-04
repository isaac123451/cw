export interface Company {
  id: string;
  name: string;
  cnpj: string;
  city: string;
  plan: string;
  status: string;
  score: number;
  openCases: number;
}

export const mockCompanies: Company[] = [
  {
    id: "1",
    name: "Pizzaria Itália",
    cnpj: "00.000.000/0001-00",
    city: "Goiânia",
    plan: "Premium",
    status: "Ativo",
    score: 8.9,
    openCases: 2,
  },
  {
    id: "2",
    name: "Burger Prime",
    cnpj: "11.111.111/0001-11",
    city: "Brasília",
    plan: "Essencial",
    status: "Ativo",
    score: 7.6,
    openCases: 1,
  },
  {
    id: "3",
    name: "Sushi House",
    cnpj: "22.222.222/0001-22",
    city: "São Paulo",
    plan: "Enterprise",
    status: "Ativo",
    score: 9.4,
    openCases: 0,
  },
];