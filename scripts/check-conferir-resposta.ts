/**
 * A conferência da resposta pública acha a reclamação aberta.
 *
 *   npm run check:conferir-resposta
 *
 * Só leitura. A extensão mandava `RA-<número do "ID:">` e o protocolo do CW
 * é `RA-<COD>` — o caso vinha nulo quase sempre: a nota não conferia o nome
 * do cliente, o passo e o prazo não apareciam, e a resposta já publicada da
 * própria reclamação contava como "repetida" (out/2026).
 *
 * Aqui: (1) a extensão manda o COD e o número; (2) a rota procura pelos dois;
 * (3) contra o banco, o COD de reclamações reais acha o caso, e o "RA-<número>"
 * sozinho não acharia.
 */
import "dotenv/config";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getPrisma } from "../lib/prisma";
import { fetchCaseByPortalCode, fetchCaseByProtocol } from "../lib/services/case.repository";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${JSON.stringify(obtido)}`);
}

const ler = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

async function main() {
  console.log("\n  CONFERÊNCIA DA RESPOSTA PÚBLICA — QUEM É A RECLAMAÇÃO\n");

  const extensao = ler("extensao/conteudo/ra-resposta.js");
  const rota = ler("app/api/extensao/conferir-resposta/route.ts");

  conferir("a extensão lê o COD da reclamação aberta", /CW\.ra\?\.cod\?\.\(conteudo\)/.test(extensao), true);
  conferir("e manda COD e número junto com o texto", /corpo: \{ texto, \.\.\.identidadeDaPagina\(\) \}/.test(extensao), true);
  conferir("resposta atrasada não pinta por cima da nova", /if \(minha !== rodada\) return;/.test(extensao), true);
  conferir("a rota procura pelo COD e pelo número", /fetchCaseByPortalCode\(prisma, cod, numero\)/.test(rota), true);
  conferir("a repetida não compara com a própria reclamação", /protocol: \{ not: proprio \}/.test(rota), true);

  const prisma = getPrisma();
  if (!prisma) {
    console.log("\n  Sem banco: só a parte do código foi conferida.\n");
    process.exitCode = falhas === 0 ? 0 : 1;
    return;
  }

  const amostra = await prisma.case.findMany({
    where: { channel: "RECLAME_AQUI", protocol: { startsWith: "RA-" } },
    select: { protocol: true, externalId: true },
    orderBy: { publishedAt: "desc" },
    take: 40,
  });

  const comCod = amostra.filter((c) => /^RA-[A-Za-z0-9_-]{16}$/.test(c.protocol));
  let achadas = 0;
  for (const c of comCod) {
    const cod = c.protocol.slice(3);
    const caso = await fetchCaseByPortalCode(prisma, cod, "");
    if (caso?.protocol === c.protocol) achadas += 1;
  }
  conferir(`o COD acha o caso (${comCod.length} reclamações recentes)`, achadas, comCod.length);

  /* O jeito antigo: "RA-<número>" com o número do ID, que não é o protocolo. */
  const comNumero = amostra.filter((c) => /^\d{6,12}$/.test(c.externalId ?? ""));
  let antigoAcharia = 0;
  for (const c of comNumero) {
    if (await fetchCaseByProtocol(prisma, `RA-${c.externalId}`)) antigoAcharia += 1;
  }
  if (comNumero.length > 0) {
    console.log(`  --    o jeito antigo ("RA-<número>") acharia ${antigoAcharia} de ${comNumero.length} com número gravado`);
  }

  console.log(falhas === 0 ? "\n  A conferência sabe de qual reclamação é a resposta.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
  process.exitCode = falhas === 0 ? 0 : 1;
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
