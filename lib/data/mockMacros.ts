import { Macro } from "@/lib/models/macro";

/**
 * Textos de partida, escritos a partir dos assuntos que mais aparecem
 * na base real: cobrança, cancelamento, sistema e atendimento.
 */
export const mockMacros: Macro[] = [
  {
    id: "mc-1",
    title: "Cobrança indevida — abertura da tratativa",
    body: "Olá, {{cliente}}! Sou {{responsavel}}, da Cardápio Web.\n\nLamentamos pelo ocorrido e já estamos verificando a cobrança apontada no protocolo {{protocolo}}. Nossa equipe financeira está analisando o histórico da sua conta e retornaremos com uma posição em até 24 horas.\n\nCaso o valor tenha sido cobrado indevidamente, faremos o estorno integral.",
    category: "Financeiro",
    owner: "Operação",
    tags: ["Cobrança", "Estorno"],
    uses: 0,
    updatedAt: "2026-08-06",
  },
  {
    id: "mc-2",
    title: "Cancelamento — tentativa de retenção",
    body: "Olá, {{cliente}}! Aqui é {{responsavel}}, da Cardápio Web.\n\nRecebemos seu pedido de cancelamento e queremos entender o que motivou essa decisão. Sua experiência é importante para nós e gostaríamos da oportunidade de resolver o que não funcionou.\n\nPodemos falar por telefone hoje? Assim conseguimos avaliar alternativas para o seu caso.",
    category: "Cancelamento",
    owner: "Operação",
    tags: ["Retenção", "Cancelamento"],
    uses: 0,
    updatedAt: "2026-08-06",
  },
  {
    id: "mc-3",
    title: "Instabilidade no sistema — reconhecimento",
    body: "Olá, {{cliente}}! Sou {{responsavel}}, da Cardápio Web.\n\nConfirmamos a instabilidade que você relatou e nosso time de tecnologia já está atuando na correção. Sabemos o impacto que isso causa na operação do seu estabelecimento e pedimos desculpas pelo transtorno.\n\nVamos manter você informado até a normalização completa.",
    category: "Sistema",
    owner: "Operação",
    tags: ["Indisponibilidade", "Tecnologia"],
    uses: 0,
    updatedAt: "2026-08-06",
  },
  {
    id: "mc-4",
    title: "Demora no atendimento — pedido de desculpas",
    body: "Olá, {{cliente}}! Aqui é {{responsavel}}, da Cardápio Web.\n\nVocê tem razão: o tempo que levamos para retornar não corresponde ao padrão que buscamos entregar. Assumimos a falha e já estamos tratando o seu caso com prioridade.\n\nA partir de agora, acompanho pessoalmente o protocolo {{protocolo}} até a solução.",
    category: "Atendimento",
    owner: "Operação",
    tags: ["Postura", "SLA"],
    uses: 0,
    updatedAt: "2026-08-06",
  },
  {
    id: "mc-5",
    title: "Solicitação de avaliação após solução",
    body: "Olá, {{cliente}}! Sou {{responsavel}}, da Cardápio Web.\n\nQue bom que conseguimos resolver a sua solicitação. Se o atendimento atendeu sua expectativa, você pode avaliar o seu caso aqui no Reclame Aqui — isso nos ajuda muito a melhorar.\n\nSeguimos à disposição pelo protocolo {{protocolo}}.",
    category: "Atendimento",
    owner: "Operação",
    tags: ["Avaliação", "Fechamento"],
    uses: 0,
    updatedAt: "2026-08-06",
  },
];
