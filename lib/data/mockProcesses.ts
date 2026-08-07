import { OperationProcess } from "@/lib/models/process";

export const mockProcesses: OperationProcess[] = [
  {
    id: "pr-1",
    name: "Tratativa de reclamação no Reclame Aqui",
    description:
      "Fluxo padrão desde o recebimento da reclamação até o registro do resultado final.",
    area: "Reputação",
    owner: "Carlos",
    sla: "48h",
    status: "Ativo",
    updatedAt: "2026-08-01",
    steps: [
      { name: "Triagem e classificação", owner: "Reputação" },
      { name: "Diagnóstico da causa raiz", owner: "Reputação" },
      { name: "Encaminhamento à área responsável", owner: "Suporte" },
      { name: "Resposta ao consumidor", owner: "Reputação" },
      { name: "Solicitação de avaliação", owner: "Reputação" },
    ],
  },
  {
    id: "pr-2",
    name: "Escalonamento de indisponibilidade",
    description:
      "Acionamento do time de Tecnologia quando o sistema afeta a operação do cliente.",
    area: "Tecnologia",
    owner: "Marcos",
    sla: "1h",
    status: "Ativo",
    updatedAt: "2026-07-22",
    steps: [
      { name: "Confirmar impacto e abrangência", owner: "Suporte" },
      { name: "Abrir incidente", owner: "Tecnologia" },
      { name: "Comunicar clientes afetados", owner: "Reputação" },
      { name: "Registrar post-mortem", owner: "Tecnologia" },
    ],
  },
  {
    id: "pr-3",
    name: "Retenção de cliente em risco",
    description:
      "Diagnóstico e negociação para reverter pedidos de cancelamento.",
    area: "Comercial",
    owner: "Juliana",
    sla: "24h",
    status: "Ativo",
    updatedAt: "2026-08-03",
    steps: [
      { name: "Identificar motivo do cancelamento", owner: "Reputação" },
      { name: "Consultar histórico e uso", owner: "Comercial" },
      { name: "Apresentar oferta de retenção", owner: "Comercial" },
      { name: "Registrar desfecho e valor", owner: "Reputação" },
    ],
  },
  {
    id: "pr-4",
    name: "Correção fiscal de nota emitida",
    description:
      "Procedimento para cancelamento e reemissão de notas com divergência.",
    area: "Fiscal",
    owner: "Marcos",
    sla: "8h",
    status: "Em revisão",
    updatedAt: "2026-07-30",
    steps: [
      { name: "Validar divergência com o contador", owner: "Fiscal" },
      { name: "Cancelar nota original", owner: "Fiscal" },
      { name: "Reemitir com dados corretos", owner: "Fiscal" },
      { name: "Confirmar com o cliente", owner: "Reputação" },
    ],
  },
  {
    id: "pr-5",
    name: "Atendimento originado em redes sociais",
    description:
      "Registro, classificação e encaminhamento de casos vindos dos canais sociais.",
    area: "Reputação",
    owner: "Juliana",
    sla: "4h",
    status: "Ativo",
    updatedAt: "2026-07-27",
    steps: [
      { name: "Registrar conversa e origem", owner: "Reputação" },
      { name: "Classificar assunto", owner: "Reputação" },
      { name: "Encaminhar internamente", owner: "Suporte" },
      { name: "Follow-up com o cliente", owner: "Reputação" },
    ],
  },
  {
    id: "pr-6",
    name: "Auditoria mensal de qualidade",
    description:
      "Revisão amostral dos atendimentos encerrados para padronização.",
    area: "Qualidade",
    owner: "Carlos",
    sla: "Mensal",
    status: "Rascunho",
    updatedAt: "2026-07-15",
    steps: [
      { name: "Selecionar amostra", owner: "Qualidade" },
      { name: "Aplicar checklist de avaliação", owner: "Qualidade" },
      { name: "Devolutiva ao time", owner: "Reputação" },
      { name: "Plano de melhoria", owner: "Reputação" },
    ],
  },
];
