import { Team } from "@/lib/models/team";

export const mockTeams: Team[] = [
  {
    id: "tm-1",
    name: "Reputação",
    description:
      "Time responsável pela gestão da experiência do cliente e pelos atendimentos públicos da marca.",
    department: "Experiência do Cliente",
    leader: "Carlos Isaac",
    active: true,
    members: [
      {
        id: "u-1",
        name: "Carlos Isaac",
        role: "Coordenador de Reputação",
        email: "carlos.isaac@cardapioweb.com",
        online: true,
        openCases: 6,
      },
      {
        id: "u-2",
        name: "Juliana Prado",
        role: "Analista de Reputação",
        email: "juliana.prado@cardapioweb.com",
        online: true,
        openCases: 5,
      },
      {
        id: "u-3",
        name: "Marcos Vinícius",
        role: "Analista de Reputação",
        email: "marcos.vinicius@cardapioweb.com",
        online: false,
        openCases: 5,
      },
      {
        id: "u-4",
        name: "Thais Portela",
        role: "Especialista em Retenção",
        email: "thais.portela@cardapioweb.com",
        online: false,
        openCases: 0,
      },
    ],
  },
  {
    id: "tm-2",
    name: "Suporte",
    description:
      "Atendimento técnico de primeiro nível para a base de clientes.",
    department: "Suporte",
    leader: "Thais Portela",
    active: true,
    members: [
      {
        id: "u-5",
        name: "Thais Portela",
        role: "Coordenadora de Suporte",
        email: "thais.portela@cardapioweb.com",
        online: true,
        openCases: 0,
      },
      {
        id: "u-6",
        name: "Rafael Monteiro",
        role: "Analista de Suporte",
        email: "rafael.monteiro@cardapioweb.com",
        online: false,
        openCases: 0,
      },
      {
        id: "u-7",
        name: "Aline Cardoso",
        role: "Analista de Suporte",
        email: "aline.cardoso@cardapioweb.com",
        online: false,
        openCases: 0,
      },
    ],
  },
  {
    id: "tm-3",
    name: "Fiscal",
    description:
      "Responsável por notas fiscais, SPED e obrigações acessórias dos clientes.",
    department: "Fiscal",
    leader: "Marcos Vinícius",
    active: true,
    members: [
      {
        id: "u-8",
        name: "Marcos Vinícius",
        role: "Especialista Fiscal",
        email: "marcos.vinicius@cardapioweb.com",
        online: false,
        openCases: 0,
      },
      {
        id: "u-9",
        name: "Bruno Carvalho",
        role: "Analista Fiscal",
        email: "bruno.carvalho@cardapioweb.com",
        online: false,
        openCases: 0,
      },
    ],
  },
  {
    id: "tm-4",
    name: "Tecnologia",
    description:
      "Engenharia e sustentação da plataforma Cardápio Web.",
    department: "Tecnologia",
    leader: "Diego Barbosa",
    active: true,
    members: [
      {
        id: "u-10",
        name: "Diego Barbosa",
        role: "Tech Lead",
        email: "diego.barbosa@cardapioweb.com",
        online: true,
        openCases: 0,
      },
      {
        id: "u-11",
        name: "Larissa Andrade",
        role: "Engenheira de Software",
        email: "larissa.andrade@cardapioweb.com",
        online: false,
        openCases: 0,
      },
    ],
  },
  {
    id: "tm-5",
    name: "Adoção",
    description:
      "Time legado de onboarding, mantido apenas para histórico.",
    department: "Implantação",
    leader: "Leonardo Pires",
    active: false,
    members: [
      {
        id: "u-12",
        name: "Leonardo Pires",
        role: "Analista de Implantação",
        email: "leonardo.pires@cardapioweb.com",
        online: false,
        openCases: 0,
      },
    ],
  },
];
