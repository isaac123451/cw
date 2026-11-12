/**
 * A extensão de cada pessoa está em dia? (12/11/2026, 1.1.74)
 *
 * A extensão manda a versão dela em cada chamada (cabeçalho X-CW-Versao), e
 * o servidor guarda a última vista por pessoa. Aqui a comparação com a
 * versão da plataforma: as duas sobem juntas a cada entrega, então a
 * extensão atrás da plataforma é a que ninguém recarregou no Chrome — o que
 * segurou o salvamento das conversas de 06 a 10/11.
 */

export interface ExtensaoVista {
  versao: string;
  /** ISO. */
  vistaEm: string;
}

export type SituacaoDaExtensao = "em-dia" | "desatualizada" | "nunca-vista";

/** -1, 0 ou 1, comparando número a número ("1.1.9" < "1.1.10"). */
export function compararVersoes(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

export function situacaoDaExtensao(vista: ExtensaoVista | null, versaoDaPlataforma: string): SituacaoDaExtensao {
  if (!vista?.versao) return "nunca-vista";
  if (!versaoDaPlataforma) return "em-dia";
  return compararVersoes(vista.versao, versaoDaPlataforma) < 0 ? "desatualizada" : "em-dia";
}

/** Lê o que está gravado, tolerante a lixo. */
export function lerExtensaoVista(valor: unknown): ExtensaoVista | null {
  const v = (valor && typeof valor === "object" ? valor : {}) as { versao?: unknown; vistaEm?: unknown };
  if (typeof v.versao !== "string" || !/^\d+(\.\d+){0,3}$/.test(v.versao) || typeof v.vistaEm !== "string") return null;
  return { versao: v.versao, vistaEm: v.vistaEm };
}

/** Gravar de novo? Só quando a versão muda, ou a cada 10 minutos — a extensão chama a cada 8 segundos. */
export function precisaGravar(anterior: ExtensaoVista | null, versao: string, agora: Date) {
  if (!anterior || anterior.versao !== versao) return true;
  return agora.getTime() - Date.parse(anterior.vistaEm) > 10 * 60_000;
}
