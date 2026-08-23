import { Macro } from "@/lib/models/macro";

/**
 * Textos de partida.
 *
 * Os cinco primeiros são de **resposta pública** no Reclame Aqui,
 * escritos a partir dos assuntos que mais aparecem na base real:
 * cobrança, cancelamento, sistema e atendimento.
 *
 * Os cinco últimos vieram do WhatsApp Business, como a operação já os
 * usa. Duas coisas mudaram na passagem, e as duas de propósito:
 *
 * 1. **O nome da atendente saiu.** Estava escrito no texto ("Aqui é a
 *    Carla"), e texto pronto com nome de pessoa dentro só serve para
 *    uma pessoa — quem mais usasse estaria se apresentando com o nome
 *    de outra. Virou `{{responsavel}}`, que a inserção troca por quem
 *    está atendendo.
 * 2. **O gênero saiu junto.** "Ficaria muito grata" tem o mesmo
 *    problema pelo mesmo motivo: se o nome sai porque quem atende
 *    muda, a concordância também tem de sair.
 *
 * O que **não** mudou: a voz, os emoji e o `*negrito*` do WhatsApp. É
 * como a operação já fala, e reescrever isso seria trocar um texto
 * aprovado por um palpite meu.
 */
export const mockMacros: Macro[] = [
  {
    id: "mc-1",
    title: "Cobrança indevida — abertura da tratativa",
    body: "Olá, {{cliente}}! Sou {{responsavel}}, da Cardápio Web.\n\nLamentamos pelo ocorrido e já estamos verificando a cobrança apontada no protocolo {{protocolo}}. Nossa equipe financeira está analisando o histórico da sua conta e retornaremos com uma posição em até 24 horas.\n\nCaso o valor tenha sido cobrado indevidamente, faremos o estorno integral.",
    category: "Financeiro",
    channel: "Reclame Aqui",
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
    channel: "Reclame Aqui",
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
    channel: "Reclame Aqui",
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
    channel: "Reclame Aqui",
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
    channel: "Reclame Aqui",
    owner: "Operação",
    tags: ["Avaliação", "Fechamento"],
    uses: 0,
    updatedAt: "2026-08-06",
  },

  /* ============================================================
     WHATSAPP — como a operação já usa
  ============================================================ */

  {
    id: "mc-6",
    title: "WhatsApp — primeiro contato",
    body: "Oi, {{cliente}}! 😊\nSou {{responsavel}}, representante do Reclame Aqui da Cardápio Web. Vi que você deixou uma mensagem no Reclame Aqui. Lamento muito saber que você teve essa experiência negativa. Podemos continuar por aqui?",
    category: "Atendimento",
    channel: "WhatsApp",
    owner: "Operação",
    tags: ["Abertura", "Primeiro contato"],
    uses: 0,
    updatedAt: "2026-08-22",
  },
  {
    id: "mc-7",
    title: "WhatsApp — o erro foi resolvido?",
    body: "Oi, {{cliente}}!\nSou {{responsavel}}, representante do Reclame Aqui da Cardápio Web. Estou entrando em contato para saber como estão as coisas com o uso do nosso sistema. O erro que você relatou anteriormente foi resolvido?",
    category: "Sistema",
    channel: "WhatsApp",
    owner: "Operação",
    tags: ["Confirmação", "Pós-correção"],
    uses: 0,
    updatedAt: "2026-08-22",
  },
  {
    id: "mc-8",
    title: "WhatsApp — convite para avaliar",
    body: "Oi, {{cliente}}! 😊\nEspero que esteja tudo bem! Para finalizarmos sua solicitação no Reclame Aqui, convidamos você a *avaliar o meu atendimento*. Sua opinião é muito importante para nós e faz toda a diferença! ✨💜\n\n*Posso contar com a sua avaliação?* 🥺",
    category: "Atendimento",
    channel: "WhatsApp",
    owner: "Operação",
    tags: ["Avaliação", "Fechamento"],
    uses: 0,
    updatedAt: "2026-08-22",
  },
  {
    id: "mc-9",
    title: "WhatsApp — pedido de avaliação, com as três perguntas",
    body: "{{cliente}}, estarei respondendo à sua solicitação no Reclame Aqui em breve. Sei que toda essa situação foi difícil e estressante, mas asseguro que fiz o meu máximo para corrigir tudo o mais rápido possível 🤗.\n\nGostaria de pedir um grande favor: *você poderia avaliar meu atendimento aqui no Reclame Aqui?*\n\nFicaria muito feliz se você pudesse responder três perguntas simples: _uma sobre a nota do atendimento, outra se você voltaria a fazer negócio comigo e, por fim, se consegui resolver o problema inicial._\n\nSua opinião é muito importante e me ajudará a continuar aprimorando meu trabalho! *Posso contar com a sua avaliação?* 🥺🙏🏻",
    category: "Atendimento",
    channel: "WhatsApp",
    owner: "Operação",
    tags: ["Avaliação", "Fechamento"],
    uses: 0,
    updatedAt: "2026-08-22",
  },
  {
    id: "mc-10",
    title: "WhatsApp — prazo de avaliação acabando",
    body: "Oi, tudo bem? 😊\nAqui é {{responsavel}}, da Cardápio Web. Falamos há um tempo sobre sua reclamação no Reclame Aqui.\n\nVi que a avaliação ainda não foi feita e o prazo para avaliar está chegando ao fim. *Para encerrar direitinho a reclamação, é só deixar a avaliação* por lá. É bem rapidinho 💜\n\nReclamação: {{protocolo}}\n\nSe puder fazer agora, eu agradeço muito ✨",
    category: "Atendimento",
    channel: "WhatsApp",
    owner: "Operação",
    tags: ["Avaliação", "Cobrança", "Prazo"],
    uses: 0,
    updatedAt: "2026-08-22",
  },
];
