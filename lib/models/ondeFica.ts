/**
 * Onde fica? (12/11/2026) — "preciso de um roadmap de um primeiro acesso
 * bem intuitivo, apontando o que cada funcionalidade faz e como encontrar
 * tal coisa".
 *
 * A fonte única de "o que é e onde está": a aba Onde fica? do Primeiro
 * acesso desenha esta lista, e a busca (Ctrl K) acha cada função pelo nome
 * e pelos apelidos. `caminho` é o clique de verdade no menu; `href` é para
 * onde o "Ir até lá" leva. O que fica fora da plataforma (a extensão) ou em
 * toda tela (o sino, o Próximo passo) aponta para o próprio item aqui.
 */

export type GrupoDoMapa =
  | "Em qualquer tela"
  | "Hoje"
  | "Frentes"
  | "Pessoas e contas"
  | "Inteligência"
  | "Conhecimento"
  | "Ajustes"
  | "Extensão do Chrome";

export interface FuncaoDoMapa {
  id: string;
  grupo: GrupoDoMapa;
  nome: string;
  faz: string;
  caminho: string[];
  /** Para onde o "Ir até lá" leva. Sem ele, a função não é uma tela (a extensão, o sino). */
  href?: string;
  /** Palavras que as pessoas usam para procurar, sem acento e em minúsculas. */
  sinonimos: string[];
}

export const GRUPOS_DO_MAPA: GrupoDoMapa[] = ["Em qualquer tela", "Hoje", "Frentes", "Pessoas e contas", "Inteligência", "Conhecimento", "Ajustes", "Extensão do Chrome"];

const f = (id: string, grupo: GrupoDoMapa, nome: string, faz: string, caminho: string[], href: string | undefined, sinonimos: string[] = []): FuncaoDoMapa => ({ id, grupo, nome, faz, caminho, href, sinonimos });

export const MAPA: FuncaoDoMapa[] = [
  f("busca", "Em qualquer tela", "Busca", "Acha casos, clientes, telefones, conversas e qualquer tela pelo nome.", ["Barra do topo", "Ctrl + K"], undefined, ["procurar", "pesquisar", "achar", "ctrl k"]),
  f("proximo-passo", "Em qualquer tela", "Próximo passo", "Diz o que fazer agora e quantos itens faltam no dia.", ["Botão no canto inferior direito"], undefined, ["o que fazer", "proximo", "fila"]),
  f("notificacoes", "Em qualquer tela", "Notificações", "Avisos do dia, como o vigia do Reclame Aqui parado ou um prazo vencendo.", ["Sino no topo"], undefined, ["sino", "avisos", "alertas"]),
  f("assistente", "Em qualquer tela", "Assistente", "Responde perguntas sobre os casos e mostra o que a IA fez hoje.", ["Menu", "Inteligência", "Assistente"], "/assistente", ["ia", "perguntar", "chat", "o que a ia fez"]),
  f("fixar", "Em qualquer tela", "Fixar no menu", "Leva as telas que você mais usa para o topo do menu.", ["Menu lateral", "Alfinete ao lado do nome"], undefined, ["fixados", "favoritos", "alfinete"]),
  f("conta", "Em qualquer tela", "Sua conta", "Perfil, senha e quais notificações você recebe.", ["Seu nome no topo", "Perfil, Senha ou Notificações"], "/conta", ["perfil", "senha", "foto", "trocar senha"]),

  f("meu-dia", "Hoje", "Meu dia", "A fila de hoje, dividida entre quem recebe atendimentos, com o que vem primeiro.", ["Menu", "Hoje", "Meu dia"], "/meu-dia", ["rotina", "fila do dia", "hoje", "o dia de"]),
  f("agenda", "Hoje", "Agenda", "Atividades, follow-ups, cobranças internas e pendências do time.", ["Menu", "Hoje", "Agenda"], "/agenda", ["fup", "follow up", "lembrete", "cobranca interna", "pendencias"]),
  f("dashboard", "Hoje", "Dashboard", "A reputação em uma tela: o que está sem resposta, atrasado ou em risco.", ["Menu", "Hoje", "Dashboard"], "/dashboard", ["painel", "visao geral", "resumo"]),

  f("ra-quadro", "Frentes", "Quadro do Reclame Aqui", "As reclamações em quadro e em lista, e a triagem das abertas.", ["Menu", "Frentes", "Reclame Aqui", "Quadro"], "/reclame-aqui", ["reclamacoes", "kanban", "triagem", "ficha do caso"]),
  f("ra-avaliacoes", "Frentes", "Pedir avaliação", "Quem pedir avaliação hoje, na cadência da documentação.", ["Menu", "Frentes", "Reclame Aqui", "Avaliações"], "/reclame-aqui/avaliacoes", ["avaliacao", "pedir nota", "cadencia"]),
  f("ra-respostas", "Frentes", "Analista de respostas", "Confere as respostas públicas e aponta o que melhorar.", ["Menu", "Frentes", "Reclame Aqui", "Respostas"], "/reclame-aqui/respostas", ["resposta publica", "revisar resposta", "erros"]),
  f("ra-nota", "Frentes", "Nota e metas", "A nota do Reclame Aqui, as metas do mês, a simulação e o Prêmio.", ["Menu", "Frentes", "Reclame Aqui", "Nota e metas"], "/reclame-aqui/indice", ["nota", "meta", "indice", "ra1000", "premio", "simulacao"]),
  f("ra-analise", "Frentes", "Análise do Reclame Aqui", "Indicadores, gráficos e o tempo ideal de resposta.", ["Menu", "Frentes", "Reclame Aqui", "Análise"], "/reclame-aqui/analytics", ["graficos", "indicadores", "tempo ideal"]),
  f("ra-configurar", "Frentes", "Fluxo e categorias", "As colunas do quadro e as categorias oficiais.", ["Menu", "Frentes", "Reclame Aqui", "Configurar"], "/reclame-aqui/configuracoes", ["colunas", "etapas", "categorias", "fluxo"]),
  f("redes", "Frentes", "Redes Sociais", "Atendimentos do Instagram e outras redes, com o dia a dia e o prazo de 1º contato.", ["Menu", "Frentes", "Redes Sociais"], "/redes-sociais", ["instagram", "facebook", "dm", "comentario", "redes"]),
  f("nps-ciclos", "Frentes", "Ciclos do NPS", "Quem respondeu a pesquisa, em quadro e em lista, com o dia a dia e quem respondeu ao contato.", ["Menu", "Frentes", "NPS", "Ciclos"], "/nps", ["nps", "pesquisa", "wootric", "detrator", "promotor", "respondeu"]),
  f("nps-promotores", "Frentes", "Promotores em lote", "Monta a lista de disparo pelo WhatsApp para os promotores.", ["Menu", "Frentes", "NPS", "Ciclos", "Promotores em lote"], "/nps", ["lista de disparo", "depoimento", "promotores"]),
  f("nps-analise", "Frentes", "Análise do NPS", "A nota, os segmentos e a taxa de resposta no WhatsApp.", ["Menu", "Frentes", "NPS", "Análise do NPS"], "/nps/analise", ["taxa de resposta", "segmentos", "nota do nps"]),
  f("google", "Frentes", "Google", "As avaliações do Google: responder, tratar no privado e encerrar.", ["Menu", "Frentes", "Google"], "/google", ["google meu negocio", "estrelas", "avaliacao do google"]),
  f("conversas", "Frentes", "Conversas do WhatsApp", "As conversas guardadas pela extensão, com os áudios transcritos.", ["Menu", "Frentes", "Conversas do WhatsApp"], "/conversas", ["whatsapp", "audio", "transcricao", "mensagens", "conversa guardada"]),

  f("clientes", "Pessoas e contas", "Clientes", "As pessoas por trás de cada caso, com o que têm em cada frente.", ["Menu", "Pessoas e contas", "Clientes"], "/clientes", ["pessoas", "consumidor", "dono", "contato"]),
  f("estabelecimentos", "Pessoas e contas", "Estabelecimentos", "Os restaurantes da base: plano, faturamento e as quatro frentes.", ["Menu", "Pessoas e contas", "Estabelecimentos"], "/estabelecimentos", ["restaurante", "conta", "cnpj", "plano", "faturamento", "quatro frentes"]),
  f("jornada", "Pessoas e contas", "Jornada do Cliente", "O ciclo de vida de cada cliente e quem está em risco.", ["Menu", "Pessoas e contas", "Jornada do Cliente"], "/jornada", ["risco", "ciclo de vida", "recorrente"]),

  f("okr", "Inteligência", "OKR", "Os objetivos do trimestre com os números calculados.", ["Menu", "Inteligência", "OKR"], "/okr", ["objetivos", "kr", "trimestre"]),
  f("relatorio", "Inteligência", "Relatório do ciclo", "O resumo do período e a planilha de métricas.", ["Menu", "Inteligência", "Relatório do ciclo"], "/relatorio", ["relatorio", "planilha de metricas", "resumo do mes"]),
  f("analytics", "Inteligência", "Analytics", "Gráficos e indicadores das frentes juntas.", ["Menu", "Inteligência", "Analytics"], "/analytics", ["graficos", "indicadores"]),
  f("causas", "Inteligência", "Causas raiz", "O catálogo de causas, com a área dona e o prazo de cada uma.", ["Menu", "Inteligência", "Causas raiz"], "/causas-raiz", ["causa", "motivo", "area responsavel"]),
  f("retencao", "Inteligência", "Cancelamento e retenção", "Quem pediu para cancelar e quem a operação conseguiu manter.", ["Menu", "Inteligência", "Cancelamento e retenção"], "/retencao", ["cancelamento", "churn", "reter", "retido"]),
  f("impacto", "Inteligência", "Impacto no Negócio", "O valor que a operação mantém e recupera.", ["Menu", "Inteligência", "Impacto no Negócio"], "/impacto", ["financeiro", "dinheiro", "receita", "reembolso"]),

  f("documentacao", "Conhecimento", "Documentação", "As regras de cada frente, com o porquê de cada passo.", ["Menu", "Conhecimento", "Documentação"], "/documentacao", ["regras", "guia", "manual", "documento"]),
  f("respostas-prontas", "Conhecimento", "Respostas prontas", "Modelos de resposta, com a nota que cada um trouxe depois.", ["Menu", "Conhecimento", "Respostas prontas"], "/base-conhecimento", ["macros", "modelo de resposta", "texto pronto"]),
  f("aprendizados", "Conhecimento", "O que a IA aprendeu", "O que a IA tirou das conversas e da Documentação, para revisar.", ["Menu", "Conhecimento", "O que a IA aprendeu"], "/aprendizados", ["aprendizados", "ia aprendeu"]),
  f("processos", "Conhecimento", "Processos e SLA", "Os prazos de cada frente e de cada área interna.", ["Menu", "Conhecimento", "Processos e SLA"], "/processos", ["sla", "prazos", "feriados", "expediente"]),
  f("projetos", "Conhecimento", "Projetos e Melhorias", "As melhorias pedidas às outras áreas e em que pé estão.", ["Menu", "Conhecimento", "Projetos e Melhorias"], "/projetos", ["melhorias", "projetos", "pedido para outra area"]),
  f("ferramentas", "Conhecimento", "Ferramentas e acessos", "Os sistemas que o time usa e como entrar em cada um.", ["Menu", "Conhecimento", "Ferramentas e acessos"], "/ferramentas", ["acessos", "logins", "sistemas"]),
  f("novidades", "Conhecimento", "Novidades", "O que mudou na plataforma, versão a versão.", ["Menu", "Conhecimento", "Novidades"], "/novidades", ["versao", "o que mudou", "atualizacoes"]),

  f("permissoes", "Ajustes", "Permissões", "Quem vê cada frente e quem recebe atendimentos no Meu dia.", ["Menu", "Configurações", "Permissões"], "/configuracoes/permissoes", ["recebe atendimentos", "acesso", "divisao do dia", "usuarios"]),
  f("integracoes", "Ajustes", "Integrações", "Wootric, IA, e-mail e os erros que a extensão registrou.", ["Menu", "Configurações", "Integrações"], "/configuracoes/integracoes", ["wootric", "gemini", "erros da extensao", "email"]),

  f("ext-whatsapp", "Extensão do Chrome", "Painel no WhatsApp", "O cartão do cliente ao lado da conversa, as respostas e o salvamento automático.", ["WhatsApp Web", "Painel roxo à direita"], undefined, ["extensao", "cartao do cliente", "guardar conversa"]),
  f("ext-vigia", "Extensão do Chrome", "Vigia do Reclame Aqui", "Lê o portal a cada 30 min e traz as reclamações novas.", ["Portal do Reclame Aqui", "Selo CW na lista"], undefined, ["vigia", "portal", "enviar ao cw", "selo"]),
  f("ext-caso-rapido", "Extensão do Chrome", "Caso rápido", "Abre um caso novo de onde você estiver.", ["Qualquer aba", "Alt + Shift + K"], undefined, ["novo caso", "atalho", "alt shift k"]),
  f("ext-disparo", "Extensão do Chrome", "Disparo em lote", "Abre cada contato da lista com a mensagem escrita; você aperta Enter.", ["WhatsApp Web", "Painel do disparo"], undefined, ["disparo", "envio em massa", "lista de envio"]),
  f("ext-planilha", "Extensão do Chrome", "Ler para as Redes", "Lê a planilha de marketing e grava os atendimentos das redes.", ["Planilha de marketing", "Botão Ler para as Redes"], undefined, ["planilha", "marketing", "importar redes"]),
];

/** O endereço do item dentro da aba Onde fica? — para o que não é uma tela. */
export const hrefNoMapa = (id: string) => `/primeiro-acesso?aba=onde-fica#${id}`;

const semAcento = (t: string) => t.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

/** Filtra o mapa pelo que a pessoa digitou: nome, o que faz, o caminho e os apelidos. */
export function filtrarMapa(termo: string, mapa: FuncaoDoMapa[] = MAPA) {
  const q = semAcento(termo.trim());
  if (!q) return mapa;
  return mapa.filter((m) => semAcento(`${m.nome} ${m.faz} ${m.caminho.join(" ")} ${m.grupo} ${m.sinonimos.join(" ")}`).includes(q));
}

/** As funções como telas da busca: o nome, o grupo e os apelidos; a que não é tela leva ao item no mapa. */
export function funcoesParaABusca(mapa: FuncaoDoMapa[] = MAPA) {
  return mapa.map((m) => ({
    titulo: m.nome,
    href: m.href ?? hrefNoMapa(m.id),
    grupo: m.href ? m.grupo : `Onde fica? · ${m.grupo}`,
    sinonimos: [...m.sinonimos, semAcento(m.faz)],
  }));
}
