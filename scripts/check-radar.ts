/**
 * Prova do radar de incidente (1.102): três clientes no mesmo tema de falha
 * em 6 horas acendem; a mesma pessoa três vezes, tema de atendimento, ou
 * fora da janela, não.
 *
 *   npx tsx scripts/check-radar.ts
 */
import { radarDeIncidente, type SinalParaRadar } from "../lib/models/radarDeIncidente";

let falhas = 0;
function conferir(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${nome.padEnd(62)} ${JSON.stringify(obtido)}${ok ? "" : `\n        esperado ${JSON.stringify(esperado)}`}`);
}

const AGORA = new Date("2026-09-30T18:00:00Z");
const h = (horas: number) => new Date(AGORA.getTime() - horas * 3_600_000).toISOString();
const s = (cliente: string, horas: number, texto: string, frente: SinalParaRadar["frente"] = "conversa"): SinalParaRadar => ({ frente, cliente, quando: h(horas), texto, rotulo: cliente });

const impressao = [
  s("Loja A", 1, "os pedidos não estão imprimindo desde cedo", "conversa"),
  s("Loja B", 2, "impressora não imprime os pedidos", "reclame-aqui"),
  s("Loja C", 3, "não imprime nada, a impressão parou", "nps"),
];

const r = radarDeIncidente(impressao, AGORA);
conferir("3 clientes, impressão, 3 horas: incidente", r.map((i) => [i.temaId, i.clientes]), [["impressao", 3]]);
conferir("as frentes juntas", r[0]?.frentes, ["nps", "reclame-aqui", "conversa"]);
conferir("2 clientes não bastam", radarDeIncidente(impressao.slice(0, 2), AGORA).length, 0);
conferir("a mesma loja 3 vezes não é incidente", radarDeIncidente([s("Loja A", 1, "não imprime"), s("Loja A", 2, "impressora não imprime"), s("Loja A", 3, "a impressão parou")], AGORA).length, 0);
conferir("fora das 6 horas não conta", radarDeIncidente([...impressao.slice(0, 2), s("Loja C", 7, "não imprime")], AGORA).length, 0);
conferir("tema de atendimento (demora) não é incidente", radarDeIncidente([s("A", 1, "ninguém me responde, sem retorno"), s("B", 1, "sem retorno do suporte há dias"), s("C", 1, "demora no retorno")], AGORA).length, 0);

console.log(falhas === 0 ? "\n  O radar acende no incidente, e só nele.\n" : `\n  ${falhas} ponto(s) fora.\n`);
process.exit(falhas === 0 ? 0 : 1);
