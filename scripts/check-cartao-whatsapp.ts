/**
 * O cartão do caso no WhatsApp (22/10/2026) — o HTML, sem navegador.
 *
 *   npm run check:cartao-whatsapp
 */
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const CW: Record<string, unknown> = {
  escapar: (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"),
};
runInNewContext(readFileSync("extensao/conteudo/cartao-whatsapp.js", "utf8"), { window: { CWReputacao: CW } });
const { html } = CW.cartaoWhatsapp as { html: (dados: unknown) => string };

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(62)} ${JSON.stringify(obtido)?.slice(0, 50)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(62)} ${JSON.stringify(esperado)?.slice(0, 50)}`);
}

const caso = (extra: Record<string, unknown> = {}) => ({
  protocolo: "RA-abc", titulo: "Pedido sumiu", status: "Em tratativa", prioridade: "Urgente", aberto: true, respondido: false,
  sla: { situacao: "estourado", rotulo: "1º contato atrasado" }, url: "http://localhost:3000/reclame-aqui/abc", ...extra,
});
const npsAberto = { nota: 3, status: "1º contato", encerrado: false, cliente: "ana@x.com", primeiroContatoEm: undefined, prazoPrimeiroContato: "2026-10-23", tentativas: 0, tentativasMinimas: 3 };

conferir("nada em aberto: sem cartão", html({ cliente: { nome: "Ana" }, casos: [caso({ aberto: false })], nps: { ...npsAberto, encerrado: true } }), "");
conferir("sem dados: sem cartão", html(null), "");
const um = html({ cliente: { nome: "Ana Souza" }, casos: [caso()] });
conferir("reclamação aberta: nome, prioridade, prazo e link ao CW", ["Ana Souza", "Urgente", "1º contato atrasado", 'href="http://localhost:3000/reclame-aqui/abc"', "sem resposta pública"].map((t) => um.includes(t)), [true, true, true, true, true]);
const tres = html({ cliente: { nome: "Ana" }, casos: [caso(), caso({ protocolo: "RA-2" }), caso({ protocolo: "RA-3" })] });
conferir("três abertas: mostra duas e avisa o resto", [(tres.match(/class="item"/g) ?? []).length, tres.includes("+1 em aberto")], [2, true]);
const soNps = html({ cliente: null, casos: [], nps: npsAberto });
conferir("só NPS em andamento: nota, etapa e o prazo do 1º contato", ["NPS 3", "1º contato até 23/10", "ana@x.com"].map((t) => soNps.includes(t)), [true, true, true]);
conferir("NPS com contato feito: as tentativas que faltam", html({ casos: [], nps: { ...npsAberto, primeiroContatoEm: "2026-10-20", tentativas: 1 } }).includes("1/3 tentativas"), true);
conferir("risco marcado: a linha de retenção", html({ cliente: { nome: "Ana" }, casos: [caso()], risco: 1 }).includes("Risco de cancelar"), true);
conferir("texto do cliente não vira HTML", html({ cliente: { nome: "<img src=x>" }, casos: [caso({ titulo: "<b>x</b>" })] }).includes("<img"), false);
conferir("botões: só Painel e fechar", (um.match(/<button /g) ?? []).length, 2);

console.log(falhas ? `\n  ${falhas} ponto(s) a corrigir.\n` : "\n  O cartão do WhatsApp mostra só o que está em aberto, pequeno, e leva ao CW.\n");
if (falhas) process.exitCode = 1;
