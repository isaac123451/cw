import "server-only";

import { randomBytes } from "node:crypto";

import { cookies, headers } from "next/headers";

import { lerConfiguracao } from "@/lib/auth/two-factor";
import { dispositivoValeAgora, hashDoSegredo, lerValorDoCookie, nomeDoDispositivo } from "@/lib/auth/dispositivoRegras";
import { getPrisma } from "@/lib/prisma";

/**
 * O dispositivo lembrado (1.120, Fase 34: "entrada mais rápida e segura —
 * lembrar o dispositivo, sem abrir mão da segurança").
 *
 * Quem marca "lembrar este dispositivo" na tela do código não digita o
 * código naquele navegador pelos dias que a Segurança definir. **A senha
 * continua sendo pedida sempre** — o que se dispensa é só o segundo fator,
 * e só no navegador que já o provou uma vez. Esquecer um (ou todos) fica em
 * Minha conta; trocar a senha esquece todos.
 */
export const COOKIE_DO_DISPOSITIVO = "cw_dispositivo";

/** Grava este navegador como lembrado — chamado depois de o código conferir. */
export async function lembrarEsteDispositivo(userId: string) {
  const prisma = getPrisma();
  if (!prisma) return;
  const { diasDoDispositivo } = await lerConfiguracao();
  if (diasDoDispositivo <= 0) return;

  const segredo = randomBytes(32).toString("base64url");
  const validoAte = new Date(Date.now() + diasDoDispositivo * 86_400_000);
  const linha = await prisma.dispositivoConfiavel.create({
    data: {
      userId,
      segredoHash: hashDoSegredo(segredo),
      nome: nomeDoDispositivo((await headers()).get("user-agent")),
      validoAte,
    },
  });

  (await cookies()).set(COOKIE_DO_DISPOSITIVO, `${linha.id}.${segredo}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: diasDoDispositivo * 86_400,
  });
}

/**
 * Este navegador dispensa o código para esta pessoa?
 *
 * Nunca lança: está no caminho do login, e uma falha aqui só pode
 * significar "peça o código", nunca "não deixe entrar" nem "deixe entrar".
 */
export async function esteDispositivoDispensaOCodigo(userId: string): Promise<boolean> {
  try {
    const store = await cookies();
    const partes = lerValorDoCookie(store.get(COOKIE_DO_DISPOSITIVO)?.value);
    if (!partes) return false;
    const prisma = getPrisma();
    if (!prisma) return false;

    const [{ diasDoDispositivo }, linha] = await Promise.all([
      lerConfiguracao(),
      prisma.dispositivoConfiavel.findUnique({ where: { id: partes.id } }),
    ]);

    if (!dispositivoValeAgora(linha, partes.segredo, userId, diasDoDispositivo, new Date())) {
      /* De outra pessoa não se apaga: o navegador pode ser compartilhado e lembrar quem é dono dele. */
      if (!linha || linha.userId === userId) store.delete(COOKIE_DO_DISPOSITIVO);
      return false;
    }

    await prisma.dispositivoConfiavel.update({ where: { id: partes.id }, data: { ultimoUsoEm: new Date() } });
    return true;
  } catch (erro) {
    console.error("[dispositivo] conferência falhou — pedindo o código", erro);
    return false;
  }
}

/** O id do dispositivo deste navegador, se houver — para a lista marcar "este". */
export async function idDesteDispositivo(): Promise<string | null> {
  return lerValorDoCookie((await cookies()).get(COOKIE_DO_DISPOSITIVO)?.value)?.id ?? null;
}

/** Esquece este navegador do lado dele (o cookie), depois de o banco esquecer. */
export async function apagarCookieDoDispositivo() {
  (await cookies()).delete(COOKIE_DO_DISPOSITIVO);
}
