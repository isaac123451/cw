/**
 * O freio de tentativas de login segura de verdade?
 *
 *   npm run check:freio
 *
 * **O defeito que isto existe para não repetir.** O freio guardava as
 * falhas num `Map` em memória, com o comentário "a aplicação roda em
 * uma instância na Vercel". Não roda: as funções escalam e nascem frias
 * com frequência, cada uma com o mapa vazio. O limite de cinco valia
 * por instância e sumia a cada instância nova.
 *
 * Agora ele mora na tabela `TentativaDeLogin`. O que se prova aqui é o
 * que a versão em memória não garantia nem numa instância só:
 *
 *  1. cinco falhas bloqueiam, e a sexta tentativa é recusada;
 *  2. **tentativas simultâneas contam todas** — dez ao mesmo tempo dão
 *     dez, e não "as que não se atropelaram";
 *  3. falha depois da janela recomeça a conta em um;
 *  4. acertar a senha zera.
 *
 * Usa uma chave descartável, que nunca é e-mail de ninguém, e apaga ao
 * sair.
 */
import "dotenv/config";

import { getPrisma } from "../lib/prisma";

import {
  checarBloqueio,
  limparFalhas,
  registrarFalha,
} from "../lib/auth/throttle";

const CHAVE = "conferencia-do-freio@exemplo.invalid";

let falhas = 0;

function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(
    `${ok ? "  ok  " : "FALHA "} ${titulo.padEnd(52)} ${JSON.stringify(obtido)}`
  );
  if (!ok) {
    console.log(`${" ".repeat(7)}${"esperado".padEnd(52)} ${JSON.stringify(esperado)}`);
  }
}

async function main() {
  console.log("\n  FREIO — tentativas de login\n");

  const prisma = getPrisma();

  if (!prisma) {
    console.log("  --   sem banco: o freio roda em memória, e não há o que provar aqui\n");
    return;
  }

  const contagem = async () =>
    (
      await prisma.tentativaDeLogin.findUnique({
        where: { chave: CHAVE },
        select: { falhas: true },
      })
    )?.falhas ?? 0;

  try {
    await limparFalhas(CHAVE);

    conferir("sem falha, a porta está livre", (await checarBloqueio(CHAVE)).bloqueado, false);

    for (let i = 0; i < 4; i += 1) await registrarFalha(CHAVE);

    conferir("quatro falhas ainda não bloqueiam", (await checarBloqueio(CHAVE)).bloqueado, false);

    await registrarFalha(CHAVE);

    const trava = await checarBloqueio(CHAVE);

    conferir("a quinta bloqueia", trava.bloqueado, true);
    conferir("e diz quantos minutos faltam", trava.minutos >= 14 && trava.minutos <= 15, true);

    /* ---- simultâneas ---- */

    await limparFalhas(CHAVE);

    await Promise.all(
      Array.from({ length: 10 }, () => registrarFalha(CHAVE))
    );

    conferir("dez falhas ao mesmo tempo contam dez", await contagem(), 10);

    /* ---- janela vencida ---- */

    await prisma.tentativaDeLogin.update({
      where: { chave: CHAVE },
      data: { primeiraEm: new Date(Date.now() - 20 * 60 * 1000) },
    });

    conferir("janela de 15 min vencida: a porta abre", (await checarBloqueio(CHAVE)).bloqueado, false);

    await registrarFalha(CHAVE);

    conferir("e a próxima falha recomeça a conta", await contagem(), 1);

    /* ---- acerto ---- */

    await limparFalhas(CHAVE);

    conferir("acertar a senha zera o histórico", await contagem(), 0);
  } finally {
    await prisma.tentativaDeLogin.deleteMany({ where: { chave: CHAVE } });
    await prisma.$disconnect();
  }

  console.log(
    falhas === 0
      ? "\n  O freio segura, e vale para a conta — não para a instância.\n"
      : `\n  ${falhas} ponto(s) a corrigir.\n`
  );

  process.exitCode = falhas === 0 ? 0 : 1;
}

main().catch((erro) => {
  console.error("\n  Erro:", erro);
  process.exitCode = 1;
});
