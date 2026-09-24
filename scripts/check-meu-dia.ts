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

import { getRange } from "../lib/services/reputation.service";
import { cotaSugerida, cotasOferecidas, planoDeRecuperacao, ritmoDeHoje } from "../lib/models/recuperacao";
import { ateDoAdiamento, marcaValeHoje, opcoesDeAdiar, voltaDoAdiado } from "../lib/models/meuDia";
import { conquistasDaSemana, conquistasDoDia, inicioDaSemana, oQueMoveANota, placarDaSemana, textoDoResumoDaSemana } from "../lib/models/motivacaoDoDia";

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

{
  /* Dez respondidas e avaliadas, duas sem resposta, e uma nota 0 com moderação pedida. */
  /* Dentro da janela que o portal publica (meses fechados), qualquer que seja o dia em que o check rode. */
  const hojeIso = getRange("6m", "vigente").end;
  const base = (i: number, extra: Partial<Case>) =>
    caso({ id: `c${i}`, protocol: `RA-${i}`, createdAt: hojeIso, status: "Resolvido", respondida: true, evaluated: true, score: 8, resolved: true, wouldDoBusiness: true, ...extra });
  const casos = [
    ...Array.from({ length: 10 }, (_, i) => base(i, {})),
    base(10, { respondida: false, evaluated: false, status: "Não respondida" }),
    base(11, { respondida: false, evaluated: false, status: "Não respondida" }),
    base(12, { score: 0, resolved: false, wouldDoBusiness: false, moderacaoPedidaEm: hojeIso, moderacaoResultado: "pendente" }),
  ];
  const acoes = oQueMoveANota(casos);
  const mod = acoes.find((a) => a.chave === "moderacao");
  conferir("a moderação pendente entra, e sobe a nota se o portal aceitar", Boolean(mod && mod.notaDepois > mod.notaAntes && mod.efeito === "se o portal aceitar"), true);
  conferir("no máximo três ações", acoes.length <= 3, true);
  const ganhos = acoes.map((a) => a.notaDepois - a.notaAntes);
  conferir("a que mais mexe na nota vem primeiro", ganhos.every((g, i) => i === 0 || g <= ganhos[i - 1]), true);
  const semPeso = oQueMoveANota(casos.map((c) => (c.id === "c12" ? { ...c, score: 8, resolved: true, wouldDoBusiness: true } : c)));
  conferir("moderação que não mexe na nota fica de fora", semPeso.some((a) => a.chave === "moderacao" && a.notaDepois === a.notaAntes), false);
}

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
  conferir("todo bloco diz algo quando está vazio", (bloco.match(/length === 0 \?/g) ?? []).length, 3);
  /* 1.37: a semana saiu do cartão para o placar do topo, que mostra sempre os números (zero incluso) contra a semana passada. */
  const placar = ler("components/rotina/PlacarDaSemana.tsx");
  conferir("o placar da semana compara com a semana passada, até zero", /igual à semana passada/.test(placar) && /que a semana passada/.test(placar), true);
  conferir("e está no Meu dia", ler("app/meu-dia/page.tsx").includes("<PlacarDaSemana dia={dia} />"), true);
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

  /* O placar conta pela mesma régua, e a comparação é até o mesmo dia da semana passada. */
  const placar = placarDaSemana({ casos, nps: ciclos, agora: AGORA });
  conferir("o placar conta igual às conquistas", [placar.agora.avaliacoes, placar.agora.respondidas, placar.agora.npsNoPrazo, placar.agora.revertidos, placar.agora.encerrados], [1, 2, 1, 1, 1]);
  const semanaPassada = placarDaSemana({ casos, nps: ciclos, agora: new Date(AGORA.getTime() + 7 * 86_400_000) });
  conferir("uma semana depois, o que foi desta semana vira a comparação", [semanaPassada.agora.respondidas, semanaPassada.antes.respondidas], [0, 2]);
  const resumo = textoDoResumoDaSemana(semanaPassada, { sequencia: 3 });
  conferir("o resumo diz a queda com a conta", resumo.includes("0 reclamações respondidas (2 a menos que na semana passada)"), true);
}

console.log("\n  Adiar para outro dia\n");
{
  /* Quinta, 24/09/2026: amanhã é sexta, dia útil. Sexta, 25/09: amanhã é sábado. */
  conferir("quinta: amanhã já é o próximo dia útil, uma opção só", opcoesDeAdiar("2026-09-24").map((o) => o.volta), ["2026-09-25"]);
  conferir("sexta: amanhã (sábado) e o próximo dia útil (segunda)", opcoesDeAdiar("2026-09-25").map((o) => o.volta), ["2026-09-26", "2026-09-28"]);
  conferir("a marca vale até a véspera da volta", ateDoAdiamento("2026-09-25", "2026-09-28"), "2026-09-27");
  conferir("hoje ou antes não é adiar", [ateDoAdiamento("2026-09-25", "2026-09-25"), ateDoAdiamento("2026-09-25", "2026-09-20")], [null, null]);
  conferir("até 90 dias; 91 não", [ateDoAdiamento("2026-09-25", "2026-12-24"), ateDoAdiamento("2026-09-25", "2026-12-25")], ["2026-12-23", null]);
  conferir("data inválida não passa (30/11 existe, 31/11 não)", [ateDoAdiamento("2026-09-25", "2026-11-31"), ateDoAdiamento("2026-09-25", "2026-11-30"), ateDoAdiamento("2026-09-25", "")], [null, "2026-11-29", null]);
  const marca = { dia: "2026-09-25", ate: ateDoAdiamento("2026-09-25", "2026-09-28") };
  conferir("adiado de sexta para segunda: some sexta, sábado e domingo", ["2026-09-25", "2026-09-26", "2026-09-27"].map((d) => marcaValeHoje(marca, d)), [true, true, true]);
  conferir("e volta sozinho na segunda", marcaValeHoje(marca, "2026-09-28"), false);
  conferir("a lista diz o dia da volta", voltaDoAdiado(marca), "2026-09-28");
}

console.log("\n  Plano de recuperação do acumulado\n");
{
  conferir("149 vencidos: a cota que zera em 5 dias úteis é 30", cotaSugerida(149), 30);
  conferir("12 vencidos: cota mínima de 5", cotaSugerida(12), 5);
  conferir("as cotas oferecidas, sem repetir", cotasOferecidas(149), [10, 20, 30, 50]);
  conferir("quinta 24/09, 149 a 30 por dia: zera na quarta 30/09", planoDeRecuperacao(149, 30, "2026-09-24"), { dias: 5, zeraEm: "2026-09-30" });
  conferir("começando no sábado, o 1º dia é a segunda", planoDeRecuperacao(30, 30, "2026-09-26"), { dias: 1, zeraEm: "2026-09-28" });
  conferir("sem cota, sem plano", planoDeRecuperacao(149, 0, "2026-09-24"), null);
  conferir("abriu com 149, está com 130: saíram 19, faltam 11", ritmoDeHoje(149, 130, 30), { saiu: 19, falta: 11, dandoConta: false });
  conferir("entrou mais do que saiu: saiu 0, nunca negativo", ritmoDeHoje(149, 152, 30), { saiu: 0, falta: 30, dandoConta: false });
  conferir("bateu a cota: dando conta", ritmoDeHoje(149, 118, 30).dandoConta, true);
}

console.log(
  falhas === 0
    ? "\n  O Meu dia conta pela mesma régua das outras telas.\n"
    : `\n  ${falhas} ponto(s) a corrigir.\n`
);

process.exit(falhas === 0 ? 0 : 1);
