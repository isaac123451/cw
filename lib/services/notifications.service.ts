import { Case } from "@/lib/models/case";
import { AgendaTask } from "@/lib/models/agenda";
import { CaseMovement } from "@/lib/models/movement";
import { GoogleEvent } from "@/lib/models/google";

import { hojeNaOperacao } from "@/lib/services/reputation.service";
import { lateMovements } from "@/lib/services/movement.service";

export type NotificationTone =
  | "danger"
  | "warning"
  | "info";

export interface Notification {
  id: string;
  tone: NotificationTone;
  title: string;
  detail: string;
  href: string;
  /** Quantidade agrupada, quando o alerta resume vários itens. */
  count?: number;
}

export interface NotificationPrefs {
  semResposta: boolean;
  replica: boolean;
  naoResolvido: boolean;
  movimentacao: boolean;
  agenda: boolean;
}

export const defaultPrefs: NotificationPrefs = {
  semResposta: true,
  replica: true,
  naoResolvido: true,
  movimentacao: true,
  agenda: true,
};

export const prefLabels: Record<
  keyof NotificationPrefs,
  { label: string; hint: string }
> = {
  semResposta: {
    label: "Reclamações sem resposta",
    hint: "Avisa quando existem casos ainda não respondidos no portal — é o item de maior peso na nota.",
  },
  replica: {
    label: "Réplicas do consumidor",
    hint: "Avisa quando o consumidor treplicou e a empresa precisa responder de novo.",
  },
  naoResolvido: {
    label: "Avaliações negativas",
    hint: "Avisa quando uma reclamação é avaliada como não resolvida.",
  },
  movimentacao: {
    label: "Movimentações atrasadas",
    hint: "Avisa quando uma área interna (ou o cliente) passou do prazo de retorno de um caso encaminhado.",
  },
  agenda: {
    label: "Atividades da agenda",
    hint: "Avisa sobre atividades vencidas e as que vencem hoje.",
  },
};

/** Diferença em dias entre duas datas ISO. */
function daysBetween(from: string, to: string) {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) -
      Date.parse(`${from}T00:00:00Z`)) /
      86400000
  );
}

/**
 * Alertas derivados dos dados reais.
 *
 * Não existe tabela de notificação: o que importa para a operação já
 * está nos casos e na agenda, e inventar um feed paralelo só criaria
 * uma segunda verdade para manter sincronizada.
 */
export function buildNotifications(
  cases: Case[],
  tasks: AgendaTask[],
  prefs: NotificationPrefs = defaultPrefs,
  owner?: string,
  movements: CaseMovement[] = [],
  googleEvents: GoogleEvent[] = []
): Notification[] {

  const list: Notification[] = [];

  const hoje = hojeNaOperacao();

  if (prefs.semResposta) {

    const semResposta = cases.filter(
      (item) => item.status === "Novo"
    );

    if (semResposta.length > 0) {

      // O mais antigo é o que mais pesa: define a urgência do alerta.
      const antigo = [...semResposta].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt)
      )[0];

      const dias = daysBetween(antigo.createdAt, hoje);

      list.push({
        id: "sem-resposta",
        tone: dias > 5 ? "danger" : "warning",
        title: `${semResposta.length} reclamação(ões) sem resposta`,
        detail:
          dias > 0
            ? `A mais antiga está parada há ${dias} dia(s).`
            : "Registradas hoje, ainda sem resposta pública.",
        href: "/reclame-aqui",
        count: semResposta.length,
      });
    }
  }

  if (prefs.replica) {

    const replicas = cases.filter(
      (item) => item.status === "Aguardando nossa réplica"
    );

    if (replicas.length > 0) {
      list.push({
        id: "replica",
        tone: "danger",
        title: `${replicas.length} réplica(s) aguardando resposta`,
        detail:
          "O consumidor respondeu e espera um retorno da empresa.",
        href: "/reclame-aqui",
        count: replicas.length,
      });
    }
  }

  if (prefs.naoResolvido) {

    const naoResolvidas = cases.filter(
      (item) =>
        item.status === "Não resolvido" &&
        daysBetween(item.createdAt, hoje) <= 30
    );

    if (naoResolvidas.length > 0) {
      list.push({
        id: "nao-resolvido",
        tone: "warning",
        title: `${naoResolvidas.length} avaliação(ões) negativa(s) no último mês`,
        detail:
          "Reclamações avaliadas como não resolvidas derrubam o índice de solução.",
        href: "/reclame-aqui/analytics",
        count: naoResolvidas.length,
      });
    }
  }

  if (prefs.movimentacao) {

    const atrasadas = lateMovements(movements, hoje);

    if (atrasadas.length > 0) {

      // O destino que mais segura casos é a informação acionável:
      // define com quem cobrar primeiro.
      const porDestino = new Map<string, number>();

      for (const { movement } of atrasadas) {
        porDestino.set(
          movement.destination,
          (porDestino.get(movement.destination) ?? 0) + 1
        );
      }

      const pior = [...porDestino.entries()].sort(
        (a, b) => b[1] - a[1]
      )[0];

      list.push({
        id: "movimentacao-atrasada",
        tone: "danger",
        title: `${atrasadas.length} movimentação(ões) fora do prazo`,
        detail: `Casos parados aguardando retorno — ${pior[1]} com ${pior[0]}.`,
        href: "/processos",
        count: atrasadas.length,
      });
    }
  }

  if (prefs.agenda) {

    const minhas = owner
      ? tasks.filter((item) => item.owner === owner)
      : tasks;

    const vencidas = minhas.filter(
      (item) => !item.done && item.dueDate < hoje
    );

    const paraHoje = minhas.filter(
      (item) => !item.done && item.dueDate === hoje
    );

    if (vencidas.length > 0) {
      list.push({
        id: "agenda-vencida",
        tone: "danger",
        title: `${vencidas.length} atividade(s) vencida(s)`,
        detail: owner
          ? "Atribuídas a você e ainda não concluídas."
          : "Ainda não concluídas na agenda da operação.",
        href: "/agenda",
        count: vencidas.length,
      });
    }

    if (paraHoje.length > 0) {
      list.push({
        id: "agenda-hoje",
        tone: "info",
        title: `${paraHoje.length} atividade(s) para hoje`,
        detail: "Programadas para a data de hoje.",
        href: "/agenda",
        count: paraHoje.length,
      });
    }

    /**
     * Compromissos do Google de hoje.
     *
     * Entram junto das atividades por escolha: para quem abre o sino, o
     * dia é um só — separar em duas listas obrigaria a olhar dois
     * lugares para saber o que vem pela frente.
     *
     * Usa o dia real do navegador, não `hojeNaOperacao()`: o evento vem
     * da agenda de verdade, e comparar com a data fixa da operação
     * esconderia tudo.
     */
    const hojeReal = new Date()
      .toISOString()
      .slice(0, 10);

    const eventosHoje = googleEvents.filter(
      (item) => item.date === hojeReal
    );

    if (eventosHoje.length > 0) {

      const comHora = eventosHoje.find(
        (item) => !item.allDay
      );

      list.push({
        id: "google-hoje",
        tone: "info",
        title: `${eventosHoje.length} compromisso(s) hoje na sua agenda`,
        detail: comHora
          ? `O próximo é "${comHora.title}", às ${comHora.time}.`
          : eventosHoje[0].title,
        href: "/agenda",
        count: eventosHoje.length,
      });
    }
  }

  const ordem: Record<NotificationTone, number> = {
    danger: 0,
    warning: 1,
    info: 2,
  };

  return list.sort(
    (a, b) => ordem[a.tone] - ordem[b.tone]
  );
}
