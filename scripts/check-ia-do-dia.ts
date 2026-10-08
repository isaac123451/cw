/**
 * A IA do dia decide certo? — `lib/models/iaDoDia.ts` (08/10/2026).
 *
 *   npm run check:ia-do-dia
 *
 * Sem banco. O que ela faz sozinha precisa ser conservador: lembrete só do
 * que pede ação, fechar só com um fato registrado depois que a atividade
 * nasceu, e a mensagem do Slack só quando é para a pessoa.
 */
import { chaveDaAcao, ehParaMim, lembreteDoSlack, tarefaFeita, type MensagemDoSlack } from "../lib/models/iaDoDia";

let falhas = 0;
function conferir(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${nome.padEnd(72)} ${JSON.stringify(obtido)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(72)} ${JSON.stringify(esperado)}`);
}

const HOJE = "2026-10-08";
const msg = (texto: string, extra: Partial<MensagemDoSlack> = {}): MensagemDoSlack => ({
  canal: "C0123ABCD",
  ts: "1791400000.000100",
  texto,
  mencoes: ["@Carlos Isaac"],
  quando: "2026-10-08T13:00:00.000Z",
  autor: "Thais",
  ...extra,
});

console.log("\n  SLACK — é para mim?\n");
conferir("menção com o nome inteiro", ehParaMim(msg("oi"), "Carlos Isaac"), true);
conferir("menção só com o primeiro nome", ehParaMim(msg("oi", { mencoes: ["@Carlos"] }), "Carlos Isaac"), true);
conferir("conversa direta (canal D…) é sempre para mim", ehParaMim(msg("oi", { canal: "D0ABCDEF1", mencoes: [] }), "Carlos Isaac"), true);
conferir("menção a outra pessoa não é", ehParaMim(msg("oi", { mencoes: ["@Thais Portela"] }), "Carlos Isaac"), false);
conferir("canal sem menção não é", ehParaMim(msg("oi pessoal", { mencoes: [] }), "Carlos Isaac"), false);

console.log("\n  SLACK — pede ação?\n");
conferir("bom dia não vira lembrete", lembreteDoSlack(msg("bom dia, pessoal!"), HOJE), null);
conferir("agradecimento não vira lembrete", lembreteDoSlack(msg("valeu, obrigado pela ajuda"), HOJE), null);
conferir("pergunta vira lembrete para hoje", lembreteDoSlack(msg("consegue ver o caso da pizzaria?"), HOJE)?.dia, HOJE);
conferir("pedido com dia vira lembrete no dia", lembreteDoSlack(msg("me manda o relatório até sexta"), HOJE)?.dia, "2026-10-09");
conferir("reunião com hora vira lembrete com hora", lembreteDoSlack(msg("call amanhã às 15h com o produto?"), HOJE)?.hora, "15:00");
conferir("o título diz de quem é", lembreteDoSlack(msg("urgente: preciso do número do NPS"), HOJE)?.titulo.startsWith("Responder no Slack — Thais:"), true);

console.log("\n  FECHAR O QUE FOI FEITO\n");
const tarefa = (id: string, extra: Partial<Parameters<typeof tarefaFeita>[0]> = {}) => ({
  id,
  title: "Retorno combinado com Ana",
  type: "Follow-up",
  dueDate: "2026-10-08",
  createdAt: "2026-10-07T15:00:00.000Z",
  ...extra,
});
conferir("retorno combinado: nossa mensagem no dia combinado fecha", tarefaFeita(tarefa("auto-conversa-m1"), { nossaMensagemEm: "2026-10-08T14:00:00.000Z" }), "você respondeu na conversa");
conferir("retorno combinado: mensagem nossa antes do dia combinado não fecha", tarefaFeita(tarefa("auto-conversa-m1"), { nossaMensagemEm: "2026-10-07T16:00:00.000Z" }), null);
conferir("retorno combinado: mensagem de antes do lembrete nascer não fecha", tarefaFeita(tarefa("auto-conversa-m1", { dueDate: "2026-10-07" }), { nossaMensagemEm: "2026-10-07T14:00:00.000Z" }), null);
conferir("cobrança de área: a área respondeu, fecha", tarefaFeita(tarefa("auto-area-x", { title: "Cobrar retorno do Financeiro" }), { areaRespondeu: true }), "a área já retornou");
conferir("cobrança de área: sem retorno, fica aberta", tarefaFeita(tarefa("auto-area-x"), { areaRespondeu: false }), null);
conferir("caso: contato registrado depois fecha o follow-up", tarefaFeita(tarefa("t1", { caseId: "c1" }), { ultimoContatoEm: "2026-10-08T10:00:00.000Z" }), "você registrou contato no caso");
conferir("caso: contato de antes da atividade não fecha", tarefaFeita(tarefa("t1", { caseId: "c1" }), { ultimoContatoEm: "2026-10-06T10:00:00.000Z" }), null);
conferir("caso encerrado fecha", tarefaFeita(tarefa("t1", { caseId: "c1", type: "Pendência", title: "Conferir dossiê" }), { casoEncerrado: true }), "o caso foi encerrado");
conferir("atividade sem vínculo nunca fecha sozinha", tarefaFeita(tarefa("t2"), { nossaMensagemEm: "2026-10-08T14:00:00.000Z", ultimoContatoEm: "2026-10-08T14:00:00.000Z" }), null);

console.log("\n  CHAVES — a mesma origem é uma ação só\n");
conferir("mensagem do Slack", chaveDaAcao.slack("C1", "1.2"), "slack:C1:1.2");
conferir("anotação: uma por conversa por dia", chaveDaAcao.anotacao("cv1", HOJE), "anotacao:conversa:cv1:2026-10-08");

console.log(falhas === 0 ? "\n  A IA do dia só age com fato.\n" : `\n  ${falhas} falha(s).\n`);
process.exit(falhas === 0 ? 0 : 1);
