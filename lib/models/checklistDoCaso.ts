import { respondida, type Case } from "@/lib/models/case";

/**
 * O checklist de resolução do caso: o que o próprio registro já prova, e
 * as marcas que alguém fez à mão.
 *
 * **Por que existe (out/2026).** As marcas viviam só na memória da tela:
 * marcar e recarregar perdia tudo, e a tabela `CaseChecklistMark` estava
 * no banco sem ninguém gravar. Pior, o checklist não enxergava o caso —
 * "Cliente contatado: pendente" com o 1º contato registrado na mesma
 * ficha, "Causa raiz: pendente" com a causa marcada —, dizia "Concluído
 * por" o dono do caso fosse quem fosse que marcou, e dava tudo como
 * cumprido só porque o caso estava encerrado.
 *
 * Agora: o que o caso registra marca sozinho (e não se desmarca, porque é
 * fato); o resto é marca à mão, gravada com quem marcou e quando.
 */

/** Quem marcou e quando, quando a marca é à mão. */
export interface MarcaDoChecklist {
  itemId: string;
  feito: boolean;
  por: string | null;
  em: string | null;
}

/**
 * De onde o caso prova o item, ou `null` quando só a pessoa sabe
 * ("Reclamação original lida", por exemplo). As chaves são as do
 * cadastro em Configurações → Checklist do caso.
 */
export function provaDoItem(chave: string, caso: Case, areasAcionadas: number): string | null {
  switch (chave) {
    case "customer_history_checked":
      return caso.imersaoEm ? "imersão no histórico registrada" : null;
    case "root_cause_identified":
      return caso.causaRaiz ? `causa raiz: ${caso.causaRaiz}` : null;
    case "team_notified":
      return areasAcionadas > 0 ? (areasAcionadas === 1 ? "uma área acionada" : `${areasAcionadas} áreas acionadas`) : null;
    case "customer_contacted":
      return caso.primeiroContatoEm ? "1º contato registrado" : null;
    case "public_response_sent":
      return respondida(caso) ? "resposta publicada no portal" : null;
    case "review_requested":
      return (caso.pedidosDeAvaliacao ?? 0) > 0 ? "pedido de avaliação registrado" : null;
    case "final_result_logged":
      return caso.evaluated
        ? "avaliado no portal"
        : caso.status === "Resolvido" || caso.status === "Não resolvido"
          ? `encerrado como ${caso.status.toLowerCase()}`
          : null;
    default:
      return null;
  }
}
