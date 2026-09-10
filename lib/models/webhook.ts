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

/** Hosts que só existem dentro da própria máquina ou rede. */
const IP_PRIVADO =
  /^(?:10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/;

/**
 * O que há de errado com este endereço de webhook — ou `null`.
 *
 * **Não havia validação nenhuma.** O único webhook cadastrado em
 * 10/09/2026 era `teste.com/webhook`: resíduo de teste, ativo, com oito
 * entregas falhas. Só não vazou nada porque faltava o `https://` e o
 * endereço era inválido — `teste.com` é um domínio real, de terceiros,
 * e com o prefixo certo os eventos das reclamações teriam ido para lá.
 *
 * - **https obrigatório.** O corpo leva dados das reclamações; em http
 *   eles atravessam a rede abertos. Fora de produção, `http://localhost`
 *   passa, para dar para testar com um receptor local.
 * - **Nada interno em produção.** Endereço de rede privada ou da própria
 *   máquina faria o servidor da aplicação bater em serviço que não é
 *   dele. Só quem é ADMIN configura, mas a trava custa uma linha.
 * - **Sem usuário e senha na URL.** Eles ficariam gravados em texto no
 *   banco e na tela; a autenticação do webhook é o segredo de assinatura.
 *
 * Pura e sem dependência, para a tela avisar antes de enviar e a action
 * recusar do mesmo jeito.
 */
export function problemaNaUrlDoWebhook(
  bruto: string,
  producao: boolean
): string | null {

  let url: URL;

  try {
    url = new URL(bruto.trim());
  } catch {
    return "Endereço inválido. Use o endereço completo, começando por https://.";
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");

  const local =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "::1" ||
    host.startsWith("127.");

  if (url.protocol !== "https:") {
    if (!(url.protocol === "http:" && local && !producao)) {
      return "Use https:// — o webhook leva dados das reclamações, e em http eles viajam abertos.";
    }
  }

  if (
    producao &&
    (local ||
      IP_PRIVADO.test(host) ||
      host.endsWith(".internal") ||
      host.endsWith(".local"))
  ) {
    return "Endereço de rede interna não é aceito em produção.";
  }

  if (url.username || url.password) {
    return "Não coloque usuário e senha no endereço; a autenticação do webhook é o segredo de assinatura.";
  }

  return null;
}
