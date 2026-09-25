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
    versao: "1.79.0",
    data: "2026-09-25",
    titulo: "Área da empresa com o estado em destaque e pedir avaliação",
    texto: "No cartão da reclamação, na área da empresa do Reclame Aqui: prioridade, prazo e situação no topo, na cor da urgência, com o que fazer agora. Quando é hora, o pedido de avaliação no tom do lembrete da vez — um clique abre o WhatsApp com a mensagem e registra no caso. Recarregue a extensão.",
    frentes: ["reclame-aqui", "extensao"],
  },
  {
    versao: "1.78.0",
    data: "2026-09-25",
    titulo: "Disparos em lote seguros pelo WhatsApp",
    texto: "No Prêmio e no pedir avaliação, monte uma lista (você escolhe quem entra) e abra o WhatsApp Web: o painel CW abre uma conversa por vez com a mensagem escrita, você aperta Enter, e ele registra e espera uns 40 segundos antes da próxima. A cada 10, uma pausa. Dá para pausar, pular e parar. Recarregue a extensão.",
    frentes: ["reclame-aqui", "extensao"],
  },
  {
    versao: "1.77.0",
    data: "2026-09-25",
    titulo: "Dossiê em texto único, com fatos e imagens",
    texto: "O dossiê agora abre como um texto corrido, escrito do registro: quem reclamou, o que aconteceu dia a dia, onde o caso está. Dá para acrescentar fatos que o sistema não tem (com data, entram na ordem certa) e imagens — cole um print com Ctrl+V. Edite à vontade e baixe com as imagens. Vale também para as Redes Sociais; o formato de oito partes continua lá, recolhido, para o pedido de moderação.",
    frentes: ["reclame-aqui", "redes"],
  },
  {
    versao: "1.76.0",
    data: "2026-09-24",
    titulo: "Prêmio repensado",
    texto: "O Prêmio agora funciona como o pedir avaliação: a aba Pedir o voto traz os indicados de hoje (quem avaliou bem, com telefone, a melhor lembrança primeiro) e quem precisa de lembrete; o clique abre o WhatsApp e já registra. Ideias e estratégias com os números da base, a planilha à parte e o cadastro da campanha no fim. Mensagem padrão mais curta.",
    frentes: ["reclame-aqui"],
  },
  {
    versao: "1.75.0",
    data: "2026-09-24",
    titulo: "Índice como no HugMe",
    texto: "Nova aba Índice no Reclame Aqui: a nota de hoje e a prévia da virada do mês, em 6 e 12 meses, com a nota exata (8,78111), a régua até o RA1000 com o que falta indicador por indicador e a evolução dia a dia do mês — com os dias que mexeram na nota e o porquê.",
    frentes: ["reclame-aqui"],
  },
  {
    versao: "1.74.0",
    data: "2026-09-24",
    titulo: "Mais causas e categorias, lista enxuta",
    texto: "Dezesseis causas raiz novas, tiradas das reclamações e do NPS, cada uma com a área que resolve e o prazo; e duas categorias que a base pedia: Impressão de pedidos e WhatsApp e robô, com subcategorias. A lista do Reclame Aqui caiu de 12 para 7 colunas e cabe no notebook sem rolar para o lado: o estabelecimento vem embaixo do cliente, a avaliação numa célula só e a situação junto do prazo e do que fazer.",
    frentes: ["reclame-aqui", "nps"],
  },
  {
    versao: "1.73.0",
    data: "2026-09-24",
    titulo: "Criar e renomear direto no campo",
    texto: "Estabelecimento, categoria, subcategoria e situação: digite para buscar e, se não existir, \"Criar\" aparece ali mesmo; o lápis de cada item renomeia. Na ficha, o estabelecimento criado já fica vinculado à reclamação. A Nova reclamação ganhou os mesmos campos com busca, e o estabelecimento vem do cadastro — não repete mais o nome do consumidor. Renomear uma situação leva as reclamações junto.",
    frentes: ["reclame-aqui"],
  },
  {
    versao: "1.72.0",
    data: "2026-09-24",
    titulo: "O que fazer em cada reclamação",
    texto: "O quadro, a lista e a trilha da reclamação dizem o que fazer agora, em uma frase: \"várias tentativas sem sucesso: tente por e-mail\", \"o objetivo foi cumprido: responda a reclamação\", \"o prazo da área passou: cobre\". Em âmbar quando passou do ponto; o clique já abre o contato no canal sugerido.",
    frentes: ["reclame-aqui"],
  },
  {
    versao: "1.71.0",
    data: "2026-09-24",
    titulo: "Completar em sequência",
    texto: "No quadro do Reclame Aqui, o aviso das reclamações sem os dados do consumidor abre todas numa fila: o painel mostra 2 de 7, gravou e já vai para a próxima, e Pular deixa uma para depois.",
    frentes: ["reclame-aqui"],
  },
  {
    versao: "1.70.0",
    data: "2026-09-24",
    titulo: "Menos atrito no Reclame Aqui e sem botão de recarregar",
    texto: "As reclamações e o NPS se atualizam sozinhos: ao voltar para a aba e a cada 3 minutos com ela à vista. No pedir avaliação, dispensar todos e devolver todos de uma vez, com as linhas mais compactas. As colunas do quadro ganharam contraste com os cartões. O filtro do quadro chama-se Estabelecimento (era o que ele filtrava) e a opção vazia virou Sem estabelecimento. E o cabeçalho da reclamação não espreme mais o título: título em cima, ações embaixo.",
    frentes: ["reclame-aqui", "nps", "plataforma"],
  },
  {
    versao: "1.69.0",
    data: "2026-09-24",
    titulo: "A extensão ao lado na área da empresa do Reclame Aqui",
    texto: "Ao abrir uma reclamação na área da empresa, um cartão pequeno (arrastável e recolhível) resume o relato: o que aconteceu, o que o cliente pede, os sinais de criticidade com o trecho e o tom. Mostra também o caso no CW (prioridade, prazo, passo da vez, responsável, reincidência do CPF/CNPJ, réplica pendente e se o cliente já validou antes de responder) e os atalhos para abrir no CW, na página pública e no dossiê em nova guia, copiar o protocolo e o rascunho da resposta. Se ainda não está no CW, o cartão oferece criar no quadro. Na lista de reclamações, cada uma ganha um selo (no CW com a prioridade e o atraso, ou nova) e um ↗ para abrir em nova guia.",
    frentes: ["extensao", "reclame-aqui"],
  },
  {
    versao: "1.68.2",
    data: "2026-09-24",
    titulo: "Sem barra para ir de um lado ao outro",
    texto: "O quadro do Reclame Aqui, o das Redes, o de Projetos e o da Jornada passam a quebrar as colunas em fileiras em vez de pedir para rolar de lado. O menu de abas do Reclame Aqui, do Analytics e das configurações quebra linha quando não cabe. No celular, a tela deixou de escorregar para o lado em 18 telas (o balão de explicação dos indicadores ocupava lugar mesmo escondido). E as tabelas de Analytics, Processos e Configurar fluxo cabem num notebook.",
    frentes: ["plataforma", "reclame-aqui", "redes"],
  },
  {
    versao: "1.68.1",
    data: "2026-09-24",
    titulo: "Prêmio, dossiê, causas e tons prontos no banco",
    texto: "As tabelas e colunas novas das versões 1.54 a 1.67 (a campanha do Prêmio e os pedidos de voto, o dossiê escrito, a área e o prazo de cada causa raiz e o aprendizado das respostas em três tons) foram criadas no banco, com a proteção de acesso ligada em todas. E a planilha do Prêmio e o dossiê baixados depois das 21h deixaram de sair com a data do dia seguinte.",
    frentes: ["plataforma", "reclame-aqui"],
  },
  {
    versao: "1.68.0",
    data: "2026-09-24",
    titulo: "Desconto dado na conversa vira impacto com um clique",
    texto: "Quando a conversa do WhatsApp mostra uma condição que nós demos — \"20% na próxima fatura\", \"1 mês grátis\", \"isentar a próxima mensalidade\", um estorno em reais ou uma cortesia —, o painel da extensão abre um aviso com o valor já calculado pela mensalidade da conta e o caso do cliente. Um clique em \"Registrar impacto\" lança o custo em Impacto no Negócio; sem mensalidade conhecida, você digita o valor. A mesma frase não é lançada duas vezes.",
    frentes: ["extensao"],
  },
  {
    versao: "1.67.0",
    data: "2026-09-24",
    titulo: "Respostas em três tons, que aprendem com você",
    texto: "Depois de \"Resumir\", o painel da extensão traz a resposta em três tons — acolhedora, objetiva e técnica —, com o nome do cliente, o que já foi feito e o prazo só se ele já foi combinado na conversa (prazo novo aparece como aviso). O texto é editável ali mesmo: se você mudar algo antes de copiar, a plataforma guarda a edição e o próximo rascunho sai do seu jeito — a saudação que você usa, a despedida que você acrescenta.",
    frentes: ["extensao"],
  },
  {
    versao: "1.66.0",
    data: "2026-09-24",
    titulo: "O resumo da conversa situa quem chega no meio",
    texto: "O \"Resumir\" do painel da extensão agora diz, em cinco linhas: o que o cliente quer, o que já foi feito, o que prometemos e para quando (em vermelho se o prazo já venceu), o que falta e o risco — cada ponto com o trecho da mensagem de onde saiu. Citação que não está na conversa é descartada, a data da promessa vem da própria mensagem, e o tamanho acompanha a conversa. Funciona também sem IA, pelas regras.",
    frentes: ["extensao"],
  },
  {
    versao: "1.65.0",
    data: "2026-09-24",
    titulo: "O que fazer agora, em cada conversa",
    texto: "Ao abrir uma conversa no WhatsApp, o painel da extensão diz logo abaixo do nome do cliente o que fazer agora: só escutar e acolher (quando ele mandou várias mensagens seguidas, irritado), assumir o erro (quando aponta uma falha nossa), esperar a área e dizer quando volta (quando o caso está com outra área e ele pergunta do andamento), propor 15 minutos no Meet (quando a explicação já foi e voltou), mandar um áudio curto (quando ele não entendeu ou os textos estão longos) ou escalar (Procon, advogado ou cliente no limite e reincidente). Com o porquê e um roteiro de três linhas.",
    frentes: ["extensao"],
  },
  {
    versao: "1.64.0",
    data: "2026-09-24",
    titulo: "O botão da extensão vai para onde você quiser",
    texto: "Arraste o botão redondo da extensão para qualquer canto da tela. Ele lembra a posição em cada site — um lugar no WhatsApp, outro no Crisp, outro no Reclame Aqui. Clicar continua abrindo o painel; para voltar ao canto de baixo à direita, use \"Botão no canto\" no rodapé do painel.",
    frentes: ["extensao"],
  },
  {
    versao: "1.63.0",
    data: "2026-09-24",
    titulo: "A causa que se repete vira item em Projetos sozinha",
    texto: "Em Causas raiz, \"A semana\" mostra as causas mais registradas nos últimos 7 dias em cada frente e o que subiu em relação à semana anterior. A causa com 3 ou mais registros em 30 dias, somando as frentes, e com área dona no catálogo agora vira item em Projetos pela rotina diária, com a área como responsável e o prazo da causa na descrição — uma vez por mês. A causa sem dono continua com o botão \"Abrir agora\".",
    frentes: ["plataforma", "reclame-aqui", "nps", "redes", "google"],
  },
  {
    versao: "1.62.0",
    data: "2026-09-24",
    titulo: "A mesma causa raiz nas quatro frentes",
    texto: "A causa raiz agora é sugerida pelo texto no Reclame Aqui, nas redes, no NPS e no Google, pela mesma conta: o relato de um caso ensina a sugestão de uma avaliação, o comentário do NPS ensina a das redes. Em Causas raiz, a nova seção \"A mesma régua\" mostra por frente quanto já está classificado, quanto usa um nome fora do catálogo e quanto a sugestão acerta — e o botão Unificar leva os registros de um nome antigo (\"cobranca\") para a causa certa.",
    frentes: ["plataforma", "reclame-aqui", "nps", "redes", "google"],
  },
  {
    versao: "1.61.0",
    data: "2026-09-24",
    titulo: "Cada causa raiz com dono",
    texto: "Cada causa raiz agora tem a área que resolve e o prazo (em Causas raiz → Editar, ou no Gerenciar do NPS). Ao classificar um caso, uma resposta do NPS ou uma avaliação do Google, aparece embaixo do campo \"Dono: Financeiro · 2 dias úteis\"; no Reclame Aqui e na janela do caso, o botão \"Acionar Financeiro\" abre o acionamento com a área já escolhida — e, se o prazo da causa for mais curto que o da prioridade, o relógio da área usa o da causa.",
    frentes: ["plataforma", "reclame-aqui", "nps", "redes", "google"],
  },
  {
    versao: "1.60.0",
    data: "2026-09-24",
    titulo: "Causas raiz tiradas dos casos reais",
    texto: "Nova tela Causas raiz (menu Inteligência): a plataforma lê os relatos do Reclame Aqui, os comentários do NPS, as redes e o Google e propõe as causas que se repetem na Cardápio Web — impressão de pedidos, integração com iFood, repasse, cobrança depois de cancelar, implantação e outras —, cada uma com quantos registros tem por frente, dois exemplos reais, a área que resolve e o prazo. Você ajusta a área e o prazo e aprova; as causas de antes continuam.",
    frentes: ["plataforma", "reclame-aqui", "nps", "redes", "google"],
  },
  {
    versao: "1.59.0",
    data: "2026-09-24",
    titulo: "O dossiê sai da extensão",
    texto: "No painel da extensão, a aba Dossiê agora tem o botão \"Abrir o dossiê na plataforma\", que abre o documento de 8 partes já no caso certo. O resumo rápido do caso continua ali, para leitura; montar e salvar o dossiê é na plataforma.",
    frentes: ["extensao", "reclame-aqui"],
  },
  {
    versao: "1.58.0",
    data: "2026-09-24",
    titulo: "O dossiê pela plataforma",
    texto: "Na ficha da reclamação, o botão Dossiê abre o documento de 8 partes em tela grande: identificação, sumário, partes, linha do tempo numerada, evidências (Anexo 01, 02…), apuração, enquadramento e conclusão com o pedido. A linha do tempo e os anexos são montados dos registros — contatos, tentativas, áreas, anotações, conversas guardadas, respostas. A IA escreve o primeiro rascunho do sumário e da apuração; tudo é editável. Ao lado, a conferência do que falta para se sustentar, o texto do pedido de moderação para copiar e o dossiê para baixar.",
    frentes: ["reclame-aqui"],
  },
  {
    versao: "1.57.0",
    data: "2026-09-24",
    titulo: "Depoimentos prontos",
    texto: "Na tela do Prêmio, as melhores falas de quem gosta da Cardápio Web: comentários de promotores do NPS e avaliações 5 estrelas do Google, sem ressalva. Primeiro quem aceitou ser case e o que já é público; o comentário do NPS sem aceite vem marcado para pedir autorização. Cada um se copia pronto, com o nome de quem disse.",
    frentes: ["reclame-aqui", "nps", "google"],
    href: "/reclame-aqui/premio",
  },
  {
    versao: "1.56.0",
    data: "2026-09-24",
    titulo: "O prêmio no calendário",
    texto: "Na tela do Prêmio, as datas da votação (quando abre e fecha) e a data de corte, com a pergunta que importa: a nota na janela que o prêmio vai olhar chega à meta? Diz quantas avaliações nota 10, entre as reclamações da janela ainda sem avaliação, faltam — ou que nem todas bastam.",
    frentes: ["reclame-aqui"],
    href: "/reclame-aqui/premio",
  },
  {
    versao: "1.55.0",
    data: "2026-09-24",
    titulo: "A campanha de votação, pessoa por pessoa",
    texto: "Na tela do Prêmio, quem foi exportado entra na campanha: o painel conta quem falta pedir, pedido feito, lembrete feito e quem disse que votou, com a taxa de voto. Cada pessoa tem o WhatsApp aberto com a mensagem da vez — o pedido, e depois o lembrete — e o botão do próximo passo; marque várias para registrar de uma vez.",
    frentes: ["reclame-aqui", "nps"],
    href: "/reclame-aqui/premio",
  },
  {
    versao: "1.54.0",
    data: "2026-09-24",
    titulo: "Prêmio Reclame Aqui: a lista de quem pedir o voto",
    texto: "Nova tela no Reclame Aqui: Prêmio. Cadastre a campanha (link da votação e a mensagem com {nome} e {link}), filtre quem avaliou bem — resolvido, voltaria, nota mínima, promotores do NPS, 5 estrelas no Google, período — e baixe a planilha pronta para o WhatsApp: nome, telefone no formato internacional e a mensagem de cada um. Uma pessoa por telefone, e quem já foi exportado não volta na próxima lista.",
    frentes: ["reclame-aqui", "nps"],
    href: "/reclame-aqui/premio",
  },
  {
    versao: "1.53.0",
    data: "2026-09-24",
    titulo: "Lembretes que nascem sozinhos",
    texto: "Ao abrir a Agenda, dois tipos de lembrete nascem sozinhos: \"cobrar retorno\" de cada área acionada sem retorno, na hora do prazo dela; e o retorno que você combinou numa conversa guardada (\"te ligo amanhã às 10h\"), no dia e na hora combinados. O que nasceu aparece no topo, com desfazer — que conclui o lembrete para ele não voltar.",
    frentes: ["plataforma", "reclame-aqui"],
    href: "/agenda",
  },
  {
    versao: "1.52.0",
    data: "2026-09-24",
    titulo: "Achar o que foi criado na Agenda",
    texto: "A lista de atividades da Agenda ganhou busca (título, estabelecimento, protocolo ou responsável) e filtros de situação (abertas, atrasadas, concluídas ou todas), tipo, frente e \"só as minhas\", com a contagem do que sobrou. As concluídas continuam guardadas e se reabrem com um clique.",
    frentes: ["plataforma"],
    href: "/agenda",
  },
  {
    versao: "1.51.0",
    data: "2026-09-24",
    titulo: "Atividade em uma linha",
    texto: "No topo da Agenda, escreva \"amanhã 10h ligar RA-123\" e Enter: vira atividade com o dia, a hora, o tipo (ligar é follow-up, cobrar é cobrança interna, avaliação é pedido de avaliação) e o caso ligado. A prévia mostra o que foi entendido antes de criar, e o aviso oferece desfazer.",
    frentes: ["plataforma"],
    href: "/agenda",
  },
  {
    versao: "1.50.0",
    data: "2026-09-24",
    titulo: "O lembrete avisa na hora",
    texto: "Atividade da agenda com hora marcada aparece na tela na hora, em qualquer página: com abrir o caso (quando tem protocolo), adiar 15 minutos, 1 hora ou para o próximo dia útil, concluir e dispensar. Com a sua permissão, o navegador avisa também quando a aba não está na frente.",
    frentes: ["plataforma"],
    href: "/agenda",
  },
  {
    versao: "1.49.0",
    data: "2026-09-24",
    titulo: "A Agenda numa linha do tempo, com tudo o que tem prazo",
    texto: "No topo da Agenda, o dia e a semana numa linha do tempo: as atividades, os eventos do Google, os prazos que vencem (1º contato e solução dos casos, 1º contato do NPS, retorno das áreas) e as ligações da cadência, cada um com a sua marca. O que tem hora fica no horário, com a marca de agora; o resto em \"no dia, sem hora\". Em cima, o que ficou para trás, com concluir e trazer para hoje em um clique.",
    frentes: ["plataforma", "reclame-aqui", "nps"],
    href: "/agenda",
  },
  {
    versao: "1.48.0",
    data: "2026-09-24",
    titulo: "Fim do dia que se escreve sozinho",
    texto: "No Meu dia, abaixo do checkpoint, o fim do dia pronto para copiar: o que andou hoje (contatos, respostas públicas, pedidos de avaliação, NPS, Google e a rotina), o que saiu da fila sem registro — feito por fora, tirado ou adiado, com o dia da volta — e o que ficou para amanhã, com o porquê: fora do prazo ou não coube no expediente.",
    frentes: ["plataforma"],
    href: "/meu-dia",
  },
  {
    versao: "1.47.0",
    data: "2026-09-24",
    titulo: "O que move a nota, na ordem do efeito",
    texto: "O bloco \"O que move a nota\" do Meu dia mostra as três ações de maior efeito no índice do Reclame Aqui, a maior primeiro, cada uma com a nota antes e depois. Entrou a terceira: as moderações pedidas e ainda sem decisão, com o quanto a nota sobe se o portal aceitar. O placar da semana passa a sugerir a que mais mexe.",
    frentes: ["reclame-aqui", "plataforma"],
    href: "/meu-dia",
  },
  {
    versao: "1.46.0",
    data: "2026-09-24",
    titulo: "Plano de recuperação do acumulado",
    texto: "Quando uma frente tem 10 ou mais itens fora do prazo, o Meu dia mostra o plano: a cota por dia útil que zera em uma semana (\"30 por dia, zera na quarta\"), outras cotas para escolher, e quanto saiu hoje contra a cota.",
    frentes: ["plataforma", "nps"],
    href: "/meu-dia",
  },
  {
    versao: "1.45.0",
    data: "2026-09-24",
    titulo: "Foco no Um por vez",
    texto: "O Um por vez filtra a fila: só uma frente (Reclame Aqui, Redes, NPS, Google), só os críticos — urgentes e detratores críticos — ou só o fora do prazo, cada opção com quantos itens tem. E o bloco de foco: 25 ou 45 minutos com o relógio no cabeçalho e quantos itens você fechou durante ele.",
    frentes: ["plataforma"],
    href: "/meu-dia",
  },
  {
    versao: "1.44.0",
    data: "2026-09-24",
    titulo: "A fila inteira, sem abrir item por item",
    texto: "No Um por vez, Ver a fila ganhou os botões de cada linha — feito hoje, tirar do dia e adiar para o próximo dia útil — e a caixa de marcar: marque vários (ou todos) e faça de uma vez. A linha fixa diz quantos saíram, com desfazer para todos.",
    frentes: ["plataforma"],
    href: "/meu-dia",
  },
  {
    versao: "1.43.0",
    data: "2026-09-24",
    titulo: "Adiar para outro dia",
    texto: "No Meu dia, qualquer item pode ser adiado: amanhã, o próximo dia útil ou uma data, em até 90 dias. Ele some até a véspera e volta sozinho no dia escolhido, se ainda for trabalho. Está no Um por vez (botão Adiar, e a tecla A adia para o próximo dia útil) e no menu de cada item na lista da atividade; a lista dos tirados mostra quando cada um volta, com Devolver.",
    frentes: ["plataforma"],
    href: "/meu-dia",
  },
  {
    versao: "1.42.0",
    data: "2026-09-24",
    titulo: "Um por vez: nada pula sob o mouse, e o teclado",
    texto: "No Um por vez do Meu dia, Feito hoje e Tirar do dia confirmam numa linha logo abaixo dos botões, com desfazer — sem aviso no canto nem faixa entrando em cima, e os botões ficam na mesma altura de um item para o outro. E o teclado: F feito, T tirar do dia, A passa a atividade da agenda para o próximo dia útil, J e K (ou as setas) andam, Enter abre na janela.",
    frentes: ["plataforma"],
    href: "/meu-dia",
  },
  {
    versao: "1.41.0",
    data: "2026-09-24",
    titulo: "A ficha da reclamação salva sozinha",
    texto: "Sem o botão Salvar na ficha: o que se escolhe (etapa, responsável, categoria, uma caixa marcada) grava na hora, e o que se digita grava ao sair do campo. Na base da tela aparece salvando…, depois salvo com desfazer ao lado; se o servidor recusar, o que foi digitado fica e o aviso oferece tentar de novo. Fechar a ficha com o cursor num campo grava o que estava escrito.",
    frentes: ["reclame-aqui", "redes"],
  },
  {
    versao: "1.40.0",
    data: "2026-09-23",
    titulo: "Triagem pelo relato, validação de verdade e imersão que prepara o contato",
    texto: "A triagem ganhou os critérios de Normal e mais critérios de Urgente e Alta — 21 ao todo —, e o relato sugere os que se aplicam, com o trecho que acendeu cada um. Toda reclamação abre na página pública e na área da empresa do Reclame Aqui, no quadro, no Meu dia, na busca, no sino e na extensão. A validação virou um passo próprio: a pergunta pronta, a resposta do cliente (confirmou ou apontou pendência) e o compromisso da avaliação. O passo da resposta pública mostra há quantos dias o portal exibe a reclamação como não respondida. E a imersão traz um resumo do cliente, acha ou cria a conta ali mesmo e guarda os links do Crisp e do portal.",
    frentes: ["reclame-aqui", "extensao"],
  },
  {
    versao: "1.39.0",
    data: "2026-09-23",
    titulo: "Pessoas clicáveis, nome que se preenche e anotação em uma linha",
    texto: "Na ficha da reclamação, o consumidor leva à ficha do cliente, o telefone abre o WhatsApp e a conta aparece junto. A reclamação que chega sem nome ganha o do contato pelo Completar ou pelo É este da extensão, ou num campo que grava ao sair, com desfazer. E a anotação virou uma linha com um botão pequeno de adicionar.",
    frentes: ["reclame-aqui", "extensao"],
  },
  {
    versao: "1.38.0",
    data: "2026-09-23",
    titulo: "A ficha não afirma o que não aconteceu",
    texto: "Reclamação ainda sem avaliação mostra Voltaria como não definido, e não mais como Não (eram 140). E a persistência no contato só aparece feita quando o cliente respondeu: com contato feito e sem resposta, ela é o passo da vez, aguardando o retorno.",
    frentes: ["reclame-aqui"],
  },
  {
    versao: "1.37.0",
    data: "2026-09-23",
    titulo: "Placar da semana",
    texto: "No topo do Meu dia, os números da semana contra a semana passada até o mesmo dia: avaliações positivas, respondidas, contatos do NPS no prazo, detratores revertidos, ciclos encerrados e a sequência de dias com a rotina inteira. Junto, o próximo passo que mais mexe na nota e o resumo da semana pronto para o Slack.",
    frentes: ["plataforma", "reclame-aqui", "nps"],
    href: "/meu-dia",
    tour: {
      id: "placar-da-semana",
      rota: "/meu-dia",
      passos: [
        { alvo: '[data-tour="placar"]', titulo: "A semana em números", texto: "Cada número contra a semana passada até o mesmo dia. Clique para ver a lista. O resumo para a gestão fica no botão do canto." },
      ],
    },
  },
  {
    versao: "1.36.0",
    data: "2026-09-23",
    titulo: "A extensão reconhece o contato, e lembra",
    texto: "Quando o telefone da conversa não acha ninguém, o painel pergunta quem é e mostra os parecidos pelo nome (reclamações, contas e clientes do NPS). É este liga o número à ficha para sempre, em qualquer computador, e Não é este cliente desfaz. O cliente do NPS sem reclamação aparece reconhecido, com a nota e o ciclo, e não mais como nada encontrado.",
    frentes: ["extensao", "nps"],
  },
  {
    versao: "1.35.0",
    data: "2026-09-23",
    titulo: "A conversa se guarda com o painel fechado",
    texto: "No WhatsApp, a conversa de um contato conhecido (com reclamação, NPS ou conta cadastrada) se guarda sozinha mesmo com o painel da extensão fechado. O botão da extensão ganha um ponto verde quando está guardando, e a conversa aparece na ficha do caso, do NPS e do estabelecimento.",
    frentes: ["extensao", "plataforma"],
    href: "/conversas",
  },
  {
    versao: "1.34.0",
    data: "2026-09-23",
    titulo: "A IA diz se está no ar",
    texto: "Em Configurações, Integrações, o cartão da IA mostra a última resposta boa (qual provedor, qual modelo, em quanto tempo e em qual ambiente) e o último erro, sem precisar medir. E o Medir agora diz qual modelo respondeu.",
    frentes: ["plataforma"],
    href: "/configuracoes/integracoes",
  },
  {
    versao: "1.33.0",
    data: "2026-09-23",
    titulo: "O plano do dia na Google Agenda",
    texto: "No Meu dia, Levar para a agenda põe cada bloco do plano na sua Google Agenda, no horário do bloco, com os itens e os links. Mostra o que vai antes de mandar, e mandar de novo atualiza os mesmos blocos, sem duplicar e sem tocar nos seus eventos. O nome do cliente e o comentário do NPS ficam fora. E o checkpoint agora fica no horário dele, mesmo com a manhã atrasada.",
    frentes: ["plataforma"],
    href: "/meu-dia",
  },
  {
    versao: "1.32.0",
    data: "2026-09-23",
    titulo: "Contato antes de classificar, e sem retorno só depois de 2 horas",
    texto: "No NPS sem comentário, a trilha pede primeiro o contato e a conversa, e só depois a classificação. Em todas as frentes, Tentei contato grava a tentativa como aguardando retorno: ela já conta como 1º contato, mas só vira sem retorno 2 horas depois, com o botão Marcar sem retorno na ficha. No Meu dia, a tentativa que passou das 2 horas aparece em FUPs.",
    frentes: ["nps", "reclame-aqui", "redes", "extensao"],
    href: "/nps",
  },
  {
    versao: "1.31.0",
    data: "2026-09-23",
    titulo: "Meu dia: cada item sai com um clique, na ordem do documento",
    texto: "Na lista de cada atividade, marque o item como feito hoje ou tire da atividade (só hoje, por 7 dias ou até devolver). O que saiu fica listado para devolver. A linha inteira abre a lista, e o Um por vez ganhou Ver a fila, Feito hoje e Tirar do dia, sem pular de lugar depois de uma ação. A ordem é a do documento (Reclame Aqui, Redes, NPS, Google; no NPS, o detrator crítico primeiro), e o que está fora do prazo agora entra nas atividades: o NPS vencido e as reclamações antigas sem resposta. De quebra, a aba do navegador ganhou o ícone da plataforma.",
    frentes: ["plataforma", "reclame-aqui", "nps"],
    href: "/meu-dia",
  },
  {
    versao: "1.30.0",
    data: "2026-09-23",
    titulo: "A primeira semana guiada",
    texto: "Quem está começando vê, na primeira visita a cada tela principal, um convite pequeno no rodapé para um tour de dois ou três passos: Meu dia, Reclame Aqui, NPS, Redes Sociais e Agenda. Aparece uma vez por tela, só na primeira semana, e some para quem já concluiu ou dispensou o roteiro do primeiro acesso.",
    frentes: ["plataforma"],
    href: "/primeiro-acesso",
  },
  {
    versao: "1.29.0",
    data: "2026-09-23",
    titulo: "Conquistas da semana",
    texto: "No Meu dia, o cartão Conquistas mostra também a semana, de segunda até hoje: avaliações positivas, reclamações respondidas com a espera real, primeiros contatos do NPS no prazo, detratores revertidos e ciclos encerrados. Só o que o banco confirma, sem linha de zero.",
    frentes: ["plataforma", "reclame-aqui", "nps"],
    href: "/meu-dia",
  },
  {
    versao: "1.28.0",
    data: "2026-09-23",
    titulo: "Pergunte à plataforma",
    texto: "Digite uma pergunta no Ctrl+K e o primeiro resultado leva ao assistente, já perguntando. A ficha do caso, o relatório e a extensão ganharam o mesmo atalho, e quando a pergunta cita um protocolo o assistente recebe o caso inteiro. De quebra, o filtro Sem resposta pública do painel voltou a listar só as que estão sem resposta.",
    frentes: ["plataforma", "reclame-aqui", "extensao"],
  },
  {
    versao: "1.27.0",
    data: "2026-09-22",
    titulo: "Triagem, dossiê e resumo mesmo sem IA",
    texto: "Quando nenhuma IA responde, a triagem da extensão, o dossiê do caso e o resumo das conversas da plataforma saem pelo motor próprio, pelas regras da documentação e só com os fatos registrados, em vez de parar no erro. As peças do dossiê vão sempre junto.",
    frentes: ["extensao", "plataforma"],
  },
  {
    versao: "1.26.0",
    data: "2026-09-22",
    titulo: "A conversa se guarda sozinha",
    texto: "Conversa de cliente com caso ou NPS aberto é guardada na plataforma sozinha enquanto está na tela, só com as mensagens novas. Dá para pausar por conversa, no próprio painel. Conversa de quem não tem nada aberto continua no botão, com confirmação.",
    frentes: ["extensao"],
  },
  {
    versao: "1.25.0",
    data: "2026-09-22",
    titulo: "O painel da extensão em quatro abas",
    texto: "Quem é, os avisos e o completar ficam fixos em cima; o resto se divide em Agora (resumo, resposta, NPS, anotação), Dossiê, Responder (textos aprovados) e Histórico (reclamações, números do cliente, estabelecimento). Trocar de aba é instantâneo e não recarrega nada.",
    frentes: ["extensao"],
  },
  {
    versao: "1.24.0",
    data: "2026-09-22",
    titulo: "O painel acha o cliente pelo que ele escreveu",
    texto: "Quando o nome ou o número da página não bastam, o painel da extensão procura o cliente pelo CPF/CNPJ, protocolo do Reclame Aqui, e-mail ou telefone que ele escreveu na conversa, e diz no cabeçalho de onde veio a identificação.",
    frentes: ["extensao"],
  },
  {
    versao: "1.23.0",
    data: "2026-09-22",
    titulo: "Cabeçalho do cliente no painel",
    texto: "O painel da extensão abre com quem é, de qual conta, o que está aberto em cada frente (Reclame Aqui, Redes, NPS) e um termômetro do humor da conversa, com seta quando piora ou melhora. Os avisos ficam em no máximo cinco, o mais grave primeiro.",
    frentes: ["extensao"],
  },
  {
    versao: "1.22.0",
    data: "2026-09-22",
    titulo: "Completar o cadastro pela conversa",
    texto: "Quando o cliente escreve na conversa um e-mail, telefone ou CPF/CNPJ que o caso não tem, o painel da extensão mostra o que encontrou e oferece Completar o cadastro. Só preenche o que está vazio, nunca troca o que já existe, e só grava com o clique.",
    frentes: ["extensao"],
  },
  {
    versao: "1.21.0",
    data: "2026-09-22",
    titulo: "A conversa também avisa",
    texto: "Com uma conversa aberta, o painel da extensão lê as mensagens do cliente e acrescenta dois avisos: quando o humor piorou nas últimas mensagens, e quando a mensagem é a mesma de uma reclamação do Reclame Aqui (\"A mensagem é a mesma da reclamação RA-x\"), com ou sem cadastro do contato. Sem IA, uma consulta por contato.",
    frentes: ["extensao"],
  },
  {
    versao: "1.20.0",
    data: "2026-09-22",
    titulo: "Avisos ao abrir a conversa",
    texto: "O painel da extensão abre com até quatro linhas do que pede cuidado com aquele contato: prazo estourado ou perto de vencer, risco de cancelamento, detrator do NPS (e há quantos dias), quantas vezes já reclamou e quantas terminaram sem solução. O mais grave vem primeiro.",
    frentes: ["extensao"],
  },
  {
    versao: "1.19.0",
    data: "2026-09-18",
    titulo: "Atalhos no painel da extensão",
    texto: "Com o painel aberto pelo Alt+Shift+C, o foco já vai para ele: / vai para a busca, 1 a 5 trocam de aba (Reclame Aqui, NPS, Redes, Painel, Atividades) e Esc fecha. As teclas só valem dentro do painel, para não disputar com os atalhos do WhatsApp nem com o que se digita na conversa. Atalhos, no rodapé (ou ?), mostra a lista.",
    frentes: ["extensao"],
  },
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
        { alvo: '[data-tour="itens-da-atividade"]', titulo: "O que falta em cada item", texto: "Na lista de cada atividade, a linha “Falta:” diz o próximo passo do caso." },
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
