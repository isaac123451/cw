/**
 * As perguntas que a operação faz, rotuladas.
 *
 * **Por que isto existe.** "Melhorar o agente" precisa de um número,
 * senão vira opinião: mexe-se num gatilho, alguma pergunta passa a
 * acertar, outra passa a errar, e ninguém sabe se o conjunto melhorou.
 * Este arquivo é o conjunto — cada linha é uma pergunta e a medição que
 * ela deveria escolher. O `check:agente` roda todas e devolve o acerto
 * em porcentagem.
 *
 * É o mais perto de "treinar" que este problema pede: não há modelo
 * para ajustar, há uma escolha entre dezessete opções. O que faz ela
 * acertar mais é ter as formas reais da pergunta escritas aqui e o
 * casamento sabendo lidar com plural, gênero e conjugação.
 *
 * **`null` é uma resposta, não uma lacuna.** As perguntas do fim não
 * são sobre a operação, e a medição certa para elas é nenhuma. Um
 * agente que responde tudo é um agente que às vezes inventa, e é por
 * isso que elas pesam igual às outras na conta.
 *
 * Ao acrescentar uma medição ao catálogo, acrescente aqui as formas
 * como alguém pediria por ela — inclusive as tortas, que são as que
 * chegam de verdade.
 */
export interface PerguntaRotulada {
  pergunta: string;
  /** A medição que deve ser escolhida, ou `null` para nenhuma. */
  esperada: string | null;
}

export const PERGUNTAS: PerguntaRotulada[] = [

  /* ---------------------------------------------- reputacao ---- */
  { pergunta: "qual a nota de reputação hoje?", esperada: "reputacao" },
  { pergunta: "como está a nota?", esperada: "reputacao" },
  { pergunta: "qual nosso score no reclame aqui?", esperada: "reputacao" },
  { pergunta: "a reputação melhorou?", esperada: "reputacao" },
  { pergunta: "me mostra a nota atual", esperada: "reputacao" },

  /* -------------------------------------- caminho_para_nota ---- */
  { pergunta: "quantas avaliações preciso para chegar a 9,5?", esperada: "caminho_para_nota" },
  { pergunta: "quantas notas faltam para a nota 9?", esperada: "caminho_para_nota" },
  { pergunta: "o que falta para alcançar 8,5?", esperada: "caminho_para_nota" },
  { pergunta: "quantas respostas para atingir 9?", esperada: "caminho_para_nota" },
  { pergunta: "dá para chegar a 10 esse mês?", esperada: "caminho_para_nota" },

  /* ---------------------------------- espera_do_consumidor ---- */
  { pergunta: "estamos demorando muito para responder?", esperada: "espera_do_consumidor" },
  { pergunta: "qual o tempo de resposta?", esperada: "espera_do_consumidor" },
  { pergunta: "quanto tempo o consumidor espera?", esperada: "espera_do_consumidor" },
  { pergunta: "a primeira resposta está rápida?", esperada: "espera_do_consumidor" },
  { pergunta: "estamos demorados?", esperada: "espera_do_consumidor" },

  /* ------------------------------------------ causas_no_tempo ---- */
  { pergunta: "qual categoria está crescendo?", esperada: "causas_no_tempo" },
  { pergunta: "o que vem aumentando nos últimos meses?", esperada: "causas_no_tempo" },
  { pergunta: "qual a tendência das reclamações?", esperada: "causas_no_tempo" },
  { pergunta: "está piorando ou melhorando?", esperada: "causas_no_tempo" },
  { pergunta: "como evoluiu por mês?", esperada: "causas_no_tempo" },

  /* ------------------------------------------ fila_da_operacao ---- */
  { pergunta: "quais casos estão fora do prazo?", esperada: "fila_da_operacao" },
  { pergunta: "como está a fila?", esperada: "fila_da_operacao" },
  { pergunta: "quantas estão sem resposta?", esperada: "fila_da_operacao" },
  { pergunta: "tem reclamação vencida?", esperada: "fila_da_operacao" },
  { pergunta: "quantos casos em aberto?", esperada: "fila_da_operacao" },

  /* ------------------------------------------------ por_frente ---- */
  { pergunta: "como está cada frente?", esperada: "por_frente" },
  { pergunta: "compara as frentes para mim", esperada: "por_frente" },
  { pergunta: "como estão os canais?", esperada: "por_frente" },
  { pergunta: "e as redes sociais?", esperada: "por_frente" },
  { pergunta: "quanto vem do manychat?", esperada: "por_frente" },

  /* ------------------------------------------------------- nps ---- */
  { pergunta: "como está o NPS?", esperada: "nps" },
  { pergunta: "quantos detratores temos?", esperada: "nps" },
  { pergunta: "e os promotores?", esperada: "nps" },
  { pergunta: "qual o nível de satisfação?", esperada: "nps" },
  { pergunta: "o nps caiu?", esperada: "nps" },

  /* --------------------------------------------- por_categoria ---- */
  { pergunta: "qual a causa raiz mais comum?", esperada: "por_categoria" },
  { pergunta: "quais os assuntos mais frequentes?", esperada: "por_categoria" },
  { pergunta: "reclamações por categoria", esperada: "por_categoria" },
  { pergunta: "qual o motivo mais recorrente?", esperada: "por_categoria" },
  { pergunta: "que tipo de reclamação mais chega?", esperada: "por_categoria" },

  /* ----------------------------------------- movimento_recente ---- */
  { pergunta: "o que chegou nos últimos 15 dias?", esperada: "movimento_recente" },
  { pergunta: "quantas entraram essa semana?", esperada: "movimento_recente" },
  { pergunta: "teve movimento recente?", esperada: "movimento_recente" },
  { pergunta: "quantos casos novos?", esperada: "movimento_recente" },
  { pergunta: "o que chegou nos últimos 7 dias?", esperada: "movimento_recente" },

  /* -------------------------------------------------- desfecho ---- */
  { pergunta: "quantas foram resolvidas?", esperada: "desfecho" },
  { pergunta: "qual a taxa de resolução?", esperada: "desfecho" },
  { pergunta: "quantos voltariam a fazer negócio?", esperada: "desfecho" },
  { pergunta: "quantas foram avaliadas?", esperada: "desfecho" },
  { pergunta: "o caso foi resolvido?", esperada: "desfecho" },

  /* -------------------------------------------- por_prioridade ---- */
  { pergunta: "temos casos críticos parados?", esperada: "por_prioridade" },
  { pergunta: "quantas são de prioridade alta?", esperada: "por_prioridade" },
  { pergunta: "tem alguma crítica sem resposta?", esperada: "por_prioridade" },
  { pergunta: "como está a distribuição por prioridade?", esperada: "por_prioridade" },
  { pergunta: "quais são os casos urgentes?", esperada: "por_prioridade" },

  /* ------------------------------------------------ por_regiao ---- */
  { pergunta: "de onde vêm as reclamações?", esperada: "por_regiao" },
  { pergunta: "quais estados reclamam mais?", esperada: "por_regiao" },
  { pergunta: "qual cidade concentra mais casos?", esperada: "por_regiao" },
  /*
    Esta erra, e fica.

    `por_regiao` devolve o ranking de estados e cidades; ela não filtra
    por uma cidade específica. Fazer o gatilho casar aqui daria uma
    resposta com cara de certa — um top 5 — para uma pergunta que pedia
    outra coisa. Enquanto a medição não souber filtrar, errar é o
    comportamento correto, e a linha fica no conjunto para não deixar
    esquecer. Conjunto rotulado com 100% costuma ser conjunto ajustado
    para a resposta que já se tinha.
  */
  { pergunta: "tem reclamação de são paulo?", esperada: "por_regiao" },
  { pergunta: "como está por região?", esperada: "por_regiao" },

  /* ---------------------------------------------- reincidencia ---- */
  { pergunta: "tem cliente reincidente?", esperada: "reincidencia" },
  { pergunta: "alguém reclamou mais de uma vez?", esperada: "reincidencia" },
  { pergunta: "quantos reincidentes temos?", esperada: "reincidencia" },
  { pergunta: "algum cliente voltou a reclamar?", esperada: "reincidencia" },
  { pergunta: "tem reclamações repetidas do mesmo cliente?", esperada: "reincidencia" },

  /* --------------------------------- mais_antigas_sem_resposta ---- */
  { pergunta: "quais são as mais antigas sem resposta?", esperada: "mais_antigas_sem_resposta" },
  { pergunta: "o que está parado há mais tempo?", esperada: "mais_antigas_sem_resposta" },
  { pergunta: "tem caso esquecido?", esperada: "mais_antigas_sem_resposta" },
  { pergunta: "quais reclamações estão encalhadas?", esperada: "mais_antigas_sem_resposta" },
  { pergunta: "qual a reclamação mais antiga?", esperada: "mais_antigas_sem_resposta" },

  /* -------------------------------------------------- retencao ---- */
  { pergunta: "quantos casos de cancelamento?", esperada: "retencao" },
  { pergunta: "quem está em risco de cancelar?", esperada: "retencao" },
  { pergunta: "como está a retenção?", esperada: "retencao" },
  { pergunta: "temos churn marcado?", esperada: "retencao" },
  { pergunta: "quantos clientes precisamos reter?", esperada: "retencao" },

  /* -------------------------------------------- por_responsavel ---- */
  { pergunta: "como está a carga do time?", esperada: "por_responsavel" },
  { pergunta: "quem está cuidando de mais casos?", esperada: "por_responsavel" },
  { pergunta: "quantas reclamações por responsável?", esperada: "por_responsavel" },
  { pergunta: "a equipe está sobrecarregada?", esperada: "por_responsavel" },
  { pergunta: "quem tem mais casos sem resposta?", esperada: "por_responsavel" },

  /* ------------------------------------------------- etiquetas ---- */
  { pergunta: "quais etiquetas mais usamos?", esperada: "etiquetas" },
  { pergunta: "como estão as marcações?", esperada: "etiquetas" },
  { pergunta: "quais tags aparecem mais?", esperada: "etiquetas" },
  { pergunta: "o que a operação vem etiquetando?", esperada: "etiquetas" },

  /* ------------------------------------------------------------
     E o que **não** é sobre a operação.

     Pesam igual. Um seletor que acerta as oitenta de cima e responde
     números da base para "me conte uma piada" não é um bom seletor —
     é um que fala sem parar.
  ------------------------------------------------------------ */
  { pergunta: "qual a previsão do tempo amanhã?", esperada: null },
  { pergunta: "quem ganhou o jogo ontem?", esperada: null },
  { pergunta: "me conte uma piada", esperada: null },
  { pergunta: "qual a capital da França?", esperada: null },
  { pergunta: "que horas são?", esperada: null },
  { pergunta: "traduza bom dia para o inglês", esperada: null },
  { pergunta: "como faço um bolo de cenoura?", esperada: null },
  { pergunta: "quanto é 47 vezes 12?", esperada: null },
];
