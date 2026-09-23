/**
 * A primeira semana guiada oferece o tour certo, na hora certa?
 *
 *   npm run check:primeira-semana
 *
 * Fase 19. Cada tela principal tem um tour curto, oferecido uma vez na
 * primeira visita, só na primeira semana e só enquanto o roteiro do
 * primeiro acesso está em curso. Este check prova a regra e confere que
 * todo balão aponta para uma âncora que existe no código — um tour que
 * procura um elemento que ninguém marcou só pula passos em silêncio.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { oferecerTourDaTela, tourDaTela, TOURS_DAS_TELAS } from "../lib/models/primeiraSemana";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${JSON.stringify(obtido)?.slice(0, 44)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(64)} ${JSON.stringify(esperado)?.slice(0, 44)}`);
}

const RAIZ = resolve(__dirname, "..");
const agora = new Date("2026-09-23T15:00:00Z");
const base = { rota: "/reclame-aqui", primeiraVisita: "2026-09-21T12:00:00Z", jaVistas: [] as string[], roteiroEmCurso: true, agora };

console.log("\n  PRIMEIRA SEMANA GUIADA\n");

conferir("na primeira semana, a tela com tour oferece o dela", oferecerTourDaTela(base)?.id, "tela-reclame-aqui");
conferir("tela sem tour não oferece nada", oferecerTourDaTela({ ...base, rota: "/configuracoes" }), null);
conferir("já visto nesta tela: não oferece de novo", oferecerTourDaTela({ ...base, jaVistas: ["tela-reclame-aqui"] }), null);
conferir("depois de sete dias: não oferece", oferecerTourDaTela({ ...base, primeiraVisita: "2026-09-10T12:00:00Z" }), null);
conferir("roteiro concluído ou dispensado: não oferece", oferecerTourDaTela({ ...base, roteiroEmCurso: false }), null);
conferir("sem primeira visita registrada: não oferece", oferecerTourDaTela({ ...base, primeiraVisita: null }), null);
conferir("o balão acha o tour da tela pelo id", tourDaTela("tela-nps")?.rota, "/nps");

/* Toda âncora dos tours existe no código. */
function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return nome === "node_modules" || nome.startsWith(".") ? [] : arquivos(caminho);
    return /\.tsx?$/.test(nome) ? [caminho] : [];
  });
}
const codigo = [...arquivos(join(RAIZ, "app")), ...arquivos(join(RAIZ, "components"))].map((f) => readFileSync(f, "utf8")).join("\n");

const ancoras = Object.values(TOURS_DAS_TELAS).flatMap((t) => t.passos.map((p) => p.alvo.match(/data-tour="([^"]+)"/)?.[1] ?? p.alvo));
const faltam = ancoras.filter((a) => {
  if (codigo.includes(`data-tour="${a}"`) || codigo.includes(`tour="${a}"`)) return false;
  /* As abas do Reclame Aqui marcam `modulo-<fim do endereço>`. */
  const doModulo = a.match(/^modulo-(.+)$/)?.[1];
  return !(doModulo && codigo.includes("data-tour={`modulo-${item.href.split(\"/\").pop()}`}") && codigo.includes(`/reclame-aqui/${doModulo}"`));
});
conferir(`as ${ancoras.length} âncoras dos tours existem no código`, faltam, []);

const layout = readFileSync(join(RAIZ, "components/layout/MainLayout.tsx"), "utf8");
conferir("o convite está em todas as telas (no layout)", layout.includes("<DicaDaTela />"), true);
const balao = readFileSync(join(RAIZ, "components/novidades/TourDaNovidade.tsx"), "utf8");
conferir("e o balão abre os tours das telas", balao.includes("tourPorId(id) ?? tourDaTela(id)"), true);

console.log(falhas === 0 ? "\n  Cada tela oferece o seu tour uma vez, na primeira semana.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
process.exit(falhas === 0 ? 0 : 1);
