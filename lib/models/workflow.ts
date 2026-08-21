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