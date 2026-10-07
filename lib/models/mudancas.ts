import type { FrenteDaNovidade } from "@/lib/models/novidades";

/**
 * A revisão geral rumo ao 1.0, item por item.
 *
 * **O pedido (05/10/2026).** "Não quero versões, tudo vai voltar para 1.0"
 * e "cada coisinha vou querer saber na parte de novidades da ferramenta".
 * Até aqui a tela de Novidades contava uma entrada por versão; agora a
 * aplicação fica em 1.0.0 e cada mudança — por menor que seja — é um item
 * próprio, com o que era, o que ficou e onde está.
 *
 * Três tipos, porque a pergunta de quem lê é diferente em cada um:
 * **novo** (o que dá para fazer agora e antes não dava), **melhoria** (o
 * que já existia e ficou mais rápido, mais claro ou mais fácil) e
 * **correção** (o que estava errado — conta, texto, tela — e deixou de
 * estar). A frente "Por dentro" guarda o que não aparece na tela mas muda
 * a confiança nela: conferências, segurança, tempo de build.
 *
 * A mais nova primeiro, e dentro do dia na ordem em que faz sentido ler.
 */

export type TipoDeMudanca = "novo" | "melhoria" | "correcao";

export const TIPOS_DE_MUDANCA: { id: TipoDeMudanca; nome: string; plural: string }[] = [
  { id: "novo", nome: "Novo", plural: "Novidades" },
  { id: "melhoria", nome: "Melhorou", plural: "Melhorias" },
  { id: "correcao", nome: "Corrigido", plural: "Correções" },
];

export interface Mudanca {
  /** Estável: é a chave do "novo" e do link direto (#id). */
  id: string;
  /** AAAA-MM-DD. */
  dia: string;
  tipo: TipoDeMudanca;
  frente: FrenteDaNovidade;
  titulo: string;
  /** O que era e o que ficou, em linguagem de quem usa. */
  texto: string;
  /** Onde a coisa está, quando é uma tela da plataforma. */
  href?: string;
  /** Onde está, quando não é link: "Extensão → caso aberto". */
  onde?: string;
}

export const REVISAO = {
  titulo: "Revisão geral rumo ao 1.0",
  inicio: "2026-10-05",
  texto:
    "Bugs, contas, desempenho, segurança e o que estava pela metade — na plataforma e na extensão, com a mesma prioridade. Cada item abaixo é uma mudança: o que era, o que ficou, onde está e o dia em que entrou.",
};

export const MUDANCAS: Mudanca[] = [
  /* ---------------- plataforma: meu dia ---------------- */
  {
    id: "meu-dia-modo-foco",
    dia: "2026-10-07",
    tipo: "novo",
    frente: "plataforma",
    titulo: "Meu dia em modo foco",
    texto:
      "O Meu dia abria com doze blocos antes da lista de tarefas. Agora abre no Foco: o próximo passo, o placar, as metas de hoje e a rotina — o que leva a terminar o dia. O que move a nota, as metas do ciclo, o plano do expediente, o checkpoint e o fim do dia ficam no \"Tudo\", no canto do título, ou no botão ao fim da rotina. A escolha fica guardada no navegador.",
    href: "/meu-dia",
  },
  {
    id: "agenda-prazos-iguais-ao-menu",
    dia: "2026-10-07",
    tipo: "correcao",
    frente: "plataforma",
    titulo: "A Agenda conta os prazos estourados igual ao Meu dia",
    texto:
      "O \"ficou para trás\" da Agenda dizia 162 prazos estourados enquanto o Meu dia, no menu, dizia 121: a Agenda contava também o NPS que a regra dos 30 dias encerra de madrugada, que não tem mais prazo a cumprir. Agora usa a mesma conta, e o que está com as áreas aparece separado — \"121 prazos de caso ou NPS estourados e 1 com as áreas\".",
    href: "/agenda",
  },
  {
    id: "dashboard-cartoes-do-ra",
    dia: "2026-10-07",
    tipo: "correcao",
    frente: "plataforma",
    titulo: "Os cartões do Dashboard contam o que a lista do clique mostra",
    texto:
      "\"Na fila da operação\" dizia 20 e, clicado, abria o quadro do Reclame Aqui com 17: o cartão somava os atendimentos das Redes. Agora \"Na fila\" e \"Risco de cancelamento\" contam só o Reclame Aqui, como a lista que abrem. No Impacto no negócio, a comparação com o mês passado sai em reais quando a porcentagem não faz sentido — de −R$ 300 para R$ 0 dizia \"+100%\", agora diz \"+R$ 300\".",
    href: "/dashboard",
  },
  {
    id: "quadro-sem-resposta-so-abertas",
    dia: "2026-10-07",
    tipo: "correcao",
    frente: "reclame-aqui",
    titulo: "O quadro conta \"sem resposta\" igual ao menu, ao placar e à extensão",
    texto:
      "O cartão Reclamações e o filtro \"sem resposta pública\" do quadro contavam também reclamação já fechada: diziam 12 enquanto o menu, o placar e a extensão diziam 11. Agora todos seguem a mesma regra — aberta, do Reclame Aqui e sem resposta pública.",
    href: "/reclame-aqui",
  },
  {
    id: "aviso-incompletas-so-ra",
    dia: "2026-10-07",
    tipo: "correcao",
    frente: "reclame-aqui",
    titulo: "O aviso de dados incompletos fala só das reclamações",
    texto:
      "O sino e a extensão diziam \"5 reclamações com dados do consumidor incompletos\" e o quadro mostrava 4: o quinto era um atendimento das Redes Sociais, que não se completa pelo quadro do Reclame Aqui. Agora o aviso conta só o Reclame Aqui, igual ao quadro.",
    href: "/reclame-aqui",
  },
  {
    id: "rotina-tempo-de-hoje",
    dia: "2026-10-07",
    tipo: "correcao",
    frente: "plataforma",
    titulo: "O tempo de cada atividade da rotina é o da parte de hoje",
    texto:
      "\"Verificar novos casos\" mostrava ~31h26 — o tempo do acumulado inteiro, inclusive o que o plano de recuperação já deixou para os próximos dias. Agora o tempo é só o de hoje (~19h37 com a fila atual) e, quando passa do expediente, aparece em âmbar com \"além do expediente\": o plano do dia encaixa o que cabe, na ordem do documento. E o placar diz \"1 dia seguido\", não \"1 dias seguidos\".",
    href: "/meu-dia",
  },
  {
    id: "distribuicao-dia-de-brasilia",
    dia: "2026-10-07",
    tipo: "correcao",
    frente: "plataforma",
    titulo: "Distribuição do time conta a espera pelo dia de Brasília",
    texto:
      "Na Distribuição do time, o \"desde quando\" de cada item usava o dia em UTC: o que chegava depois das 21h aparecia como do dia seguinte, e a fila parecia mais nova do que é. Agora é o dia em Brasília, como no resto da plataforma.",
    href: "/distribuicao",
  },
  {
    id: "placar-encerrados-com-trabalho",
    dia: "2026-10-07",
    tipo: "correcao",
    frente: "nps",
    titulo: "O placar só conta como encerrado o ciclo do NPS que teve contato",
    texto:
      "Neste ciclo o placar dizia \"137 ciclos de NPS encerrados\" — e 119 eram respostas antigas que a rotina da madrugada fechou como Sem Retorno sem ninguém ter tentado falar com o cliente. Agora o placar, as conquistas e o resumo para a gestão só contam o encerramento com pelo menos um contato ou uma tentativa: 18 neste ciclo, contra 3 no mesmo ponto do anterior.",
    href: "/meu-dia",
  },
  {
    id: "meu-dia-cadencia-esgotada",
    dia: "2026-10-07",
    tipo: "correcao",
    frente: "reclame-aqui",
    titulo: "Reclamação com as tentativas esgotadas volta para o Meu dia",
    texto:
      "Quando o cliente não atende, o caso fica nas ligações até a cadência acabar (5 tentativas ou 7 dias). Depois disso ele saía das ligações e não voltava para lugar nenhum — uma reclamação ficou duas semanas fora de toda fila, 37 dias sem resposta pública. Agora, esgotada a cadência, ela volta para \"em aberto\" com o aviso \"tentativas esgotadas: publique a mensagem transparente\" e para os FUPs, como o guia manda.",
    href: "/meu-dia",
  },
  {
    id: "meu-dia-sem-duplicados",
    dia: "2026-10-07",
    tipo: "correcao",
    frente: "plataforma",
    titulo: "A fila do dia não repete mais o caso com tentativa aguardando retorno",
    texto:
      "Os itens que o servidor manda para o Meu dia (tentativa aguardando retorno, ligações da cadência) usavam um código do caso diferente do da tela, então a tela não reconhecia o caso: quem tinha uma tentativa pendente aparecia nos FUPs e de novo em \"em aberto\". Hoje eram 8 casos assim. E caso já fechado (aguardando avaliação, não resolvido) deixa de pedir FUP por uma tentativa antiga.",
    href: "/meu-dia",
  },
  {
    id: "sequencia-dois-tercos",
    dia: "2026-10-07",
    tipo: "melhoria",
    frente: "plataforma",
    titulo: "A sequência de dias conta com dois terços da rotina, não só com ela inteira",
    texto:
      "A chama do placar só somava o dia com as 12 atividades marcadas — e, olhando a base, de 13 dias com marcas só um fechou tudo, então ela ficava quase sempre em zero. Agora o dia entra na sequência com dois terços da rotina (8 de 12). Ao salvar, o aviso diz a sequência ou quantas faltam para hoje contar. Dia útil sem atividade nenhuma prevista não interrompe mais.",
    href: "/meu-dia",
  },
  {
    id: "um-por-vez-fim-do-bloco",
    dia: "2026-10-07",
    tipo: "melhoria",
    frente: "plataforma",
    titulo: "O bloco de foco avisa quando acaba, e a fila zerada conta o que você fechou",
    texto:
      "No Um por vez, o bloco de 25 ou 45 minutos chegava a 00:00 e ficava parado no cabeçalho, sem aviso. Agora aparece \"Bloco de 25 min encerrado: 6 itens fechados\" com a sugestão de pausa — e, se o navegador já permite notificações, ela chega mesmo com a aba atrás. Quando a fila zera depois de trabalho feito, a tela diz \"Fila zerada: N itens fechados agora\" em vez de \"Nada na fila\".",
    href: "/meu-dia?um-por-vez",
  },
  {
    id: "meu-dia-pular-da-a-volta",
    dia: "2026-10-07",
    tipo: "correcao",
    frente: "plataforma",
    titulo: "\"Pular\" no próximo passo não trava mais depois de dar a volta na fila",
    texto:
      "Depois de pular todos os itens da fila, o próximo passo voltava para o primeiro e o botão Pular parava de andar. Agora a volta recomeça a contagem e o Pular segue para o seguinte, no Meu dia e no próximo passo flutuante.",
    href: "/meu-dia",
  },
  {
    id: "placar-compara-com-o-ciclo",
    dia: "2026-10-07",
    tipo: "correcao",
    frente: "plataforma",
    titulo: "O placar diz \"ciclo anterior\", que é com o que ele compara",
    texto:
      "Desde que o placar passou a contar por ciclo, cada número ainda dizia \"+3 que a semana passada\". A conta sempre foi contra o ciclo anterior até o mesmo ponto; o texto e o tour agora dizem isso.",
    href: "/meu-dia",
  },
  /* ---------------- redes: captura ---------------- */
  {
    id: "redes-email-nao-e-perfil",
    dia: "2026-10-07",
    tipo: "correcao",
    frente: "redes",
    titulo: "O e-mail do cliente deixa de virar perfil do Instagram na captura do Slack",
    texto:
      "Quando a mensagem do Slack trazia o e-mail do cliente, a captura tomava o \"@gmail.com\" por perfil do Instagram e gravava \"gmail.com\" como perfil do atendimento. Agora a arroba só vale como perfil quando está solta no texto, e perfil de verdade (\"@maria.doces\") continua saindo.",
    onde: "Redes Sociais → Capturar do Slack",
  },
  /* ---------------- plataforma: cadastros ---------------- */
  {
    id: "carga-nao-cria-usuario",
    dia: "2026-10-07",
    tipo: "correcao",
    frente: "plataforma",
    titulo: "A carga do Reclame Aqui não cria mais conta para quem saiu da operação",
    texto:
      "Quem atendeu reclamações e não tem login (ex-operacional, por exemplo) virava um usuário sem senha na lista de responsáveis e de times a cada carga. Agora a carga só avisa quem ficou sem conta: a reclamação entra sem responsável e quem for cuidar dela atribui na ficha. Cadastrar responsável à mão, em Times, continua como antes.",
    onde: "Configurações → Times; carga da planilha do Reclame Aqui",
  },
  /* ---------------- extensão: o painel ---------------- */
  {
    id: "ext-nota-da-resposta-acha-a-reclamacao",
    dia: "2026-10-07",
    tipo: "correcao",
    frente: "extensao",
    titulo: "A nota da resposta no Reclame Aqui volta a saber de qual reclamação é",
    texto:
      "Enquanto se escreve a resposta pública no HugMe ou no Reclame Aqui, a extensão dá a nota de 0 a 100 e os avisos. Ela identificava a reclamação pelo número do \"ID:\", mas no CW o protocolo é o código (COD) — o caso quase nunca era achado. Na prática, a nota não conferia se o nome do cliente estava certo, o passo e o prazo da reclamação nunca apareciam, e reescrever uma resposta já publicada acusava \"100% igual\" à da própria reclamação. Agora vão o COD e o número, e o servidor procura pelos dois — conferido contra as 40 reclamações mais recentes, todas achadas. De quebra: uma conferência que chega atrasada não pinta mais a nota de um texto antigo por cima da atual; o \"Pode publicar\" não some quando aparece a linha do caso; e voltar à mesma caixa não liga a conferência duas vezes.",
    onde: "Extensão → HugMe / Reclame Aqui → caixa da resposta pública",
  },
  {
    id: "ext-slack-e-atalho-no-tema",
    dia: "2026-10-07",
    tipo: "correcao",
    frente: "extensao",
    titulo: "Slack sem travar na prévia vazia, e respostas rápidas no tema do painel",
    texto:
      "No Slack, se o servidor não entendesse a mensagem como atendimento, o painel da prévia quebrava sem dizer nada; agora avisa e oferece tentar de novo. O contador \"Conferindo… 400 de 350\" também não passa mais do total no último lote. E o atalho de respostas rápidas ao lado da caixa do WhatsApp seguia sempre o tema do sistema: com o painel no escuro e o computador no claro, a janela saía clara. Passou a seguir o tema escolhido no painel.",
    onde: "Extensão → Slack; WhatsApp → Respostas rápidas",
  },
  {
    id: "ext-confirma-o-que-gravou",
    dia: "2026-10-07",
    tipo: "melhoria",
    frente: "extensao",
    titulo: "Extensão confirma o que gravou: tentativa do NPS, anotação no caso, vínculo do contato",
    texto:
      "Quatro gravações terminavam caladas — o painel só se redesenhava, e quem clicou ficava sem saber se foi. Agora, depois da resposta do servidor, aparece a pílula no canto: \"Tentativa registrada no NPS.\", \"Contato registrado no NPS.\", \"Anotação gravada no caso.\" e \"Contato vinculado: esta conversa passa a ser reconhecida.\". E o \"desfazer vínculo\" ignorava o resultado: uma falha voltava ao painel como se tivesse desfeito; agora diz que não deu, e o vínculo continua à vista.",
    onde: "Extensão → Cliente e caso aberto",
  },
  {
    id: "ext-novo-caso-da-conversa",
    dia: "2026-10-07",
    tipo: "correcao",
    frente: "extensao",
    titulo: "\"Novo caso\" aberto da conversa: UF pelo DDD, data com calendário e rótulos que seguem a Origem",
    texto:
      "Três coisas no formulário que nasce do \"Cadastrar aqui\" do WhatsApp. A UF pelo DDD só funcionava no Reclame Aqui — a tabela morava no leitor do portal, que o WhatsApp não carrega —, então o caso saía sem estado mesmo com o telefone na tela; agora vem preenchida, com o aviso de onde veio. A data era um campo de texto \"Publicada em (AAAA-MM-DD)\" que quebrava a linha e desalinhava a Prioridade; virou um seletor de data, chamado \"Data do contato\" quando o caso vem de conversa (vazio, conta hoje). E trocar a Origem no seletor não mexia nos rótulos: com Reclame Aqui escolhido, o Id continuava dizendo \"deixe vazio para gerar\", e o portal exige o número. De quebra, calendário, listas e barras de rolagem nativas do painel passaram a seguir o tema escuro ou claro escolhido, e não o da página.",
    onde: "Extensão → WhatsApp → Cliente → Cadastrar aqui",
  },
  {
    id: "ext-leia-me-o-que-sai",
    dia: "2026-10-07",
    tipo: "correcao",
    frente: "extensao",
    titulo: "O manual da extensão diz, sem arredondar, o que sai do navegador",
    texto:
      "O LEIA-ME prometia que \"só três coisas\" saíam da máquina e que a consulta \"nunca\" levava uma conversa. Deixou de ser verdade quando a conversa passou a ser guardada, resumida e lida para os sinais. A seção foi reescrita em três grupos — o que sai sozinho ao abrir uma conversa, o que sai a cada 30 minutos (o vigia) e o que só sai com um clique (prévia do portal, guardar, IA, áudio, NPS, Google, Slack, planilha) —, dizendo o que é gravado e o que é só lido. A página de Opções da extensão ganhou a mesma frase sobre a leitura sem gravar. Tudo continua indo só para o endereço do CW configurado nas opções.",
    onde: "Extensão → LEIA-ME → O que a extensão lê",
  },
  {
    id: "ext-google-data-da-avaliacao",
    dia: "2026-10-07",
    tipo: "correcao",
    frente: "extensao",
    titulo: "Avaliação do Google registrada com a data certa, mesmo quando o texto fala de anos",
    texto:
      "O \"Registrar no CW\" do Google Perfil da Empresa deduz a data do \"há 2 semanas\" do cartão — mas procurava por unidade, a maior primeiro, no cartão inteiro. Uma avaliação que dizia \"sou cliente há 5 anos\" ia para a ficha com a data de cinco anos atrás, fora de qualquer janela e dos indicadores do mês. Agora vale a primeira expressão de tempo do cartão, que é a data logo abaixo do nome; \"esperei 3 dias\" no relato também não passa na frente. E a confirmação em dois tempos ganhou um \"cancelar\": se a leitura saiu errada, desfaz ali mesmo — antes o botão ficava parado em \"Confirmar\".",
    onde: "Extensão → Google Perfil da Empresa → Registrar no CW",
  },
  {
    id: "ext-agenda-hoje-amanha",
    dia: "2026-10-07",
    tipo: "melhoria",
    frente: "extensao",
    titulo: "Agenda da extensão diz \"hoje\" e \"amanhã\"",
    texto:
      "Cada atividade levava a data cheia no canto (\"07/10/2026\"), e era preciso conferir o calendário para saber se era para agora. A etiqueta passou a dizer \"hoje\" ou \"amanhã\" quando é o caso; atrasada continua vermelha, com a data em que venceu.",
    onde: "Extensão → Agenda",
  },
  {
    id: "ext-navegacao-explica-a-ponta",
    dia: "2026-10-06",
    tipo: "melhoria",
    frente: "extensao",
    titulo: "\"‹ 3 de 12 ›\" diz quando chegou na ponta",
    texto:
      "No primeiro ou no último caso da lista, a seta apagada não dizia nada — nem ao passar o mouse, nem ao leitor de tela. Agora diz \"Este é o primeiro da lista\" ou \"Este é o último da lista\".",
    onde: "Extensão → caso aberto a partir de uma lista",
  },
  {
    id: "ext-tentativas-pelo-tipo",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "extensao",
    titulo: "Quantas tentativas o NPS pede, pelo tipo do ciclo",
    texto:
      "O formulário de tentativa da extensão dizia \"Três tentativas em 7 dias autorizam encerrar por falta de retorno\" para todo ciclo. Para o tipo \"Falta de Retorno\" o guia pede cinco — e a ficha da plataforma já contava cinco. Agora a extensão recebe o mínimo do próprio ciclo.",
    onde: "Extensão → NPS → Tentei contato",
  },
  {
    id: "ext-endereco-de-exemplo",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "extensao",
    titulo: "O exemplo de endereço nas Opções é o de produção",
    texto:
      "A tela de Opções sugeria \"https://cw-reputacao.vercel.app\" — um endereço que não é o da plataforma. Quem copiasse o exemplo ficava sem conexão. Agora o exemplo (e a mensagem de endereço inválido) é o de produção, https://cw-rho-eight.vercel.app.",
    onde: "Extensão → Opções",
  },
  {
    id: "ext-telefone-legivel",
    dia: "2026-10-06",
    tipo: "melhoria",
    frente: "extensao",
    titulo: "Telefone legível no cartão do cliente; textos prontos sem o canal repetido",
    texto:
      "O cartão do cliente, na aba Histórico, mostrava o número cru — \"11960599984\". Agora \"(11) 96059-9984\". E na aba Responder cada texto pronto repetia o canal num selo logo abaixo do título (\"WhatsApp — primeiro contato\" e, embaixo, \"WhatsApp\"); o selo só aparece quando o título não diz o canal.",
    onde: "Extensão → conversa → Histórico e Responder",
  },
  {
    id: "ext-leia-me-limites",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "bastidores",
    titulo: "O manual da extensão diz o que vale hoje",
    texto:
      "Os \"limites conhecidos\" do LEIA-ME diziam que o vínculo com o estabelecimento não era gravado e que havia três contas de exemplo; hoje 293 das 371 reclamações têm a conta, pelo CPF ou CNPJ. E diziam que a rotina diária dependia de ligar um agendamento — ela já roda às 6h. O texto conta o estado de agora, inclusive o que falta: o resumo do dia ainda não sai por e-mail.",
  },
  {
    id: "rascunho-sem-em-breve",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "extensao",
    titulo: "O rascunho \"Responder agora\" sem o \"em breve\"",
    texto:
      "O primeiro rascunho das conversas dizia \"te retorno com uma posição em breve\" — e a análise de respostas da própria plataforma marca \"em breve\" como vago, um erro. O rascunho nascia com o defeito que ela aponta. Agora diz \"te dou uma posição ainda hoje\"; como todo rascunho, é para revisar antes de enviar.",
    onde: "Extensão → conversa → textos prontos",
  },
  {
    id: "slack-mencao-nao-e-cliente",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "extensao",
    titulo: "Slack das Redes: a menção a quem atende não vira o cliente",
    texto:
      "A automação do canal escreve \"Olá @Carlos Isaac Cliente Janaina entrou em contato no Instagram…\". O leitor tomava a menção pelo perfil do cliente: os atendimentos nasciam com o cliente \"@Carlos\" e o título \"Olá @Carlos Isaac Cliente…\". Agora a extensão manda as menções da mensagem, o servidor as tira junto com o \"Olá\", reconhece \"Cliente Janaina entrou\" (sem dois-pontos) como nome e não aceita \"Outras\", que é o que a automação escreve quando não sabe. O título passa a ser \"Cliente Janaina entrou em contato no Instagram…\".",
    onde: "Extensão → Slack · Redes Sociais",
  },
  {
    id: "ext-nome-do-contato-no-whatsapp",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "extensao",
    titulo: "O nome do contato no WhatsApp é o nome, e não o subtítulo",
    texto:
      "A extensão lia o nome no primeiro texto com dica do cabeçalho — e no WhatsApp de agora quem tem dica é o subtítulo. Das 30 conversas guardadas, 20 tinham o contato \"clique para mostrar os dados do contato\", 3 \"Conta comercial\", 2 \"online\" e 1 \"ic-person-filled\" (o ícone do avatar). Como o nome também é a chave do painel, ele recarregava a cada \"online\" → \"digitando…\". Agora a leitura pega o primeiro texto do cabeçalho que é nome de verdade, e a conferência do leitor prova seis cabeçalhos diferentes.",
    onde: "Extensão → WhatsApp Web",
  },
  {
    id: "ext-etapa-sem-nome-cortado",
    dia: "2026-10-06",
    tipo: "melhoria",
    frente: "extensao",
    titulo: "Mudar de etapa sem o nome cortado",
    texto:
      "Voltar, avançar e \"outra etapa\" dividiam a mesma linha, e os dois botões cortavam o nome (\"← Aguardand…\", \"Aguardando a…\"). Voltar é raro: virou só a seta, com o nome na dica. O avançar ganhou o espaço e mostra a etapa inteira.",
    onde: "Extensão → cartão do caso",
  },
  {
    id: "ext-agenda-sem-protocolo-repetido",
    dia: "2026-10-06",
    tipo: "melhoria",
    frente: "extensao",
    titulo: "Agenda da extensão sem o protocolo repetido",
    texto:
      "A atividade \"Cobrar retorno de Desenvolvimento — RA-JJ45…\" mostrava o protocolo de novo na linha de baixo, antes do assunto do caso. Quando o título já tem o protocolo, a linha traz só o assunto.",
    onde: "Extensão → aba Agenda",
  },
  {
    id: "ext-nao-informado-fora-dos-titulos",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "extensao",
    titulo: "\"Não informado\" saiu também dos títulos das abas",
    texto:
      "As abas Reclame Aqui e NPS diziam \"RECLAME AQUI · NÃO INFORMADO\" quando a reclamação chegou sem o consumidor. Agora o título fica só com a frente, e o cabeçalho do cliente mostra o telefone da conversa no lugar de \"Sem nome\", com a nota \"a reclamação está sem o nome do consumidor\".",
    onde: "Extensão → abas Cliente, RA e NPS",
  },
  {
    id: "sem-resposta-uma-conta",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "extensao",
    titulo: "\"Sem resposta\" com uma conta só",
    texto:
      "O popup e o Painel da extensão diziam \"5 sem resposta\" — contavam só a coluna Novo —, enquanto o menu da plataforma e o Meu dia diziam 12: a reclamação já \"Em tratativa\", ainda sem resposta no portal, sumia do número da extensão. Agora todos contam a reclamação aberta sem resposta pública: o popup, o Painel, a lista que o número abre, o aviso do sino e as sugestões da conversa. O aviso do sino leva direto à lista filtrada.",
    onde: "Extensão → popup e Painel · sino de avisos",
  },
  {
    id: "ext-selo-de-espera-pelo-nome-certo",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "extensao",
    titulo: "Selo de espera e etiquetas pelo nome certo",
    texto:
      "O selo \"espera 20 min\" da lista do WhatsApp guardava a sua resposta pelo nome da conversa aberta — e lia o subtítulo, igual para toda conversa. A marca de \"já respondida\" nunca casava com a linha. Agora usa o mesmo leitor do nome corrigido, e a linha da lista sem dica de nome também ganha selo e etiqueta.",
    onde: "Extensão → lista de conversas do WhatsApp Web",
  },
  {
    id: "ext-aviso-do-whatsapp-nao-e-fala",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "extensao",
    titulo: "O aviso de criptografia não é mais mensagem do cliente",
    texto:
      "Numa tela só com foto e áudio, o \"As mensagens e ligações são protegidas com a criptografia de ponta a ponta\" e o \"Aguardando mensagem…\" eram guardados como fala do cliente. Agora a extensão os descarta, e o servidor marca como aviso o que chegar assim.",
    onde: "Extensão → Guardar a conversa",
  },
  {
    id: "ext-aba-cliente",
    dia: "2026-10-05",
    tipo: "novo",
    frente: "extensao",
    titulo: "Aba Cliente para voltar à conversa",
    texto:
      "A conversa aberta ganhou aba própria na barra do painel. Antes, voltar a ela dependia de clicar de novo na aba em que você estava — um gesto que ninguém adivinha. Clicar na aba em que você já está agora recarrega aquela tela.",
    onde: "Extensão → barra de abas",
  },
  {
    id: "ext-caso-a-caso",
    dia: "2026-10-05",
    tipo: "novo",
    frente: "extensao",
    titulo: "Caso a caso, sem voltar à lista",
    texto:
      "O caso aberto a partir de uma lista mostra \"‹ 3 de 12 ›\" ao lado do voltar, e as setas ← e → do teclado passam para o anterior ou o próximo. Trabalhar a fila era abrir, registrar, voltar, rolar e abrir o próximo.",
    onde: "Extensão → caso aberto",
  },
  {
    id: "ext-numeros-nas-abas",
    dia: "2026-10-05",
    tipo: "novo",
    frente: "extensao",
    titulo: "Números nas abas",
    texto:
      "RA mostra quantas reclamações esperam resposta ou réplica, NPS quantos ciclos estão fora do prazo e Agenda o que vence hoje ou já venceu — sem abrir a aba. São as mesmas contas do Painel e do popup, atualizadas ao abrir a gaveta.",
    onde: "Extensão → barra de abas",
  },
  {
    id: "ext-painel-move-a-nota",
    dia: "2026-10-06",
    tipo: "novo",
    frente: "extensao",
    titulo: "\"O que move a nota\" no Painel da extensão",
    texto:
      "Logo abaixo da nota do Reclame Aqui, as ações que mais sobem a nota agora, com o número ao lado: \"Responder às 12 sem resposta pública · 8,8 → 9,0\", \"Pedir avaliação às 7 da vez · 8,8 → 8,9\". Um clique abre a tela certa na plataforma. É a mesma conta do Meu dia e do popup.",
    onde: "Extensão → Painel",
  },
  {
    id: "ext-abas-com-icone",
    dia: "2026-10-05",
    tipo: "melhoria",
    frente: "extensao",
    titulo: "Abas com ícone e teclas de 1 a 6",
    texto:
      "Cliente, RA, NPS, Redes, Painel e Agenda com ícone e nome curto — o \"Reclame Aqui\" não sai mais cortado. Com o foco no painel, as teclas 1 a 6 trocam de aba.",
    onde: "Extensão → barra de abas",
  },
  {
    id: "ext-menu-do-cabecalho",
    dia: "2026-10-05",
    tipo: "melhoria",
    frente: "extensao",
    titulo: "Menu ⋯ no cabeçalho",
    texto:
      "Manter aberto, tema, voltar para a lateral, abrir sozinho na conversa, botão no canto, atalhos e opções num lugar só. O rodapé que ocupava uma linha inteira da gaveta saiu, e a gaveta ganhou altura para o que importa.",
    onde: "Extensão → ⋯ no cabeçalho",
  },
  {
    id: "ext-cabecalho-e-icones",
    dia: "2026-10-05",
    tipo: "melhoria",
    frente: "extensao",
    titulo: "Cabeçalho sólido e ícones de traço",
    texto:
      "Sem gradiente e sem emoji como ícone (📌, ◑): os botões viraram ícones de traço que seguem o tema claro e o escuro, no painel e no popup. O botão redondo também perdeu o gradiente.",
    onde: "Extensão",
  },
  {
    id: "ext-agora-sem-formulario",
    dia: "2026-10-05",
    tipo: "melhoria",
    frente: "extensao",
    titulo: "\"Agora\" sem formulário aberto",
    texto:
      "Perguntar, Anotar e Lembrete viraram três botões; o formulário abre no clique, um de cada vez, e fica aberto se a tela se redesenhar. Antes eram dez campos e três botões roxos empilhados em todo atendimento.",
    onde: "Extensão → Cliente → Agora",
  },
  {
    id: "ext-perguntar-direto",
    dia: "2026-10-05",
    tipo: "melhoria",
    frente: "extensao",
    titulo: "Perguntar ao assistente mais direto",
    texto:
      "As perguntas prontas viraram botões e o campo ficou numa linha com o Perguntar ao lado. Uma conversa já em andamento com o assistente abre o painel dele sozinha.",
    onde: "Extensão → Cliente → Agora → Perguntar",
  },
  {
    id: "ext-outro-canal-em-uma-linha",
    dia: "2026-10-05",
    tipo: "melhoria",
    frente: "extensao",
    titulo: "\"Já está em outro canal\" em uma linha",
    texto:
      "O aviso de que o cliente está no Reclame Aqui mas não no WhatsApp virou uma linha com \"Cadastrar aqui\" ao lado — era um aviso âmbar mais um botão roxo da largura da gaveta.",
    onde: "Extensão → Cliente → Agora",
  },
  {
    id: "ext-caso-passos-em-grade",
    dia: "2026-10-05",
    tipo: "melhoria",
    frente: "extensao",
    titulo: "Passos do documento em grade",
    texto:
      "No caso aberto, os passos ficam em dois grupos lado a lado: Registrar (1º contato, tentei contato, mandei atualização, cliente confirmou, pedi a avaliação) e Copiar texto (atualização, pedido de avaliação, #incidentes). Eram oito botões da largura da gaveta, e o relato ficava três rolagens abaixo. O que já foi feito aparece numa linha verde.",
    onde: "Extensão → caso aberto",
  },
  {
    id: "ext-caso-voltar-diz-onde",
    dia: "2026-10-05",
    tipo: "melhoria",
    frente: "extensao",
    titulo: "O voltar diz para onde volta",
    texto:
      "No alto do caso: \"← Reclame Aqui\", \"← Agenda\", \"← Cliente\" — de onde ele foi aberto. O voltar sem rótulo do cabeçalho saiu.",
    onde: "Extensão → caso aberto",
  },
  {
    id: "ext-etapa-em-uma-linha",
    dia: "2026-10-05",
    tipo: "melhoria",
    frente: "extensao",
    titulo: "Mudar de etapa em uma linha",
    texto:
      "Voltar, avançar e \"outra etapa…\" numa linha só. A caixa tracejada \"início do fluxo\", do tamanho de um botão, sumiu — o vizinho ocupa o lugar, e o avançar fica destacado.",
    onde: "Extensão → caso aberto e listas",
  },
  {
    id: "ext-dossie-e-resumo",
    dia: "2026-10-05",
    tipo: "melhoria",
    frente: "extensao",
    titulo: "Dossiê e resumo lado a lado",
    texto:
      "\"Abrir o dossiê\" (na plataforma) e \"Resumo rápido\" (ali mesmo) viraram dois botões pequenos. A análise da IA (\"Ler com calma\" e \"Ler rápido\") perdeu os \"(~10 s)\" do rótulo — o tempo foi para a dica ao passar o mouse.",
    onde: "Extensão → caso aberto",
  },
  {
    id: "ext-relato-recolhido",
    dia: "2026-10-05",
    tipo: "melhoria",
    frente: "extensao",
    titulo: "Relato longo recolhido",
    texto:
      "O relato do consumidor com mais de 700 caracteres abre em oito linhas, com \"ler o relato inteiro\" logo abaixo. O texto inteiro empurrava as anotações para fora da vista.",
    onde: "Extensão → caso aberto",
  },
  {
    id: "ext-marcar-atividade-recolhido",
    dia: "2026-10-05",
    tipo: "melhoria",
    frente: "extensao",
    titulo: "Marcar uma atividade atrás de um botão",
    texto:
      "No Painel e na Agenda, o formulário de atividade abre no clique. Aberto em toda visita, ocupava meia tela. O cartão da agenda também perdeu o \"sem caso ligado\" tracejado.",
    onde: "Extensão → Painel e Agenda",
  },
  {
    id: "ext-outras-frentes-uma-linha",
    dia: "2026-10-05",
    tipo: "melhoria",
    frente: "extensao",
    titulo: "Outras frentes do contato em uma linha",
    texto:
      "Cada frente onde o contato também está (Reclame Aqui, NPS, Redes) virou uma linha clicável com o total e o que está em aberto. Era um cartão de quatro linhas para cada uma.",
    onde: "Extensão → abas RA, NPS e Redes",
  },
  {
    id: "ext-outras-frentes-propria-aba",
    dia: "2026-10-05",
    tipo: "correcao",
    frente: "extensao",
    titulo: "A própria aba não aparece como \"outra frente\"",
    texto:
      "Na aba Reclame Aqui, o bloco \"este contato em outras frentes\" chegava a mostrar o próprio Reclame Aqui, com \"esta aba não os mostra\".",
    onde: "Extensão → abas RA, NPS e Redes",
  },
  {
    id: "ext-nps-sem-reclamacao-falsa",
    dia: "2026-10-05",
    tipo: "correcao",
    frente: "extensao",
    titulo: "NPS sem o \"não tem reclamação\" falso",
    texto:
      "Na aba NPS, um bloco dizia \"este contato não tem reclamação cadastrada\" logo abaixo do cartão da reclamação aberta dele. O bloco do dossiê agora só aparece quando há reclamação.",
    onde: "Extensão → NPS",
  },
  {
    id: "ext-nota-com-virgula",
    dia: "2026-10-05",
    tipo: "correcao",
    frente: "extensao",
    titulo: "Nota com vírgula no painel",
    texto: "O Painel mostrava a nota do Reclame Aqui como \"8.8\". Agora \"8,8\", como no resto da plataforma.",
    onde: "Extensão → Painel",
  },

  {
    id: "ext-textos-do-canal-certo",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "extensao",
    titulo: "Textos prontos do canal certo",
    texto:
      "A aba Responder escolhia os textos só pela categoria: numa reclamação do Reclame Aqui aberta no WhatsApp, o único sugerido era \"NPS — promotor, pedido de indicação\". Agora o texto da pesquisa só aparece com ciclo de NPS aberto, o do direct só para caso das Redes, e a ordem segue a página onde o painel está.",
    onde: "Extensão → Cliente → Responder",
  },
  {
    id: "ext-textos-preenchidos",
    dia: "2026-10-06",
    tipo: "melhoria",
    frente: "extensao",
    titulo: "Textos prontos já preenchidos",
    texto:
      "O texto copiado na aba Responder já sai com o primeiro nome do cliente, o protocolo, quem está atendendo e o estabelecimento. O que só você pode escrever ([SEU NOME], [NOTA]…) aparece avisado embaixo, antes de mandar. Cada texto mostra também o canal para que foi escrito.",
    onde: "Extensão → Cliente → Responder",
  },

  {
    id: "ext-cabecalho-sem-nao-informado",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "extensao",
    titulo: "\"Não informado\" não aparece mais como nome",
    texto:
      "A reclamação que o vigia traz do portal chega sem o nome do consumidor, e o cabeçalho do painel estampava \"Não informado\" em negrito com a conversa da pessoa aberta ao lado. Agora vai o nome do contato, com a observação de que a reclamação está sem o nome.",
    onde: "Extensão → Cliente",
  },

  {
    id: "ext-aba-caso-em-grade",
    dia: "2026-10-06",
    tipo: "melhoria",
    frente: "extensao",
    titulo: "Editar o caso pela extensão, em duas colunas",
    texto:
      "Na aba Caso, responsável e prioridade, categoria e subcategoria, telefone e e-mail ficam lado a lado, e o que falta no cadastro é marcado no próprio campo (\"falta\", com a borda laranja) — eram nove campos empilhados e uma lista \"Falta:\" no alto. Ao salvar, um aviso confirma o protocolo e quantos campos foram gravados, depois da resposta do servidor.",
    onde: "Extensão → Cliente → Caso",
  },

  {
    id: "ext-nps-no-cliente",
    dia: "2026-10-06",
    tipo: "melhoria",
    frente: "extensao",
    titulo: "O ciclo do NPS direto na conversa",
    texto:
      "Quem chega pelo NPS, sem reclamação, via só \"o ciclo do NPS está na aba NPS\" e um botão para ir buscá-lo — justamente na conversa sobre o NPS. Agora o ciclo aberto aparece ali: nota, prazo, etapa, tentativa e pós-contato, além do Perguntar. Com mais de um ciclo, um botão leva aos outros.",
    onde: "Extensão → Cliente (contato do NPS)",
  },
  {
    id: "ext-nps-compacto",
    dia: "2026-10-06",
    tipo: "melhoria",
    frente: "extensao",
    titulo: "Tentativa e pós-contato do NPS atrás de dois botões",
    texto:
      "\"Tentei contato\" e \"Depois do contato\" abrem cada um o seu formulário, um por vez — eram dois cartões abertos com um parágrafo de regra cada. A regra ficou numa linha dentro do que abre (\"três tentativas em 7 dias autorizam encerrar… esta é a 2ª\"). A etapa perdeu a caixa \"início do ciclo\" e o avançar ficou destacado.",
    onde: "Extensão → NPS",
  },

  {
    id: "ext-contato-novo",
    dia: "2026-10-06",
    tipo: "melhoria",
    frente: "extensao",
    titulo: "\"Contato novo\" em vez de \"Nada encontrado\"",
    texto:
      "Uma conversa de quem ainda não está na base abria com \"Nada encontrado\", como se a busca tivesse falhado. Agora diz \"Contato novo\", com o Cadastrar caso e o \"quem é este contato\" logo abaixo. \"Nada encontrado\" ficou para a busca digitada que não acha nada.",
    onde: "Extensão → Cliente",
  },

  /* ---------------- extensão: popup e opções ---------------- */
  {
    id: "popup-abria-rolado",
    dia: "2026-10-05",
    tipo: "correcao",
    frente: "extensao",
    titulo: "O popup abria rolado para o fim",
    texto:
      "Ao clicar no ícone, o popup já abria 800 px para baixo, com a nota fora da vista: o campo de busca, no fim da página, recebia o foco. A busca foi para o topo — é a primeira coisa que se usa — e o foco não rola nada.",
    onde: "Extensão → ícone (popup)",
  },
  {
    id: "popup-curva-meses-fechados",
    dia: "2026-10-05",
    tipo: "correcao",
    frente: "extensao",
    titulo: "Curva da nota só com meses fechados",
    texto:
      "A \"Nota mês a mês\" do popup terminava no mês corrente: no dia 5 de outubro estampava \"2,6 em out/26 · 1 reclamação ▼ 5,5\" — um mês de cinco dias. Agora são os 12 meses fechados, com a mesma conta da tela de Análise: \"8,1 em set/26 · 19 reclamações\".",
    onde: "Extensão → ícone (popup)",
  },
  {
    id: "popup-formato-brasileiro",
    dia: "2026-10-05",
    tipo: "correcao",
    frente: "extensao",
    titulo: "Popup no formato daqui",
    texto:
      "Nota com vírgula (8,8 e não 8.8), janela em dd/mm/aaaa (era 2026-04-01) e o selo RA1000 que aparecia duas vezes lado a lado. O 🎉 das conquistas virou um marcador discreto.",
    onde: "Extensão → ícone (popup)",
  },
  {
    id: "opcoes-sem-promessa-falsa",
    dia: "2026-10-05",
    tipo: "correcao",
    frente: "extensao",
    titulo: "As Opções dizem o que a extensão faz de verdade",
    texto:
      "A página dizia \"mensagem, histórico e mídia não são lidos\" e \"nada é gravado sem você confirmar\" — deixou de ser verdade quando a conversa passou a se guardar sozinha, o vigia passou a pôr reclamações no quadro e o completar passou a gravar ao abrir. Reescrita com o que acontece hoje, inclusive o que continua nunca acontecendo: enviar mensagem ou publicar resposta.",
    onde: "Extensão → Opções",
  },
  {
    id: "opcoes-em-grupos",
    dia: "2026-10-06",
    tipo: "melhoria",
    frente: "extensao",
    titulo: "Opções em quatro grupos",
    texto:
      "Os dez interruptores estavam numa seção só, \"Comportamento\", misturando WhatsApp, Reclame Aqui e avisos. Agora: O painel (abrir sozinho, empurrar a página), No WhatsApp Web (etiquetas, conversas sem resposta), Reclame Aqui (vigia, completar ao abrir) e Avisos (número no ícone, prazos, cobrança das etapas, aviso diário).",
    onde: "Extensão → Opções",
  },
  {
    id: "captura-redes-na-marca",
    dia: "2026-10-06",
    tipo: "melhoria",
    frente: "extensao",
    titulo: "Captura das Redes e botão do Google na cor da marca",
    texto:
      "Na planilha do Google e no Slack, os botões da janela de captura eram pretos, e o \"Registrar no CW\" das avaliações do Google também — diferentes de todo o resto da extensão. Agora são roxos, no claro e no escuro.",
    onde: "Extensão → Planilha do Google, Slack e Google Perfil",
  },
  {
    id: "ext-so-abre-http",
    dia: "2026-10-05",
    tipo: "correcao",
    frente: "bastidores",
    titulo: "A extensão só abre endereços da web",
    texto:
      "O painel podia pedir para abrir em aba nova qualquer endereço, inclusive data: e javascript:. Agora só http e https — o popup já fazia assim; o painel passava direto.",
    onde: "Extensão",
  },

  /* ---------------- plataforma ---------------- */
  {
    id: "lembrete-com-nome-certo",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "plataforma",
    titulo: "Lembrete da conversa sem \"clique para mostrar os dados do contato\"",
    texto:
      "Os lembretes que nascem das conversas guardadas (\"Retorno combinado com…\", \"Pedido de…\", \"Reunião com…\") levavam o nome gravado da conversa — que em 20 delas era o subtítulo do WhatsApp. Agora só entra nome de verdade; sem ele, o título fica \"Retorno combinado: …\".",
    href: "/agenda",
  },
  {
    id: "conversas-nome-e-ultima-fala",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "plataforma",
    titulo: "Conversas com o nome certo e a última fala de verdade",
    texto:
      "A lista de Conversas mostrava \"clique para mostrar os dados do contato\" em 20 conversas e, em várias, o aviso de criptografia como última mensagem — o aviso não tem hora, e o banco põe o que não tem hora primeiro na ordem decrescente. Por isso \"Esperando a gente\" dizia 12 quando eram 6. Agora o nome falso dá lugar ao estabelecimento, ao cliente do NPS ou ao telefone formatado (+55 67 98289-1760); os avisos são lidos como avisos, e a conversa guardada de novo recebe o nome certo.",
    href: "/conversas",
  },
  {
    id: "conversas-na-ficha-e-no-dossie",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "plataforma",
    titulo: "Conversas certas também na ficha do caso e no dossiê",
    texto:
      "A lista de Conversas já tinha o nome e a última fala corrigidos, mas o bloco \"Conversas do WhatsApp\" da ficha do caso lia por outro caminho: mostrava \"clique para mostrar os dados do contato\" e, como última mensagem da cliente, \"Aguardando mensagem. Essa ação pode levar alguns instantes\". O dossiê, que sustenta um pedido diante de terceiro, levava junto o aviso de criptografia como fala e assinava cada fala da cliente com o nome falso. Agora a ficha, o dossiê, o resumo por IA, o Radar, o cancelamento e a análise de respostas usam o nome de verdade (ou o telefone) e deixam os avisos do WhatsApp de fora.",
    href: "/conversas",
  },
  {
    id: "exportar-metricas-voltou",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "plataforma",
    titulo: "Exportar a Planilha de Métricas voltou a funcionar",
    texto:
      "O botão respondia \"Intervalo de datas inválido\" para qualquer período: a conferência da data tinha perdido as barras numa edição e só aceitava o texto literal \"dddd-dd-dd\". No mesmo tipo de defeito, a exportação da conversa trocava cada \"s\" do resumo por espaço (\"Re umo salvo\"), e a prova de envio dos disparos da extensão não juntava os espaços.",
    href: "/analytics",
  },
  {
    id: "nps-tentativa-em-um-clique",
    dia: "2026-10-06",
    tipo: "novo",
    frente: "nps",
    titulo: "Tentativa de contato registrada em um clique",
    texto:
      "\"O que aconteceu\" é obrigatório porque é o que sustenta encerrar por falta de retorno — e virou pedágio: das 118 tentativas gravadas, 33 diziam só \".\" e 72 \"não tive retorno\" ou \"tentativa de contato feita\". Agora o campo traz atalhos do canal escolhido (\"Caixa postal\", \"Número errado\", \"Mensagem não entregue\", \"Visualizou e não respondeu\"…); um clique preenche, outro soma. O mesmo na extensão. Texto sem letra nem número deixou de passar, e os \".\" que já estavam gravados não aparecem mais como anotação.",
    href: "/nps",
    onde: "Ficha do NPS → Tentei contato · Extensão → NPS → Tentei contato",
  },
  {
    id: "nps-analise-numeros",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "nps",
    titulo: "Análise do NPS: média com uma casa e nada de \"0%\" para quem existe",
    texto:
      "Na tabela da tendência a média aparecia \"9\" logo abaixo de \"9,1\", como se fosse outra escala; agora é sempre \"9,0\". E nas barras de tipo e causa, 2 respostas em 4 mil apareciam como \"(0%)\" — como se fossem nenhuma. Agora dizem \"(< 0,1%)\". Vale para todas as barras da plataforma.",
    href: "/nps/analise",
  },
  {
    id: "nps-quatro-frentes-sem-o-proprio",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "nps",
    titulo: "\"Nas quatro frentes\" não conta o próprio ciclo",
    texto:
      "Na ficha do NPS, o bloco que mostra o cliente nas outras frentes listava o ciclo aberto na tela como \"NPS · 1 em aberto\" — parecia que havia outro esperando. Agora ele fica de fora, e a frente diz \"Nenhum além deste\" quando é o único.",
    href: "/nps",
  },
  {
    id: "nps-coluna-encerrado",
    dia: "2026-10-06",
    tipo: "melhoria",
    frente: "nps",
    titulo: "A coluna \"Encerrado\" diz para que serve",
    texto:
      "No filtro \"Em aberto\" a coluna fica vazia e dizia só \"Ciclo fechado.\". Agora explica o gesto: solte um cartão ali para encerrar, e a ficha abre para escolher o desfecho.",
    href: "/nps",
  },
  {
    id: "mostrar-mais-faltam",
    dia: "2026-10-06",
    tipo: "melhoria",
    frente: "plataforma",
    titulo: "\"Mostrar mais 40 · faltam 253\"",
    texto:
      "O botão das listas longas dizia \"Mostrar mais 40 de 253\" — lido como 40 de um total de 253, quando 253 era o que faltava. Agora diz \"faltam\", e no último lote \"Mostrar os 9 restantes\". Nos quadros e listas do Reclame Aqui e do NPS, nas categorias, no prêmio e nos itens da atividade.",
  },
  {
    id: "prazos-da-documentacao-em-todo-lugar",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "reclame-aqui",
    titulo: "Prazo de verdade em todo caso: os da documentação, enquanto nada for cadastrado",
    texto:
      "Nenhuma regra de prazo está cadastrada em Processos. O Meu dia já usava, nesse caso, os prazos da documentação (a tabela de criticidade do Reclame Aqui e o 1º contato das Redes) e dizia \"19 do Reclame Aqui fora do prazo\" — mas a ficha de cada um desses casos, o quadro, o painel da extensão, o \"Pede ação agora\" e Processos diziam \"Sem prazo\". A mesma reclamação estava atrasada e em dia ao mesmo tempo. Agora a regra vale dentro do próprio relógio: Processos passou de 0 para 13 fora do prazo (o mais antigo com a solução atrasada 37 dias úteis), e o \"Pede ação agora\" conta os casos junto do NPS. Cadastrar regras em Processos continua valendo por cima.",
    href: "/processos",
  },
  {
    id: "prazos-estourados-de-onde",
    dia: "2026-10-06",
    tipo: "melhoria",
    frente: "plataforma",
    titulo: "\"201 prazos estourados\" diz de onde vêm",
    texto:
      "O aviso do Meu dia somava NPS e casos num número só, e logo abaixo o plano falava em 108 do NPS e 19 do Reclame Aqui — ninguém sabia o que somava com o quê. Agora diz \"188 do NPS e 13 casos\", e explica que os atrasados vão na frente do plano na cota de cada dia (antes prometia que todos estavam na frente).",
    href: "/meu-dia",
  },
  {
    id: "clientes-nao-informado",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "plataforma",
    titulo: "\"Não informado\" não é um cliente",
    texto:
      "A lista de Clientes juntava pelo nome, e as reclamações que chegaram sem o consumidor viravam um cliente \"Não informado\" com três reclamações abertas — três pessoas diferentes. Agora ficam fora da lista (continuam no Reclame Aqui, com o aviso de dados incompletos), e nem a ficha do caso nem a extensão oferecem \"Ver cliente\" para quem não tem nome.",
    href: "/clientes",
  },
  {
    id: "jornada-quadro-em-lotes",
    dia: "2026-10-07",
    tipo: "melhoria",
    frente: "plataforma",
    titulo: "Quadro da Jornada desenha 30 clientes por etapa, e não mil",
    texto:
      "O ciclo de vida desenhava todos os clientes de uma vez — só \"Primeiro contato\" passava de 800 cartões, quase 15 mil elementos na tela, e arrastar um cliente engasgava. Cada etapa agora mostra 30 e um \"Mostrar mais 30 · faltam 808\" embaixo; o número no topo da coluna continua sendo o total, e o cliente aberto ao lado fica à vista mesmo além do lote. A tela caiu para menos de 3 mil elementos, e a separação por etapa passou a ser feita numa passada só.",
    href: "/jornada",
  },
  {
    id: "fluxo-diz-o-que-conta-como-aberto",
    dia: "2026-10-07",
    tipo: "melhoria",
    frente: "reclame-aqui",
    titulo: "Configurar fluxo diz se cada etapa conta como aberta ou sai da fila",
    texto:
      "A fila do Reclame Aqui dizia \"22 em aberto\" e, entre os chips, \"Finalizado 4\". Não é erro de conta: só Aguardando avaliação, Resolvido e Não resolvido tiram o caso da fila, e toda etapa criada no fluxo conta como aberta — de propósito, para nenhuma etapa nova sumir dos indicadores. Mas isso não aparecia em lugar nenhum. Agora cada etapa mostra \"conta como aberta\" ou \"sai da fila\", e uma etapa cujo nome soa como fim (Finalizado, Encerrado, Concluído…) mas conta como aberta ganha um aviso: os casos nela seguem na fila, nos prazos e no \"sem resposta\".",
    href: "/reclame-aqui/configuracoes?tab=status",
  },
  {
    id: "plural-quando-e-um",
    dia: "2026-10-07",
    tipo: "correcao",
    frente: "plataforma",
    titulo: "Quando é um, a frase fica no singular",
    texto:
      "Uma varredura nos textos montados com número achou onze que saíam como \"Existem 1 reclamações sem resposta pública\", \"1 dos 5 casos em aberto estão fora do prazo\", \"Só 1 avaliações na aba de 6 meses\", \"todos os 1 detratores do ciclo\", \"1 mensagens numa conversa nova\", \"setembro: 1 reclamações\", \"1 dias não utilizados\" ou, na extensão, \"lendo 1 mensagens…\". Agora concordam: no Assistente (sem resposta, fora do prazo, risco de cancelamento e há quantos dias a mais antiga está parada — \"de hoje\" quando é do dia), no relatório do ciclo, nas metas do ciclo, na importação de conversa, na previsão de reclamações, na renegociação, no plano do mês e no resumo da conversa da extensão.",
  },
  {
    id: "saude-dos-dados",
    dia: "2026-10-07",
    tipo: "novo",
    frente: "plataforma",
    titulo: "Saúde dos dados: o que na base está errado e mexe nos números, com o caminho para corrigir",
    texto:
      "Em Configurações → Cadastros, um painel novo confere a base a cada abertura e aponta o que distorce alguma conta: mensalidade fora de escala (a Kantinho Burger com R$ 20.999, sobra do bug do ×100), conta com plano que não existe na tabela (238 no \"Essencial\"), caso aberto com o responsável de teste, atendimento das Redes com a menção do Slack no lugar do cliente, resposta pública sem data, etapa com nome de fim que conta como aberta (\"Finalizado\", 4 casos), causa raiz sem nome de verdade e atividade com o texto do WhatsApp no título. Cada achado diz por que importa, o que fazer e leva direto ao registro. Nada é corrigido sozinho — quem administra decide, e o painel só aparece para administrador.",
    href: "/configuracoes",
  },
  {
    id: "prazos-estourados-batem-com-o-plano",
    dia: "2026-10-07",
    tipo: "correcao",
    frente: "nps",
    titulo: "\"Prazos estourados\" do NPS batem com o plano de recuperação: 108, e não 147",
    texto:
      "No Meu dia, o aviso dizia \"160 prazos estourados — 147 do NPS e 13 casos\" logo acima do plano de recuperação com \"110 NPS fora do prazo\"; o popup da extensão somava os mesmos 147. A diferença eram 38 ciclos com mais de 30 dias sem nenhuma resposta: a regra do guia já autoriza encerrá-los como Sem Retorno, e a rotina da madrugada faz isso (50 por noite, e tem fechado 50 — o acumulado está sendo escoado). Não há mais prazo de 1º contato a cumprir neles, e o plano já não os contava. Agora o aviso e o popup também não: 108 vencidos e 2 vencendo hoje. E a rotina passou a encerrar do mais antigo para o mais novo; antes pegava os elegíveis sem ordem.",
    href: "/meu-dia",
  },
  {
    id: "sem-resposta-uma-regra",
    dia: "2026-10-07",
    tipo: "correcao",
    frente: "reclame-aqui",
    titulo: "\"Sem resposta\" com o mesmo número em todo lugar: 12, e não 13",
    texto:
      "O Meu dia mostrava \"Respostas públicas 0/13 — zerar a fila: 13 ainda sem resposta\" logo acima de \"Responder às 12 sem resposta pública\". A 13ª era uma reclamação já fechada, avaliada como não resolvida sem resposta nossa: não há mais o que responder nela. A meta do ciclo, a meta do dia, o relatório (\"sem resposta agora\"), o Dashboard e o Assistente contavam qualquer reclamação sem texto de resposta — fechada ou aberta, e o Assistente ainda somava atendimentos das Redes, que nunca têm resposta pública. Agora existe uma regra só, usada por todos que pedem ação: reclamação do Reclame Aqui, aberta e sem resposta pública. A conta da nota segue o portal e continua considerando a fechada. Uma conferência nova prova contra o banco que todos dizem o mesmo número.",
    href: "/meu-dia",
  },
  {
    id: "celular-e-leitor-de-tela-34-telas",
    dia: "2026-10-07",
    tipo: "melhoria",
    frente: "plataforma",
    titulo: "34 telas conferidas no celular e no leitor de tela",
    texto:
      "Cada tela foi aberta com 375 px de largura (um celular comum) e vasculhada atrás de rolagem lateral e de qualquer elemento passando da borda: nenhuma das 34 vazou. Na mesma varredura, a procura por botão sem nome e campo sem rótulo achou 13 telas com campos que o leitor de tela anunciava só como \"caixa de texto\": as buscas do quadro do RA, do NPS, de Clientes, Estabelecimentos, Respostas prontas e Times; os filtros de etapa, categoria e tipo; o limite WIP do fluxo; o mês e os números manuais das Métricas diárias; os campos dos tipos de Impacto; os tópicos da Jornada; a pergunta ao Assistente; e o texto editável do Meu dia e do Relatório. Todos ganharam nome.",
  },
  {
    id: "novidades-com-data",
    dia: "2026-10-07",
    tipo: "melhoria",
    frente: "plataforma",
    titulo: "Novidades mostram o dia de cada mudança, a mais nova primeiro",
    texto:
      "Com mais de cem itens, não dava para saber o que tinha entrado hoje: cada mudança já guardava o dia, mas a tela não mostrava, e a ordem dentro de cada frente dependia de onde o item foi escrito. Agora o dia aparece ao lado do selo (Corrigido, Melhorou, Novo) e cada frente começa pelo mais recente.",
    href: "/novidades",
  },
  {
    id: "conferido-em-producao",
    dia: "2026-10-07",
    tipo: "melhoria",
    frente: "bastidores",
    titulo: "Conferido no modo produção: build limpo, 66 tentativas de invasão barradas, telas em menos de 0,3 s",
    texto:
      "O build de produção (o mesmo que a Vercel roda) passou limpo: TypeScript sem erro e 61 páginas geradas. Com ele no ar localmente, o teste que tenta entrar indevidamente por cada porta — sem sessão, com sessão falsificada ou vencida, conta desativada, token de API errado, cadastro, conexão do Google — teve as 66 tentativas recusadas, já com a porta nova (proxy). Todas as telas abriram com conteúdo, de 85 a 280 ms; as leituras do Meu dia levam 425 ms e o NPS inteiro, 1,2 s. A lentidão que aparece no computador de desenvolvimento é a compilação do modo dev, não a aplicação. Também rodaram as 20 conferências que gravam no banco com dado descartável — casos, histórico, edição simultânea, mover, tratativa, cadastros, exclusão, importações, NPS, duas etapas, freio de login, vigia e o contrato da extensão — e todas passaram; as tabelas foram contadas antes e depois e ficaram idênticas. Uma delas acusava erro por usar um nome antigo de categoria (\"Cobrança\", que desde a unificação vira Financeiro) e foi atualizada. Só duas ficaram de fora de propósito: a que roda a rotina da madrugada inteira (mexeria em ciclos reais e no Wootric) e a que altera um estabelecimento real.",
  },
  {
    id: "middleware-vira-proxy",
    dia: "2026-10-07",
    tipo: "melhoria",
    frente: "bastidores",
    titulo: "A porta de entrada segue a convenção nova do Next 16",
    texto:
      "O arquivo que confere a sessão antes de cada tela se chamava \"middleware\", nome que o Next 16 descontinuou — a cada subida do servidor vinha o aviso. Virou \"proxy\", com a mesma regra: sem sessão, as telas mandam para o login e a API responde 401; com sessão, a tela de login manda para o Meu dia. Conferido por fora logo depois da troca.",
  },
  {
    id: "lint-de-volta",
    dia: "2026-10-07",
    tipo: "correcao",
    frente: "bastidores",
    titulo: "A revisão de código automática voltou a rodar inteira",
    texto:
      "O \"npm run lint\" parava logo no começo com \"could not find plugin react-hooks\": a regra do React valia também para os scripts .cjs de conferência, que o Next não cobre. A regra passou a valer só onde o plugin existe, e os scripts .cjs ganharam a mesma exceção dos .js de linha de comando. Resultado: o projeto inteiro em 1 minuto, 0 erros e 0 avisos — os dois avisos antigos eram exceções de propósito (o contexto dos casos e a importação automática do Wootric) e ganharam o motivo escrito ao lado, conferido que nenhuma lia valor velho. E uma conferência nova, \"check:tema-escuro\", impede que um tom de texto forte entre sem a versão escura.",
  },
  {
    id: "texto-crase-e-busca-do-popup",
    dia: "2026-10-07",
    tipo: "correcao",
    frente: "extensao",
    titulo: "\"Responder às 12\", com crase, e a busca do popup sem texto cortado",
    texto:
      "A alavanca do dia dizia \"Responder as 12 sem resposta pública\" — responder pede \"a\", e \"a + as\" é \"às\". Corrigido ali (popup, Meu dia e painel), na dica do assistente e no passo 3 da Calculadora. E o campo de busca do popup cortava o próprio texto de ajuda (\"…nome ou protoco\"); agora diz só \"Telefone, nome ou protocolo\", como no painel.",
    onde: "Extensão → popup; Meu dia; Calculadora",
  },
  {
    id: "vazio-falso-agenda-e-cadastros",
    dia: "2026-10-07",
    tipo: "correcao",
    frente: "plataforma",
    titulo: "Agenda e cadastros não dizem mais \"nada\" enquanto carregam",
    texto:
      "Uma varredura nova fotografou o texto de 23 telas durante a carga e comparou com o final: frase de vazio que aparece e depois some é vazio falso. Além de Causas raiz, ela achou a Agenda (\"Nada marcado e nenhum prazo vencendo neste dia\" antes de os compromissos chegarem) e as cinco listas de Configurações — categorias, subcategorias, checklist, etiquetas e times —, que diziam \"Nenhum… encontrado\" nos primeiros segundos. Todas passam a mostrar as linhas de carregando até os dados chegarem.",
    href: "/agenda",
  },
  {
    id: "causas-semana-e-voz",
    dia: "2026-10-07",
    tipo: "correcao",
    frente: "plataforma",
    titulo: "Causas raiz: \"A semana\" espera os dados, e a Voz do cliente cita o cliente",
    texto:
      "Ao abrir a tela, as quatro frentes de \"A semana: o que subiu\" diziam \"Nada classificado nesta semana\" por alguns segundos — e então aparecia a causa da semana. Agora o quadro mostra que está carregando até as reclamações, o NPS e o Google chegarem. Na \"Voz do cliente para o Produto\", a frase das Redes era a mensagem da automação do Slack (\"Olá @Carlos Isaac Cliente Janaina entrou em contato…\"), que é como os atendimentos antigos ficaram gravados; a citação passa a sair sem a menção e sem o \"Olá\", do mesmo jeito que a captura nova já grava.",
    href: "/causas-raiz",
  },
  {
    id: "clientes-estabelecimentos-em-lotes",
    dia: "2026-10-07",
    tipo: "melhoria",
    frente: "plataforma",
    titulo: "Clientes e Estabelecimentos abrem com 60 cartões e \"mostrar mais\"",
    texto:
      "As duas grades desenhavam a base inteira de uma vez — 244 estabelecimentos e cerca de 300 clientes, de 9 a 10 mil elementos na tela, o que pesava ao rolar e ao filtrar. Agora entram 60 e um \"Mostrar mais 60 · faltam 184\" no fim. Busca, filtros, ordenação e os números do topo continuam valendo para a base toda.",
    href: "/estabelecimentos",
  },
  {
    id: "respostas-nome-e-seu-nome",
    dia: "2026-10-07",
    tipo: "melhoria",
    frente: "plataforma",
    titulo: "Respostas prontas: [NOME] e [SEU NOME] já saem preenchidos",
    texto:
      "Os textos de WhatsApp foram escritos com colchete — \"Oi, [NOME]! Aqui é o [SEU NOME]\" — e só {{cliente}} era trocado sozinho. Com o caso aberto, a pessoa apagava o colchete e digitava um nome que estava na tela. Agora [NOME] sai com o primeiro nome do consumidor e [SEU NOME] com o primeiro nome de quem está escrevendo, no atalho de respostas da extensão e na resposta pública do caso. Sem o nome, o colchete fica e o aviso de \"faltam trechos\" continua cobrando; [NOTA] e os pedidos longos seguem para você escrever.",
    href: "/base-conhecimento",
  },
  {
    id: "escuro-texto-forte",
    dia: "2026-10-07",
    tipo: "correcao",
    frente: "plataforma",
    titulo: "No tema escuro, cinco tons de texto que sumiam voltaram a aparecer",
    texto:
      "O título \"Lembretes de segurança\" em Ferramentas e acessos era marrom-escuro sobre fundo escuro — o aviso estava lá e não se lia. A causa era geral: o tom mais forte de âmbar, verde, violeta e o azul dos quadros de destaque não tinham versão escura. Uma varredura em todas as telas achou os cinco e todos ganharam a inversão: os quadros de destaque da Documentação, o guia do encerramento do NPS, o roteiro do Primeiro acesso, a chance de cancelar na Retenção e o balão das nossas mensagens nas Conversas.",
    href: "/ferramentas",
  },
  {
    id: "mensalidade-x100",
    dia: "2026-10-07",
    tipo: "correcao",
    frente: "plataforma",
    titulo: "Abrir e salvar um estabelecimento não multiplica mais a mensalidade por 100",
    texto:
      "O formulário de estabelecimento abria a mensalidade como \"209.99\" e, ao salvar, tratava o ponto como milhar: bastava abrir e salvar, sem mexer no valor, para R$ 209,99 virar R$ 20.999. Aconteceu com a Kantinho Burger, que passou a ser sozinha toda a \"receita recorrente\" e toda a \"receita em risco\" da tela. Agora o campo abre como \"209,99\", e a leitura entende \"209.99\" digitado com ponto como decimal — no estabelecimento, no Impacto e no preço dos Planos, que tinham a mesma conta. O valor já gravado da Kantinho Burger continua R$ 20.999 até alguém corrigir na ficha. E o aviso de reclamações sem estabelecimento passou a dizer que o vínculo se faz sozinho pelo CPF ou CNPJ — mandava vincular caso a caso.",
    href: "/estabelecimentos",
  },
  {
    id: "jornada-sem-nota-nao-e-detrator",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "plataforma",
    titulo: "Jornada: quem não deu nota não é detrator",
    texto:
      "O cliente sem nenhuma nota — nem no Reclame Aqui, nem no NPS, nem no Google — ficava com média 0 e entrava como \"Detrator\". A Jornada contava 218 detratores; 79 eram só quem ainda não avaliou. Agora são 139, e o cartão desse cliente não mostra mais \"★ 0\", que parecia uma nota péssima. A reclamação não avaliada também deixou de pesar na média. E o quadro mostra linhas pulsando enquanto carrega, em vez de \"Nenhum cliente\" em todas as colunas.",
    href: "/jornada",
  },
  {
    id: "analytics-espera-a-base",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "plataforma",
    titulo: "Analytics, Impacto e Projetos também esperam os dados",
    texto:
      "A Análise da operação abria com \"0 de 0 casos no recorte\", \"Nenhum responsável atribuído ainda\", \"Sem dados para exibir\" e \"Nenhuma causa raiz marcada nos últimos 90 dias\" — o Impacto, com \"Nenhum tipo cadastrado\", e o quadro de Projetos, com \"Nenhuma iniciativa\" em todas as colunas. Uma amostragem do que cada tela mostra no primeiro instante, comparada com o que mostra depois, achou os dois; agora esperam a base. As outras 25 telas amostradas já não afirmavam nada antes da hora.",
    href: "/analytics",
  },
  {
    id: "meu-dia-nao-afirma-na-carga",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "plataforma",
    titulo: "O Meu dia e o Dashboard não dizem \"nada pendente\" antes de saber",
    texto:
      "Nos primeiros segundos, o Meu dia dizia \"Nada vencendo, ninguém parado e nenhum sinal de crise\", \"Nada pendente que mova a nota\" e a conquista \"Nenhum prazo estourado\" — com 188 prazos estourados, que apareciam depois. O Dashboard fazia o mesmo com \"Nenhum caso crítico em aberto\", \"Nada pendente para hoje\" e \"Nenhum resultado financeiro\"; a Agenda, Clientes, Estabelecimentos, Impacto, Respostas prontas e Processos, com as listas vazias. Agora cada bloco mostra linhas pulsando até os dados chegarem, e só então diz o que tem — ou que não tem.",
    href: "/meu-dia",
  },
  {
    id: "vence-hoje-concordancia",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "plataforma",
    titulo: "\"e mais 1 vence ainda hoje\"",
    texto:
      "O aviso de prazos dizia \"e outros 1 vencem ainda hoje\" e \"1 prazo vencem hoje\". Agora concorda com o número, aqui e no que o assistente lê sobre o dia.",
    href: "/meu-dia",
  },
  {
    id: "telefone-legivel-nas-fichas",
    dia: "2026-10-06",
    tipo: "melhoria",
    frente: "plataforma",
    titulo: "Telefone legível nas fichas",
    texto:
      "A ficha do caso, a do cliente, a do estabelecimento, a conversa guardada, a importação, o disparo em lote e a campanha do Prêmio mostravam o número como estava gravado — \"11960599984\", \"+5511960599984\". Agora \"(11) 96059-9984\" e \"+55 11 96059-9984\". O mascarado da base e o de outro país ficam como vieram.",
  },
  {
    id: "indicadores-sem-zero-na-carga",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "plataforma",
    titulo: "Nenhum indicador diz \"0\" enquanto carrega",
    texto:
      "Nos primeiros segundos de cada tela os números apareciam zerados: o Dashboard abria com \"0/10 · Não recomendada\", o NPS com \"0 respostas\" e \"0 fora do prazo\", a Agenda com \"0 de 0\". Quem olhava primeiro acreditava. Agora o lugar do número pulsa até o dado chegar — em 13 telas: Dashboard, Reclame Aqui, NPS, Redes Sociais, Agenda, Clientes, Estabelecimentos, Impacto, Jornada, Processos, Projetos, Base de conhecimento e Analytics. A nota do Reclame Aqui aparece na hora quando o número do portal já está gravado.",
    href: "/dashboard",
  },
  {
    id: "ficha-carregando-nao-e-inexistente",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "plataforma",
    titulo: "Ficha de cliente e de estabelecimento não acusa \"não encontrado\" na carga",
    texto:
      "Abrir o link de um cliente ou de um estabelecimento num navegador recém-aberto mostrava \"Cliente não encontrado\" até a base chegar — e quem estava com pressa voltava. Agora diz \"Carregando o cliente…\" e só acusa a ausência depois que a base inteira chegou, como a ficha do caso já fazia.",
    href: "/clientes",
  },
  {
    id: "nps-sem-tratativa-explicado",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "nps",
    titulo: "O filtro \"Sem tratativa\" explicado como é",
    texto:
      "A dica do filtro dizia \"promotores sem comentário: não abrem ciclo\" — regra que deixou de existir em 05/10, quando todo promotor passou a entrar na fila. Agora diz o que o filtro mostra: as respostas encerradas em lote, sem ninguém atender, que contam no NPS e não estão na fila.",
    href: "/nps",
  },
  {
    id: "plural-de-verdade",
    dia: "2026-10-05",
    tipo: "melhoria",
    frente: "plataforma",
    titulo: "\"1 reclamação\" e \"5 reclamações\", nunca \"reclamação(ões)\"",
    texto:
      "Mais de 440 textos em 132 telas, avisos, relatórios e respostas do assistente usavam o plural com parênteses — \"2 caso(s)\", \"1 detrator(es)\", \"3 dia(s)\". Agora cada um usa o número que está ao lado: \"1 caso\", \"2 casos\".",
  },
  {
    id: "ficha-aba-triagem",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "reclame-aqui",
    titulo: "A ficha manda para a aba que existe",
    texto:
      "Os textos da ficha e do Analytics mandavam para \"a aba Investigação\", que se chama Triagem desde a tela de triagem; o cartão dentro dela também. E o bloco de contatos mostrava \"Nenhum contato registrado\" e \"Carregando contatos…\" ao mesmo tempo — o segundo só aparece agora quando há contato a carregar.",
  },
  {
    id: "ra-telas-esperam-a-base",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "reclame-aqui",
    titulo: "As telas do Reclame Aqui não mostram nota zero enquanto carregam",
    texto:
      "Nos primeiros segundos, o Índice pintava \"Não recomendada · 0\" e escrevia \"Resposta em 0%: meta cumprida\" e \"Mais 50 avaliações para o mínimo de 50\" — antes de virar \"RA1000 · 8,8\". A Análise, os Gráficos, a Calculadora, a Triagem e o Pedir avaliação faziam o mesmo com os seus números. Agora as seis esperam a base com \"Carregando as reclamações…\" e só então mostram a conta.",
    href: "/reclame-aqui/indice",
  },
  {
    id: "pesos-da-nota-certos",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "reclame-aqui",
    titulo: "Os pesos da nota explicados como a conta faz",
    texto:
      "A fórmula da plataforma é a oficial — resposta 20%, média das notas 30%, solução 30%, voltaria 20% —, mas os textos diziam outra coisa. O assistente de IA recebia \"nota do consumidor 20%\" e \"voltaria 30%\", trocados, e aconselhava em cima disso. O Meu dia e a análise de respostas diziam \"solução e voltaria pesam 30% cada\". E a aba Avaliação e o histograma diziam \"notas de 7 a 10 contam como promotor no cálculo\", corte que só existe como palpite na Calculadora. E cinco lugares — o Dashboard, o painel do Reclame Aqui, a aba Avaliação, o aviso do sino e a sugestão da extensão — chamavam a resposta pública de \"o item de maior peso na nota\"; ela pesa 20%, e o que vale dizer é que é o único item que depende só de nós. Agora todos dizem o que a conta usa, e o assistente lê os pesos da mesma constante do cálculo.",
  },
  {
    id: "checklist-de-verdade",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "reclame-aqui",
    titulo: "O checklist de resolução grava e enxerga o caso",
    texto:
      "As marcas do checklist viviam só na tela: marcar e recarregar perdia tudo, e nada foi gravado até hoje. Ele também não enxergava o caso — \"Cliente contatado: pendente\" com o 1º contato registrado na mesma ficha —, dizia \"Concluído por\" o dono do caso fosse quem fosse que marcou, e dava tudo como cumprido só porque o caso estava encerrado. Agora o que o caso registra marca sozinho, dizendo de onde (\"Pelo registro: 1º contato registrado\", \"causa raiz: Atendimento\"), e não se desmarca à mão; o resto, como \"Reclamação original lida\", vai para o banco com quem marcou e quando. Na reclamação conferida, foi de 0 para 3 de 8.",
    onde: "Ficha do caso → Triagem → Checklist de resolução",
  },
  {
    id: "prazo-venceu",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "reclame-aqui",
    titulo: "\"Venceu\", e não \"Vence\", para prazo que já passou",
    texto:
      "Em Criticidade e prazo, um caso com a solução atrasada 38 dias úteis mostrava \"Vence qui, 13/08\" — como se fosse adiante. Agora diz \"Venceu\", em vermelho.",
  },
  {
    id: "historico-de-trocas",
    dia: "2026-10-06",
    tipo: "novo",
    frente: "reclame-aqui",
    titulo: "O histórico do caso diz quem trocou o responsável e a etapa",
    texto:
      "Três reclamações reais apareceram com o usuário de teste \"Conferência\" como responsável, e não havia como saber desde quando nem por quem: o histórico do caso era montado só das datas, das movimentações e dos contatos. A tabela de eventos existia no banco e nada gravava nela. Agora toda troca de responsável ou de etapa — pela ficha, pelo quadro ou pela extensão — fica no Histórico, com \"de → para\" e quem trocou. Vale daqui para a frente.",
    onde: "Ficha do caso → Histórico",
  },
  {
    id: "ra-respondida-nao-e-encerrado",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "reclame-aqui",
    titulo: "Caso respondido e ainda aberto não aparece como \"Encerrado\"",
    texto:
      "Na Triagem e no quadro, a reclamação aguardando a nossa réplica mostrava o relógio como \"Encerrado\" logo acima de \"O consumidor respondeu no portal: responda a réplica\". O relógio para quando há resposta pública, mas o caso não acabou: agora diz \"Respondida no portal\", e \"Encerrado\" fica para o que está de fato encerrado.",
    href: "/reclame-aqui/triagem",
  },
  {
    id: "ra-protocolo-como-e",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "reclame-aqui",
    titulo: "Protocolo com a grafia do portal em toda tela",
    texto:
      "O protocolo do Reclame Aqui distingue maiúscula de minúscula (RA-7nIYAcGmxS9RRgYD). Em \"Pedir avaliação\" ele aparecia todo em maiúsculas — RA-MPDZCGFW-TNKWAZI —, diferente das outras telas e do portal, e assim também no título da prova de uma conversa. Agora aparece como é.",
    href: "/reclame-aqui/avaliacoes",
  },
  {
    id: "ra-idade-no-plural",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "reclame-aqui",
    titulo: "\"5 meses\", e não \"5 mês\"",
    texto:
      "A idade curta dos cartões do quadro e da Triagem dizia \"5 mês\" e \"2 ano\". Continua curta para caber, agora no plural certo.",
    href: "/reclame-aqui",
  },
  {
    id: "ra-uma-lista-de-telas",
    dia: "2026-10-06",
    tipo: "melhoria",
    frente: "reclame-aqui",
    titulo: "As telas do Reclame Aqui numa lista só, numa fileira só",
    texto:
      "As abas do módulo eram 12 em duas fileiras, e o menu lateral tinha outra lista, com itens diferentes — Categorias só no menu; Triagem, Índice e Respostas só nas abas. Agora as duas mostram as mesmas 13 telas, na mesma ordem, agrupadas em Trabalhar, Acompanhar e Ajustar. As abas cabem numa fileira e rolam de lado na tela estreita, com a aba aberta sempre à vista.",
    href: "/reclame-aqui",
  },
  {
    id: "ra-cartao-mais-limpo",
    dia: "2026-10-06",
    tipo: "melhoria",
    frente: "reclame-aqui",
    titulo: "Cartão do quadro mais limpo",
    texto:
      "O próximo passo deixou de ser uma pílula com a frase inteira e virou uma linha de ação logo abaixo do cliente (\"→ Confirme com o cliente se tudo voltou a funcionar\"). \"Respondida\" virou um \"✓ 29/09\" discreto — quase todo caso depois do Novo está respondido, e a pílula verde em todos virava ruído —, e \"Marcar respondida\" só aparece ao passar o mouse. Os selos que sobram são só de estado: prazo, sem notícia, completar.",
    href: "/reclame-aqui",
  },
  {
    id: "ra-filtros-em-uma-linha",
    dia: "2026-10-06",
    tipo: "melhoria",
    frente: "reclame-aqui",
    titulo: "Filtros do quadro em uma linha",
    texto:
      "A barra tinha três fileiras de seletores. Ficaram à vista os do dia a dia — busca, situação, status, \"Este mês\" e \"30 dias\" e os filtros salvos —, e estabelecimento, categoria, etiqueta, responsável e datas foram para \"Mais filtros\". Com algum deles em uso, a fileira já abre aberta e o botão mostra quantos, para nenhum filtro ficar escondido.",
    href: "/reclame-aqui",
  },
  {
    id: "ficha-botoes-de-um-jeito-so",
    dia: "2026-10-06",
    tipo: "melhoria",
    frente: "reclame-aqui",
    titulo: "Botões da ficha do caso com um estilo só",
    texto:
      "O cabeçalho da reclamação misturava três estilos e três alturas de botão — contorno roxo em Página pública e Área da empresa, neutro nos outros, cada um de um tamanho. Agora todos têm a mesma altura e o mesmo contorno; só o WhatsApp fica preenchido, como ação principal, e o Excluir virou um ícone discreto no fim da fileira.",
    href: "/reclame-aqui",
  },
  {
    id: "trilha-obrigatorios",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "reclame-aqui",
    titulo: "Trilha: \"1 de 6 obrigatórios\", com os opcionais marcados",
    texto:
      "O contador dizia \"1 de 6 passos\" com oito passos na tela, e parecia conta errada: dois são opcionais no caso (persistência no contato e resolução interna) e não entram na conta. Agora diz \"obrigatórios\", explica ao passar o mouse, e os passos opcionais trazem \"· opcional\" — o tracejado que deveria marcá-los não aparecia.",
    href: "/reclame-aqui",
  },
  {
    id: "rotulos-iguais-ao-menu",
    dia: "2026-10-06",
    tipo: "melhoria",
    frente: "plataforma",
    titulo: "O rótulo de cada tela é o grupo dela no menu",
    texto:
      "O texto pequeno acima do título de cada tela não tinha padrão — \"Rotina\", \"Visão geral\", \"Operação\", \"Base de pessoas\", \"Evolução contínua\", \"Módulo\", \"Atendimento\" — e o NPS aparecia como \"Inteligência\" estando em Frentes no menu. Agora cada tela mostra o grupo em que está no menu (Hoje, Frentes, Pessoas e contas, Inteligência, Conhecimento), e as telas internas de um módulo mostram o nome dele.",
  },
  {
    id: "virgula-nas-tabelas",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "plataforma",
    titulo: "Vírgula na Jornada, nas métricas diárias e na medição da IA",
    texto:
      "A Jornada do Cliente mostrava a nota média como \"3.5\", a tabela de métricas diárias da Analytics como \"8.49\", \"83.3%\" e \"361.0\", e a medição da IA em Configurações como \"1.4 s\". Agora tudo com vírgula; a exportação da planilha continua com o número cru.",
    href: "/jornada",
  },
  {
    id: "proximo-passo-em-pilula",
    dia: "2026-10-06",
    tipo: "melhoria",
    frente: "plataforma",
    titulo: "O próximo passo flutuante não cobre mais a tela",
    texto:
      "O cartão do próximo passo nascia aberto, com 300 px, por cima do quadro, das tabelas e dos formulários em toda tela. Agora nasce como a pílula \"Próximo passo · 202\" no canto, com o ponto âmbar quando há atraso; um clique abre, e quem abrir fica com ele aberto. O lembrete de foco continua abrindo o cartão sozinho.",
  },
  {
    id: "placar-encerrados-com-tratativa",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "nps",
    titulo: "Placar: \"ciclos encerrados\" conta só o que teve tratativa",
    texto:
      "O placar do Meu dia dizia \"88 ciclos de NPS encerrados, −519 que a semana passada\" em vermelho: em 30/09 a importação fechou 520 respostas de uma vez como \"Sem tratativa\", e o placar contava isso como trabalho. Agora vale a mesma regra do NPS por ciclo — o lote sem tratativa fica de fora —, e o número passou a \"87, +11 que a semana passada\". A conquista \"ciclos encerrados com a tratativa registrada\" segue a mesma conta.",
    href: "/meu-dia",
  },
  {
    id: "dias-uteis",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "plataforma",
    titulo: "\"10 dias úteis\", e não \"10 dias útil(eis)\"",
    texto: "No Meu dia, o aviso de cliente sem notícia e a sequência da rotina ainda diziam \"dias útil(eis)\".",
    href: "/meu-dia",
  },
  {
    id: "nota-do-periodo-so-do-periodo",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "reclame-aqui",
    titulo: "A nota de um mês conta só as avaliações daquele mês",
    texto:
      "Na Análise, ao escolher 30 dias, um trimestre ou um intervalo (um mês, por exemplo), a nota juntava as reclamações abertas no período com as avaliações que chegaram depois — em abril/2026 eram 20 avaliações, 12 feitas em outros meses, e a nota saía 8,4 onde as de abril davam 6,9. Agora o período conta só as avaliações feitas dentro dele, e a nota de cada mês é a mesma da Análise, dos Gráficos, do Índice e da extensão. A janela oficial de 6 e 12 meses não muda: continua a conta do portal. Fora dela, o cartão se chama \"Nota do período\", e o histograma também usa as avaliações do período.",
    href: "/reclame-aqui/analytics",
  },
  {
    id: "login-mais-leve",
    dia: "2026-10-06",
    tipo: "melhoria",
    frente: "plataforma",
    titulo: "A tela de entrar ficou leve",
    texto:
      "Sem ninguém logado, a tela de login carregava a plataforma inteira por trás e disparava oito leituras ao servidor a cada abertura — reclamações, cadastros, filtros, preferências —, todas recusadas por falta de sessão. Agora login e cadastro abrem só com o tema e os avisos; o resto carrega depois de entrar. (Num primeiro momento isso fez a tela de destino quebrar logo depois do código de duas etapas; corrigido no mesmo dia: a tela leve vale só ao abrir o login, nunca no envio que redireciona.)",
    href: "/login",
  },
  {
    id: "falta-um",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "plataforma",
    titulo: "\"Falta 1 tentativa\", e não \"Faltam 1\"",
    texto:
      "Com o plural certo, a concordância apareceu: \"Faltam 1 peça\", \"Faltam 1 tentativa\". Agora o verbo acompanha o número no dossiê, no guia do NPS, nas Redes, no Prêmio, no Plano de ação e nas respostas do assistente.",
  },
  {
    id: "assistente-object-object",
    dia: "2026-10-05",
    tipo: "correcao",
    frente: "reclame-aqui",
    titulo: "Assistente: \"faltam [object Object]\"",
    texto:
      "Perguntado sobre o caminho até uma nota, o assistente respondia \"faltam [object Object] avaliações nota 10\". Agora diz o número — e, quando não dá para chegar, o motivo: não sobram reclamações sem avaliação no período, ou o teto é o índice de resposta.",
    href: "/assistente",
  },
  {
    id: "plano-metas-sem-piscar",
    dia: "2026-10-05",
    tipo: "correcao",
    frente: "reclame-aqui",
    titulo: "Metas do plano voltam sem piscar",
    texto:
      "Depois de gravar as metas do mês, a tabela desenhava uma vez com o rascunho antigo e logo outra com o gravado. Agora troca de uma vez só.",
    href: "/reclame-aqui/plano",
  },
  {
    id: "novidades-item-a-item",
    dia: "2026-10-05",
    tipo: "novo",
    frente: "plataforma",
    titulo: "Novidades item a item, sem número de versão",
    texto:
      "Esta tela: cada mudança da revisão é um item — novo, melhorou ou corrigido —, com o que era, o que ficou e onde está, com busca e filtro. A aplicação fica em 1.0, e o ponto de \"novo\" no menu passa a contar pelo dia, não pela versão.",
    href: "/novidades",
  },

  /* ---------------- por dentro ---------------- */
  {
    id: "conferir-tudo",
    dia: "2026-10-06",
    tipo: "novo",
    frente: "bastidores",
    titulo: "Todas as conferências com um comando",
    texto:
      "São mais de 150 conferências e não havia jeito de rodar todas: depois de uma mudança grande, a regressão aparecia dias depois numa que ninguém lembrou. Agora \"npm run conferir\" roda as 123 que só leem, seis por vez, em pouco mais de um minuto, e diz quais falharam e quais ficaram de fora (as que gravam no banco ou falam com o servidor). Todas passaram.",
  },
  {
    id: "conferir-tempo-sozinho",
    dia: "2026-10-06",
    tipo: "melhoria",
    frente: "bastidores",
    titulo: "Conferência de tempo roda sozinha",
    texto:
      "A conferência de desempenho mede o tempo das consultas; rodando ao lado de outras cinco, o tempo inflava e ela falhava sem motivo. No \"npm run conferir\" ela agora roda por último, sozinha. E as conferências rodam quatro por vez, não seis: com seis o banco recusava conexão; o que falhar em paralelo roda de novo, sozinho, antes de ser dado como falha.",
  },
  {
    id: "dependencia-sharp",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "bastidores",
    titulo: "Falha de segurança no tratamento de imagens corrigida",
    texto:
      "Saiu um alerta de gravidade alta para a biblioteca de imagens que o Next usa (sharp 0.35.4, por uma falha no leitor de SVG). Atualizada para 0.35.5 — a mesma faixa que o Next pede, sem mexer em mais nada. A conferência de dependências voltou ao verde.",
  },
  {
    id: "conferencia-das-barras",
    dia: "2026-10-06",
    tipo: "novo",
    frente: "bastidores",
    titulo: "Conferência das expressões sem barra",
    texto:
      "Uma expressão como /^d{4}-d{2}-d{2}$/ compila e não funciona — foi o que quebrou a exportação de métricas sem nenhum aviso. A conferência nova lê todas as expressões do código e acusa \\d, \\s e \\w que perderam a barra.",
  },
  {
    id: "lint-mais-rapido",
    dia: "2026-10-05",
    tipo: "melhoria",
    frente: "bastidores",
    titulo: "A conferência do código caiu de mais de 1 hora para 2,5 minutos",
    texto:
      "O verificador de código varria também a cópia compilada do servidor de testes. Fora dela, o mesmo verificador termina em 2 min 34 s — e os 11 erros que apareceram no Plano de ação foram corrigidos.",
  },
  {
    id: "dependencia-source-map",
    dia: "2026-10-06",
    tipo: "correcao",
    frente: "bastidores",
    titulo: "Nenhuma dependência com falha conhecida sem decisão",
    texto:
      "Uma biblioteca usada para montar o CSS (source-map-js) tinha uma falha publicada de travamento por arquivo malformado; foi para a versão corrigida. As outras quatro da lista são do instalador do banco, que não roda em produção, e seguem com o motivo escrito.",
  },
  {
    id: "contas-conferidas",
    dia: "2026-10-06",
    tipo: "melhoria",
    frente: "bastidores",
    titulo: "Contas conferidas de novo contra a base real",
    texto:
      "Nota do Reclame Aqui, calculadora, índice, plano de ação (a previsão erra em média 0,2 ponto contra os meses fechados), prazos em horas úteis com feriados, ciclos do mês, metas e períodos: todas as provas passaram. As telas principais abrem dentro da meta de 1,5 s.",
  },
  {
    id: "extensao-provada-site-a-site",
    dia: "2026-10-06",
    tipo: "melhoria",
    frente: "bastidores",
    titulo: "O que a extensão promete, provado site a site",
    texto:
      "As 17 provas dos leitores de página passaram: Reclame Aqui (pública e área da empresa), WhatsApp (conversa, número, selos de espera, guardar sozinho), Crisp, Portal Cardápio Web, Google, planilha e Slack das Redes, disparos, prazos, identificação do contato e o atalho de respostas ao lado da caixa de mensagem.",
  },
  {
    id: "conferencias-em-dia",
    dia: "2026-10-06",
    tipo: "melhoria",
    frente: "bastidores",
    titulo: "Todas as conferências de novo no verde",
    texto:
      "Rodadas as 117 conferências que só leem a base. Dez estavam vermelhas por motivo errado — esperavam o texto antigo, com o plural entre parênteses, não conheciam as tabelas novas do Plano de ação e da revisão de categorias, ou contavam um caso do Instagram na métrica diária do Reclame Aqui. A conta estava certa em todas; as conferências foram acertadas para continuar valendo de alarme.",
  },
  {
    id: "bancada-do-painel",
    dia: "2026-10-05",
    tipo: "melhoria",
    frente: "bastidores",
    titulo: "Bancada da extensão de volta, com popup e opções",
    texto:
      "A página que abre o painel da extensão fora do Chrome, com dados reais, carregava só um arquivo desde que a ponte de áudio entrou. Voltou a carregar o painel inteiro, relê os arquivos a cada atualização e agora mostra também o popup e as opções.",
  },
  {
    id: "conferencias-da-extensao",
    dia: "2026-10-05",
    tipo: "melhoria",
    frente: "bastidores",
    titulo: "Conferências da extensão sem alarme falso",
    texto:
      "A conferência de fiação passou a ler também os pedidos do popup (o vigia aparecia como \"tratador sem quem chame\"), e a de segurança do HTML reconhece os ícones, o plural e o número formatado como seguros pela forma.",
  },
];

/** O que é novo para quem viu a página pela última vez no dia `vista`. */
export function mudancasDesde(mudancas: Mudanca[], vista: string | null) {
  return new Set(mudancas.filter((m) => !vista || m.dia > vista).map((m) => m.id));
}

export function diaDaUltimaMudanca() {
  return MUDANCAS.reduce((maior, m) => (m.dia > maior ? m.dia : maior), "");
}

/** Contagem por tipo, para o resumo do alto da página. */
export function contarPorTipo(mudancas: Mudanca[]) {
  const c: Record<TipoDeMudanca, number> = { novo: 0, melhoria: 0, correcao: 0 };
  for (const m of mudancas) c[m.tipo] += 1;
  return c;
}

/** Busca sem acento e sem caixa no título, no texto e no "onde". */
export function buscarMudancas(mudancas: Mudanca[], termo: string) {
  const normalizar = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const t = normalizar(termo.trim());
  if (!t) return mudancas;
  return mudancas.filter((m) => normalizar(`${m.titulo} ${m.texto} ${m.onde ?? ""}`).includes(t));
}
