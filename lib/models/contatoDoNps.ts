import { quandoRespondeu } from "@/lib/models/nps";

/**
 * O contato do ciclo do NPS numa linha (10/11/2026): "quero também que
 * apareça no nps se o cliente respondeu, quero tudo registrado".
 *
 * O quadro e a lista mostravam só "N tentativas"; se o cliente tinha
 * respondido, só a ficha dizia. Agora o cartão e a linha dizem
 * "Respondeu · 29/10" (verde) ou "2 tentativas · 28/10".
 */

export interface ContatoDoCiclo {
  status: string;
  postContactAt?: string | null;
  closedAt?: string | null;
  firstContactAt?: string | null;
  attempts?: { resultado?: string | null; createdAt: string }[];
}

const diaCurto = (iso: string) => {
  const d = new Date(Date.parse(iso) - 3 * 3_600_000).toISOString();
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`;
};

export function contatoDoCiclo(item: ContatoDoCiclo): { texto: string; respondeu: boolean } | null {
  const respondeuEm = quandoRespondeu({ ...item, postContactAt: item.postContactAt ?? undefined, closedAt: item.closedAt ?? undefined });
  const tentativas = item.attempts ?? [];
  if (respondeuEm) return { texto: `Respondeu · ${diaCurto(respondeuEm)}`, respondeu: true };
  if (!tentativas.length && !item.firstContactAt) return null;
  const ultima = [...tentativas.map((a) => a.createdAt), item.firstContactAt].filter((d): d is string => Boolean(d)).sort().pop()!;
  const n = tentativas.length || 1;
  return { texto: `${n} ${n === 1 ? "tentativa" : "tentativas"} · ${diaCurto(ultima)}`, respondeu: false };
}

/**
 * A tentativa que o cliente respondeu, pela conversa do WhatsApp ligada ao
 * ciclo: a primeira fala dele depois de uma tentativa marca a última
 * tentativa feita antes dela. Só fala com data (`em`): a mensagem antiga
 * guardada hoje não pode passar por resposta de hoje. `null` quando já há
 * "respondeu" registrado ou o cliente não escreveu depois do contato.
 */
export function tentativaRespondida(
  tentativas: { id: string; createdAt: string; resultado?: string | null }[],
  falasDoCliente: string[]
): string | null {
  if (!tentativas.length || tentativas.some((t) => t.resultado === "respondeu")) return null;
  const ordenadas = [...tentativas].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const primeira = ordenadas[0].createdAt;
  const fala = falasDoCliente.filter((f) => f > primeira).sort()[0];
  if (!fala) return null;
  return ordenadas.filter((t) => t.createdAt <= fala).pop()!.id;
}
