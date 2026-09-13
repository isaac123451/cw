/**
 * Prova da rotina do agente e do Meu dia — sem banco.
 *
 * O que entra em cada dia (diárias só em dia útil, semanais no dia
 * configurado, feriado fora), a sequência de dias com a rotina completa
 * (fim de semana não interrompe, dia incompleto sim), as contagens por
 * frente de cada atividade e o plano: horário fixo no lugar, atrasado na
 * frente, e o que não cabe no expediente dito com todas as letras.
 *
 *   npm run check:rotina
 */
import type { Case } from "../lib/models/case";
import type { NpsResponseView } from "../lib/models/nps";
import { ROTINA_PADRAO, atividadesDoDia, diaDaSemana, sequenciaDeDias, type AtividadeDaRotina } from "../lib/models/rotina";
import { contarRotina, minutosDaAtividade, planoDoDia } from "../lib/models/meuDia";
import { textoDoCheckpoint } from "../components/rotina/CheckpointDoDia";
import { instanteDe } from "../lib/services/horasUteis";

let falhas = 0;

function confere(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`${ok ? "ok  " : "FALHOU"}  ${nome}${ok ? "" : `\n        esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`}`);
}

function br(texto: string) {
  const [dia, hora] = texto.split(" ");
  const [h, m] = hora.split(":").map(Number);
  return instanteDe(dia, h * 60 + m).toISOString();
}

const rotina = ROTINA_PADRAO;
const diarias = rotina.filter((a) => a.frequencia === "diaria");

console.log("\n— O que entra em cada dia —");
confere("14/09/2026 é segunda", diaDaSemana("2026-09-14"), 1);
confere("segunda: as 11 diárias e a semanal de segunda (indicadores)", atividadesDoDia(rotina, "2026-09-14").map((a) => a.chave).filter((c) => c === "indicadores").length + diarias.length, atividadesDoDia(rotina, "2026-09-14").length);
confere("sexta: o relatório do ciclo entra", atividadesDoDia(rotina, "2026-09-18").some((a) => a.chave === "relatorio"), true);
confere("sábado: nada — nem diária nem semanal de dia útil", atividadesDoDia(rotina, "2026-09-19").length, 0);
confere("feriado (12/10): as diárias descansam", atividadesDoDia(rotina, "2026-10-12").filter((a) => a.frequencia === "diaria").length, 0);
confere("contínuas nunca entram no checklist do dia", atividadesDoDia(rotina, "2026-09-14").some((a) => a.frequencia === "continua"), false);
const semRelatorio: AtividadeDaRotina[] = rotina.map((a) => (a.chave === "relatorio" ? { ...a, ativa: false } : a));
confere("desativada sai", atividadesDoDia(semRelatorio, "2026-09-18").some((a) => a.chave === "relatorio"), false);

console.log("\n— A sequência de dias —");
const todas = (dia: string) => atividadesDoDia(rotina, dia).map((a) => ({ atividadeId: a.id, dia }));
const marcas = [...todas("2026-09-10"), ...todas("2026-09-11"), ...todas("2026-09-14")];
confere("qui, sex e seg completas: 3 (o fim de semana não interrompe)", sequenciaDeDias(rotina, marcas, "2026-09-15"), 3);
confere("hoje completo também conta", sequenciaDeDias(rotina, [...marcas, ...todas("2026-09-15")], "2026-09-15"), 4);
const faltouUma = marcas.filter((m) => !(m.dia === "2026-09-11" && m.atividadeId === diarias[10].id));
confere("sexta sem o checkpoint interrompe: só segunda conta", sequenciaDeDias(rotina, faltouUma, "2026-09-15"), 1);
confere("sem marca nenhuma: zero", sequenciaDeDias(rotina, [], "2026-09-15"), 0);

console.log("\n— As contagens, por frente —");
const agora = new Date(br("2026-09-15 10:00"));
const caso = (id: string, campos: Partial<Case>): Case => ({
  id, protocol: `P-${id}`, company: "Cliente", customer: "Ana", source: "Reclame Aqui", category: "Pagamento", priority: "Alta",
  status: "Novo", title: `Caso ${id}`, description: "", resolved: false, wouldDoBusiness: false, sla: "",
  createdAt: "2026-09-14", recebidaEm: br("2026-09-14 09:00"), ...campos,
});
const resposta = (id: string, campos: Partial<NpsResponseView>): NpsResponseView => ({
  id, score: 3, comment: "", respondedAt: br("2026-09-14 09:00"), customer: id, status: "Novo",
  firstContactDueAt: br("2026-09-15 09:00"), reviewAsked: false, testimonialAsked: false, referralAsked: false,
  source: "Wootric", churnRisk: false, attempts: [], wootricNotes: [], notes: [], ...campos,
});

const contagens = contarRotina(
  {
    casos: [
      caso("ra-novo", {}),
      caso("ra-antigo", { createdAt: "2026-08-01", recebidaEm: undefined }),
      caso("ig-novo", { source: "Instagram", status: "Recebido" }),
      caso("ra-sem-noticia", { status: "Em tratativa", primeiroContatoEm: br("2026-09-10 10:00"), ultimoContatoEm: br("2026-09-10 10:00") }),
      caso("ra-moderacao", { status: "Resolvido", resolved: true, moderacaoPedidaEm: "2026-09-01", moderacaoResultado: "pendente" }),
      caso("ra-na-cadencia", { status: "Em tratativa", primeiroContatoEm: br("2026-09-09 10:00"), ultimoContatoEm: br("2026-09-09 10:00"), tentativasSemResposta: 2 }),
    ],
    nps: [
      resposta("nps-parado", {}),
      resposta("nps-antigo", { respondedAt: br("2026-08-20 10:00"), firstContactDueAt: br("2026-08-21 10:00") }),
      resposta("nps-tentado", { status: "Em tratativa", firstContactAt: br("2026-09-11 10:00"), attempts: [{ id: "a", channel: "WhatsApp", note: "", actor: "", createdAt: br("2026-09-11 10:00") }] }),
      resposta("nps-conversado", { status: "Em tratativa", firstContactAt: br("2026-09-10 10:00"), postContactAt: br("2026-09-11 11:00"), moodAfter: 3, attempts: [{ id: "b", channel: "Telefone", note: "", actor: "", createdAt: br("2026-09-10 10:00") }] }),
    ],
    google: [{ id: "g1", autor: "Bia", status: "aberta", classificacao: "negativa", publicadaEm: br("2026-09-14 12:00") }],
    movimentos: [{ id: "m1", caseId: "ra-sem-noticia", destination: "Financeiro", reason: "", actor: "", startedAt: br("2026-09-10 10:00"), dueHours: 24 }],
    tarefas: [
      { id: "t1", title: "Ligar pro João", type: "Follow-up", owner: "", dueDate: "2026-09-14", priority: "Alta", done: false },
      { id: "t2", title: "Amanhã", type: "Pendência", owner: "", dueDate: "2026-09-16", priority: "Baixa", done: false },
    ],
    regrasSla: [],
    metricaHoje: null,
    ligacoes: [{ id: "ra-lig", frente: "reclame-aqui", titulo: "Caso lig", href: "/reclame-aqui/lig" }],
  },
  agora
);

confere("novos: o RA de hoje, o Instagram, o NPS parado e o Google aberto (o RA de antes do registro não)", [contagens.novos.total, contagens.novos.porFrente], [4, { "reclame-aqui": 1, redes: 1, nps: 1, google: 1 }]);
confere("o NPS parado desde agosto é backlog, fora do total e do plano", contagens.novos.acumulado?.total, 1);
confere("NPS parado com o prazo vencido conta como atrasado", contagens.novos.itens.find((i) => i.id === "nps-parado")?.atrasado, true);
confere("FUP: o RA sem notícia e o NPS conversado sem confirmação (o RA na cadência de tentativas não)", [contagens.fups.itens.map((i) => i.id).sort(), contagens.fups.porFrente], [["nps-conversado", "ra-sem-noticia"], { "reclame-aqui": 1, nps: 1 }]);
confere("moderação pendente há 14 dias: na fila e atrasada", [contagens.moderacoes.total, contagens.moderacoes.atrasados], [1, 1]);
confere("área: o Financeiro de 1 dia útil, acionado 3 dias úteis atrás, atrasado", [contagens.areas.total, contagens.areas.atrasados], [1, 1]);
confere("agenda: só o que vence hoje ou antes, e sem frente", [contagens.pendencias.total, contagens.pendencias.porFrente], [1, {}]);
confere("ligações: a do servidor mais a 2ª tentativa do NPS que nunca atendeu (o conversado não)", [contagens.ligacoes.itens.map((i) => i.id).sort(), contagens.ligacoes.porFrente], [["nps-tentado", "ra-lig"], { "reclame-aqui": 1, nps: 1 }]);
confere("métrica ainda não medida hoje: pede para conferir depois", contagens.metricas.total, 1);

console.log("\n— O plano do dia —");
const doDia = atividadesDoDia(rotina, "2026-09-15");
const plano = planoDoDia(doDia, contagens, new Set(), agora);
confere("sem itens, a atividade não gasta tempo (e fica fora do plano)", plano.semTrabalho.includes(doDia.find((a) => a.chave === "avaliacoes")!.id), true);
confere("o checkpoint fica no horário dele", plano.blocos.find((b) => b.titulo.startsWith("Checkpoint"))?.inicio, "17:30");
confere("a planilha das 8h, vista às 10h, cai no início do que sobra", plano.blocos.find((b) => b.titulo.startsWith("Preencher"))?.inicio, "10:00");
confere("e as pendências das 8h15 logo depois dela, sem sobrepor", plano.blocos.find((b) => b.titulo.startsWith("Verificar atividades"))?.inicio, "10:10");
const livres = plano.blocos.filter((b) => !["Preencher a Planilha de Métricas Reputação", "Verificar atividades e pendências do dia", "Checkpoint diário com a gestão"].includes(b.titulo));
confere("o 1º bloco livre é atrasado e do Reclame Aqui (o FUP do cliente sem notícia)", [livres[0]?.atrasados > 0, livres[0]?.frente], [true, "reclame-aqui"]);
const pos0 = (titulo: string, f: string) => livres.findIndex((b) => b.titulo.startsWith(titulo) && b.frente === f);
confere("o NPS vencido dos novos vem antes de qualquer bloco sem atraso", pos0("Verificar novos", "nps") < livres.findIndex((b) => b.atrasados === 0), true);
const pos = (titulo: string, f: string) => livres.findIndex((b) => b.titulo.startsWith(titulo) && b.frente === f);
confere("sem atraso, a ordem do documento: o RA de retornar vem antes do NPS de retornar", pos("Retornar", "reclame-aqui") < pos("Retornar", "nps"), true);
confere("e o Instagram dos novos vem antes do NPS não vencido de qualquer atividade", pos("Verificar novos", "redes") < pos("Retornar", "nps"), true);
confere("minutos dos novos: 15 do RA + 10 das redes + 8 do NPS + 8 do Google", minutosDaAtividade(doDia.find((a) => a.chave === "novos")!, contagens.novos), 41);
const tarde = planoDoDia(doDia, contagens, new Set(), new Date(br("2026-09-15 17:20")));
confere("às 17h20, quase nada cabe: o resto vai para 'não cabe'", tarde.naoCabe.length > 0 && tarde.minutosDisponiveis === 40, true);
const feitas = new Set(doDia.map((a) => a.id));
confere("tudo marcado: plano vazio", planoDoDia(doDia, contagens, feitas, agora).blocos.length, 0);
{
  /* 100 novos do RA, todos atrasados, às 16h: cabe o que dá até o checkpoint das 17h30. */
  const muitos = { ...contagens, novos: { ...contagens.novos, total: 100, porFrente: { "reclame-aqui": 100 }, atrasados: 100, itens: Array.from({ length: 100 }, (_, i) => ({ id: `n${i}`, frente: "reclame-aqui" as const, titulo: "x", href: "/", atrasado: true })) } };
  const duas = doDia.filter((a) => a.chave === "novos" || a.chave === "checkpoint");
  const p = planoDoDia(duas, muitos, new Set(), new Date(br("2026-09-15 16:00")));
  const parte = p.blocos.find((b) => b.titulo.startsWith("Verificar novos"));
  confere("não cabe inteiro: vão 6 de 100 (90 min até o checkpoint), o resto para amanhã", [parte?.itens, parte?.inicio, p.naoCabe[0]?.itens], [6, "16:00", 94]);
}
confere("no sábado, o expediente é zero", planoDoDia(doDia, contagens, new Set(), new Date(br("2026-09-19 10:00"))).minutosDisponiveis, 0);

console.log("\n— O checkpoint —");
const texto = textoDoCheckpoint({
  hoje: "2026-09-15",
  ontem: { dia: "2026-09-14", contatos: 5, primeirosContatos: 2, respostasPublicas: 1, pedidosDeAvaliacao: 3, tentativasNps: 0, googleRespondidas: 0, atividadesFeitas: 11 },
  plano,
  contagens,
  feitas: 0,
  total: doDia.length,
});
confere("três partes, na ordem da gestão", ["*Ontem (14/09):*", "*Hoje:*", "*Riscos:*"].map((p) => texto.indexOf(p) > 0), [true, true, true]);
confere("ontem conta só o que aconteceu (sem 'zero tentativas no NPS')", texto.includes("tentativa(s) no NPS"), false);
confere("os riscos saem das contagens", texto.includes("1 solicitação(ões) às áreas atrasadas"), true);

console.log(falhas === 0 ? "\nTudo certo.\n" : `\n${falhas} falha(s).\n`);
process.exit(falhas === 0 ? 0 : 1);
