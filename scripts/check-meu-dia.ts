/**
 * O topo do Meu dia diz a verdade, e bate com as outras telas?
 *
 *   npm run check:meu-dia
 *
 * **O pedido.** "A parte do meu dia acho que tem margem para melhorar."
 * O topo ganhou três blocos — o que pede ação agora, o que move a nota e
 * as conquistas de hoje. Este check prova duas coisas sem servidor:
 *
 * 1. **as conquistas** só aparecem com fato do dia de Brasília;
 * 2. **a fiação**: o aviso de avaliação e a projeção usam a mesma fila
 *    (a tela Pedir avaliação mostra 46, o Meu dia não pode dizer 37), e a
 *    nota sai de `scoreFrom`/`simulate`, sem conta própria.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Case } from "../lib/models/case";
import type { NpsResponseView } from "../lib/models/nps";

import { conquistasDoDia, oQueMoveANota } from "../lib/models/motivacaoDoDia";

const RAIZ = resolve(__dirname, "..");

let falhas = 0;

function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${JSON.stringify(obtido)?.slice(0, 44)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(64)} ${JSON.stringify(esperado)?.slice(0, 44)}`);
}

const ler = (arquivo: string) => readFileSync(resolve(RAIZ, arquivo), "utf8");

/* 16/09/2026, 15h em Brasília. */
const AGORA = new Date("2026-09-16T18:00:00Z");

const caso = (c: Partial<Case>) => ({ source: "Reclame Aqui", protocol: "RA-1", ...c }) as Case;
const ciclo = (r: Partial<NpsResponseView>) => ({ id: "n1", score: 3, ...r }) as NpsResponseView;

console.log("\n  MEU DIA — o que move a nota e o que já deu certo\n");
console.log("— Conquistas —\n");

{
  const nada = conquistasDoDia({ casos: [], nps: [], prazosEstourados: 4, agora: AGORA });
  conferir("sem fato do dia, nenhuma conquista", nada, []);

  const semPrazo = conquistasDoDia({ casos: [], nps: [], prazosEstourados: 0, agora: AGORA });
  conferir("dia sem prazo estourado conta", semPrazo.map((c) => c.chave), ["sem-prazo-estourado"]);

  const avaliacoes = [
    caso({ evaluated: true, evaluatedAt: "2026-09-16T13:00:00Z", resolved: true, score: 8 }),
    caso({ evaluated: true, evaluatedAt: "2026-09-16T14:00:00Z", resolved: false, score: 3 }),
    /* 23h de ontem em Brasília = 02h de hoje em UTC: é de ontem. */
    caso({ evaluated: true, evaluatedAt: "2026-09-16T02:00:00Z", resolved: true, score: 10 }),
  ];
  const hoje = conquistasDoDia({ casos: avaliacoes, nps: [], prazosEstourados: 1, agora: AGORA });
  conferir(
    "avaliação positiva só a de hoje em Brasília, e não a ruim",
    hoje.filter((c) => c.chave === "avaliacao-positiva").map((c) => c.titulo),
    ["Avaliação positiva hoje"]
  );

  const detratores = [
    ciclo({ id: "a", score: 2, postContactAt: "2026-09-16T15:00:00Z", resolvedAfter: true }),
    ciclo({ id: "b", score: 5, postContactAt: "2026-09-16T15:00:00Z", moodAfter: 2 }),
    ciclo({ id: "c", score: 9, postContactAt: "2026-09-16T15:00:00Z", resolvedAfter: true }),
  ];
  const revertidos = conquistasDoDia({ casos: [], nps: detratores, prazosEstourados: 1, agora: AGORA });
  conferir(
    "detrator revertido: só nota ≤ 6 que voltou resolvida ou satisfeita",
    revertidos.map((c) => [c.chave, c.href]),
    [["detrator-revertido", "/nps/a"]]
  );
}

console.log("\n— O que move a nota —\n");

conferir("sem reclamação, nada a projetar", oQueMoveANota([], AGORA), []);

console.log("\n— A fiação —\n");

{
  const modelo = ler("lib/models/motivacaoDoDia.ts");
  conferir("a nota sai de scoreFrom/simulate, sem conta própria", /scoreFrom\(simulate\(/.test(modelo), true);
  conferir(
    "a fila da projeção é a de todas as reclamações do RA",
    /filaDeAvaliacao\(casos\.filter\(\(c\) => c\.source === "Reclame Aqui"\), agora\)/.test(modelo),
    true
  );

  const abertura = ler("lib/models/aberturaDoAgente.ts");
  conferir(
    "o aviso de avaliação usa a mesma fila (não só as abertas)",
    /filaDeAvaliacao\(casos\.filter\(\(c\) => c\.source === "Reclame Aqui"\), agora\)/.test(abertura),
    true
  );
  conferir("sem notícia e crise levam o caso para a mini-janela", (abertura.match(/janela: \{/g) ?? []).length, 2);

  const pagina = ler("app/meu-dia/page.tsx");
  conferir("o Meu dia mostra o bloco no topo", /<AgoraNoMeuDia \/>/.test(pagina), true);

  const sino = ler("lib/services/notifications.service.ts");
  conferir("o sino conta o atraso das áreas pelo expediente configurado", sino.includes("lateMovements(movements, { expediente })"), true);
  conferir(
    "e quem chama o sino passa o expediente",
    /googleEvents,\s*expediente\s*\)/.test(ler("components/layout/NotificationsMenu.tsx")) && /workspace\.expediente\s*\)/.test(ler("app/api/extensao/resumo/route.ts")),
    true
  );

  const bloco = ler("components/rotina/AgoraNoMeuDia.tsx");
  conferir("todo aviso tem saída (Resolver, ou o plano abaixo)", /Resolver/.test(bloco) && /no plano abaixo/.test(bloco), true);
  conferir("todo bloco diz algo quando está vazio", (bloco.match(/length === 0 \?/g) ?? []).length, 3);
}

console.log(
  falhas === 0
    ? "\n  O Meu dia conta pela mesma régua das outras telas.\n"
    : `\n  ${falhas} ponto(s) a corrigir.\n`
);

process.exit(falhas === 0 ? 0 : 1);
