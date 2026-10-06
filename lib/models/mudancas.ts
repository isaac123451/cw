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
    "Bugs, contas, desempenho, segurança e o que estava pela metade — com a extensão em primeiro lugar. Cada item abaixo é uma mudança: o que era, o que ficou e onde está.",
};

export const MUDANCAS: Mudanca[] = [
  /* ---------------- extensão: o painel ---------------- */
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
      "Logo abaixo da nota do Reclame Aqui, as ações que mais sobem a nota agora, com o número ao lado: \"Responder as 12 sem resposta pública · 8,8 → 9,0\", \"Pedir avaliação às 7 da vez · 8,8 → 8,9\". Um clique abre a tela certa na plataforma. É a mesma conta do Meu dia e do popup.",
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
      "A ficha do caso, a do cliente, a do estabelecimento, a conversa guardada, a importação e o disparo em lote mostravam o número como estava gravado — \"11960599984\", \"+5511960599984\". Agora \"(11) 96059-9984\" e \"+55 11 96059-9984\". O mascarado da base e o de outro país ficam como vieram.",
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
      "A conferência de desempenho mede o tempo das consultas; rodando ao lado de outras cinco, o tempo inflava e ela falhava sem motivo. No \"npm run conferir\" ela agora roda por último, sozinha.",
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
