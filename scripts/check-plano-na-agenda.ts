/**
 * O plano do dia vai para a Google Agenda sem duplicar e sem tocar no
 * que não é dele?
 *
 *   npm run check:plano-na-agenda
 *
 * Sem Google de verdade: o `fetch` é trocado por um falso que guarda as
 * chamadas, e o check confere o que seria mandado — endereço, método,
 * horário em Brasília, a marca privada e a descrição sem dado pessoal.
 */
import type { Contagem, PlanoDoDia } from "../lib/models/meuDia";
import { eventosDoPlano, linkDoDia, sincronizacao, type EventoExistente } from "../lib/models/planoNaAgenda";
import { gravarEventoDoPlano, listarEventosDoPlano } from "../lib/services/google.service";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(66)} ${JSON.stringify(obtido)?.slice(0, 44)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(66)} ${JSON.stringify(esperado)?.slice(0, 44)}`);
}

console.log("\n  O PLANO DO DIA NA GOOGLE AGENDA\n");

const bloco = (atividadeId: string, frente: PlanoDoDia["blocos"][number]["frente"], inicio: string, fim: string, itens: number, atrasados = 0) => ({
  atividadeId, titulo: atividadeId === "novos" ? "Verificar novos casos" : "Checkpoint", frente, inicio, fim, minutos: 30, itens, atrasados, motivo: "Prioridade do documento.",
});
const plano = { blocos: [bloco("novos", "reclame-aqui", "09:00", "09:45", 3, 1), bloco("novos", "nps", "09:45", "10:30", 12), bloco("checkpoint", undefined, "17:30", "17:45", 0)] };
const atividades = [
  { id: "novos", titulo: "Verificar novos casos", chave: "novos" as const },
  { id: "checkpoint", titulo: "Checkpoint", chave: "checkpoint" as const, link: "/meu-dia" },
];
const contagens: Partial<Record<"novos", Pick<Contagem, "itens">>> = {
  novos: {
    itens: [
      { id: "c1", frente: "reclame-aqui", titulo: "Cobrança indevida", detalhe: "Alta · Maria Silva", href: "/reclame-aqui/c1", atrasado: true },
      { id: "c2", frente: "reclame-aqui", titulo: "Sistema caiu", detalhe: "Normal · João", href: "/reclame-aqui/c2" },
      { id: "c3", frente: "reclame-aqui", titulo: "Pedido sumiu", href: "/reclame-aqui/c3" },
      { id: "c4", frente: "reclame-aqui", titulo: "Não coube hoje", href: "/reclame-aqui/c4" },
      ...Array.from({ length: 14 }, (_, i) => ({ id: `n${i}`, frente: "nps" as const, titulo: `Nota 2 — meu dinheiro não voltou ${i}`, detalhe: "Detrator crítico · loja", href: `/nps/n${i}` })),
    ],
  },
};

const eventos = eventosDoPlano({ plano, atividades, contagens, origem: "https://cw.exemplo" });
conferir("um evento por bloco, com a chave atividade:frente", eventos.map((e) => e.chave), ["novos:reclame-aqui", "novos:nps", "checkpoint:geral"]);
conferir("o título diz a frente e quantos itens", eventos[0].titulo, "Verificar novos casos · RA (3)");
conferir("o bloco leva só os itens que couberam (3 de 4 no RA)", eventos[0].descricao.includes("Não coube hoje"), false);
conferir("com o fora do prazo marcado e o link da plataforma", eventos[0].descricao.includes("• Cobrança indevida (fora do prazo) — https://cw.exemplo/reclame-aqui/c1"), true);
conferir("o nome do cliente não vai para a agenda", eventos[0].descricao.includes("Maria"), false);
conferir("no NPS, só a nota: o comentário do cliente fica", /dinheiro/.test(eventos[1].descricao), false);
conferir("mais de 10 itens: lista 10 e aponta o Meu dia", eventos[1].descricao.includes("e mais 2 — https://cw.exemplo/meu-dia"), true);
conferir("bloco sem itens leva o atalho da atividade", eventos[2].descricao.includes("https://cw.exemplo/meu-dia"), true);

/* ---- sincronizar ---- */
const agora = new Date("2026-09-23T12:30:00-03:00");
const ev = (id: string, bloco: string | undefined, ini: string, fim: string): EventoExistente => ({ id, bloco, inicio: `2026-09-23T${ini}:00-03:00`, fim: `2026-09-23T${fim}:00-03:00` });

const primeira = sincronizacao([], eventos, agora);
conferir("a primeira vez, cria todos", [primeira.criar.length, primeira.atualizar.length, primeira.apagar.length], [3, 0, 0]);

const jaNaAgenda = [ev("g1", "novos:reclame-aqui", "13:00", "13:45"), ev("g2", "novos:nps", "13:45", "14:30"), ev("g3", "checkpoint:geral", "17:30", "17:45")];
const segunda = sincronizacao(jaNaAgenda, eventos, agora);
conferir("mandar de novo: atualiza os mesmos, não duplica", [segunda.criar.length, segunda.atualizar.map((a) => a.id), segunda.apagar.length], [0, ["g1", "g2", "g3"], 0]);

const semNps = eventos.filter((e) => e.chave !== "novos:nps");
const terceira = sincronizacao(jaNaAgenda, semNps, agora);
conferir("o bloco que saiu do plano sai da agenda", terceira.apagar, ["g2"]);

const comPassado = [ev("p1", "novos:nps", "08:00", "09:00"), ev("a1", "novos:reclame-aqui", "12:00", "13:00"), ev("meu", undefined, "15:00", "16:00")];
const quarta = sincronizacao(comPassado, semNps, agora);
conferir("o que já terminou fica, como registro do dia", quarta.apagar.includes("p1") || quarta.atualizar.some((a) => a.id === "p1"), false);
conferir("o bloco em andamento é atualizado, não duplicado", quarta.atualizar.map((a) => a.id), ["a1"]);
conferir("evento sem a marca (os seus) nunca é tocado", [...quarta.apagar, ...quarta.atualizar.map((a) => a.id)].includes("meu"), false);
conferir("o link abre o dia na agenda", linkDoDia("2026-09-23"), "https://calendar.google.com/calendar/r/day/2026/9/23");

/* ---- as chamadas ao Google ---- */
async function chamadas() {
  const feitas: { url: string; metodo: string; corpo?: Record<string, unknown> }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    feitas.push({ url: String(url), metodo: init?.method ?? "GET", corpo: init?.body ? JSON.parse(String(init.body)) : undefined });
    const lista = { items: [{ id: "g1", start: { dateTime: "2026-09-23T13:00:00-03:00" }, end: { dateTime: "2026-09-23T13:45:00-03:00" }, extendedProperties: { private: { cwPlano: "2026-09-23", cwBloco: "novos:reclame-aqui" } } }, { id: "diaInteiro", start: { date: "2026-09-23" }, end: { date: "2026-09-24" } }] };
    return new Response(JSON.stringify(String(url).includes("?") ? lista : { id: "novo" }), { status: 200 });
  }) as typeof fetch;

  try {
    const lidos = await listarEventosDoPlano("tok", "2026-09-23");
    const url = new URL(feitas[0].url);
    conferir("lê só os eventos marcados do dia (pela marca, não pelo título)", url.searchParams.get("privateExtendedProperty"), "cwPlano=2026-09-23");
    conferir("no dia de Brasília", [url.searchParams.get("timeMin"), url.searchParams.get("timeMax")], ["2026-09-23T00:00:00-03:00", "2026-09-23T23:59:59-03:00"]);
    conferir("e devolve o bloco de cada um (o de dia inteiro fica de fora)", lidos.map((l) => [l.id, l.bloco]), [["g1", "novos:reclame-aqui"]]);

    await gravarEventoDoPlano("tok", "2026-09-23", eventos[0]);
    await gravarEventoDoPlano("tok", "2026-09-23", eventos[0], "g1");
    const [, criar, atualizar] = feitas;
    conferir("criar é POST na agenda principal", [criar.metodo, criar.url], ["POST", "https://www.googleapis.com/calendar/v3/calendars/primary/events"]);
    conferir("com o horário do bloco em Brasília", [criar.corpo?.start, criar.corpo?.end], [{ dateTime: "2026-09-23T09:00:00", timeZone: "America/Sao_Paulo" }, { dateTime: "2026-09-23T09:45:00", timeZone: "America/Sao_Paulo" }]);
    conferir("e a marca privada do dia e do bloco", criar.corpo?.extendedProperties, { private: { cwPlano: "2026-09-23", cwBloco: "novos:reclame-aqui" } });
    conferir("atualizar é PUT no mesmo evento", [atualizar.metodo, atualizar.url.endsWith("/events/g1")], ["PUT", true]);
  } finally {
    globalThis.fetch = original;
  }
}

chamadas().then(() => {
  console.log(falhas === 0 ? "\n  O plano vai para a agenda sem duplicar e sem tocar no que não é dele.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
  process.exitCode = falhas === 0 ? 0 : 1;
});
