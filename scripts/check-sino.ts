/**
 * O sino olha todas as frentes, agrupa, e não enche a tela ao abrir?
 *
 *   npm run check:sino
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Case } from "../lib/models/case";
import type { NpsResponseView } from "../lib/models/nps";
import { assinaturaDoAviso, buildNotifications, defaultPrefs } from "../lib/services/notifications.service";
import { EXPEDIENTE_PADRAO } from "../lib/services/horasUteis";
import { summarize } from "../lib/services/nps.service";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${JSON.stringify(obtido)?.slice(0, 44)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(64)} ${JSON.stringify(esperado)?.slice(0, 44)}`);
}

const AGORA = new Date("2026-09-17T15:00:00Z");
const caso = (c: Partial<Case>) => ({ id: "x", protocol: "RA-1", customer: "Ana", source: "Reclame Aqui", status: "Novo", createdAt: "2026-09-16", priority: "Normal", category: "", tags: [], ...c }) as Case;

console.log("\n  O SINO\n");

const nps = [
  { id: "n1", score: 2, customer: "loja1", status: "Novo", respondedAt: "2026-09-10T12:00:00Z", firstContactDueAt: "2026-09-11T12:00:00Z" },
  { id: "n2", score: 3, customer: "loja2", customerName: "Bruna", status: "Novo", respondedAt: "2026-09-17T13:00:00Z", firstContactDueAt: "2026-09-18T13:00:00Z" },
] as unknown as NpsResponseView[];
const google = [
  { id: "g1", status: "aberta", classificacao: "negativa", autor: "Carla" },
  { id: "g2", status: "aberta", classificacao: "positiva", autor: "Davi" },
];

const semFontes = buildNotifications([caso({})], [], defaultPrefs, undefined, [], [], EXPEDIENTE_PADRAO);
conferir(
  "sem as fontes novas, nenhum aviso novo (a extensão recebe o que recebia)",
  semFontes.some((n) => ["nps-fora-do-prazo", "nps-detratores-hoje", "google-negativas", "redes-fora-do-prazo", "crise", "sem-noticia"].includes(n.id)),
  false
);
conferir("e os avisos de antes ganham frente", semFontes[0].frente, "reclame-aqui");

const tudo = buildNotifications([caso({})], [], defaultPrefs, undefined, [], [], EXPEDIENTE_PADRAO, { nps, avaliacoesGoogle: google, regras: [], agora: AGORA });
const ids = tudo.map((n) => n.id);
conferir("NPS fora do prazo, com a conta da tela", tudo.find((n) => n.id === "nps-fora-do-prazo")?.count, summarize(nps, AGORA).estourados);
conferir("detrator novo hoje abre em mini-janela", tudo.find((n) => n.id === "nps-detratores-hoje")?.janela, { frente: "nps", ref: "n2", titulo: "NPS 3 · Bruna" });
conferir("Google: só as negativas abertas sem resposta", tudo.find((n) => n.id === "google-negativas")?.count, 1);
conferir("cada aviso tem frente", tudo.every((n) => Boolean(n.frente)), true);
conferir("o grave vem primeiro", tudo[0].tone, "danger");
conferir("nada repetido", new Set(ids).size, ids.length);

conferir("'visto' vale para o texto: 3 visto não esconde 4", assinaturaDoAviso({ id: "a", count: 3, title: "3 x" }) === assinaturaDoAviso({ id: "a", count: 4, title: "4 x" }), false);

const sino = readFileSync(resolve(__dirname, "../components/layout/NotificationsMenu.tsx"), "utf8");
conferir("o número do sino conta só o que não foi visto", /novos\.length/.test(sino) && /cw:avisos-vistos/.test(sino), true);
conferir("abrir a plataforma não dispara pop-up (20 s só registram)", /Date\.now\(\) - montadoEm < 20_000/.test(sino), true);
conferir("pop-up só do que é grave ou atenção, e não visto", /n\.tone !== "info" && !vistos\.has\(assinatura\)/.test(sino), true);
conferir("grupos em ordem fixa de frente", /ORDEM_DAS_FRENTES\.filter/.test(sino), true);

console.log(falhas === 0 ? "\n  O sino olha tudo, sem pular na tela.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
process.exit(falhas === 0 ? 0 : 1);
