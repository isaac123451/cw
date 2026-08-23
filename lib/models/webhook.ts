/**
 * Nomes e rótulos dos eventos de webhook.
 *
 * Separado de `webhook.service.ts` porque o serviço é `server-only` (usa
 * `node:crypto` e o Prisma) e a tela de Integrações é client component:
 * importar o serviço de lá envenenava o bundle do cliente e derrubava a
 * rota inteira em tempo de execução, sem `tsc` nem `lint` reclamarem.
 */

export const WEBHOOK_EVENTS = [
  "caso.criado",
  "caso.avaliado",
  "movimentacao.atrasada",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const WEBHOOK_EVENT_LABELS: Record<
  WebhookEvent,
  string
> = {
  "caso.criado": "Caso criado",
  "caso.avaliado": "Caso avaliado",
  /**
   * Atraso não é evento, é estado.
   *
   * Os outros dois nascem de alguém gravando alguma coisa. Este só
   * existe quando o relógio passa do prazo, e ninguém está gravando
   * nada nesse instante — por isso quem o dispara é a rotina agendada,
   * e por isso ele não existia antes de haver uma.
   */
  "movimentacao.atrasada": "Movimentação atrasada",
};
