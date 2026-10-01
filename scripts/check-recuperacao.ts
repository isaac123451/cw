/**
 * O plano de recuperação segue o ajuste de cada um?
 *
 *   npm run check:recuperacao
 *
 * Sem banco (1.122, Fase 34: "plano de recuperação configurável — cotas,
 * prazos e frentes do jeito das suas demandas"). O ajuste por frente:
 * aparecer ou não, a partir de quantos fora do prazo, em quantos dias
 * zerar e a cota fixa. E o que vem de fora (o banco, a tela) é conferido.
 */
import type { FrenteId } from "../lib/models/frentes";
import {
  AJUSTE_PADRAO,
  ajusteValido,
  cotaDaFrente,
  cotasOferecidas,
  cotaSugerida,
  frentesNoPlano,
  planoDeRecuperacao,
} from "../lib/models/recuperacao";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(62)} ${JSON.stringify(obtido)?.slice(0, 50)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(62)} ${JSON.stringify(esperado)?.slice(0, 50)}`);
}

console.log("\n  PLANO DE RECUPERAÇÃO — do jeito de cada um\n");

conferir("sem ajuste, o de sempre: 10 fora do prazo, 5 dias, cota sugerida", ajusteValido(null).nps, AJUSTE_PADRAO);
conferir("a sugerida segue o prazo: 149 em 5 dias → 30; em 10 dias → 15", [cotaSugerida(149, 5), cotaSugerida(149, 10)], [30, 15]);

const ajuste = ajusteValido({
  nps: { ligado: true, minimo: 30, dias: 10, cota: null },
  "reclame-aqui": { ligado: true, minimo: 3, dias: 2, cota: 4 },
  redes: { ligado: false },
});
const porFrente = new Map<FrenteId, number>([["nps", 149], ["reclame-aqui", 5], ["redes", 40], ["google", 9]]);
conferir("as frentes no plano seguem o mínimo e o liga-desliga de cada uma", frentesNoPlano(porFrente, ajuste).map(([f]) => f), ["nps", "reclame-aqui"]);
conferir("cota fixa vale no lugar da sugerida", [cotaDaFrente(5, ajuste["reclame-aqui"]), cotaDaFrente(149, ajuste.nps)], [4, 15]);
conferir("a cota fixa aparece entre as oferecidas", cotasOferecidas(5, 2, 4).includes(4), true);
conferir("com 15 por dia, 149 zeram em 10 dias úteis", planoDeRecuperacao(149, 15, "2026-10-01")?.dias, 10);

const bagunca = ajusteValido({ nps: { ligado: "sim", minimo: -5, dias: 999, cota: "abc" }, google: { cota: 0 } });
conferir(
  "o que vem fora dos limites vira o limite (ou o padrão)",
  [bagunca.nps.ligado, bagunca.nps.minimo, bagunca.nps.dias, bagunca.nps.cota, bagunca.google.cota],
  [true, 1, 30, null, null]
);
conferir("frente que não veio no ajuste fica com o padrão", ajuste.google, AJUSTE_PADRAO);

console.log(falhas === 0 ? "\n  O plano segue o ajuste de cada um.\n" : `\n  ${falhas} falha(s).\n`);
process.exit(falhas === 0 ? 0 : 1);
