/**
 * O próximo passo aparece certo, lembra na hora certa e chega limpo à
 * extensão?
 *
 *   npm run check:proximo-passo
 *
 * Sem banco (1.123). As regras de `lib/models/proximoPasso.ts` e a fiação:
 * o cartão do topo do Meu dia, o flutuante das outras telas (fora do Meu
 * dia e das telas de entrada) e a linha do popup da extensão.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ItemDaFila } from "../lib/models/guiaParaFechar";
import { deveLembrar, porQueDoItem, proximoPassoValido, resumoDaFila, retratoDoProximoPasso } from "../lib/models/proximoPasso";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(62)} ${JSON.stringify(obtido)?.slice(0, 44)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(62)} ${JSON.stringify(esperado)?.slice(0, 44)}`);
}

const item = (parte: Partial<ItemDaFila>): ItemDaFila => ({
  chave: "reclame-aqui:1",
  frente: "reclame-aqui",
  ref: "1",
  titulo: "Responder RA-1 — Pizzaria da Ana",
  detalhe: "fora do prazo há 2 dias",
  href: "/reclame-aqui/RA-1",
  atrasado: false,
  atividades: ["Retornar os casos em aberto"],
  chaves: ["em-aberto"],
  janela: null,
  critico: false,
  ...parte,
});

console.log("\n  PRÓXIMO PASSO — as regras\n");

conferir("o porquê: crítico e fora do prazo, crítico, fora do prazo, a atividade", [
  porQueDoItem(item({ critico: true, atrasado: true })),
  porQueDoItem(item({ critico: true })),
  porQueDoItem(item({ atrasado: true })),
  porQueDoItem(item({})),
], ["crítico e fora do prazo", "crítico", "fora do prazo", "Retornar os casos em aberto"]);

const fila = [item({ atrasado: true }), item({ chave: "nps:2", critico: true }), item({ chave: "nps:3" })];
conferir("o resumo da fila", resumoDaFila(fila), { total: 3, atrasados: 1, criticos: 1 });

const min = 60_000;
conferir("não lembra antes do intervalo", deveLembrar({ paradaDesde: 0, ultimoLembrete: 0, intervaloMin: 25, agora: 24 * min }), false);
conferir("lembra com a fila parada o intervalo inteiro", deveLembrar({ paradaDesde: 0, ultimoLembrete: 0, intervaloMin: 25, agora: 25 * min }), true);
conferir("não repete logo depois de lembrar", deveLembrar({ paradaDesde: 0, ultimoLembrete: 25 * min, intervaloMin: 25, agora: 30 * min }), false);
conferir("item que saiu zera o relógio", deveLembrar({ paradaDesde: 20 * min, ultimoLembrete: 0, intervaloMin: 25, agora: 30 * min }), false);
conferir("desligado nunca lembra", deveLembrar({ paradaDesde: 0, ultimoLembrete: 0, intervaloMin: 0, agora: 999 * min }), false);

const agora = new Date("2026-10-01T15:00:00Z");
const retrato = retratoDoProximoPasso(fila, agora)!;
conferir("o retrato é o primeiro da fila", [retrato.titulo, retrato.porque, retrato.total, retrato.atrasados], ["Responder RA-1 — Pizzaria da Ana", "fora do prazo", 3, 1]);
conferir("fila vazia: nada a guardar", retratoDoProximoPasso([], agora), null);
conferir("o que volta do banco passa na conferência", proximoPassoValido(retrato, agora)?.titulo, retrato.titulo);
conferir("mais velho que 12 h não vale", proximoPassoValido(retrato, new Date("2026-10-02T04:00:00Z")), null);
conferir("link que não é da aplicação nem https é recusado", proximoPassoValido({ ...retrato, href: "javascript:alert(1)" }, agora), null);
conferir("caminho que começa com // (outro site) é recusado", proximoPassoValido({ ...retrato, href: "//outro.site/x" }, agora), null);
conferir("o WhatsApp (https) passa", proximoPassoValido({ ...retrato, href: "https://web.whatsapp.com/send?phone=5511999999999" }, agora)?.href, "https://web.whatsapp.com/send?phone=5511999999999");

console.log("\n  A FIAÇÃO\n");
const ler = (arquivo: string) => readFileSync(resolve(__dirname, "..", arquivo), "utf8");
conferir("o flutuante está no layout, em qualquer tela", ler("app/layout.tsx").includes("<ProximoPassoFlutuante />"), true);
conferir("e fica fora do Meu dia e das telas de entrada", /FORA = \[\/\^\\\/meu-dia\/, \/\^\\\/login\//.test(ler("components/rotina/ProximoPassoFlutuante.tsx")), true);
conferir("o Meu dia tem o cartão no topo", ler("app/meu-dia/page.tsx").includes("<ProximoPasso"), true);
conferir("o resumo da extensão devolve o próximo passo conferido", /proximoPasso = proximoPassoValido\(/.test(ler("app/api/extensao/resumo/route.ts")), true);
const popup = ler("extensao/popup/popup.js");
conferir("o popup escapa título, porquê e destino", /escapar\(destino\)/.test(popup) && /escapar\(proximo\.titulo\)/.test(popup) && /escapar\(proximo\.porque\)/.test(popup), true);

console.log(falhas === 0 ? "\n  O próximo passo está à vista, e certo.\n" : `\n  ${falhas} falha(s).\n`);
process.exit(falhas === 0 ? 0 : 1);
