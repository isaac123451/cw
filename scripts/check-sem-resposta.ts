/**
 * "Sem resposta" é a mesma conta em todo lugar que pede ação.
 *
 *   npm run check:sem-resposta
 *
 * Só leitura. A meta do ciclo dizia "13 ainda sem resposta" ao lado de
 * "Responder às 12": a 13ª era uma reclamação já fechada, avaliada como não
 * resolvida sem resposta nossa — não há mais o que responder (out/2026).
 * Cada tela escrevia a sua regra e algumas esqueciam o "aberta".
 *
 * Aqui: (1) as telas e rotas que pedem ação usam `semRespostaPublica`;
 * (2) contra o banco, a meta do ciclo conta exatamente as abertas do
 * Reclame Aqui sem resposta pública, e nenhuma fechada nem das Redes.
 */
import "dotenv/config";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getPrisma } from "../lib/prisma";
import { fetchCases } from "../lib/services/case.repository";
import { isOpen, isReclameAqui, naSituacao, semRespostaPublica } from "../lib/services/case.service";
import { respondida } from "../lib/models/case";
import { metasDoCiclo } from "../lib/models/metasDoCiclo";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(62)} ${JSON.stringify(obtido)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(62)} ${JSON.stringify(esperado)}`);
}

const ler = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

/* Onde "sem resposta" é o que fazer agora — e não a conta da nota, que segue o portal. */
const QUE_PEDEM_ACAO = [
  "lib/models/metasDoCiclo.ts",
  "lib/models/motivacaoDoDia.ts",
  "lib/services/relatorio.service.ts",
  "lib/services/notifications.service.ts",
  "lib/services/assistant.catalogo.ts",
  "app/dashboard/page.tsx",
  "app/api/extensao/resumo/route.ts",
  "app/api/extensao/contexto/route.ts",
  "app/api/extensao/fila/route.ts",
  "lib/models/contadoresDoMenu.ts",
];

async function main() {
  console.log("\n  SEM RESPOSTA — UMA REGRA SÓ\n");

  for (const arquivo of QUE_PEDEM_ACAO) {
    conferir(`${arquivo} usa semRespostaPublica`, ler(arquivo).includes("semRespostaPublica"), true);
  }

  const prisma = getPrisma();
  if (!prisma) {
    console.log("\n  Sem banco: só o código foi conferido.\n");
    process.exitCode = falhas === 0 ? 0 : 1;
    return;
  }

  const casos = await fetchCases(prisma);
  const abertasSemResposta = casos.filter((c) => isOpen(c) && isReclameAqui(c) && !respondida(c)).length;
  const fechadasSemResposta = casos.filter((c) => !isOpen(c) && isReclameAqui(c) && !respondida(c)).length;

  conferir("a regra é aberta + Reclame Aqui + sem resposta pública", casos.filter(semRespostaPublica).length, abertasSemResposta);
  conferir("nenhum atendimento das Redes entra", casos.filter((c) => semRespostaPublica(c) && !isReclameAqui(c)).length, 0);

  const metas = metasDoCiclo({ casos, nps: [] });
  const meta = metas.metas.find((m) => m.chave === "respostas");
  const dita = Number(meta?.porque.match(/(\d+) ainda sem resposta/)?.[1] ?? 0);
  conferir("a meta do ciclo diz o número das abertas", dita, abertasSemResposta);
  /* O cartão e o filtro do quadro (naSituacao) contavam também as fechadas: 12 contra 11 em 07/10. */
  conferir("o filtro e o cartão do quadro contam igual", casos.filter((c) => naSituacao(c, "sem-resposta", "0000-00-00")).length, abertasSemResposta);

  console.log(`  --    ${fechadasSemResposta} fechada(s) sem resposta ficam fora da fila (e dentro da conta da nota)`);

  console.log(falhas === 0 ? "\n  Toda tela que pede ação conta igual.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
  process.exitCode = falhas === 0 ? 0 : 1;
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
