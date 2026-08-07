import { Project } from "@/lib/models/project";

export const mockProjects: Project[] = [
  {
    id: "pj-1",
    title: "Importador de planilhas do Reclame Aqui",
    description:
      "Subir o export da plataforma e criar os casos automaticamente, sem digitação manual.",
    stage: "Em andamento",
    owner: "Carlos",
    impact: "Alto",
    progress: 60,
    updatedAt: "2026-08-03",
    tags: ["Automação", "Reclame Aqui"],
  },
  {
    id: "pj-2",
    title: "Alertas automáticos de SLA",
    description:
      "Notificar o responsável antes do vencimento do prazo de resposta.",
    stage: "Planejado",
    owner: "Juliana",
    impact: "Alto",
    progress: 15,
    updatedAt: "2026-08-01",
    tags: ["SLA", "Notificações"],
  },
  {
    id: "pj-3",
    title: "Padronização das macros de resposta pública",
    description:
      "Revisar e versionar todos os textos aprovados pelo jurídico.",
    stage: "Em andamento",
    owner: "Juliana",
    impact: "Médio",
    progress: 45,
    updatedAt: "2026-07-30",
    tags: ["Conhecimento", "Qualidade"],
  },
  {
    id: "pj-4",
    title: "Painel de impacto financeiro por trimestre",
    description:
      "Consolidar receita preservada e recuperada para apresentação à liderança.",
    stage: "Concluído",
    owner: "Carlos",
    impact: "Alto",
    progress: 100,
    updatedAt: "2026-07-28",
    tags: ["Analytics", "Financeiro"],
  },
  {
    id: "pj-5",
    title: "Classificação automática de causa raiz",
    description:
      "Usar IA para sugerir categoria e causa raiz a partir do texto da reclamação.",
    stage: "Ideia",
    owner: "Marcos",
    impact: "Alto",
    progress: 0,
    updatedAt: "2026-08-02",
    tags: ["IA", "Produtividade"],
  },
  {
    id: "pj-6",
    title: "Integração com o WhatsApp Business",
    description:
      "Centralizar as conversas do WhatsApp direto na plataforma.",
    stage: "Ideia",
    owner: "Juliana",
    impact: "Médio",
    progress: 0,
    updatedAt: "2026-07-26",
    tags: ["Integração", "Redes Sociais"],
  },
  {
    id: "pj-7",
    title: "Pesquisa de satisfação pós-atendimento",
    description:
      "Disparo automático de NPS após o encerramento do caso.",
    stage: "Planejado",
    owner: "Carlos",
    impact: "Médio",
    progress: 25,
    updatedAt: "2026-07-31",
    tags: ["NPS", "Satisfação"],
  },
  {
    id: "pj-8",
    title: "Auditoria mensal de qualidade do atendimento",
    description:
      "Rotina amostral de revisão com devolutiva estruturada ao time.",
    stage: "Concluído",
    owner: "Carlos",
    impact: "Médio",
    progress: 100,
    updatedAt: "2026-07-20",
    tags: ["Qualidade", "Processo"],
  },
];
