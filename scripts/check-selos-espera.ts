/**
 * Selos de quem espera resposta — a conta da espera e o selo.
 *
 *   npm run check:selos-espera
 *
 * Sem navegador: roda `extensao/conteudo/selos-espera.js` numa caixa sem
 * página, só as funções puras.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(58)} ${String(JSON.stringify(obtido)).slice(0, 40)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(58)} ${String(JSON.stringify(esperado)).slice(0, 40)}`);
}

console.log("\n  SELOS DE QUEM ESPERA RESPOSTA\n");

const codigo = readFileSync(resolve(__dirname, "../extensao/conteudo/selos-espera.js"), "utf8");
const caixa: Record<string, unknown> = { window: {}, Date };
vm.createContext(caixa);
vm.runInContext(codigo, caixa);
const s = ((caixa.window as Record<string, unknown>).CWReputacao as { selosEspera: Record<string, (...a: unknown[]) => unknown> }).selosEspera;

/* Sexta, 25/09/2026, 15:00 no relógio local da caixa. */
const agora = new Date(2026, 8, 25, 15, 0, 0);
conferir("hora de hoje: minutos exatos", s.minutosDesde("14:32", agora), 28);
conferir("hora \"depois de agora\" é de ontem", s.minutosDesde("16:10", agora), 1370);
conferir("Ontem: pelo menos um dia", s.minutosDesde("Ontem", agora), 1440);
conferir("dia da semana: segunda foi há 4 dias", s.minutosDesde("segunda-feira", agora), 4 * 1440);
conferir("data completa", s.minutosDesde("20/09/2026", agora), 5 * 1440 + 15 * 60);
conferir("texto que não é hora: nada", s.minutosDesde("digitando…", agora), null);

conferir("menos de 5 min: sem selo (conversa acontecendo)", s.seloDaEspera(3), null);
conferir("28 min: leve", s.seloDaEspera(28), { rotulo: "espera 28 min", nivel: "leve" });
conferir("1 h e meia: atenção", s.seloDaEspera(95), { rotulo: "espera 1 h e meia", nivel: "atencao" });
conferir("5 h: atrasado", s.seloDaEspera(300), { rotulo: "espera 5 h", nivel: "atrasado" });
conferir("desde ontem", s.seloDaEspera(1440), { rotulo: "espera desde ontem", nivel: "atrasado" });
conferir("há 3 dias", s.seloDaEspera(3 * 1440), { rotulo: "espera há 3 dias", nivel: "atrasado" });

conferir("não lê texto de mensagem nem manda nada", /innerText|chrome\.runtime|fetch\(|CW\.enviar/.test(codigo), false);

console.log(`\n  ${falhas === 0 ? "Tudo certo." : `${falhas} falha(s).`}\n`);
process.exit(falhas === 0 ? 0 : 1);
