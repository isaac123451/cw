/**
 * Prazo estourando avisa — o que a extensão decide avisar.
 *
 *   npm run check:prazos-extensao
 *
 * Sem navegador: a decisão mora em `extensao/comum/prazos.js`, a mesma
 * que o service worker usa.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { decidirAvisosDePrazo, dentroDoHorario, horaDeBrasilia } from "../extensao/comum/prazos.js";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(60)} ${String(JSON.stringify(obtido)).slice(0, 40)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(60)} ${String(JSON.stringify(esperado)).slice(0, 40)}`);
}

console.log("\n  PRAZO ESTOURANDO AVISA\n");

const a = { protocolo: "RA-1", situacao: "atencao", meu: true, responsavel: "Carlos" };
const b = { protocolo: "RA-2", situacao: "estourado", meu: false, responsavel: null };
const c = { protocolo: "RA-3", situacao: "estourado", meu: false, responsavel: "Outra pessoa" };

const primeira = decidirAvisosDePrazo({ casos: [a, b, c], avisados: {} });
conferir("avisa os meus e os sem responsável; o do colega não", primeira.individuais.map((x: { protocolo: string }) => x.protocolo), ["RA-1", "RA-2"]);
conferir("guarda o estado de quem pede atenção", primeira.estado, { "RA-1": "atencao", "RA-2": "estourado" });

const repetida = decidirAvisosDePrazo({ casos: [a, b], avisados: primeira.estado });
conferir("na volta seguinte, sem mudança, silêncio", [repetida.individuais.length, repetida.grupo], [0, null]);

const estourou = decidirAvisosDePrazo({ casos: [{ ...a, situacao: "estourado" }, b], avisados: primeira.estado });
conferir("de atenção para estourado, avisa de novo", estourou.individuais.map((x: { protocolo: string; situacao: string }) => `${x.protocolo}:${x.situacao}`), ["RA-1:estourado"]);

const saiu = decidirAvisosDePrazo({ casos: [b], avisados: primeira.estado });
conferir("o caso resolvido sai do estado (e volta a avisar se voltar)", saiu.estado, { "RA-2": "estourado" });

const muitos = decidirAvisosDePrazo({ casos: [1, 2, 3, 4].map((n) => ({ protocolo: `RA-${n}`, situacao: "estourado", meu: true })), avisados: {} });
conferir("três ou mais de uma vez: um aviso só", [muitos.individuais.length, muitos.grupo?.length], [0, 4]);

conferir("7h não avisa, 8h avisa, 20h não", [dentroDoHorario(7), dentroDoHorario(8), dentroDoHorario(20)], [false, true, false]);
conferir("a hora é a de Brasília", horaDeBrasilia(new Date("2026-09-25T11:30:00Z")), 8);

const sw = readFileSync(resolve(__dirname, "../extensao/fundo/service-worker.js"), "utf8");
conferir("o service worker usa esta decisão e o interruptor", [sw.includes("decidirAvisosDePrazo("), sw.includes("config.prazos === false")], [true, true]);
conferir("o aviso roda no ciclo de 5 minutos", /ALARME_LEMBRETE\) \{\s*cobrarEtapas\(\);\s*avisarPrazos\(\);/.test(sw.replace(/\r\n/g, "\n")), true);

console.log(`\n  ${falhas === 0 ? "Tudo certo." : `${falhas} falha(s).`}\n`);
process.exit(falhas === 0 ? 0 : 1);
