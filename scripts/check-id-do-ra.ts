/**
 * O ID do Reclame Aqui (o número da página) é guardado, mostrado e achado?
 *
 *   npm run check:id-do-ra
 *
 * 13/11/2026 — "preciso que você trabalhe com o ID do reclame aqui". Sem
 * banco: o rótulo prefere o número; as Redes não; a busca acha pelo número
 * inteiro e por um pedaço; o vigia grava o número e pede as que faltam; a
 * extensão mostra o número.
 */
import { readFileSync } from "node:fs";

import type { Case } from "../lib/models/case";
import { buscarNaPlataforma } from "../lib/models/buscaGlobal";
import { idExterno } from "../lib/services/case.service";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(62)} ${JSON.stringify(obtido)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(62)} ${JSON.stringify(esperado)}`);
}

const caso = (extra: Partial<Case>) => ({ id: "3gnDNHnTdGwX3cVW", protocol: "RA-3gnDNHnTdGwX3cVW", source: "Reclame Aqui", customer: "Ana", company: "", title: "Repasse atrasado", status: "Novo", ...extra }) as unknown as Case;

console.log("\n  O RÓTULO\n");
conferir("com o número guardado: o número", idExterno(caso({ idRa: "256873207" })), "256873207");
conferir("sem o número: o código do endereço, como antes", idExterno(caso({})), "3gnDNHnTdGwX3cVW");
conferir("nas Redes o número não entra", idExterno(caso({ idRa: "1", source: "Instagram", protocol: "IG-1" })), "IG-1");

console.log("\n  A BUSCA\n");
const casos = [caso({ idRa: "256873207" }), caso({ id: "x2", protocol: "RA-x2", idRa: "249505087", customer: "Bruno" })];
const primeiro = (termo: string) => buscarNaPlataforma({ termo, casos }).filter((r) => r.tipo === "caso")[0];
conferir("o número inteiro acha o caso", primeiro("256873207")?.titulo, "Ana");
conferir("com 'ID' na frente também", primeiro("ID: 249505087")?.titulo, "Bruno");
conferir("um pedaço de 5 dígitos acha", primeiro("50508")?.titulo, "Bruno");
conferir("o resultado mostra o ID", primeiro("256873207")?.marca, "ID 256873207");

console.log("\n  O VIGIA E A EXTENSÃO\n");
const portal = readFileSync("lib/services/raPortal.service.ts", "utf8");
conferir("o vigia grava o número ao atualizar", portal.includes("mudancas.idRa = String(r.numero)"), true);
conferir("e ao criar", portal.includes("data: { idRa: String(r.numero) }"), true);
conferir("acha a reclamação também pelo número guardado", portal.includes("{ idRa: { in: numeros.map(String) } }"), true);
conferir("pede ao vigia as que ainda não têm número (6 por volta)", portal.includes("where: { protocol: { startsWith: \"RA-\" }, idRa: null }") && portal.includes("SEM_ID_POR_VOLTA = 6"), true);
conferir("a lista de casos traz a coluna", readFileSync("lib/services/case.repository.ts", "utf8").includes('c."idRa"'), true);
const painel = readFileSync("extensao/conteudo/painel-caso.js", "utf8");
conferir("o painel da extensão mostra o ID", (painel.match(/idRa \? `ID \$\{/g) ?? []).length, 2);
for (const rota of ["detalhe", "fila", "contexto"]) conferir(`a rota ${rota} manda o número`, readFileSync(`app/api/extensao/${rota}/route.ts`, "utf8").includes("idRa: "), true);

console.log(falhas ? `\n  ${falhas} falha(s).\n` : "\n  Tudo certo.\n");
process.exit(falhas ? 1 : 0);
