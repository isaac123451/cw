export interface PlaybookStep {
  title: string;
  owner: string;
  sla?: string;
  detail: string;
  checklist?: string[];
}

export interface Playbook {
  id: string;
  slug: string;
  title: string;
  summary: string;
  scope: string;
  owner: string;
  updatedAt: string;
  version: string;
  steps: PlaybookStep[];
  rules?: string[];
  /** Página correspondente no Confluence, onde a doc oficial vive. */
  confluenceUrl?: string;
}

export const mockPlaybooks: Playbook[] = [
  {
    id: "pb-1",
    slug: "atendimento-reclame-aqui",
    title: "Atendimento no Reclame Aqui — do início à finalização",
    summary:
      "Fluxo oficial de tratativa de uma reclamação pública, do recebimento até o registro do resultado final.",
    scope: "Reclame Aqui",
    owner: "Carlos Isaac",
    updatedAt: "2026-08-05",
    version: "3.0",
    steps: [
      {
        title: "1. Recebimento e registro",
        owner: "Reputação",
        sla: "Até 2h do aviso",
        detail:
          "A reclamação chega pelo portal do Reclame Aqui. Como não há integração oficial, o caso é cadastrado manualmente ou importado pela planilha exportada do portal. Todo caso nasce com protocolo, empresa, consumidor e canal de origem preenchidos.",
        checklist: [
          "Ler a reclamação original por completo",
          "Cadastrar o caso com protocolo e empresa vinculada",
          "Anexar o link público da reclamação",
        ],
      },
      {
        title: "2. Triagem e classificação",
        owner: "Reputação",
        sla: "Até 4h",
        detail:
          "Define categoria, subcategoria, prioridade e o time responsável. A classificação é o que alimenta o Analytics — sem ela o diagnóstico de causa raiz fica cego.",
        checklist: [
          "Definir categoria e subcategoria",
          "Definir prioridade (Crítica, Alta, Média, Baixa)",
          "Marcar risco de cancelamento quando houver",
          "Atribuir responsável e time envolvido",
        ],
      },
      {
        title: "3. Investigação e causa raiz",
        owner: "Time envolvido",
        sla: "Até 24h",
        detail:
          "O time acionado apura o que aconteceu: consulta histórico do cliente, logs, faturas ou registros de atendimento. A causa raiz é registrada no caso, não apenas o sintoma relatado.",
        checklist: [
          "Consultar histórico do cliente na Jornada",
          "Acionar a área responsável",
          "Registrar a causa raiz identificada",
        ],
      },
      {
        title: "4. Contato com o consumidor",
        owner: "Reputação",
        sla: "Até 24h",
        detail:
          "Contato direto pelo canal disponível (telefone ou WhatsApp) antes da resposta pública, sempre que possível. O objetivo é resolver de fato, não apenas responder.",
        checklist: [
          "Registrar tentativa e resultado do contato",
          "Alinhar a solução com o consumidor",
        ],
      },
      {
        title: "5. Resposta pública",
        owner: "Reputação",
        sla: "Até 48h do recebimento",
        detail:
          "Publicação da resposta oficial no portal, usando macro aprovada quando aplicável. Este é o item de maior peso no índice de resposta — reclamação sem resposta pública derruba a nota mesmo quando o problema foi resolvido.",
        checklist: [
          "Usar macro aprovada ou validar texto próprio",
          "Publicar no portal e registrar a data",
          "Colar o texto publicado na aba Avaliação RA",
        ],
      },
      {
        title: "6. Solicitação de avaliação",
        owner: "Reputação",
        sla: "Após a solução",
        detail:
          "Com o problema resolvido, o consumidor é convidado a avaliar o atendimento. A avaliação alimenta a nota do consumidor e o índice de solução.",
        checklist: [
          "Solicitar avaliação pelo canal de contato",
          "Registrar a solicitação no caso",
        ],
      },
      {
        title: "7. Registro do resultado final",
        owner: "Reputação",
        sla: "No encerramento",
        detail:
          "Fecha o ciclo: situação resolvida, nota recebida, se o cliente voltaria a fazer negócio e o impacto financeiro quando houver retenção ou valor recuperado.",
        checklist: [
          "Marcar situação como resolvida",
          "Registrar nota e intenção de retorno",
          "Lançar impacto financeiro, se aplicável",
          "Mover o caso para Resolvido ou Fechado",
        ],
      },
    ],
    rules: [
      "Nenhum caso é encerrado sem resposta pública publicada.",
      "Prioridade Crítica e risco de churn têm SLA de 1h para primeiro contato.",
      "A causa raiz é obrigatória — 'cliente insatisfeito' não é causa raiz.",
      "Toda oferta concedida precisa ser lançada em Impacto no Negócio.",
    ],
  },
  {
    id: "pb-2",
    slug: "manychat-redes-sociais",
    title: "ManyChat e canais de redes sociais",
    summary:
      "Como os atendimentos que chegam pelo ManyChat, Instagram, Facebook e WhatsApp entram na operação.",
    scope: "Redes Sociais",
    owner: "Juliana Prado",
    updatedAt: "2026-08-04",
    version: "1.6",
    steps: [
      {
        title: "1. O que é o ManyChat na operação",
        owner: "Reputação",
        detail:
          "O ManyChat é a ferramenta de automação que recebe e distribui as conversas vindas do Instagram e do Facebook. Ele é um canal de entrada, não um módulo: todo caso originado nele é registrado no módulo Redes Sociais, com o campo de origem preenchido como ManyChat.",
      },
      {
        title: "2. Captura da conversa",
        owner: "Reputação",
        sla: "Até 4h",
        detail:
          "O fluxo automatizado faz a primeira triagem e coleta identificação do cliente. Quando o assunto exige tratativa humana, o agente assume a conversa e registra o caso na plataforma.",
        checklist: [
          "Identificar o cliente e a loja envolvida",
          "Registrar o caso com origem correta (ManyChat, Instagram, Facebook ou WhatsApp)",
          "Classificar o assunto",
        ],
      },
      {
        title: "3. Encaminhamento interno",
        owner: "Time envolvido",
        sla: "Até 8h",
        detail:
          "Mesma lógica do Reclame Aqui: o caso é encaminhado ao time responsável e acompanhado até a resolução. A diferença é que não existe resposta pública em portal — a tratativa acontece na própria conversa.",
      },
      {
        title: "4. Follow-up e encerramento",
        owner: "Reputação",
        sla: "Até 24h da solução",
        detail:
          "Retorno ao cliente confirmando a solução e, quando o caso tinha potencial de virar reclamação pública, convite para avaliação positiva.",
        checklist: [
          "Confirmar a solução com o cliente",
          "Registrar o desfecho no caso",
          "Avaliar risco de escalar para o Reclame Aqui",
        ],
      },
    ],
    rules: [
      "Casos de redes sociais nunca entram na base do Reclame Aqui — a separação por canal de origem é obrigatória.",
      "O módulo se chama Redes Sociais; ManyChat é apenas um dos canais.",
      "Conversa que menciona intenção de reclamar publicamente vira prioridade Alta.",
    ],
  },
  {
    id: "pb-3",
    slug: "rastreabilidade",
    title: "Rastreabilidade dos casos",
    summary:
      "O que fica registrado em cada caso e como reconstruir a história completa de um atendimento.",
    scope: "Plataforma",
    owner: "Carlos Isaac",
    updatedAt: "2026-08-05",
    version: "2.2",
    steps: [
      {
        title: "Identificação",
        owner: "Automático",
        detail:
          "Protocolo único, empresa vinculada com CNPJ, consumidor, cidade e canal de origem. O protocolo é a chave de busca em toda a plataforma.",
      },
      {
        title: "Classificação",
        owner: "Reputação",
        detail:
          "Categoria, subcategoria, prioridade, time envolvido e tags. Toda mudança de classificação fica visível na aba Histórico do caso.",
      },
      {
        title: "Tratativa",
        owner: "Reputação e time envolvido",
        detail:
          "Responsável, checklist de resolução com marcação por item, comentários internos e registros de contato. O checklist mostra quantos itens obrigatórios ainda faltam antes de encerrar.",
      },
      {
        title: "Desfecho",
        owner: "Reputação",
        detail:
          "Resposta pública, data de publicação, avaliação do consumidor, intenção de voltar a fazer negócio, tempo de resposta e tempo de solução.",
      },
      {
        title: "Impacto",
        owner: "Reputação",
        detail:
          "Quando houve retenção, recuperação de valor ou oferta concedida, o registro vai para Impacto no Negócio e passa a compor o resultado da área.",
      },
    ],
    rules: [
      "A aba Histórico de cada caso reconstrói a linha do tempo do registro ao encerramento.",
      "A Jornada do Cliente agrupa todos os casos de uma mesma empresa, revelando reincidência.",
      "Indicadores só consideram casos com o campo correspondente preenchido — dado ausente não vira zero.",
    ],
  },
];
