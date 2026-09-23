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

import { conquistasDaSemana, conquistasDoDia, inicioDaSemana, oQueMoveANota } from "../lib/models/motivacaoDoDia";

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
    /googleEvents,\s*expediente\s*[,)]/.test(ler("components/layout/NotificationsMenu.tsx")) && /workspace\.expediente\s*\)/.test(ler("app/api/extensao/resumo/route.ts")),
    true
  );

  const resumo = ler("app/api/extensao/resumo/route.ts");
  conferir("o popup da extensão usa as mesmas contas", /oQueMoveANota\(casos\)/.test(resumo) && /conquistasDoDia\(\{ casos,/.test(resumo), true);
  const popup = ler("extensao/popup/popup.js");
  conferir("e desenha o que move a nota e as conquistas", /function blocoDaNota\(/.test(popup) && /blocoDaNota\(meuDia, base\)/.test(popup), true);

  const bloco = ler("components/rotina/AgoraNoMeuDia.tsx");
  conferir("todo aviso tem saída (Resolver, ou o plano abaixo)", /Resolver/.test(bloco) && /no plano abaixo/.test(bloco), true);
  conferir("todo bloco diz algo quando está vazio", (bloco.match(/length === 0 \?/g) ?? []).length, 4);
}

console.log("\n— Conquistas da semana —\n");

{
  /* AGORA é quarta, 16/09: a semana começa na segunda, 14/09. */
  conferir("a semana começa na segunda", inicioDaSemana("2026-09-16"), "2026-09-14");
  conferir("domingo ainda é da semana que começou na segunda", inicioDaSemana("2026-09-20"), "2026-09-14");

  const vazia = conquistasDaSemana({ casos: [], nps: [], agora: AGORA });
  conferir("semana sem nada: nenhuma linha de zero", vazia.conquistas, []);

  const casos = [
    caso({ protocol: "RA-1", evaluated: true, evaluatedAt: "2026-09-15T13:00:00Z", score: 10, resolved: true }),
    caso({ protocol: "RA-2", evaluated: true, evaluatedAt: "2026-09-15T14:00:00Z", score: 2, resolved: false }),
    caso({ protocol: "RA-3", evaluated: true, evaluatedAt: "2026-09-10T14:00:00Z", score: 10, resolved: true }),
    caso({ protocol: "RA-4", createdAt: "2026-09-12T12:00:00Z", publicResponseAt: "2026-09-14T12:00:00Z" }),
    caso({ protocol: "RA-5", createdAt: "2026-09-10T12:00:00Z", publicResponseAt: "2026-09-16T12:00:00Z" }),
  ];
  const ciclos = [
    ciclo({ id: "a", firstContactAt: "2026-09-15T12:00:00Z", firstContactDueAt: "2026-09-16T12:00:00Z" }),
    ciclo({ id: "b", firstContactAt: "2026-09-15T12:00:00Z", firstContactDueAt: "2026-09-14T12:00:00Z" }),
    ciclo({ id: "c", score: 4, postContactAt: "2026-09-16T12:00:00Z", resolvedAfter: true, closedAt: "2026-09-16T13:00:00Z" }),
  ];
  const semana = conquistasDaSemana({ casos, nps: ciclos, agora: AGORA });
  const por = Object.fromEntries(semana.conquistas.map((c) => [c.chave, `${c.titulo} · ${c.detalhe}`]));

  conferir("só as avaliações da semana, e quantas foram positivas", por.avaliacoes, "1 avaliação positiva · de 2 avaliada(s) no Reclame Aqui");
  conferir("respondidas com a espera de verdade, sem prazo inventado", por.respondidas, "2 reclamações respondidas · espera mediana de 6 dia(s) desde a publicação");
  conferir("NPS no prazo pelo prazo do próprio ciclo", por["nps-no-prazo"], "1 primeiro contato do NPS no prazo · de 2 feito(s) na semana");
  conferir("detrator revertido na semana", por.revertidos, "1 detrator revertido · resolvidos ou satisfeitos depois do contato");
  conferir("ciclo encerrado na semana", por.encerrados, "1 ciclo de NPS encerrado · com a tratativa registrada");
}

console.log(
  falhas === 0
    ? "\n  O Meu dia conta pela mesma régua das outras telas.\n"
    : `\n  ${falhas} ponto(s) a corrigir.\n`
);

process.exit(falhas === 0 ? 0 : 1);
