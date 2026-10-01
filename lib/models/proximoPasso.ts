import type { FrenteId } from "@/lib/models/frentes";
import type { ItemDaFila } from "@/lib/models/guiaParaFechar";

/**
 * O próximo passo à vista (1.123).
 *
 * Fase 34, "cards e pop-ups de foco — lembretes curtos e o próximo passo à
 * vista, para quem perde o foco rápido"; Fase 36, "cards que empurram — na
 * plataforma e na extensão, a informação fácil e o próximo passo à vista".
 *
 * O próximo passo é o primeiro da fila do Um por vez (`filaDoDia`): a
 * mesma ordem — frente, urgência, ordem do documento —, para o cartão do
 * topo do Meu dia, o cartão flutuante das outras telas e o popup da
 * extensão nunca discordarem do modo de foco.
 */

/** Por que este item está na frente — uma palavra, para caber no cartão. */
export function porQueDoItem(item: Pick<ItemDaFila, "atrasado" | "critico" | "atividades">) {
  if (item.critico && item.atrasado) return "crítico e fora do prazo";
  if (item.critico) return "crítico";
  if (item.atrasado) return "fora do prazo";
  return item.atividades[0] ?? "na fila de hoje";
}

export function resumoDaFila(fila: Pick<ItemDaFila, "atrasado" | "critico">[]) {
  return {
    total: fila.length,
    atrasados: fila.filter((i) => i.atrasado).length,
    criticos: fila.filter((i) => i.critico).length,
  };
}

/** Os intervalos do lembrete de foco, em minutos; 0 desliga. */
export const INTERVALOS_DO_LEMBRETE = [15, 25, 45, 0] as const;
export const INTERVALO_PADRAO_DO_LEMBRETE = 25;

/**
 * Hora de lembrar?
 *
 * Só quando a fila ficou parada o intervalo inteiro (o primeiro item não
 * mudou) **e** o último lembrete foi há pelo menos um intervalo. Quem está
 * trabalhando não é interrompido: cada item que sai zera o relógio.
 */
export function deveLembrar(entrada: { paradaDesde: number; ultimoLembrete: number; intervaloMin: number; agora: number }) {
  const { paradaDesde, ultimoLembrete, intervaloMin, agora } = entrada;
  if (intervaloMin <= 0) return false;
  const intervalo = intervaloMin * 60_000;
  return agora - paradaDesde >= intervalo && agora - ultimoLembrete >= intervalo;
}

/** O próximo passo como vai para a conta — e dela para o popup da extensão. */
export interface ProximoPassoGuardado {
  titulo: string;
  detalhe: string;
  porque: string;
  /** Caminho da aplicação ("/reclame-aqui/RA-…") ou endereço completo (WhatsApp). */
  href: string;
  frente: FrenteId | null;
  total: number;
  atrasados: number;
  /** Quando a plataforma viu este próximo passo. */
  em: string;
}

/** O retrato do primeiro da fila; sem fila, `null` (nada a fazer agora). */
export function retratoDoProximoPasso(fila: ItemDaFila[], agora: Date): ProximoPassoGuardado | null {
  const item = fila[0];
  if (!item) return null;
  const resumo = resumoDaFila(fila);
  return {
    titulo: item.titulo.slice(0, 160),
    detalhe: (item.detalhe ?? "").slice(0, 200),
    porque: porQueDoItem(item),
    href: item.href,
    frente: item.frente ?? null,
    total: resumo.total,
    atrasados: resumo.atrasados,
    em: agora.toISOString(),
  };
}

/** Retrato mais velho que isto não vale mais no popup: o dia já mudou. */
export const VALIDADE_DO_PROXIMO_PASSO_H = 12;

/** O que chega do banco, conferido — o popup não pode mostrar lixo. */
export function proximoPassoValido(bruto: unknown, agora: Date): ProximoPassoGuardado | null {
  if (!bruto || typeof bruto !== "object") return null;
  const p = bruto as Record<string, unknown>;
  const em = Date.parse(String(p.em ?? ""));
  if (!Number.isFinite(em) || agora.getTime() - em > VALIDADE_DO_PROXIMO_PASSO_H * 3_600_000) return null;
  const href = String(p.href ?? "");
  /* Caminho da aplicação ou https — "//outro.site" seria um endereço de fora. */
  if (!((href.startsWith("/") && !href.startsWith("//")) || href.startsWith("https://"))) return null;
  const titulo = String(p.titulo ?? "").trim();
  if (!titulo) return null;
  return {
    titulo: titulo.slice(0, 160),
    detalhe: String(p.detalhe ?? "").slice(0, 200),
    porque: String(p.porque ?? "").slice(0, 60),
    href,
    frente: (["reclame-aqui", "redes", "nps", "google"] as const).includes(p.frente as FrenteId) ? (p.frente as FrenteId) : null,
    total: Math.max(0, Math.round(Number(p.total) || 0)),
    atrasados: Math.max(0, Math.round(Number(p.atrasados) || 0)),
    em: new Date(em).toISOString(),
  };
}
