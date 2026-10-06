/**
 * O checklist de resolução enxerga o caso.
 *
 *   npm run check:checklist
 *
 * Sem banco. Cada item que o registro prova marca sozinho, com a origem
 * dita; o que só a pessoa sabe ("Reclamação original lida") nunca marca
 * sozinho; e a tela não guarda mais as marcas só na memória nem dá o caso
 * encerrado como cumprido por inteiro (out/2026).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Case } from "../lib/models/case";
import { provaDoItem } from "../lib/models/checklistDoCaso";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(62)} ${JSON.stringify(obtido)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(62)} ${JSON.stringify(esperado)}`);
}

console.log("\n  CHECKLIST DE RESOLUÇÃO\n");

const vazio = { protocol: "RA-X", status: "Novo", source: "Reclame Aqui" } as Case;
const cheio = {
  ...vazio,
  status: "Resolvido",
  imersaoEm: "2026-09-25T13:13:00Z",
  causaRaiz: "Atendimento",
  primeiroContatoEm: "2026-09-25T13:13:00Z",
  publicResponse: "Olá, Mayara! …",
  pedidosDeAvaliacao: 1,
  evaluated: true,
} as Case;

const CHAVES = [
  "read_complaint",
  "customer_history_checked",
  "root_cause_identified",
  "team_notified",
  "customer_contacted",
  "public_response_sent",
  "review_requested",
  "final_result_logged",
];

conferir("caso sem registro: nada marca sozinho", CHAVES.map((k) => provaDoItem(k, vazio, 0)).filter(Boolean).length, 0);
conferir(
  "caso com tudo registrado: só a leitura do relato fica à mão",
  CHAVES.filter((k) => !provaDoItem(k, cheio, 1)),
  ["read_complaint"]
);
conferir("a origem é dita", provaDoItem("root_cause_identified", cheio, 0), "causa raiz: Atendimento");
conferir("área acionada conta as movimentações", [provaDoItem("team_notified", vazio, 0), provaDoItem("team_notified", vazio, 2)], [null, "2 áreas acionadas"]);
conferir(
  "resultado final: avaliado ou encerrado como resolvido/não resolvido",
  [
    provaDoItem("final_result_logged", { ...vazio, status: "Aguardando avaliação" } as Case, 0),
    provaDoItem("final_result_logged", { ...vazio, status: "Não resolvido" } as Case, 0),
  ],
  [null, "encerrado como não resolvido"]
);

/* A tela: marcas no banco, nada de "tudo cumprido" por estar encerrado. */
const tela = readFileSync(resolve(__dirname, "../components/reclame-aqui/detail/InvestigationTab.tsx"), "utf8");
conferir("a tela grava a marca (marcarItemDoChecklist)", tela.includes("marcarItemDoChecklist("), true);
conferir("a tela lê as marcas gravadas (marcasDoChecklist)", tela.includes("marcasDoChecklist("), true);
conferir("o caso encerrado não nasce com tudo marcado", /data\.resolved\s*\?\s*active\.map/.test(tela), false);
conferir("ninguém mais é dado como autor sem ter marcado", tela.includes("Concluído por ${data.owner"), false);

console.log(falhas === 0 ? "\n  O checklist mostra o que o caso prova e guarda o que alguém marcou.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
process.exitCode = falhas === 0 ? 0 : 1;
