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
    id: "plural-de-verdade",
    dia: "2026-10-05",
    tipo: "melhoria",
    frente: "plataforma",
    titulo: "\"1 reclamação\" e \"5 reclamações\", nunca \"reclamação(ões)\"",
    texto:
      "Mais de 440 textos em 132 telas, avisos, relatórios e respostas do assistente usavam o plural com parênteses — \"2 caso(s)\", \"1 detrator(es)\", \"3 dia(s)\". Agora cada um usa o número que está ao lado: \"1 caso\", \"2 casos\".",
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
