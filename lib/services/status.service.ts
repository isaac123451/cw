/**
 * Cores dos status do ciclo real do Reclame Aqui.
 *
 * Ficava duplicado (e divergente) entre lista, Kanban e detalhe — a lista
 * ainda usava nomes antigos como "Em Atendimento" e "Fechado", que não
 * existem no portal. Aqui é a única fonte.
 */
export const STATUS_TONE: Record<string, string> = {
  Novo: "bg-indigo-50 text-indigo-700 ring-indigo-100",

  "Aguardando nossa réplica":
    "bg-sky-50 text-sky-700 ring-sky-100",

  "Aguardando avaliação":
    "bg-amber-50 text-amber-700 ring-amber-100",

  Resolvido:
    "bg-emerald-50 text-emerald-700 ring-emerald-100",

  "Não resolvido": "bg-rose-50 text-rose-700 ring-rose-100",
};

export function toneOf(status: string) {
  return (
    STATUS_TONE[status] ??
    "bg-zinc-100 text-zinc-600 ring-zinc-200"
  );
}

/** O que cada status significa — usado nos title= das telas. */
export const STATUS_HINT: Record<string, string> = {
  Novo: "Reclamação recebida e ainda não respondida no portal.",

  "Aguardando nossa réplica":
    "O consumidor treplicou e a empresa precisa responder de novo.",

  "Aguardando avaliação":
    "Já respondemos — o consumidor ainda não deu a nota.",

  Resolvido:
    "O consumidor avaliou e marcou a reclamação como resolvida.",

  "Não resolvido":
    "O consumidor avaliou e marcou como não resolvida.",
};

export function hintOf(status: string) {
  return STATUS_HINT[status] ?? status;
}
