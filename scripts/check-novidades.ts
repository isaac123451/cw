/**
 * A página de Novidades acompanha as versões, e os tours acham o que apontam?
 *
 *   npm run check:novidades
 *
 * **O pedido.** "Tela com todas as novidades." A página lista cada versão
 * que mudou a tela, com filtro por frente, o "novo" desde a última visita
 * e tours na própria tela. O que este check segura:
 *
 * 1. **a versão atual está lá** — subir o package.json sem escrever a
 *    novidade acende vermelho; e a lista está em ordem, sem repetir;
 * 2. **todo endereço existe** como página, e todo tour aponta um
 *    `data-tour` que existe no código (um tour para um elemento que saiu
 *    seria um balão que nunca aparece);
 * 3. **o "novo"**: quem nunca abriu vê só a era atual; quem viu a 1.5.0 vê
 *    o que veio depois.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { NOVIDADES, compararVersoes, eraDaVersao, filtrarNovidades, novasDesde, tourPorId } from "../lib/models/novidades";

const RAIZ = resolve(__dirname, "..");

let falhas = 0;

function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${JSON.stringify(obtido)?.slice(0, 44)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(64)} ${JSON.stringify(esperado)?.slice(0, 44)}`);
}

console.log("\n  NOVIDADES\n");

/* ---- 1. versões ---- */

const pacote = JSON.parse(readFileSync(resolve(RAIZ, "package.json"), "utf8")) as { version: string };
const menor = pacote.version.replace(/\.\d+$/, ".0");
conferir(`a versão atual (${pacote.version}) tem novidade`, NOVIDADES.some((n) => n.versao === pacote.version || n.versao === menor), true);
conferir("da mais nova para a mais antiga", NOVIDADES.every((n, i) => i === 0 || compararVersoes(NOVIDADES[i - 1].versao, n.versao) > 0), true);
conferir("toda novidade tem frente e texto", NOVIDADES.every((n) => n.frentes.length > 0 && n.texto.length > 20), true);
conferir("datas no formato do dia", NOVIDADES.every((n) => /^\d{4}-\d{2}-\d{2}$/.test(n.data)), true);

/* ---- 2. endereços e tours ---- */

const paginaExiste = (href: string) => {
  const caminho = href.split("?")[0].replace(/^\//, "");
  return existsSync(join(RAIZ, "app", caminho, "page.tsx"));
};
const semPagina = NOVIDADES.flatMap((n) => [n.href, n.tour?.rota]).filter((h): h is string => Boolean(h) && !paginaExiste(h!));
conferir("todo endereço é uma página", semPagina, []);

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const p = join(dir, nome);
    return statSync(p).isDirectory() ? arquivos(p) : /\.tsx$/.test(nome) ? [p] : [];
  });
}
const codigo = [...arquivos(join(RAIZ, "components")), ...arquivos(join(RAIZ, "app"))].map((f) => readFileSync(f, "utf8")).join("\n");
const alvosSemMarca = NOVIDADES.flatMap((n) => n.tour?.passos ?? [])
  .map((p) => p.alvo.match(/data-tour="([^"]+)"/)?.[1] ?? p.alvo.match(/title="([^"]+)"/)?.[1] ?? null)
  .filter((marca): marca is string => marca !== null && !codigo.includes(`"${marca}"`));
conferir("todo tour aponta um elemento que existe no código", alvosSemMarca, []);
conferir("ids de tour únicos", new Set(NOVIDADES.flatMap((n) => (n.tour ? [n.tour.id] : []))).size, NOVIDADES.filter((n) => n.tour).length);
conferir("o tour é achado pelo id", tourPorId("um-por-vez")?.rota, "/meu-dia");
conferir("id desconhecido não abre tour", tourPorId("nao-existe"), null);
conferir("a página monta o tour", readFileSync(resolve(RAIZ, "components/layout/MainLayout.tsx"), "utf8").includes("<TourDaNovidade />"), true);

/* ---- 3. o novo e o filtro ---- */

conferir("eras", ["1.8.0", "1.1.0", "1.0.1", "1.0.0", "0.48.0", "0.47.0"].map(eraDaVersao), ["2.0", "2.0", "1.0", "1.0", "1.0", "antes"]);
conferir("quem nunca abriu vê só a era atual", [...novasDesde(NOVIDADES, null)].every((v) => eraDaVersao(v) === "2.0"), true);
conferir("quem viu a 1.5.0 vê o que veio depois", [...novasDesde(NOVIDADES, "1.5.0")].every((v) => compararVersoes(v, "1.5.0") > 0) && novasDesde(NOVIDADES, "1.5.0").size > 0, true);
conferir("quem viu a atual não tem novidade", novasDesde(NOVIDADES, NOVIDADES[0].versao).size, 0);
conferir("filtro por frente", filtrarNovidades(NOVIDADES, "google").every((n) => n.frentes.includes("google")), true);
conferir("o menu marca a novidade não vista", readFileSync(resolve(RAIZ, "components/layout/Sidebar.tsx"), "utf8").includes("CHAVE_DA_VERSAO_VISTA"), true);

console.log(falhas === 0 ? "\n  As novidades acompanham as versões.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
process.exit(falhas === 0 ? 0 : 1);
