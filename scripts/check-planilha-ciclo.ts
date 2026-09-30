/**
 * Prova da automação da planilha "Métricas do Reclame Aqui" (1.97): as
 * linhas que o CW preenche batem com o que a equipe já tinha preenchido à
 * mão em setembro/2026 (dias 1 a 24), e o script só escreve no vazio.
 *
 *   npx tsx --env-file=.env scripts/check-planilha-ciclo.ts
 */
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { planilhaDoMes, tempoDaPlanilha } from "@/lib/services/planilhaDoCiclo.service";

let falhas = 0;
function conferir(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${nome.padEnd(62)} ${JSON.stringify(obtido)}${ok ? "" : `\n        esperado ${JSON.stringify(esperado)}`}`);
}

/* O que a equipe preencheu à mão, dias 1 a 24 de setembro de 2026. */
const DA_EQUIPE = {
  entrantes: [1, 2, 2, 4, 4, 4, 4, 5, 6, 7, 8, 8, 8, 8, 8, 9, 11, 11, 13, 13, 15, 16, 16, 17],
  respondidas: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 4, 4, 5, 7, 7, 7, 7, 8, 8, 8, 8],
  ciclos: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3],
};

(async () => {
  console.log("\n— O formato da planilha —\n");
  conferir("tempo médio como a equipe escreve", [tempoDaPlanilha("18 dias e 8 horas"), tempoDaPlanilha("17 dias e 6 horas"), tempoDaPlanilha("5 dias")], ["18,8", "17,6", "5,0"]);

  console.log("\n— Contra o que a equipe preencheu (setembro, dias 1 a 24) —\n");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const p = await planilhaDoMes(prisma, "2026-09");
  const n = (linha: string) => p.valores[linha as keyof typeof p.valores].slice(0, 24).map(Number);
  conferir("cabeçalho da aba (A1)", p.cabecalho, "Set/2026");
  conferir("respondidas: iguais nos 24 dias", n("Reclamações respondidas"), DA_EQUIPE.respondidas);
  conferir("ciclos com o selo: iguais nos 24 dias", n("Ciclos com o selo ativo"), DA_EQUIPE.ciclos);
  const entrantes = n("Nº de reclamações entrantes (RA)");
  conferir("entrantes: todos a no máximo 1 da equipe", entrantes.every((v, i) => Math.abs(v - DA_EQUIPE.entrantes[i]) <= 1), true);
  conferir("dia sem leitura do painel fica vazio (null)", p.valores["Nota de Reputação"][0], null);
  await prisma.$disconnect();

  console.log("\n— O script só escreve no vazio —\n");
  const gs = fs.readFileSync(path.join(__dirname, "..", "docs", "planilha", "MetricasDoCW.gs"), "utf8");
  conferir("a trava do vazio existe antes do setValue", /if \(String\(valores\[linha\]\[col\]\)\.trim\(\) !== ""\) return;\s*\n\s*aba\.getRange\(linha \+ 1, col \+ 1\)\.setValue/.test(gs), true);
  conferir("sem escape \\u que o editor transforma", /[̀-ͯ]/.test(gs), false);

  console.log(falhas === 0 ? "\n  A planilha recebe só o que bate com o que a equipe faz, e só no vazio.\n" : `\n  ${falhas} ponto(s) fora.\n`);
  process.exit(falhas === 0 ? 0 : 1);
})();
