/**
 * O menu lateral: grupos pelo dia, contadores que batem com as telas.
 *
 *   npm run check:menu
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { AgendaTask } from "../lib/models/agenda";
import type { Case } from "../lib/models/case";
import type { NpsResponseView } from "../lib/models/nps";
import { contadoresDoMenu, numeroCurto } from "../lib/models/contadoresDoMenu";
import { GRUPOS_DO_MENU, itemDeConfiguracoes, menuItems } from "../core/navigation/menu";
import { EXPEDIENTE_PADRAO } from "../lib/services/horasUteis";
import { summarize } from "../lib/services/nps.service";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${JSON.stringify(obtido)?.slice(0, 44)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(64)} ${JSON.stringify(esperado)?.slice(0, 44)}`);
}

const AGORA = new Date("2026-09-17T15:00:00Z");
const caso = (c: Partial<Case>) => ({ id: "x", protocol: "RA-1", customer: "", source: "Reclame Aqui", status: "Novo", createdAt: "2026-09-16", priority: "Normal", category: "", tags: [], ...c }) as Case;

console.log("\n  MENU LATERAL\n");

{
  const grupos = new Set(menuItems.map((m) => m.group));
  conferir("todo item está num dos grupos do dia", [...grupos].every((g) => (GRUPOS_DO_MENU as readonly string[]).includes(g)), true);
  conferir("nenhum grupo vazio", GRUPOS_DO_MENU.every((g) => menuItems.some((m) => m.group === g)), true);
  conferir("Configurações fica no rodapé, fora da lista", [itemDeConfiguracoes.href, menuItems.some((m) => m.href === "/configuracoes")], ["/configuracoes", false]);
  const hrefs = menuItems.flatMap((m) => [m.href, ...(m.children ?? []).map((f) => f.href)]);
  conferir("nenhuma tela some do menu na troca", ["/nps/analise", "/novidades", "/conversas", "/relatorio", "/processos"].every((h) => hrefs.includes(h)), true);
}

{
  const casos = [
    caso({ id: "a" }),
    caso({ id: "b", publicResponse: "respondida" }),
    caso({ id: "c", source: "Instagram", status: "Recebido" }),
    caso({ id: "d", source: "Instagram", status: "Resolvido" }),
  ];
  const nps = [
    { id: "n1", score: 2, status: "Novo", respondedAt: "2026-09-10T12:00:00Z", firstContactDueAt: "2026-09-11T12:00:00Z" },
    { id: "n2", score: 2, status: "Novo", respondedAt: "2026-09-17T12:00:00Z", firstContactDueAt: "2026-09-18T12:00:00Z" },
  ] as unknown as NpsResponseView[];
  const tarefas = [
    { id: "t1", dueDate: "2026-09-16", done: false },
    { id: "t2", dueDate: "2026-09-17", done: false },
    { id: "t3", dueDate: "2026-09-17", done: true },
    { id: "t4", dueDate: "2026-09-20", done: false },
  ] as unknown as AgendaTask[];

  const c = contadoresDoMenu({ casos, nps, googleAbertas: 3, tarefas, regras: [], expediente: EXPEDIENTE_PADRAO, agora: AGORA });
  conferir("Reclame Aqui conta as abertas sem resposta pública", c["/reclame-aqui"].valor, 1);
  conferir("Redes conta só as não encerradas", c["/redes-sociais"].valor, 1);
  conferir("NPS usa a mesma conta da tela (summarize)", c["/nps"].valor, summarize(nps, AGORA).estourados);
  conferir("NPS atrasado fica vermelho", c["/nps"].urgente, true);
  conferir("Agenda: vencidas e de hoje, não feitas; atrasada fica vermelha", [c["/agenda"].valor, c["/agenda"].urgente], [2, true]);
  conferir("Google abertas", c["/google"].valor, 3);
  conferir("número longo encurta", [numeroCurto(999), numeroCurto(1572)], ["999", "1,6 mil"]);
}

{
  const menu = readFileSync(resolve(__dirname, "../components/layout/Sidebar.tsx"), "utf8");
  conferir("o menu usa os contadores e os grupos novos", /contadoresDoMenu\(/.test(menu) && /GRUPOS_DO_MENU\.map/.test(menu), true);
  conferir("fixados e recolhido guardados por pessoa, no navegador", /cw:menu-fixados/.test(menu) && /cw:menu-recolhido/.test(menu), true);
  conferir("sem componente criado durante o render", /function Linha\(/.test(menu), false);
  const movel = readFileSync(resolve(__dirname, "../components/layout/MobileNav.tsx"), "utf8");
  conferir("no celular a gaveta abre sempre por inteiro", /<Sidebar forcarAberto \/>/.test(movel), true);
}

console.log(falhas === 0 ? "\n  O menu mostra o dia e conta o que as telas contam.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
process.exit(falhas === 0 ? 0 : 1);
