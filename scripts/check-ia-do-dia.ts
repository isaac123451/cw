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
import { atividadeDoFeito, entenderComando } from "../lib/models/comandosDaIA";
import { combinadosSemData, esperaDoCliente, promessaSemData } from "../lib/models/lembretesAutomaticos";

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

console.log("\n  COMANDOS EM PALAVRAS\n");
{
  const P = new Set(["RA-rceRWFM8hJR8oNTy"]);
  const lembrete = entenderComando("me lembra de ligar pro João amanhã às 10h", HOJE, P);
  conferir("“me lembra de … amanhã às 10h” vira lembrete com dia e hora", lembrete?.tipo === "lembrete" ? [lembrete.linha.dueDate, lembrete.linha.time] : null, ["2026-10-09", "10:00"]);
  conferir("o título fica sem o “me lembra de”", lembrete?.tipo === "lembrete" ? /^me lembra/i.test(lembrete.linha.title) : null, false);
  const anota = entenderComando("anota no RA-rceRWFM8hJR8oNTy que o cliente aceitou o desconto", HOJE, P);
  conferir("“anota no RA-… que …” vira anotação no caso", anota?.tipo === "anotacao" ? [anota.protocolo, anota.texto] : null, ["RA-rceRWFM8hJR8oNTy", "o cliente aceitou o desconto"]);
  conferir("anotação em caso que não existe não é comando", entenderComando("anota no RA-naoExiste123 que tal", HOJE, P), null);
  const feito = entenderComando("concluí o retorno da Ana", HOJE, P);
  conferir("“concluí …” vira marcar como feito", feito?.tipo === "feito" ? feito.busca : null, "retorno da Ana");
  conferir("pergunta continua sendo pergunta", entenderComando("quantas reclamações estão sem resposta?", HOJE, P), null);
  conferir("“me lembra quantas faltam?” é pergunta (termina em ?)", entenderComando("me lembra quantas avaliações faltam?", HOJE, P), null);

  const abertas = [
    { id: "a", title: "Retorno combinado com Ana: “te ligo amanhã”" },
    { id: "b", title: "Retorno combinado com Bruno" },
    { id: "c", title: "Enviar relatório do ciclo" },
  ];
  conferir("“o retorno da Ana” acha a da Ana", atividadeDoFeito("o retorno da Ana", abertas).escolhida?.id, "a");
  conferir("“o relatório” acha o relatório", atividadeDoFeito("o relatório", abertas).escolhida?.id, "c");
  conferir("“o retorno combinado” empata: não fecha nenhuma, mostra as duas", [atividadeDoFeito("o retorno combinado", abertas).escolhida, atividadeDoFeito("o retorno combinado", abertas).candidatas.length], [null, 2]);
  conferir("nada parecido: não fecha", atividadeDoFeito("pagar o boleto", abertas).escolhida, null);
}

console.log("\n  O COMBINADO SEM DATA — dos dois lados (09/10/2026)\n");
{
  const D = "2026-10-09";
  conferir("nós: “vou verificar e te retorno” vira promessa", Boolean(promessaSemData("Vou verificar com o financeiro e te retorno", D)), true);
  conferir("nós: “deixa eu ver aqui” vira promessa", Boolean(promessaSemData("Deixa eu ver aqui o que aconteceu", D)), true);
  conferir("nós: com dia e hora fica com o combinado com data", promessaSemData("Te ligo amanhã às 10h", D), null);
  conferir("nós: cumprimento não é promessa", promessaSemData("Bom dia! Tudo bem?", D), null);
  conferir("cliente: “te mando o CNPJ” vira espera", Boolean(esperaDoCliente("Te mando o CNPJ", D)), true);
  conferir("cliente: “vou testar aqui e te falo” vira espera", Boolean(esperaDoCliente("vou testar aqui e te falo", D)), true);
  conferir("cliente: reclamação não é espera", esperaDoCliente("Não funciona de jeito nenhum", D), null);
  const conversa = [
    { id: "1", de: "cliente", texto: "o pedido não imprime", em: "2026-10-09T12:00:00Z", dia: D },
    { id: "2", de: "nos", texto: "Vou verificar e te retorno", em: "2026-10-09T12:05:00Z", dia: D },
    { id: "3", de: "cliente", texto: "ok, te mando o print", em: "2026-10-09T12:06:00Z", dia: D },
  ];
  conferir("a conversa dá uma promessa nossa e uma espera do cliente", combinadosSemData(conversa).map((c) => `${c.tipo}:${c.mensagemId}`), ["promessa:2", "espera:3"]);
  conferir("respondemos depois: a promessa já foi cumprida", combinadosSemData([...conversa, { id: "4", de: "nos", texto: "Era a impressora, já está ok", em: "2026-10-09T13:00:00Z", dia: D }]).map((c) => c.tipo), ["espera"]);
  conferir("o cliente mandou depois: a espera já foi cumprida", combinadosSemData([...conversa, { id: "5", de: "cliente", texto: "segue o print", em: "2026-10-09T13:00:00Z", dia: D }]).map((c) => c.tipo), ["promessa"]);
  const criada = { dueDate: "2026-10-09", createdAt: "2026-10-09T13:00:00.000Z" };
  conferir("promessa: nossa mensagem depois do lembrete fecha", tarefaFeita(tarefa("auto-promessa-2", criada), { nossaMensagemEm: "2026-10-09T15:00:00.000Z" }), "você respondeu na conversa");
  conferir("promessa: mensagem de antes do lembrete não fecha", tarefaFeita(tarefa("auto-promessa-2", criada), { nossaMensagemEm: "2026-10-09T12:05:00.000Z" }), null);
  conferir("espera: o cliente mandou depois fecha", tarefaFeita(tarefa("auto-espera-3", criada), { clienteMensagemEm: "2026-10-09T16:00:00.000Z" }), "o cliente mandou mensagem");
  conferir("espera: mensagem nossa não fecha a espera", tarefaFeita(tarefa("auto-espera-3", criada), { nossaMensagemEm: "2026-10-09T16:00:00.000Z" }), null);
}

console.log("\n  CHAVES — a mesma origem é uma ação só\n");
conferir("mensagem do Slack", chaveDaAcao.slack("C1", "1.2"), "slack:C1:1.2");
conferir("anotação: uma por conversa por dia", chaveDaAcao.anotacao("cv1", HOJE), "anotacao:conversa:cv1:2026-10-08");

console.log(falhas === 0 ? "\n  A IA do dia só age com fato.\n" : `\n  ${falhas} falha(s).\n`);
process.exit(falhas === 0 ? 0 : 1);
