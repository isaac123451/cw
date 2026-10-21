export interface WorkflowStatus {
  id: string;

  name: string;

  color: string;

  order: number;

  active: boolean;

  limit?: number;

  /**
   * Minutos entre lembretes enquanto o caso ficar nesta etapa.
   *
   * Indefinido = etapa silenciosa, que é o padrão. Quem cobra é a
   * extensão: ela pergunta ao servidor quais casos estão parados em
   * etapas com lembrete ligado e avisa de tempos em tempos, até o caso
   * sair dali.
   */
  reminderMinutes?: number;

  createdAt?: string;
}
/**
 * O que cada coluna do quadro do Reclame Aqui quer dizer, e como a
 * reclamação chega e sai dela (21/10/2026: "coisas que ajudariam para
 * entender como funciona x coisa"). Aparece ao passar o mouse no nome
 * da coluna. Coluna criada pela operação fica sem dica.
 */
export const DICA_DA_ETAPA: Record<string, string> = {
  Novo: "Chegou do portal e ainda não foi respondida. O relógio do 1º contato (1 dia útil) e o da resposta pública correm daqui.",
  "Em tratativa": "Coluna da operação: alguém está resolvendo. O vigia não tira daqui — a não ser que o consumidor faça réplica depois da última mexida, ou avalie.",
  "Aguardando retorno": "Coluna da operação: esperando o cliente ou uma área interna. Mesmas regras de \"Em tratativa\".",
  "Aguardando nossa réplica": "A última palavra no portal é do consumidor: ele respondeu à nossa resposta. A bola está conosco — responda a réplica.",
  "Aguardando avaliação": "Respondida no portal e sem avaliação. É daqui que vem a nota nova: peça a avaliação quando o problema estiver resolvido.",
  Resolvido: "O consumidor avaliou e marcou como resolvida. Não volta para trás.",
  "Não resolvido": "O consumidor avaliou e marcou como não resolvida. Não volta para trás; pode ir para moderação quando cabe.",
  Finalizado: "Encerrada pela operação sem avaliação do consumidor.",
};
