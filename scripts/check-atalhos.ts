/**
 * Os atalhos de teclado: sequência "g"+letra, e nada enquanto se digita.
 *
 *   npm run check:atalhos
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { ATALHOS_DE_TELA, digitandoEm, telaDaSequencia } from "../lib/models/atalhosDeTeclado";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${JSON.stringify(obtido)?.slice(0, 44)}`);
}

console.log("\n  ATALHOS DE TECLADO\n");

conferir("g depois r vai ao Reclame Aqui", telaDaSequencia("g", "r")?.href, "/reclame-aqui");
conferir("maiúscula também vale (Caps Lock)", telaDaSequencia("g", "N")?.href, "/nps");
conferir("letra sem o g antes não navega", telaDaSequencia(null, "r"), null);
conferir("g com letra sem tela não faz nada", telaDaSequencia("g", "z"), null);
conferir("nenhuma letra repetida entre as telas", new Set(ATALHOS_DE_TELA.map((a) => a.segunda)).size, ATALHOS_DE_TELA.length);
conferir("digitando num campo, atalho nenhum", [digitandoEm({ tagName: "INPUT" } as unknown as EventTarget), digitandoEm({ tagName: "TEXTAREA" } as unknown as EventTarget), digitandoEm({ tagName: "DIV", isContentEditable: true } as unknown as EventTarget)], [true, true, true]);
conferir("fora de campo, vale", digitandoEm({ tagName: "BODY", isContentEditable: false } as unknown as EventTarget), false);

const componente = readFileSync(resolve(__dirname, "../components/busca/AtalhosDeTeclado.tsx"), "utf8");
conferir("com Ctrl/Cmd/Alt a tecla é do navegador", /e\.ctrlKey \|\| e\.metaKey \|\| e\.altKey \|\| digitandoEm/.test(componente), true);
conferir("com diálogo aberto, o teclado é dele", /aria-modal="true"/.test(componente), true);
conferir("o topo monta os atalhos", /<AtalhosDeTeclado \/>/.test(readFileSync(resolve(__dirname, "../components/layout/Topbar.tsx"), "utf8")), true);

console.log(falhas === 0 ? "\n  Os atalhos levam aonde dizem, e não atrapalham quem digita.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
process.exit(falhas === 0 ? 0 : 1);
