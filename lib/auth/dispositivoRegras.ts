import { createHash, timingSafeEqual } from "node:crypto";

/**
 * As regras do dispositivo lembrado (1.120), sem cookie nem banco — para
 * o `check:dispositivo` provar sem navegador. A parte que toca cookie e
 * banco está em `lib/auth/dispositivo.ts`.
 */

/** O SHA-256 do segredo, em hexadecimal. */
export function hashDoSegredo(segredo: string) {
  return createHash("sha256").update(segredo).digest("hex");
}

/** `id.segredo` → as duas partes, ou `null` se o valor não tem a forma. */
export function lerValorDoCookie(valor: string | undefined | null): { id: string; segredo: string } | null {
  if (!valor) return null;
  const ponto = valor.indexOf(".");
  if (ponto <= 0 || ponto === valor.length - 1) return null;
  const id = valor.slice(0, ponto);
  const segredo = valor.slice(ponto + 1);
  if (!/^[a-z0-9]{10,40}$/i.test(id) || !/^[A-Za-z0-9_-]{40,60}$/.test(segredo)) return null;
  return { id, segredo };
}

export interface LinhaDoDispositivo {
  userId: string;
  segredoHash: string;
  criadoEm: Date;
  validoAte: Date;
  revogadoEm: Date | null;
}

/**
 * O dispositivo dispensa o código para esta pessoa, agora?
 *
 * Precisa ser dela, não ter sido esquecido, estar dentro da validade de
 * quando foi lembrado **e** dentro do prazo de hoje — se quem administra
 * encurtar de 30 para 7 dias, os lembrados há mais de 7 deixam de valer
 * na hora, sem esperar o vencimento antigo. Prazo 0 desliga todos.
 */
export function dispositivoValeAgora(
  linha: LinhaDoDispositivo | null,
  segredo: string,
  userId: string,
  diasDoPrazo: number,
  agora: Date
): boolean {
  if (!linha || diasDoPrazo <= 0) return false;
  if (linha.userId !== userId || linha.revogadoEm) return false;
  if (linha.validoAte.getTime() <= agora.getTime()) return false;
  if (linha.criadoEm.getTime() + diasDoPrazo * 86_400_000 <= agora.getTime()) return false;
  const esperado = Buffer.from(linha.segredoHash, "hex");
  const recebido = Buffer.from(hashDoSegredo(segredo), "hex");
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

/** "Chrome no Windows", "Safari no iPhone" — para reconhecer na lista. */
export function nomeDoDispositivo(userAgent: string | null | undefined): string {
  const ua = userAgent ?? "";
  const navegador = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Navegador";
  const sistema = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux"
              : "";
  return sistema ? `${navegador} no ${sistema}` : navegador;
}
