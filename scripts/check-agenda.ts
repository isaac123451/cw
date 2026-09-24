/**
 * A Agenda junta tudo o que tem dia e hora?
 *
 *   npm run check:agenda
 *
 * Sem banco: monta atividades, eventos do Google, casos, NPS e áreas e
 * confere a linha do tempo (Fase 25) — o que entra, em que hora, na
 * ordem certa, e que o prazo estourado vira número, não linha.
 */
import type { AgendaTask } from "../lib/models/agenda";
import type { Case } from "../lib/models/case";
import type { GoogleEvent } from "../lib/models/google";
import type { CaseMovement } from "../lib/models/movement";
import type { NpsResponseView } from "../lib/models/nps";
import { PRAZOS_DA_DOCUMENTACAO, type SlaRule } from "../lib/models/sla";
import { atrasadosDaAgenda, compromissosEntre } from "../lib/models/compromissos";
import { instanteDe } from "../lib/services/horasUteis";
import { entenderLinha } from "../lib/models/linhaDaAgenda";
import { combinadoNaMensagem } from "../lib/models/lembretesAutomaticos";
import { adiarLembrete, chaveDoAviso, lembretesNaHora } from "../lib/models/lembretes";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(66)} ${JSON.stringify(obtido)?.slice(0, 50)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(66)} ${JSON.stringify(esperado)?.slice(0, 50)}`);
}

const br = (dia: string, hora: string) => {
  const [h, m] = hora.split(":").map(Number);
  return instanteDe(dia, h * 60 + m);
};
const REGRAS: SlaRule[] = PRAZOS_DA_DOCUMENTACAO.map((p, i) => ({ ...p, id: `doc-${i}`, active: true }));

const tarefa = (t: Partial<AgendaTask>): AgendaTask => ({ id: "t", title: "Atividade", type: "Follow-up", owner: "Isaac", dueDate: "2026-09-16", priority: "Média", done: false, ...t });
const caso = (c: Partial<Case>): Case =>
  ({
    id: "c1", protocol: "RA-1", company: "", customer: "Cliente", source: "Reclame Aqui", category: "Financeiro", priority: "Urgente", status: "Novo",
    title: "Cobrança em dobro", description: "", resolved: false, wouldDoBusiness: false, sla: "—", createdAt: "2026-09-15",
    recebidaEm: br("2026-09-15", "16:00").toISOString(), ...c,
  }) as Case;

/* Quarta, 16/09/2026, 09:00 em Brasília. */
const AGORA = br("2026-09-16", "09:00");

const lista = compromissosEntre({
  de: "2026-09-16",
  ate: "2026-09-16",
  agora: AGORA,
  regras: REGRAS,
  tarefas: [
    tarefa({ id: "a", title: "Ligar para a Ana", time: "14:30", relatedCase: "RA-1" }),
    tarefa({ id: "b", title: "Sem hora" }),
    tarefa({ id: "c", title: "Amanhã", dueDate: "2026-09-17" }),
  ],
  eventos: [
    { id: "g1", title: "Reunião com Produto", start: "", allDay: false, date: "2026-09-16", time: "11:00" } as GoogleEvent,
    { id: "g2", title: "Feriado de alguém", start: "", allDay: true, date: "2026-09-16" } as GoogleEvent,
  ],
  casos: [caso({}), caso({ id: "c2", protocol: "RA-2", recebidaEm: br("2026-09-15", "08:00").toISOString(), createdAt: "2026-09-15" })],
  nps: [
    { id: "n1", score: 2, customer: "loja-x", customerName: "Loja X", firstContactDueAt: br("2026-09-16", "16:00").toISOString() } as NpsResponseView,
    { id: "n2", score: 3, customer: "loja-y", firstContactDueAt: br("2026-09-15", "16:00").toISOString() } as NpsResponseView,
  ],
  movimentos: [{ id: "m1", caseId: "c1", destination: "Financeiro", reason: "estorno", actor: "Isaac", startedAt: br("2026-09-15", "17:00").toISOString(), dueHours: 4 } as CaseMovement],
});

console.log("\n  O dia na linha do tempo\n");
conferir(
  "tudo do dia, pela hora; o sem hora no fim",
  lista.map((c) => `${c.minuto === undefined ? "--:--" : `${String(Math.floor(c.minuto / 60)).padStart(2, "0")}:${String(c.minuto % 60).padStart(2, "0")}`} ${c.origem}`),
  ["10:00 prazo-caso", "11:00 google", "11:00 area", "14:30 atividade", "16:00 prazo-nps", "--:-- atividade", "--:-- google"]
);
conferir("o caso urgente de ontem 16h: 1º contato vence hoje 10h", lista.find((c) => c.origem === "prazo-caso")?.detalhe?.startsWith("1º contato vence · RA-1"), true);
conferir("a atividade com protocolo liga o caso (mini-janela)", lista.find((c) => c.tarefaId === "a")?.casoId, "c1");
conferir("o NPS pelo nome, não pelo identificador", lista.find((c) => c.origem === "prazo-nps")?.titulo, "NPS 2 · Loja X");
conferir("a atividade de amanhã não entra no dia", lista.some((c) => c.tarefaId === "c"), false);

{
  const itens = [{ id: "c9", frente: "reclame-aqui" as const, titulo: "Cliente sem retorno", detalhe: "tentativa 2 · tarde (14h–18h)", href: "/reclame-aqui/RA-9" }];
  const hojeCom = compromissosEntre({ de: "2026-09-16", ate: "2026-09-16", agora: AGORA, tarefas: [], ligacoes: { dia: "2026-09-16", itens } });
  const amanhaSem = compromissosEntre({ de: "2026-09-17", ate: "2026-09-17", agora: AGORA, tarefas: [], ligacoes: { dia: "2026-09-16", itens } });
  conferir("a ligação da cadência entra hoje, sem hora, com o período", hojeCom.map((c) => [c.origem, c.minuto ?? null, c.detalhe]), [["ligacao", null, "tentativa 2 · tarde (14h–18h)"]]);
  conferir("e só no dia dela", amanhaSem.length, 0);
}

console.log("\n  O que ficou para trás\n");
const atras = atrasadosDaAgenda({
  hoje: "2026-09-16",
  agora: AGORA,
  regras: REGRAS,
  tarefas: [tarefa({ id: "v", dueDate: "2026-09-14" }), tarefa({ id: "w", dueDate: "2026-09-15", done: true }), tarefa({ id: "x" })],
  casos: [caso({ id: "c2", protocol: "RA-2", recebidaEm: br("2026-09-15", "08:00").toISOString(), createdAt: "2026-09-15" })],
  nps: [{ id: "n2", score: 3, customer: "y", firstContactDueAt: br("2026-09-15", "16:00").toISOString() } as NpsResponseView],
});
conferir("atividade vencida e aberta, uma a uma", atras.atividades.map((t) => t.id), ["v"]);
conferir("prazos estourados viram número (caso + NPS)", atras.prazosEstourados, 2);

console.log("\n  O lembrete que avisa\n");
{
  const tarefas = [
    tarefa({ id: "l1", title: "Ligar 08h30", time: "08:30" }),
    tarefa({ id: "l2", title: "Ligar 10h", time: "10:00" }),
    tarefa({ id: "l3", title: "Feita", time: "08:00", done: true }),
    tarefa({ id: "l4", title: "Sem hora" }),
    tarefa({ id: "l5", title: "Ontem", time: "08:00", dueDate: "2026-09-15" }),
  ];
  conferir("às 09h: só a das 08h30, aberta, de hoje e com hora", lembretesNaHora(tarefas, AGORA, new Set()).map((t) => t.id), ["l1"]);
  conferir("dispensada, não volta", lembretesNaHora(tarefas, AGORA, new Set([chaveDoAviso(tarefas[0])])).length, 0);
  const adiada = { ...tarefas[0], ...adiarLembrete(tarefas[0], "15min", AGORA) };
  conferir("adiar 15 min conta de agora: 09:15", [adiada.dueDate, adiada.time], ["2026-09-16", "09:15"]);
  conferir("adiada, avisa de novo no horário novo", lembretesNaHora([adiada], br("2026-09-16", "09:15"), new Set([chaveDoAviso(tarefas[0])])).map((t) => t.id), ["l1"]);
  conferir("1 h às 23h30 passa para amanhã 00:30", adiarLembrete(tarefas[0], "1h", br("2026-09-16", "23:30")), { dueDate: "2026-09-17", time: "00:30" });
  conferir("amanhã na sexta é segunda, mesmo horário", adiarLembrete(tarefas[0], "amanha", br("2026-09-18", "09:00")), { dueDate: "2026-09-21", time: "08:30" });
}

console.log("\n  Criar em uma linha\n");
{
  /* Quarta, 16/09/2026. */
  const prot = new Set(["RA-123", "RA-ABC_def"]);
  const ver = (t: string) => {
    const l = entenderLinha(t, "2026-09-16", prot);
    return l && [l.dueDate, l.time ?? null, l.title, l.type, l.relatedCase ?? null];
  };
  conferir("amanhã 10h ligar RA-123", ver("amanhã 10h ligar RA-123"), ["2026-09-17", "10:00", "Ligar", "Follow-up", "RA-123"]);
  conferir("sexta às 14h30 cobrar financeiro", ver("sexta às 14h30 cobrar financeiro"), ["2026-09-18", "14:30", "Cobrar financeiro", "Cobrança interna", null]);
  conferir("quarta (hoje é quarta): a próxima, não hoje", ver("quarta revisar macros")?.[0], "2026-09-23");
  conferir("25/09 9:15 pedir avaliação da Ana", ver("25/09 9:15 pedir avaliação da Ana"), ["2026-09-25", "09:15", "Pedir avaliação da Ana", "Solicitação de avaliação", null]);
  conferir("10/09 já passou: é o do ano que vem", ver("10/09 renovar contrato")?.[0], "2027-09-10");
  conferir("sem dia nem hora: hoje, sem hora, Pendência", ver("conferir planilha"), ["2026-09-16", null, "Conferir planilha", "Pendência", null]);
  conferir("protocolo que não existe não liga", ver("ligar RA-999")?.[4], null);
  conferir("só data e hora, sem o que fazer: nada", entenderLinha("amanhã 10h", "2026-09-16", prot), null);
  conferir("31/11 não existe: fica no título", ver("31/11 ver isso")?.[0], "2026-09-16");
}

console.log("\n  O lembrete que nasce da conversa\n");
{
  const ver = (t: string) => {
    const c = combinadoNaMensagem(t, "2026-09-16");
    return c && [c.dueDate, c.time ?? null];
  };
  conferir("\"te ligo amanhã às 10h\"", ver("Oi Ana! Resolvido do nosso lado. Te ligo amanhã às 10h para confirmar."), ["2026-09-17", "10:00"]);
  conferir("\"vou te retornar na sexta\"", ver("Vou te retornar na sexta com a posição do financeiro"), ["2026-09-18", null]);
  conferir("\"retorno hoje às 16h\"", ver("Retorno hoje às 16h, combinado?"), ["2026-09-16", "16:00"]);
  conferir("sem dia nem hora não é agendamento", ver("Vou verificar e te retorno"), null);
  conferir("dia sem promessa nossa não é", ver("Amanhã às 10h eu estou na loja"), null);
  conferir("o trecho é a frase da promessa", combinadoNaMensagem("Obrigado! Te ligo amanhã às 10h.", "2026-09-16")?.trecho, "Te ligo amanhã às 10h.");
}

console.log(falhas === 0 ? "\n  A Agenda junta o dia inteiro.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
process.exit(falhas === 0 ? 0 : 1);
