/**
 * Os avisos ao abrir a conversa dizem o que importa, na ordem certa?
 *
 *   npm run check:avisos-extensao
 *
 * Fase 17. O painel da extensão abre com até quatro linhas do que pede
 * cuidado com o contato: prazo estourado, risco, detrator do NPS,
 * reincidência, reclamação sem solução. A regra (`P.avisosDoContato`)
 * roda aqui dentro de uma página de mentira, só com o que ela usa.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(58)} ${JSON.stringify(obtido)?.slice(0, 60)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(58)} ${JSON.stringify(esperado)?.slice(0, 60)}`);
}

const P: Record<string, unknown> = {};
const janela = { CWReputacao: { escapar: (t: string) => t }, __cwPainel: P };
runInNewContext(readFileSync(resolve(__dirname, "../extensao/conteudo/painel-contato.js"), "utf8"), {
  window: janela,
  document: {},
  chrome: undefined,
  console,
});

type Aviso = { tom: string; texto: string };
const avisos = P.avisosDoContato as (dados: unknown, agora?: number) => Aviso[];
const textos = (d: unknown, agora?: number) => avisos(d, agora).map((a) => a.texto);

const agora = new Date("2026-09-18T12:00:00-03:00").getTime();
const cliente = (c: Record<string, unknown> = {}) => ({ nome: "Ana", total: 1, abertos: 1, naoResolvidos: 0, risco: false, ...c });

console.log("\n  AVISOS AO ABRIR A CONVERSA\n");

conferir("sem cliente, nada", avisos({}), []);
conferir("cliente tranquilo, nada", avisos({ cliente: cliente(), casos: [{ aberto: true, protocolo: "RA-1", sla: { situacao: "ok" } }] }), []);
conferir("prazo estourado", textos({ cliente: cliente(), casos: [{ aberto: true, protocolo: "RA-1", sla: { situacao: "estourado" } }] }), ["Prazo estourado em RA-1"]);
conferir("caso fechado não conta prazo", textos({ cliente: cliente(), casos: [{ aberto: false, protocolo: "RA-1", sla: { situacao: "estourado" } }] }), []);
conferir("prazo perto de vencer traz o rótulo", textos({ cliente: cliente(), casos: [{ aberto: true, protocolo: "RA-2", sla: { situacao: "atencao", rotulo: "vence em 2h" } }] }), ["RA-2: vence em 2h"]);
conferir("reincidente", textos({ cliente: cliente({ total: 2 }) }), ["Já reclamou 2 vezes"]);
conferir(
  "detrator do NPS com os dias",
  textos({ cliente: cliente(), nps: { nota: 3, encerrado: false, respondidoEm: "2026-09-15T12:00:00-03:00" } }, agora),
  ["Detrator do NPS (nota 3) há 3 dias"]
);
conferir("NPS encerrado não avisa", textos({ cliente: cliente(), nps: { nota: 3, encerrado: true } }), []);
conferir("promotor não avisa", textos({ cliente: cliente(), nps: { nota: 9, encerrado: false } }), []);
conferir("sem solução, no singular", textos({ cliente: cliente({ naoResolvidos: 1 }) }), ["1 reclamação terminou sem solução"]);

const tudo = avisos(
  {
    cliente: cliente({ total: 4, naoResolvidos: 2, risco: true }),
    casos: [{ aberto: true, protocolo: "RA-9", sla: { situacao: "estourado" } }],
    nps: { nota: 2, encerrado: false, respondidoEm: "2026-09-18T08:00:00-03:00" },
  },
  agora
);
conferir("no máximo quatro", tudo.length, 4);
conferir("o grave vem primeiro", tudo.map((a) => a.tom), ["perigo", "perigo", "perigo", "atencao"]);
conferir("detrator de hoje", tudo[2].texto, "Detrator do NPS (nota 2), respondeu hoje");

const estilo = readFileSync(resolve(__dirname, "../extensao/conteudo/estilo.js"), "utf8");
const painel = readFileSync(resolve(__dirname, "../extensao/conteudo/painel-contato.js"), "utf8");
conferir("o painel desenha os avisos antes do resumo", /blocoAvisos\(P\.avisosDoContato\(dados\)\)\);\s*\n\s*\/\/[^\n]*\n\s*partes\.push\(P\.blocoResumo\(\)\)/.test(painel), true);
conferir("e o estilo existe", estilo.includes(".avisos-contato li.perigo"), true);

console.log(falhas === 0 ? "\n  O painel abre dizendo o que pede cuidado.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
process.exit(falhas === 0 ? 0 : 1);
