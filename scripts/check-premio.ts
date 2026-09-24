/**
 * A lista do Prêmio Reclame Aqui tira as pessoas certas?
 *
 *   npm run check:premio
 *
 * Sem banco (Fase 23): quem entra pelos filtros, uma pessoa por
 * telefone, quem já está na campanha fica de fora, o telefone no formato
 * internacional e a mensagem com o nome.
 */
import type { Case } from "../lib/models/case";
import type { NpsResponseView } from "../lib/models/nps";
import { depoimentosDoPremio, janelaNaDataDeCorte, premioNoCalendario, textoDoDepoimento } from "../lib/models/premio";
import { contatosDoPremio, FILTROS_PADRAO, linkDoWhatsApp, mensagemDaVez, mensagemParaContato, resumoDaCampanha, telefoneInternacional } from "../lib/models/premio";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${JSON.stringify(obtido)?.slice(0, 50)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(64)} ${JSON.stringify(esperado)?.slice(0, 50)}`);
}

const caso = (c: Partial<Case>) =>
  ({ id: "c", source: "Reclame Aqui", customer: "Ana Souza", evaluated: true, resolved: true, wouldDoBusiness: true, score: 9, createdAt: "2026-08-01", evaluatedAt: "2026-08-10", phone: "(11) 98765-4321", ...c }) as Case;
const nps = (r: Partial<NpsResponseView>) => ({ id: "n", score: 10, customer: "loja", respondedAt: "2026-08-20T12:00:00Z", phone: "11912345678", ...r }) as NpsResponseView;

console.log("\n  O telefone e a mensagem\n");
conferir("(11) 98765-4321 → +5511987654321", telefoneInternacional("(11) 98765-4321"), "+5511987654321");
conferir("já com 55 na frente", telefoneInternacional("55 11 3333-4444"), "+551133334444");
conferir("mascarado pelo portal não serve", telefoneInternacional("(11) 9••••-4321"), undefined);
conferir("curto demais não serve", telefoneInternacional("98765-4321"), undefined);
conferir("a mensagem leva o primeiro nome e o link", mensagemParaContato("Olá, {nome}! Vota na gente: {link}", { nome: "ANA souza" }, "https://ra/v"), "Olá, Ana! Vota na gente: https://ra/v");
conferir('sem nome, não fica "Olá, !"', mensagemParaContato("Olá, {nome}! Vota: {link}", { nome: "" }, "x"), "Olá! Vota: x");

console.log("\n  Quem entra na lista\n");
const casos = [
  caso({ id: "c1" }),
  caso({ id: "c2", resolved: false, customer: "Bruno", phone: "11900000002" }),
  caso({ id: "c3", score: 5, customer: "Carla", phone: "11900000003" }),
  caso({ id: "c4", evaluated: false, customer: "Davi", phone: "11900000004" }),
  caso({ id: "c5", scoreDisregarded: true, customer: "Eva", phone: "11900000005" }),
  caso({ id: "c6", source: "Instagram", customer: "Fábio", phone: "11900000006" }),
];
const respostas = [
  nps({ id: "n1", customerName: "Ana Souza", phone: "+55 11 98765-4321", respondedAt: "2026-09-01T12:00:00Z" }),
  nps({ id: "n2", score: 7, phone: "11900000007" }),
  nps({ id: "n3", score: 9, customerName: "Gil", phone: "11900000008", avaliacaoGoogle: { estrelas: 5, publicadaEm: "2026-09-02" }, aceitaCase: true }),
];
const lista = contatosDoPremio({ casos, nps: respostas, filtros: FILTROS_PADRAO });
conferir("resolvido e nota ≥ 7; o resto fica de fora", lista.map((c) => c.ref).sort(), ["n1", "n3"].sort());
conferir("a Ana do RA e do NPS é uma pessoa só (a mais recente)", lista.filter((c) => c.telefoneInternacional === "+5511987654321").map((c) => c.ref), ["n1"]);
conferir("o motivo diz por que está na lista", lista.find((c) => c.ref === "n3")?.motivo, "NPS 9, 5 estrelas no Google, aceitou ser case");
conferir("só 5 estrelas no Google", contatosDoPremio({ casos, nps: respostas, filtros: { ...FILTROS_PADRAO, frentes: ["nps"], googleCinco: true } }).map((c) => c.ref), ["n3"]);
conferir("quem já está na campanha fica de fora", contatosDoPremio({ casos, nps: respostas, filtros: FILTROS_PADRAO, jaNaCampanha: new Set(["nps:n1"]) }).map((c) => c.ref).sort(), ["c1", "n3"]);
conferir("o período pela data da avaliação", contatosDoPremio({ casos, nps: respostas, filtros: { ...FILTROS_PADRAO, frentes: ["reclame-aqui"], de: "2026-08-11" } }).length, 0);

console.log("\n  A campanha de votação\n");
{
  const campanha = { mensagem: "Olá, {nome}! Vote: {link}", lembrete: "Oi, {nome}, fecha amanhã: {link}", linkVotacao: "https://ra/v" };
  conferir("a pedir recebe o pedido", mensagemDaVez({ situacao: "exportado", nome: "Ana" }, campanha), "Olá, Ana! Vote: https://ra/v");
  conferir("pedido feito recebe o lembrete", mensagemDaVez({ situacao: "pedido", nome: "Ana" }, campanha), "Oi, Ana, fecha amanhã: https://ra/v");
  conferir("sem lembrete escrito, repete o pedido", mensagemDaVez({ situacao: "pedido", nome: "Ana" }, { ...campanha, lembrete: undefined }), "Olá, Ana! Vote: https://ra/v");
  conferir("quem votou não recebe nada", mensagemDaVez({ situacao: "votou", nome: "Ana" }, campanha), "");
  conferir("o link do WhatsApp com a mensagem", linkDoWhatsApp("+5511987654321", "Olá, Ana!"), "https://wa.me/5511987654321?text=Ol%C3%A1%2C%20Ana!");
  conferir("sem telefone, sem link", linkDoWhatsApp(undefined, "x"), null);
  const r = resumoDaCampanha([{ situacao: "exportado" }, { situacao: "pedido" }, { situacao: "lembrete" }, { situacao: "votou" }, { situacao: "votou" }]);
  conferir("o painel conta cada passo", [r.exportado, r.pedido, r.lembrete, r.votou, r.total], [1, 1, 1, 2, 5]);
  conferir("taxa de voto é sobre quem recebeu o pedido (2 de 4)", r.taxaDeVoto, 0.5);
}

console.log("\n  O prêmio no calendário\n");
{
  conferir("corte em 15/11/2026: janela de 01/05 a 31/10", janelaNaDataDeCorte("2026-11-15"), { inicio: "2026-05-01", fim: "2026-10-31" });
  conferir("corte em janeiro: janela do ano anterior", janelaNaDataDeCorte("2027-01-10"), { inicio: "2026-07-01", fim: "2026-12-31" });
  const base = (i: number, extra: Partial<Case>) =>
    caso({ id: `p${i}`, createdAt: "2026-07-10", respondida: true, evaluated: true, score: 6, resolved: false, wouldDoBusiness: false, ...extra } as Partial<Case>);
  const casos = [...Array.from({ length: 10 }, (_, i) => base(i, {})), ...Array.from({ length: 10 }, (_, i) => base(20 + i, { evaluated: false, score: undefined }))];
  const r = premioNoCalendario({ casos, dataDeCorte: "2026-11-15", notaMeta: 6, hoje: "2026-09-24" });
  conferir("dias até o corte", r.diasAteOCorte, 52);
  conferir("10 avaliáveis na janela", r.avaliaveis, 10);
  conferir("nota 3,8 → 6,0: faltam 6 avaliações 10 (5 dão 5,9)", r.faltam, 6);
  const impossivel = premioNoCalendario({ casos, dataDeCorte: "2026-11-15", notaMeta: 9.9, hoje: "2026-09-24" });
  conferir("meta alta demais: nem com todas avaliando 10", impossivel.faltam, null);
  const ja = premioNoCalendario({ casos, dataDeCorte: "2026-11-15", notaMeta: 1, hoje: "2026-09-24" });
  conferir("meta já batida: faltam 0", ja.faltam, 0);
}

console.log("\n  Depoimentos prontos\n");
{
  const d = depoimentosDoPremio({
    nps: [
      nps({ id: "d1", score: 10, customerName: "Loja A", comment: "O sistema mudou a nossa operação, os pedidos ficaram organizados.", aceitaCase: true }),
      nps({ id: "d2", score: 9, customerName: "Loja B", comment: "Atendimento excelente e a equipe sempre muito atenciosa com a gente." }),
      nps({ id: "d3", score: 10, customerName: "Loja C", comment: "Muito bom, mas demorou para configurar a impressora." }),
      nps({ id: "d4", score: 8, customerName: "Loja D", comment: "Gostei bastante do cardápio digital e da facilidade no dia a dia." }),
      nps({ id: "d5", score: 10, customerName: "Loja E", comment: "Top" }),
    ],
    google: [
      { id: "g1", estrelas: 5, autor: "Maria", texto: "Plataforma completa, suporte rápido e o cardápio ficou lindo.", identificado: true, publicadaEm: "2026-09-01T10:00:00Z" },
      { id: "g2", estrelas: 5, autor: "Anônimo", texto: "Plataforma completa, suporte rápido e o cardápio ficou lindo.", identificado: false, publicadaEm: "2026-09-01T10:00:00Z" },
      { id: "g3", estrelas: 4, autor: "João", texto: "Bom sistema no geral, atende o que precisamos no restaurante.", identificado: true, publicadaEm: "2026-09-01T10:00:00Z" },
    ],
  });
  conferir("case primeiro, Google depois, o NPS sem autorização por último", d.map((x) => x.ref), ["d1", "g1", "d2"]);
  conferir("elogio com ressalva, nota 8, fala curta, 4 estrelas e anônimo ficam de fora", d.length, 3);
  conferir("o NPS sem aceite diz que precisa de autorização", d.find((x) => x.ref === "d2")?.liberado, false);
  conferir("pronto para colar", textoDoDepoimento({ fala: "Muito  bom", autor: "Ana" }), "“Muito bom” — Ana, cliente Cardápio Web");
}

console.log(falhas === 0 ? "\n  A lista do prêmio tira as pessoas certas.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
process.exit(falhas === 0 ? 0 : 1);
