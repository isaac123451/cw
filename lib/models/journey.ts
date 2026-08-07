/** Etapa do ciclo de vida do cliente — colunas do quadro da Jornada. */
export interface JourneyStage {
  id: string;
  name: string;
  color: string;
  description: string;
  order: number;
  active: boolean;
}

/**
 * Tópico livre criado pela operação para ir moldando a jornada — por
 * exemplo "Pontos críticos", "Oportunidades", "Combinados".
 */
export interface JourneyTopic {
  id: string;
  name: string;
  icon: string;
  color: string;
  order: number;
}

/** Registro dentro de um tópico, sempre amarrado a um cliente. */
export interface JourneyEntry {
  id: string;
  company: string;
  topicId: string;
  text: string;
  author: string;
  createdAt: string;
}
