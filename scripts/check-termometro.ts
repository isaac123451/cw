/**
 * O termômetro do cliente — `lib/models/termometro.ts` (09/10/2026).
 *
 *   npm run check:termometro
 *
 * Sem banco. A calibragem foi conferida contra as avaliações reais com
 * conversa guardada (5 em 09/10/2026: erro médio da nota de 2,4 para 0,4
 * ponto); aqui ficam as regras que não podem voltar atrás.
 */
import { calibrar, faixaDaSatisfacao, satisfacaoPelosSinais, tendenciaEntre, type HistoricoDeAvaliacoes } from "../lib/models/termometro";

let falhas = 0;
function conferir(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${nome.padEnd(72)} ${JSON.stringify(obtido)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(72)} ${JSON.stringify(esperado)}`);
}

const OPERACAO: HistoricoDeAvaliacoes = { avaliacoes: 228, notaMedia: 7.3, resolvido: 85, voltaria: 74 };
const NENHUM: HistoricoDeAvaliacoes = { avaliacoes: 0, notaMedia: null, resolvido: null, voltaria: null };
const sinais = (extra: Partial<Parameters<typeof satisfacaoPelosSinais>[0]> = {}) => ({
  humor: 3 as const,
  horasEsperando: 0,
  promessaAtrasada: false,
  respostaPublica: false,
  encerrado: false,
  notaNps: null,
  ...extra,
});

console.log("\n  OS SINAIS\n");
conferir("humor neutro, ninguém esperando: 5", satisfacaoPelosSinais(sinais()).valor, 5);
conferir("muito satisfeito: 10", satisfacaoPelosSinais(sinais({ humor: 5 })).valor, 10);
conferir("muito irritado e esperando há 30 h: 0 (não fica negativo)", satisfacaoPelosSinais(sinais({ humor: 1, horasEsperando: 30 })).valor, 0);
conferir("esperando 5 h e promessa atrasada: tira 2", satisfacaoPelosSinais(sinais({ horasEsperando: 5, promessaAtrasada: true })).valor, 3);
conferir("sem conversa, vale a nota do NPS", satisfacaoPelosSinais(sinais({ humor: null, notaNps: 4 })).valor, 4);
conferir("o porquê de cada ajuste vai junto", satisfacaoPelosSinais(sinais({ horasEsperando: 26 })).porque.length, 2);

console.log("\n  A CALIBRAGEM\n");
const base = satisfacaoPelosSinais(sinais({ humor: 4 }));
const feliz = calibrar(base, NENHUM, OPERACAO, { satisfacao: 9, notaPrevista: 10, chanceResolvido: 95, chanceVoltaria: 90, motivo: "Agradeceu", sinais: ["agradeceu"] });
conferir("cliente feliz: satisfação alta (IA pesa mais que os sinais)", feliz.satisfacao, 9);
conferir("e a nota prevista chega no topo, como na operação real", feliz.notaPrevista >= 9, true);
const bravo = calibrar(satisfacaoPelosSinais(sinais({ humor: 1, horasEsperando: 30 })), NENHUM, OPERACAO, { satisfacao: 1, notaPrevista: 1, chanceResolvido: 10, chanceVoltaria: 5, motivo: "Quer cancelar", sinais: [] });
conferir("cliente bravo e esperando: detrator", faixaDaSatisfacao(bravo.satisfacao), "detrator");
conferir("e a nota prevista fica baixa", bravo.notaPrevista <= 5, true);
const otimista = calibrar(satisfacaoPelosSinais(sinais({ humor: 1, horasEsperando: 30 })), NENHUM, OPERACAO, { satisfacao: 10, notaPrevista: 10 });
conferir("IA otimista não leva a 10 quem está irritado e esperando", otimista.satisfacao < 10, true);
const historicoRuim: HistoricoDeAvaliacoes = { avaliacoes: 3, notaMedia: 2, resolvido: 0, voltaria: 0 };
const comHistorico = calibrar(base, historicoRuim, OPERACAO, { satisfacao: 7, notaPrevista: 7 });
const semHistorico = calibrar(base, NENHUM, OPERACAO, { satisfacao: 7, notaPrevista: 7 });
conferir("cliente que sempre avaliou mal: nota prevista menor que a de quem não tem histórico", comHistorico.notaPrevista < semHistorico.notaPrevista, true);
conferir("e o histórico aparece nos sinais", comHistorico.sinais.some((s) => s.includes("avaliação(ões) anterior(es)")), true);
const semIa = calibrar(base, NENHUM, OPERACAO, null);
conferir("sem IA: sai pelos sinais e pelo histórico, com o porquê no motivo", [semIa.satisfacao, semIa.motivo.length > 0], [8, true]);
conferir("tudo dentro das réguas (0–10 e 0–100)", [bravo, feliz, otimista].every((t) => t.notaPrevista >= 0 && t.notaPrevista <= 10 && t.chanceResolvido >= 0 && t.chanceResolvido <= 100), true);

console.log("\n  FAIXA E TENDÊNCIA\n");
conferir("faixas do NPS", [faixaDaSatisfacao(10), faixaDaSatisfacao(8), faixaDaSatisfacao(6)], ["promotor", "neutro", "detrator"]);
conferir("tendência", [tendenciaEntre(4, 7), tendenciaEntre(7, 4), tendenciaEntre(6, 6), tendenciaEntre(null, 5)], ["melhorando", "piorando", "estavel", null]);

console.log(falhas === 0 ? "\n  O termômetro mede com régua de verdade.\n" : `\n  ${falhas} falha(s).\n`);
process.exit(falhas === 0 ? 0 : 1);
