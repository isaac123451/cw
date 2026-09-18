/**
 * As novidades de todas as versões, em linguagem de quem usa.
 *
 * **O pedido.** "Tela com todas as novidades." A página da 1.0 contava
 * a 1.0 inteira em sete cartões; quem voltava de férias não sabia o que
 * tinha mudado desde a última vez, e quem lia uma novidade não sabia
 * onde ela ficava.
 *
 * **O que mora aqui.** Uma entrada por versão que mudou algo na tela —
 * as correções invisíveis ficam no ROADMAP.md —, com as frentes que ela
 * toca (para o filtro), o endereço de onde a coisa está e, quando cabe,
 * um tour: dois ou três balões na própria tela apontando o que mudou.
 *
 * Os tours apontam elementos marcados com `data-tour` (ou um seletor
 * estável). Se o elemento não aparece — lista vazia, tela de celular —,
 * o passo é pulado, e não quebra o tour.
 */

/** A última versão que a pessoa viu na página, no navegador dela. */
export const CHAVE_DA_VERSAO_VISTA = "cw:novidades-vista";

export type FrenteDaNovidade = "reclame-aqui" | "redes" | "nps" | "google" | "extensao" | "plataforma";

export const FRENTES_DAS_NOVIDADES: { id: FrenteDaNovidade; nome: string }[] = [
  { id: "reclame-aqui", nome: "Reclame Aqui" },
  { id: "redes", nome: "Redes Sociais" },
  { id: "nps", nome: "NPS" },
  { id: "google", nome: "Google" },
  { id: "extensao", nome: "Extensão" },
  { id: "plataforma", nome: "Plataforma" },
];

export interface PassoDoTour {
  /** Seletor CSS do elemento apontado. */
  alvo: string;
  titulo: string;
  texto: string;
}

export interface TourDaNovidade {
  id: string;
  /** A tela onde o tour acontece. */
  rota: string;
  passos: PassoDoTour[];
}

export interface Novidade {
  versao: string;
  /** AAAA-MM-DD. */
  data: string;
  titulo: string;
  texto: string;
  frentes: FrenteDaNovidade[];
  href?: string;
  tour?: TourDaNovidade;
}

export type Era = "2.0" | "1.0" | "antes";

export const ERAS: { id: Era; nome: string; texto: string }[] = [
  { id: "2.0", nome: "Rumo à 2.0", texto: "Ter gosto de usar: achar as coisas, fazer mais de uma ao mesmo tempo e terminar o dia." },
  { id: "1.0", nome: "1.0", texto: "A documentação de reputação virou o funcionamento da plataforma." },
  { id: "antes", nome: "Antes da 1.0", texto: "A base: tudo gravado no banco, a extensão e as primeiras telas de cada frente." },
];

export function eraDaVersao(versao: string): Era {
  const [maior, menor] = versao.split(".").map(Number);
  if (maior >= 1 && (maior > 1 || menor >= 1)) return "2.0";
  if (maior >= 1 || menor >= 48) return "1.0";
  return "antes";
}

/** Negativo quando `a` é anterior a `b`. */
export function compararVersoes(a: string, b: string) {
  const pa = a.split(".").map((n) => Number(n) || 0);
  const pb = b.split(".").map((n) => Number(n) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * O que é novo para quem viu a página pela última vez em `vista`.
 *
 * Quem nunca abriu (vista nula) não ganha 60 marcações de "novo": só a
 * era atual conta como novidade.
 */
export function novasDesde(novidades: Novidade[], vista: string | null) {
  if (!vista) return new Set(novidades.filter((n) => eraDaVersao(n.versao) === "2.0").map((n) => n.versao));
  return new Set(novidades.filter((n) => compararVersoes(n.versao, vista) > 0).map((n) => n.versao));
}

export function filtrarNovidades(novidades: Novidade[], frente: FrenteDaNovidade | null) {
  return frente ? novidades.filter((n) => n.frentes.includes(frente)) : novidades;
}

export function tourPorId(id: string | null | undefined) {
  if (!id) return null;
  return NOVIDADES.find((n) => n.tour?.id === id)?.tour ?? null;
}

/** A mais nova primeiro. */
export const NOVIDADES: Novidade[] = [
  {
    versao: "1.18.0",
    data: "2026-09-18",
    titulo: "NPS mais direto e IA gratuita de reserva",
    texto: "No NPS, o topo ficou com o que se usa todo dia; etapas, causas, exportar e importar estão em Mais. Os gráficos repetidos saíram (continuam na Análise do NPS), o percentual de cada faixa foi para o indicador, e a lista sobe. Nas Redes, os segmentos ocupam metade da altura. A IA ganhou Groq e OpenRouter como reserva gratuita: quando uma cai, a próxima responde. Para ligar, basta pôr as chaves.",
    frentes: ["nps", "redes", "plataforma"],
    href: "/nps",
  },
  {
    versao: "1.17.0",
    data: "2026-09-18",
    titulo: "Busca mais legível e telas melhores no celular",
    texto: "Na busca (Ctrl+K), cada resultado mostra o nome em cima e, embaixo, o protocolo, o status em etiqueta colorida e o título; casos das Redes aparecem num grupo separado do Reclame Aqui, e a nota do NPS vem na cor da faixa. No celular, os indicadores ficam em duas colunas, os botões que só apareciam com o mouse ficam à vista, e a fila de Pedir avaliação e a Agenda deixaram de espremer o texto.",
    frentes: ["plataforma"],
  },
  {
    versao: "1.16.0",
    data: "2026-09-17",
    titulo: "Dispensar o pedido de avaliação",
    texto: "Nem todo caso merece seis meses de lembrete. Na fila de Pedir avaliação (e dentro do próprio pedido), Dispensar tira o caso da cadência sem apagar nada — e a seção Dispensados mostra quem tirou, quando, e devolve à fila com um clique.",
    frentes: ["reclame-aqui"],
    href: "/reclame-aqui/avaliacoes",
  },
  {
    versao: "1.14.0",
    data: "2026-09-17",
    titulo: "Resumo de conversa sem depender de IA externa",
    texto: "Quando nenhum provedor de IA responde (chave ausente, ou congestionado), o motor próprio da plataforma lê a conversa e devolve resumo, humor, pendência, próximo passo e três rascunhos prontos — pelas mesmas regras que a documentação já usa, sem inventar nada. O botão de resumir na extensão fica sempre disponível.",
    frentes: ["extensao", "plataforma"],
  },
  {
    versao: "1.13.0",
    data: "2026-09-17",
    titulo: "Sugestão de triagem pelo texto",
    texto: "No Reclame Aqui, sem categoria ainda, o relato sugere uma — pelos casos parecidos e por regras, com o motivo à vista. No NPS, o comentário sugere o tipo e a causa raiz. A taxa de acerto só aparece com base suficiente para dizer algo (medida: 64,6% em 356 relatos, contra 50,3% de chutar a mais comum). Sempre um clique em Usar — nada marca sozinho.",
    frentes: ["reclame-aqui", "nps"],
    href: "/reclame-aqui",
  },
  {
    versao: "1.12.0",
    data: "2026-09-17",
    titulo: "Segmentos das Redes",
    texto: "Origem, rede, assunto, gravidade, alcance do perfil e estabelecimento, cada um com a contagem ao lado. Clicar filtra o quadro, a lista e os indicadores, e o recorte vira link.",
    frentes: ["redes"],
    href: "/redes-sociais",
  },
  {
    versao: "1.11.0",
    data: "2026-09-17",
    titulo: "Casos das Redes pela planilha e pelo Slack",
    texto: "Com a planilha das Redes aberta, Ler para as Redes mostra quantas linhas são novas, quantas já estão no CW e quantas se repetem; Gravar cria os atendimentos a triar. No Slack, cada mensagem ganha CW · Redes, e o lançador confere o canal inteiro. Nada é gravado por abrir.",
    frentes: ["redes", "extensao"],
    href: "/redes-sociais",
  },
  {
    versao: "1.10.0",
    data: "2026-09-17",
    titulo: "Triagem das Redes em cinco perguntas",
    texto: "Quem é, a rede, o que aconteceu, a gravidade (com a sugestão e o motivo) e a saída. Resolvido na primeira conversa se registra ali mesmo, com a confirmação do cliente; e há um final novo, Encaminhado, para o caso que passou para outra área. Na tela das Redes, Triar o mais antigo abre o próximo na janela.",
    frentes: ["redes"],
    href: "/redes-sociais",
  },
  {
    versao: "1.9.0",
    data: "2026-09-17",
    titulo: "Novidades de todas as versões",
    texto: "Esta página: a linha do tempo desde a 0.21, com filtro por frente, a marca do que é novo desde a sua última visita e o botão Mostrar na tela, que aponta a novidade no lugar dela. O ponto ao lado da versão, no rodapé do menu, avisa quando há algo que você ainda não viu.",
    frentes: ["plataforma"],
    tour: {
      id: "novidades",
      rota: "/meu-dia",
      passos: [
        { alvo: '[data-tour="versao"]', titulo: "Novidades", texto: "Quando aparece o ponto ao lado da versão, há novidade que você ainda não viu. Clique para abrir esta página." },
      ],
    },
  },
  {
    versao: "1.8.0",
    data: "2026-09-17",
    titulo: "Meu dia, um item por vez",
    texto: "O botão Um por vez transforma as atividades abertas numa fila: um item na frente, o fora do prazo primeiro, com os passos que faltam para ele sair do dia. Abra na janela, registre, e o modo segue para o próximo. Atividade da agenda se conclui ali mesmo.",
    frentes: ["plataforma", "reclame-aqui", "redes", "nps", "google"],
    href: "/meu-dia",
    tour: {
      id: "um-por-vez",
      rota: "/meu-dia",
      passos: [
        { alvo: '[data-tour="um-por-vez"]', titulo: "Um por vez", texto: "Abre a fila do dia com um item por vez. ← e → andam pela fila." },
        { alvo: 'button[title="Ver os itens"]', titulo: "O que falta em cada item", texto: "Na lista de cada atividade, a linha “Falta:” diz o próximo passo do caso." },
      ],
    },
  },
  {
    versao: "1.7.0",
    data: "2026-09-17",
    titulo: "Várias janelas, organizadas",
    texto: "Com duas ou mais mini-janelas abertas, a bandeja arruma lado a lado ou em cascata. Janela com texto não salvo mostra um ponto âmbar, e fechar pede confirmação.",
    frentes: ["plataforma"],
  },
  {
    versao: "1.6.0",
    data: "2026-09-17",
    titulo: "A ficha inteira na mini-janela",
    texto: "O botão do cabeçalho da janela alarga e mostra a mesma ficha da tela cheia. As janelas abrem também do Meu dia, da Agenda e das fichas de cliente e estabelecimento.",
    frentes: ["reclame-aqui", "redes", "nps", "plataforma"],
    href: "/reclame-aqui",
    tour: {
      id: "janelas",
      rota: "/reclame-aqui",
      passos: [
        { alvo: '[data-tour="cartao-do-quadro"]', titulo: "Abrir em janela", texto: "Passe o mouse no cartão: o ícone de janela, no canto, abre a ficha por cima do quadro. Dá para abrir várias e seguir navegando; o botão no cabeçalho da janela mostra a ficha inteira." },
      ],
    },
  },
  {
    versao: "1.5.0",
    data: "2026-09-17",
    titulo: "Quadro do Reclame Aqui mais limpo",
    texto: "O cartão mostra o que decide o próximo passo — prioridade, prazo, idade e o passo da trilha —, e as ações aparecem ao passar o mouse. Colunas sem borda e filtros numa barra mais baixa.",
    frentes: ["reclame-aqui"],
    href: "/reclame-aqui",
    tour: {
      id: "quadro",
      rota: "/reclame-aqui",
      passos: [
        { alvo: '[data-tour="cartao-do-quadro"]', titulo: "O cartão", texto: "Prioridade (Normal não aparece), protocolo, idade, cliente e o passo da trilha. Ao passar o mouse, no canto: abrir em janela e excluir." },
      ],
    },
  },
  {
    versao: "1.4.0",
    data: "2026-09-17",
    titulo: "Atalhos de teclado",
    texto: "g e uma letra vão para a tela (g m Meu dia, g r Reclame Aqui, g n NPS), n abre um caso novo e ? mostra todos. Nada vale enquanto se digita.",
    frentes: ["plataforma"],
  },
  {
    versao: "1.3.0",
    data: "2026-09-17",
    titulo: "Notificações de todas as frentes",
    texto: "O sino agrupa por frente o NPS fora do prazo, o detrator novo, a avaliação negativa do Google, as Redes atrasadas e a crise. O número conta só o que você ainda não viu, e cada aviso abre em mini-janela.",
    frentes: ["plataforma", "nps", "google", "redes", "reclame-aqui"],
    tour: {
      id: "sino",
      rota: "/meu-dia",
      passos: [
        { alvo: '[data-tour="sino"]', titulo: "O sino", texto: "Agrupado por frente. O número conta só o novo para você; “Todas” mostra o resto." },
      ],
    },
  },
  {
    versao: "1.2.0",
    data: "2026-09-17",
    titulo: "Menu lateral repaginado",
    texto: "Grupos pelo dia de trabalho, o número do que pede ação ao lado de cada frente, fixados pelo alfinete e o modo recolhido só com ícones.",
    frentes: ["plataforma"],
    tour: {
      id: "menu",
      rota: "/meu-dia",
      passos: [
        { alvo: '[data-tour="menu"]', titulo: "Grupos do dia", texto: "Hoje, Frentes, Pessoas e contas, Inteligência e Conhecimento. O número ao lado de cada frente é o que pede ação — vermelho só com atraso." },
        { alvo: '[data-tour="menu-recolher"]', titulo: "Recolher", texto: "Deixa só os ícones, para trabalhar com a tela cheia de janelas. Passe o mouse num item para fixá-lo no topo." },
      ],
    },
  },
  {
    versao: "1.1.0",
    data: "2026-09-17",
    titulo: "Busca que acha",
    texto: "Ctrl+K ou / de qualquer tela: casos por protocolo, cliente, CPF/CNPJ, telefone ou título; NPS; clientes; estabelecimentos; conversas; e as telas pelo nome. Shift+Enter abre em mini-janela. O aviso de falha de leitura virou um aviso pequeno, que tenta de novo sozinho.",
    frentes: ["plataforma"],
    tour: {
      id: "busca",
      rota: "/meu-dia",
      passos: [
        { alvo: '[data-tour="busca"]', titulo: "Busca", texto: "Ctrl+K ou / de qualquer tela. Enter abre; Shift+Enter abre o caso numa mini-janela." },
      ],
    },
  },
  {
    versao: "1.0.0",
    data: "2026-09-17",
    titulo: "Versão 1.0",
    texto: "O roadmap 1.0 fechado: a documentação de reputação das quatro frentes virou o funcionamento da plataforma, e esta página de novidades.",
    frentes: ["plataforma"],
  },
  {
    versao: "0.82.0",
    data: "2026-09-17",
    titulo: "Popup da extensão que devolve",
    texto: "Além dos prazos, o popup mostra o que move a nota e as conquistas de hoje.",
    frentes: ["extensao"],
  },
  {
    versao: "0.81.0",
    data: "2026-09-17",
    titulo: "Abertura mais rápida",
    texto: "A plataforma carrega os dados da abertura numa ida só: cerca de 1 s, contra quase 3 s antes.",
    frentes: ["plataforma"],
  },
  {
    versao: "0.80.0",
    data: "2026-09-16",
    titulo: "No celular",
    texto: "As telas principais cabem em 375 px, com a mini-janela inteira na tela.",
    frentes: ["plataforma"],
  },
  {
    versao: "0.79.0",
    data: "2026-09-16",
    titulo: "Nenhuma tela sem saída",
    texto: "Lista vazia diz por que está vazia e oferece o próximo passo.",
    frentes: ["plataforma"],
  },
  {
    versao: "0.78.0",
    data: "2026-09-16",
    titulo: "Tempo até o 1º contato no relatório",
    texto: "O relatório do ciclo mede o tempo até o primeiro contato em cada frente.",
    frentes: ["reclame-aqui", "redes", "nps"],
    href: "/relatorio",
  },
  {
    versao: "0.77.0",
    data: "2026-09-16",
    titulo: "Urgência sugerida pelos dados",
    texto: "A triagem sugere a criticidade por reincidência do CPF/CNPJ, alto ticket e risco de cancelamento, dizendo o motivo.",
    frentes: ["reclame-aqui"],
    href: "/reclame-aqui",
  },
  {
    versao: "0.76.0",
    data: "2026-09-16",
    titulo: "Conversas do WhatsApp: quem espera",
    texto: "Filtro de quem está esperando resposta, vínculo sugerido pelo telefone, busca que navega dentro da conversa e o lado certo de cada mensagem.",
    frentes: ["extensao", "plataforma"],
    href: "/conversas",
  },
  {
    versao: "0.75.0",
    data: "2026-09-16",
    titulo: "Meu dia: agora, a nota e as conquistas",
    texto: "O topo do Meu dia mostra o que pede ação agora, o que move a nota e o que já deu certo hoje.",
    frentes: ["plataforma"],
    href: "/meu-dia",
  },
  {
    versao: "0.74.0",
    data: "2026-09-16",
    titulo: "Mini-janelas",
    texto: "Abra a ficha de um caso, NPS ou avaliação por cima de qualquer tela — até oito — e continue navegando. Sobrevivem ao F5.",
    frentes: ["reclame-aqui", "redes", "nps", "google", "plataforma"],
  },
  {
    versao: "0.73.0",
    data: "2026-09-16",
    titulo: "Planos pela tabela configurada",
    texto: "A conta, o Impacto e a tabela falam do mesmo plano.",
    frentes: ["plataforma"],
  },
  {
    versao: "0.71.0",
    data: "2026-09-16",
    titulo: "Toda gravação diz o que aconteceu",
    texto: "Salvar confirma só depois do banco — e, quando não grava, diz o motivo.",
    frentes: ["plataforma"],
  },
  {
    versao: "0.70.0",
    data: "2026-09-16",
    titulo: "Duas pessoas no mesmo caso",
    texto: "Quem salva depois grava só o que mudou; se os dois mexeram no mesmo campo, nada é gravado e a tela diz qual campo, para ninguém apagar o trabalho do outro.",
    frentes: ["reclame-aqui", "redes", "nps"],
  },
  {
    versao: "0.69.0",
    data: "2026-09-16",
    titulo: "O agente conhece a documentação",
    texto: "Responde citando a seção do documento, avisa antes de perguntar e escreve pelas regras.",
    frentes: ["plataforma"],
    href: "/assistente",
  },
  {
    versao: "0.68.0",
    data: "2026-09-15",
    titulo: "Atalho do painel da extensão",
    texto: "Alt+Shift+C abre o painel em qualquer site suportado.",
    frentes: ["extensao"],
  },
  {
    versao: "0.67.0",
    data: "2026-09-15",
    titulo: "Extensão no Portal, Crisp e Google Perfil",
    texto: "O painel reconhece o cliente também no Portal Cardápio Web, no Crisp e no Google Perfil da Empresa.",
    frentes: ["extensao", "google"],
  },
  {
    versao: "0.66.0",
    data: "2026-09-15",
    titulo: "Meu dia de bolso",
    texto: "O popup da extensão mostra a rotina e os prazos; o ícone conta o que está estourando.",
    frentes: ["extensao"],
  },
  {
    versao: "0.65.0",
    data: "2026-09-15",
    titulo: "Resposta pública conferida no HugMe e no Reclame Aqui",
    texto: "Nome, canal privado, promessa, tom e dado pessoal conferidos antes de publicar, dentro das próprias páginas.",
    frentes: ["extensao", "reclame-aqui"],
  },
  {
    versao: "0.64.0",
    data: "2026-09-15",
    titulo: "As ações do documento no painel",
    texto: "Registrar contato, tentativa e validação sem sair da conversa.",
    frentes: ["extensao"],
  },
  {
    versao: "0.63.0",
    data: "2026-09-15",
    titulo: "Exportar conversa do WhatsApp",
    texto: "Em .txt, no formato do WhatsApp, ou em planilha.",
    frentes: ["plataforma"],
    href: "/conversas",
  },
  {
    versao: "0.62.0",
    data: "2026-09-14",
    titulo: "Filtro por data no NPS",
    texto: "Vale para a tela inteira: lista, quadro e números.",
    frentes: ["nps"],
    href: "/nps",
  },
  {
    versao: "0.61.0",
    data: "2026-09-14",
    titulo: "A conversa como evidência",
    texto: "Passos, gancho para o pedido de avaliação e o dossiê saem da conversa guardada.",
    frentes: ["reclame-aqui", "plataforma"],
  },
  {
    versao: "0.59.0",
    data: "2026-09-14",
    titulo: "Conversas do WhatsApp",
    texto: "A tela das conversas, guardadas pela extensão ou pelo arquivo exportado.",
    frentes: ["extensao", "plataforma"],
    href: "/conversas",
  },
  {
    versao: "0.58.0",
    data: "2026-09-14",
    titulo: "Primeiro acesso guiado",
    texto: "Do documento ao primeiro caso tratado, para quem chega.",
    frentes: ["plataforma"],
  },
  {
    versao: "0.57.0",
    data: "2026-09-14",
    titulo: "Ferramentas e acessos",
    texto: "Os links do time a um clique, também no popup da extensão.",
    frentes: ["plataforma", "extensao"],
  },
  {
    versao: "0.56.0",
    data: "2026-09-14",
    titulo: "O porquê de cada regra",
    texto: "O ícone ao lado de cada regra abre o trecho do documento que a define.",
    frentes: ["plataforma"],
  },
  {
    versao: "0.55.0",
    data: "2026-09-14",
    titulo: "Documentação do time",
    texto: "Importar, ler, buscar e editar os documentos de reputação.",
    frentes: ["plataforma"],
    href: "/documentacao",
  },
  {
    versao: "0.54.0",
    data: "2026-09-14",
    titulo: "Relatório do ciclo",
    texto: "Indicadores das abas do portal, selo RA1000 e pontos de atenção, prontos para o Slack e a planilha.",
    frentes: ["reclame-aqui", "nps", "google", "redes"],
    href: "/relatorio",
  },
  {
    versao: "0.53.0",
    data: "2026-09-13",
    titulo: "Ficha do NPS",
    texto: "Uma ficha por ciclo, com a trilha do guia e o encerramento devolvido ao Wootric.",
    frentes: ["nps"],
    href: "/nps",
  },
  {
    versao: "0.52.0",
    data: "2026-09-13",
    titulo: "Meu dia",
    texto: "A rotina do documento com os números de hoje nas quatro frentes, o plano que cabe no expediente e o checkpoint.",
    frentes: ["plataforma"],
    href: "/meu-dia",
  },
  {
    versao: "0.51.0",
    data: "2026-09-13",
    titulo: "Redes, Google e NPS no fluxo dos documentos",
    texto: "Etapas, prazos e causa raiz de cada frente como o documento descreve.",
    frentes: ["redes", "google", "nps"],
  },
  {
    versao: "0.50.0",
    data: "2026-09-13",
    titulo: "Ofertas e renegociação",
    texto: "As ofertas do documento, com o limite do mês.",
    frentes: ["reclame-aqui"],
  },
  {
    versao: "0.49.0",
    data: "2026-09-13",
    titulo: "Reclame Aqui passo a passo",
    texto: "A trilha no topo do caso, o acionamento de áreas com prazo, as cadências e a fila de pedir avaliação.",
    frentes: ["reclame-aqui"],
    href: "/reclame-aqui/avaliacoes",
  },
  {
    versao: "0.48.0",
    data: "2026-09-12",
    titulo: "Horas úteis, triagem e 1º contato",
    texto: "Todo prazo em tempo útil, com feriados; criticidade Urgente, Alta e Normal; o 1º contato registrado como fato.",
    frentes: ["reclame-aqui", "redes", "nps"],
    href: "/processos",
  },
  {
    versao: "0.42.0",
    data: "2026-09-02",
    titulo: "Reclamação nova entra sozinha",
    texto: "A extensão confere a lista do Reclame Aqui ao abrir a plataforma e põe a reclamação nova no quadro.",
    frentes: ["reclame-aqui", "extensao"],
  },
  {
    versao: "0.40.0",
    data: "2026-08-28",
    titulo: "NPS no celular e a nota do Wootric",
    texto: "A nota chega do Wootric, dá para anotar pela plataforma e pela extensão, e a tela cabe no celular.",
    frentes: ["nps", "extensao"],
  },
  {
    versao: "0.35.0",
    data: "2026-08-26",
    titulo: "Dossiê na ficha",
    texto: "O dossiê do cliente salvo no caso, como pasta com capa.",
    frentes: ["reclame-aqui", "extensao"],
  },
  {
    versao: "0.33.0",
    data: "2026-08-26",
    titulo: "Tema escuro",
    texto: "O botão ao lado do sino alterna o tema.",
    frentes: ["plataforma"],
  },
  {
    versao: "0.32.0",
    data: "2026-08-26",
    titulo: "Redes Sociais com tela própria",
    texto: "Redes deixam de ser um canal do Reclame Aqui.",
    frentes: ["redes"],
    href: "/redes-sociais",
  },
  {
    versao: "0.27.0",
    data: "2026-08-25",
    titulo: "Resumo do caso na extensão",
    texto: "O resumo geral e o do último assunto, com as respostas sugeridas.",
    frentes: ["extensao"],
  },
  {
    versao: "0.26.0",
    data: "2026-08-24",
    titulo: "Dashboard e análise do NPS com o mesmo número",
    texto: "As duas telas respondem a mesma pergunta pela mesma conta.",
    frentes: ["nps"],
    href: "/nps/analise",
  },
  {
    versao: "0.24.0",
    data: "2026-08-24",
    titulo: "Fora os dados de demonstração",
    texto: "Toda tela mostra a operação real, gravada no banco.",
    frentes: ["plataforma"],
  },
  {
    versao: "0.22.0",
    data: "2026-08-23",
    titulo: "Verificação em duas etapas",
    texto: "Código por e-mail ao entrar.",
    frentes: ["plataforma"],
  },
  {
    versao: "0.21.0",
    data: "2026-08-23",
    titulo: "Gráficos e calculadora de reputação",
    texto: "Os gráficos do Reclame Aqui e a calculadora que mostra quanto cada avaliação move a nota.",
    frentes: ["reclame-aqui"],
    href: "/reclame-aqui/calculadora",
  },
];
