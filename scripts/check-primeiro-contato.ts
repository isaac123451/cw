/**
 * O tempo até o 1º contato é medido com o relógio dos prazos?
 *
 *   npm run check:primeiro-contato
 *
 * **A ideia do roadmap.** "O documento define a meta de 1º contato e não
 * a mede. Proponho que ela entre na tabela de indicadores e no relatório
 * do ciclo." A conta, sem servidor:
 *
 * - a mediana é em minutos úteis (a noite e o fim de semana não contam);
 * - "no prazo" só olha o que já se decidiu: o caso de ontem, ainda no
 *   prazo e sem contato, não pesa;
 * - o que chegou antes do registro de contato fica de fora, contado à
 *   parte;
 * - no NPS, o ciclo encerrado sem contato (sem tratativa) não entra.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Case } from "../lib/models/case";
import type { NpsResponseView } from "../lib/models/nps";
import type { SlaRule } from "../lib/models/sla";
import { medirPrimeiroContato, primeiroContatoDoNps, primeiroContatoDosCasos } from "../lib/models/primeiroContato";

const RAIZ = resolve(__dirname, "..");

let falhas = 0;

function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${JSON.stringify(obtido)?.slice(0, 44)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(64)} ${JSON.stringify(esperado)?.slice(0, 44)}`);
}

const ler = (arquivo: string) => readFileSync(resolve(RAIZ, arquivo), "utf8");
const d = (iso: string) => new Date(iso);

/* Quarta, 16/09/2026, 15h em Brasília. */
const AGORA = d("2026-09-16T18:00:00Z");

console.log("\n  TEMPO ATÉ O 1º CONTATO\n");

{
  const ind = medirPrimeiroContato(
    [
      /* sexta 17h → segunda 9h: 2h úteis (17h–18h e 8h–9h). */
      { inicio: d("2026-09-11T20:00:00Z"), contatoEm: d("2026-09-14T12:00:00Z"), prazo: d("2026-09-14T14:00:00Z") },
      /* 1h depois, dentro do prazo. */
      { inicio: d("2026-09-15T13:00:00Z"), contatoEm: d("2026-09-15T14:00:00Z"), prazo: d("2026-09-15T17:00:00Z") },
      /* contatado depois do prazo. */
      { inicio: d("2026-09-15T13:00:00Z"), contatoEm: d("2026-09-16T13:00:00Z"), prazo: d("2026-09-15T17:00:00Z") },
      /* sem contato, prazo vencido. */
      { inicio: d("2026-09-14T13:00:00Z"), prazo: d("2026-09-15T13:00:00Z") },
      /* sem contato, ainda no prazo: não pesa. */
      { inicio: d("2026-09-16T17:00:00Z"), prazo: d("2026-09-17T17:00:00Z") },
    ],
    AGORA
  );
  conferir("mediana em minutos úteis (sexta 17h → segunda 9h = 2h)", ind.medianaMin, 120);
  conferir("no prazo só entre os decididos (2 de 4)", [ind.noPrazo, ind.percentualNoPrazo], [2, 50]);
  conferir("o vencido sem contato conta contra", ind.vencidosSemContato, 1);
  conferir("e o que ainda está no prazo fica fora da conta", [ind.total, ind.contatados], [5, 3]);
  conferir("sem nada, sem número (e não 0%)", medirPrimeiroContato([], AGORA).percentualNoPrazo, null);
}

{
  const regras = [{ id: "r", category: "*", priority: "Normal", active: true, responseHours: 24, solutionHours: 0 }] as unknown as SlaRule[];
  const caso = (c: Partial<Case>) => ({ id: "x", source: "Reclame Aqui", priority: "Normal", status: "Novo", ...c }) as Case;
  const ind = primeiroContatoDosCasos(
    [
      caso({ id: "a", createdAt: "2026-09-01" }),
      caso({ id: "b", createdAt: "2026-09-14", recebidaEm: "2026-09-14T13:00:00Z", primeiroContatoEm: "2026-09-14T15:00:00Z" }),
      caso({ id: "c", createdAt: "2026-08-01" }),
    ],
    regras,
    { de: "2026-09-01", ate: "2026-09-16" },
    AGORA
  );
  conferir("antes do registro de contato e sem registro: à parte", [ind.total, ind.semRegistro], [1, 1]);
  conferir("fora do período não entra", ind.total + ind.semRegistro, 2);
  conferir("o prazo vem da regra da criticidade", ind.percentualNoPrazo, 100);
}

{
  const r = (x: Partial<NpsResponseView>) => ({ id: "n", score: 3, ...x }) as NpsResponseView;
  const ind = primeiroContatoDoNps(
    [
      r({ respondedAt: "2026-09-15T13:00:00Z", firstContactDueAt: "2026-09-15T21:00:00Z", firstContactAt: "2026-09-15T14:00:00Z" }),
      r({ respondedAt: "2026-09-15T13:00:00Z", firstContactDueAt: "2026-09-15T21:00:00Z", closedAt: "2026-09-15T14:00:00Z" }),
    ],
    { de: "2026-09-14", ate: "2026-09-16" },
    AGORA,
    (iso) => iso.slice(0, 10)
  );
  conferir("NPS encerrado sem contato (sem tratativa) não entra", [ind.total, ind.medianaMin], [1, 60]);
}

console.log("\n— A fiação —\n");

{
  const servico = ler("lib/services/relatorio.service.ts");
  conferir("na tabela de indicadores (cada aba)", /primeiroContato: primeiroContatoDosCasos\(casos,/.test(servico), true);
  conferir("no ciclo, por frente", /nps: primeiroContatoDoNps\(/.test(servico), true);
  conferir("no texto do Slack", servico.includes("*1º contato no ciclo:*"), true);

  const acao = ler("lib/actions/relatorio.ts");
  conferir("o relatório lê as regras e o expediente do banco", /slaRuleDoBanco/.test(acao) && /lerExpediente\(prisma\)/.test(acao), true);
  conferir("e a planilha leva as três linhas por frente", acao.includes("1º contato: % no prazo"), true);

  const tela = ler("components/relatorio/RelatorioDoCiclo.tsx");
  conferir("a tela mostra a linha e o cartão", tela.includes("1º contato (horas úteis)") && tela.includes("Tempo até o 1º contato no ciclo"), true);
}

console.log(falhas === 0 ? "\n  A meta de 1º contato agora é medida, pelo mesmo relógio dos prazos.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
process.exit(falhas === 0 ? 0 : 1);
