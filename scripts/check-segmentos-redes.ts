/**
 * Os segmentos das Redes contam o que o filtro vai mostrar?
 *
 *   npm run check:segmentos-redes
 *
 * **O pedido.** Segmentar as Redes por origem, rede, tipo, gravidade,
 * alcance do perfil e estabelecimento, com filtros e a contagem por
 * segmento. O que este check segura, sem banco:
 *
 * 1. **a origem** sai da chave da captura (planilha, Slack) e o resto é
 *    registro manual; o alcance, dos seguidores;
 * 2. **facetas de verdade**: a contagem de uma dimensão ignora o próprio
 *    filtro e respeita os outros — o número ao lado é o que o clique mostra;
 * 3. **o filtro que zerou continua na lista**, para poder ser desfeito;
 * 4. **o endereço**: o recorte vira link, e o `?categoria=` antigo chega
 *    como assunto.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Case } from "../lib/models/case";
import {
  alcanceDoCaso,
  alternarFiltro,
  enderecoDosFiltros,
  filtrosAtivos,
  filtrosDoEndereco,
  origemDoCaso,
  segmentar,
} from "../lib/models/segmentosDasRedes";

const RAIZ = resolve(__dirname, "..");

let falhas = 0;

function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${JSON.stringify(obtido)?.slice(0, 44)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(64)} ${JSON.stringify(esperado)?.slice(0, 44)}`);
}

console.log("\n  SEGMENTOS DAS REDES\n");

const caso = (c: Partial<Case>) => ({ id: "uuid", source: "Instagram", category: "Cobrança", priority: "Normal", ...c }) as Case;

const casos = [
  caso({ id: "planilha:abc:1", followers: 18400, priority: "Urgente", establishmentId: "e1" }),
  caso({ id: "planilha:abc:2", source: "Facebook", followers: 300 }),
  caso({ id: "slack:C1:1.1", followers: 4000, category: "Entrega", establishmentId: "e1" }),
  caso({ id: "9f1c", source: "WhatsApp", category: "Não classificado" }),
];
const nome = (id: string) => ({ e1: "Pizzaria Bella" } as Record<string, string>)[id];

/* ---- 1. origem e alcance ---- */

conferir("origem pela chave", casos.map(origemDoCaso), ["Planilha", "Planilha", "Slack", "Registro manual"]);
conferir("alcance pelos seguidores", casos.map(alcanceDoCaso), ["10 mil ou mais", "Até 1 mil", "1 a 10 mil", "Sem o dado"]);

/* ---- 2. facetas ---- */

const semFiltro = segmentar(casos, {}, nome);
conferir("sem filtro, todos", semFiltro.casos.length, 4);
conferir("origem contada em ordem", semFiltro.facetas.origem.map((f) => [f.valor, f.total]), [["Planilha", 2], ["Slack", 1], ["Registro manual", 1]]);
conferir("sem assunto e sem vínculo têm nome", [semFiltro.facetas.tipo.some((f) => f.valor === "Sem assunto"), semFiltro.facetas.estabelecimento.map((f) => f.valor)], [true, ["Pizzaria Bella", "Sem vínculo"]]);

const soPlanilha = segmentar(casos, { origem: ["Planilha"] }, nome);
conferir("filtrar Planilha deixa 2", soPlanilha.casos.length, 2);
conferir("a própria origem ainda mostra o Slack para trocar", soPlanilha.facetas.origem.find((f) => f.valor === "Slack")?.total, 1);
conferir("a rede já conta só a planilha", soPlanilha.facetas.rede.map((f) => [f.valor, f.total]), [["Instagram", 1], ["Facebook", 1]]);

const dois = segmentar(casos, { origem: ["Planilha", "Slack"], estabelecimento: ["Pizzaria Bella"] }, nome);
conferir("dois valores na mesma dimensão somam; dimensões cruzam", dois.casos.length, 2);

/* ---- 3. o filtro que zerou ---- */

const zerou = segmentar(casos, { rede: ["ManyChat"] }, nome);
conferir("filtro sem casos zera a lista", zerou.casos.length, 0);
conferir("e continua na lista, ativo, com 0", zerou.facetas.rede.find((f) => f.valor === "ManyChat"), { valor: "ManyChat", total: 0, ativo: true });

/* ---- 4. endereço ---- */

const f1 = alternarFiltro(alternarFiltro({}, "rede", "Instagram"), "origem", "Slack");
conferir("alternar liga", f1, { rede: ["Instagram"], origem: ["Slack"] });
conferir("alternar de novo desliga e some", alternarFiltro(f1, "rede", "Instagram"), { origem: ["Slack"] });
conferir("contagem de filtros ativos", filtrosAtivos({ rede: ["Instagram", "Facebook"], origem: ["Slack"] }), 3);
conferir("ida e volta pelo endereço", filtrosDoEndereco(new URLSearchParams(enderecoDosFiltros(f1))), { origem: ["Slack"], rede: ["Instagram"] });
conferir("o ?categoria= antigo vira assunto", filtrosDoEndereco(new URLSearchParams("categoria=Entrega")), { tipo: ["Entrega"] });

const pagina = readFileSync(resolve(RAIZ, "app/redes-sociais/page.tsx"), "utf8");
conferir("a tela filtra quadro e lista pelos segmentos", pagina.includes("const social = segmentado.casos;"), true);
conferir("os segmentos ficam fora do vazio", pagina.indexOf("<SegmentosDasRedes") < pagina.indexOf("social.length === 0 ? ("), true);

console.log(falhas === 0 ? "\n  Os segmentos contam o que o filtro vai mostrar.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
process.exit(falhas === 0 ? 0 : 1);
