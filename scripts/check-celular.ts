/**
 * A passada de 375 px (Fase 10.3) continua valendo?
 *
 *   npm run check:celular
 *
 * A passada foi feita no navegador, em 375 × 812, nas telas do roadmap —
 * painel, quadro, caso, NPS (lista e ficha), Meu dia, relatório — e mais
 * Redes, Conversas e Google, com dois detectores rodados na página:
 * elemento passando da borda sem um contêiner que role, e texto maior
 * que a própria caixa. Ficaram dois defeitos, e são eles que este check
 * segura:
 *
 * 1. a mini-janela nascia 29 px além da borda esquerda (a posição
 *    inicial usava o limite do arrastar, que deixa meia janela para fora);
 * 2. o nome sem espaço — o handle do NPS, "vanessa.silva.cassiano…" —
 *    passava da ficha e era cortado.
 *
 * O detector usado na página está em `DETECTOR`, abaixo, para repetir a
 * passada no console do navegador quando uma tela nova entrar.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { abrirJanela } from "../lib/models/janelas";

export const DETECTOR = `(() => { const w = document.documentElement.clientWidth; const fora = [], cortado = [];
  const rola = (el) => { for (let p = el; p && p !== document.body; p = p.parentElement) if (/(auto|scroll)/.test(getComputedStyle(p).overflowX)) return true; return false; };
  for (const el of document.querySelectorAll('body *')) {
    if (['INPUT','TEXTAREA','SELECT','svg','path'].includes(el.tagName) || rola(el)) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    if (r.right > w + 1) fora.push(el);
    if (!/truncate|line-clamp|sr-only/.test(String(el.className)) && el.children.length === 0 && el.scrollWidth > el.clientWidth + 2) cortado.push(el);
  }
  return { largura: w, fora, cortado }; })()`;

const RAIZ = resolve(__dirname, "..");

let falhas = 0;

function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${JSON.stringify(obtido)?.slice(0, 44)}`);
}

const ler = (arquivo: string) => readFileSync(resolve(RAIZ, arquivo), "utf8");

console.log("\n  CELULAR — 375 PX\n");

for (const largura of [320, 375, 414]) {
  const r = abrirJanela([], { frente: "nps", ref: "x", titulo: "x" }, { largura, altura: 812 });
  const j = r.tipo === "aberta" ? r.janelas[0] : null;
  const real = Math.min(380, largura - 16);
  conferir(`a mini-janela nasce inteira em ${largura} px`, Boolean(j && j.x >= 8 && j.x + real <= largura - 7), true);
}

conferir("o nome longo quebra na ficha do NPS", /\[overflow-wrap:anywhere\][^>]*>\{nomeDoCliente\(ciclo\)\}/.test(ler("components/nps/ficha/FichaDoNps.tsx")), true);
conferir("e o título na ficha do caso", ler("components/reclame-aqui/detail/CaseDetail.tsx").includes("[overflow-wrap:anywhere]"), true);
conferir(
  "a mini-janela (essencial ou completa) nunca é mais larga que a tela",
  /min\(\$\{completa \? LARGURA_DA_FICHA_COMPLETA : LARGURA_DA_JANELA\}px, calc\(100vw - 16px\)\)/.test(ler("components/janelas/JanelasHost.tsx")),
  true
);

console.log(falhas === 0 ? "\n  As telas principais cabem em 375 px.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
process.exit(falhas === 0 ? 0 : 1);
