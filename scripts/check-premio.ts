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
import { contatosDoPremio, FILTROS_PADRAO, mensagemParaContato, telefoneInternacional } from "../lib/models/premio";

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

console.log(falhas === 0 ? "\n  A lista do prêmio tira as pessoas certas.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
process.exit(falhas === 0 ? 0 : 1);
