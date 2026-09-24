/**
 * Prova da trilha do Reclame Aqui e das três cadências da documentação.
 *
 * Sem banco. Cada caso é montado no estado de um passo e a trilha tem de
 * apontar o passo seguinte certo; cada cadência recebe datas reais de
 * setembro de 2026 (com fim de semana no meio) e tem de sugerir o dia
 * que o documento pede. Também prova o resumo dos contatos, a linha do
 * tempo e o relógio das áreas — as peças que a trilha lê.
 *
 *   npm run check:trilha
 */
import type { Case } from "../lib/models/case";
import { trilhaDoCaso, proximoPasso } from "../lib/models/trilha";
import {
  filaDeAvaliacao,
  pedidoDeAvaliacao,
  persistencia,
  semNoticia,
} from "../lib/models/cadencia";
import { mensagemDeAcionamento } from "../lib/models/mensagens";
import { estadoDaValidacao, resumirContatos, type ContatoView } from "../lib/models/tratativa";
import { descreverRegistro, instanteDe } from "../lib/services/horasUteis";
import { movementStatus } from "../lib/services/movement.service";
import { buildTimeline, quandoNaLinha } from "../lib/services/timeline.service";

let falhas = 0;

function confere(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`${ok ? "ok  " : "FALHOU"}  ${nome}${ok ? "" : `\n        esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`}`);
}

/** "2026-09-15 16:00" em Brasília → ISO. */
function br(texto: string) {
  const [dia, hora] = texto.split(" ");
  const [h, m] = hora.split(":").map(Number);
  return instanteDe(dia, h * 60 + m).toISOString();
}

function caso(extra: Partial<Case> = {}): Case {
  return {
    id: "RA-teste",
    protocol: "RA-teste",
    company: "Pizzaria Teste",
    customer: "Maria Souza",
    source: "Reclame Aqui",
    category: "Integração",
    priority: "Normal",
    status: "Novo",
    title: "Pedidos do iFood não chegam",
    description: "",
    resolved: false,
    wouldDoBusiness: false,
    sla: "",
    createdAt: "2026-09-14",
    ...extra,
  };
}

const atual = (c: Case, agora = br("2026-09-15 10:00")) =>
  proximoPasso(c, { agora: new Date(agora) })?.id ?? "completa";

console.log("\n— A trilha, passo a passo (caso novo) —");
const novo = caso();
confere("caso recém-chegado: triar", atual(novo), "triar");
const triado = caso({ triadaEm: br("2026-09-14 09:00"), triadaPor: "Isaac" });
confere("triado: imersão", atual(triado), "imersao");
const imerso = { ...triado, imersaoEm: br("2026-09-14 09:10") };
confere("imersão feita: 1º contato", atual(imerso), "contato");
const tentou = { ...imerso, primeiroContatoEm: br("2026-09-14 09:30"), ultimoContatoEm: br("2026-09-14 09:30"), tentativasSemResposta: 1 };
confere("tentativa sem resposta: persistência", atual(tentou), "persistencia");
/* 1.38: contato feito e nenhuma resposta ainda (a tentativa aguardando não conta como sem resposta) — a persistência não pode aparecer feita. */
const semResposta = { ...imerso, primeiroContatoEm: br("2026-09-14 09:30"), ultimoContatoEm: br("2026-09-14 09:30"), tentativasSemResposta: 0 };
const passoDe = (c: Case, id: string) => trilhaDoCaso(c, { agora: new Date(br("2026-09-15 10:00")) }).find((p) => p.id === id)?.estado;
confere("contato feito sem resposta: persistência é o passo da vez, e não 'feita'", [atual(semResposta), passoDe(semResposta, "persistencia")], ["persistencia", "atual"]);
confere("antes do 1º contato, a persistência ainda não se aplica", passoDe(imerso, "persistencia"), "opcional");
const falou = { ...tentou, tentativasSemResposta: 0, ultimaRespostaEm: br("2026-09-14 14:00") };
confere("cliente respondeu: validação (a área é opcional)", atual(falou), "validacao");
confere("e a persistência aparece feita só por causa da resposta", passoDe(falou, "persistencia"), "feito");
confere(
  "com área aberta: aguardar a área",
  proximoPasso(falou, { areaAberta: { destino: "Financeiro" }, agora: new Date(br("2026-09-15 10:00")) })?.id,
  "area"
);
const validado = { ...falou, validadoEm: br("2026-09-15 11:00") };
confere("validado: resposta pública", atual(validado), "resposta");
const respondido = { ...validado, respondida: true, publicResponseAt: br("2026-09-15 15:00") };
confere("respondido: pedir a avaliação", atual(respondido), "pedir-avaliacao");
const avaliado = { ...respondido, evaluated: true, score: 10, evaluatedAt: "2026-09-18" };
confere("avaliado: trilha completa", atual(avaliado), "completa");
confere("consumidor replicou: a vez é nossa, não de pedir nota", atual({ ...respondido, status: "Aguardando nossa réplica" }), "resposta");
confere("quem espera a nossa réplica não entra na fila de avaliação", pedidoDeAvaliacao({ ...respondido, status: "Aguardando nossa réplica" }).ativo, false);
confere(
  "a imersão é deduzida quando o 1º contato veio antes do registro dela",
  trilhaDoCaso({ ...triado, primeiroContatoEm: br("2026-09-14 09:30") }).find((p) => p.id === "imersao")?.deduzido,
  true
);

console.log("\n— Legado: o que o fim prova sobre o começo —");
const antigo = caso({ createdAt: "2026-08-01", status: "Aguardando avaliação", respondida: true, publicResponseAt: "2026-08-03T00:00:00.000Z" });
confere(
  "reclamação antiga respondida: pula para o follow-up, sem pendência impossível",
  atual(antigo, br("2026-09-13 10:00")),
  "pedir-avaliacao"
);
confere(
  "os passos de antes aparecem como deduzidos",
  trilhaDoCaso(antigo, { agora: new Date(br("2026-09-13 10:00")) }).filter((p) => p.deduzido).map((p) => p.id),
  ["triar", "imersao", "contato", "validacao"]
);
const velho = caso({ createdAt: "2025-12-01", status: "Aguardando avaliação", respondida: true, publicResponseAt: "2025-12-02T00:00:00.000Z" });
confere("respondida há mais de 6 meses: fora da janela, trilha encerrada", atual(velho, br("2026-09-13 10:00")), "completa");

console.log("\n— Pedido de avaliação (Passo 8) —");
const resp = caso({ respondida: true, publicResponseAt: br("2026-09-10 14:00") });
const p1 = pedidoDeAvaliacao(resp, new Date(br("2026-09-12 10:00")));
confere("1º lembrete: 2 dias depois da resposta", [p1.proximoDia, p1.vencido, p1.numero, p1.quando], ["2026-09-12", true, 1, "hoje"]);
const p0 = pedidoDeAvaliacao(resp, new Date(br("2026-09-11 10:00")));
confere("véspera: ainda não vence", [p0.vencido, p0.quando], [false, "em 12/09"]);
const p2 = pedidoDeAvaliacao({ ...resp, pedidosDeAvaliacao: 1, ultimoPedidoAvaliacaoEm: br("2026-09-12 10:30") }, new Date(br("2026-09-13 10:00")));
confere("2º lembrete: 2 dias depois do 1º", [p2.proximoDia, p2.numero], ["2026-09-14", 2]);
const p4 = pedidoDeAvaliacao({ ...resp, pedidosDeAvaliacao: 3, ultimoPedidoAvaliacaoEm: br("2026-09-16 10:30") }, new Date(br("2026-09-17 10:00")));
confere("depois de 3 lembretes: semanal", [p4.proximoDia, p4.numero], ["2026-09-23", 4]);
const atrasado = pedidoDeAvaliacao(resp, new Date(br("2026-09-15 10:00")));
confere("lembrete esquecido fica atrasado, com a data", [atrasado.vencido, atrasado.quando, atrasado.resumo], [true, "desde 12/09", "1º lembrete atrasado, desde 12/09."]);
const soDia = pedidoDeAvaliacao(caso({ respondida: true, publicResponseAt: "2026-08-21T00:00:00.000Z" }), new Date(br("2026-08-22 10:00")));
confere("data só de dia (planilha) não recua um dia no fuso", soDia.proximoDia, "2026-08-23");
confere("avaliada não pede mais", pedidoDeAvaliacao({ ...resp, evaluated: true }).ativo, false);
confere("sem resposta pública não pede", pedidoDeAvaliacao(caso()).ativo, false);

/*
  Dispensar (17/09/2026): a cadência insiste por seis meses, e nem todo
  caso merece insistência — o consumidor pediu para não ser procurado, a
  reclamação era duplicada, resolveu-se por fora. Sai da fila sem apagar
  os pedidos já registrados, e volta quando se desfaz.
*/
const dispensado = pedidoDeAvaliacao({ ...resp, avaliacaoDispensadaEm: br("2026-09-13 09:00") }, new Date(br("2026-09-15 10:00")));
confere("dispensado sai da fila", [dispensado.ativo, dispensado.dispensado], [false, true]);
confere("e diz por que saiu — não é 'já avaliada' nem 'fora da janela'", dispensado.resumo, "Dispensado — não entra mais na fila de pedir avaliação.");
confere("os pedidos já feitos continuam contados", pedidoDeAvaliacao({ ...resp, pedidosDeAvaliacao: 2, avaliacaoDispensadaEm: br("2026-09-13 09:00") }).numero, 2);
confere("desfazer devolve à fila", pedidoDeAvaliacao({ ...resp, avaliacaoDispensadaEm: undefined }, new Date(br("2026-09-15 10:00"))).ativo, true);
confere(
  "dispensado não aparece na fila do dia",
  filaDeAvaliacao(
    [
      { ...resp, id: "x", protocol: "x" },
      { ...resp, id: "y", protocol: "y", avaliacaoDispensadaEm: br("2026-09-13 09:00") },
    ],
    new Date(br("2026-09-15 10:00"))
  ).hoje.map((f) => f.item.protocol),
  ["x"]
);

const fila = filaDeAvaliacao(
  [
    { ...resp, id: "a", protocol: "a" },
    { ...resp, id: "b", protocol: "b", publicResponseAt: br("2026-09-08 14:00") },
    { ...resp, id: "c", protocol: "c", publicResponseAt: br("2026-09-14 14:00") },
    { ...resp, id: "d", protocol: "d", evaluated: true },
  ],
  new Date(br("2026-09-12 10:00"))
);
confere("fila: o mais atrasado primeiro, avaliada fora", [fila.hoje.map((x) => x.item.id), fila.proximos.map((x) => x.item.id)], [["b", "a"], ["c"]]);

console.log("\n— Persistência (Passo 4) —");
const t = (id: string, em: string, resultado: ContatoView["resultado"] = "nao-atendeu"): ContatoView => ({
  id,
  tipo: "tentativa",
  canal: "Telefone",
  resultado,
  em: br(em),
  autor: "Isaac",
});
const duas = persistencia([t("1", "2026-09-14 09:00"), t("2", "2026-09-15 09:30")], new Date(br("2026-09-15 16:00")));
confere("duas tentativas de manhã: a próxima é à tarde, no dia útil seguinte", [duas.tentativas, duas.periodo, duas.proximoDia, duas.esgotada], [2, "tarde", "2026-09-16", false]);
const hoje = persistencia([t("1", "2026-09-14 09:00")], new Date(br("2026-09-15 08:30")));
confere("sem tentativa hoje: a próxima é hoje", hoje.proximoDia, "2026-09-15");
const sexta = persistencia([t("1", "2026-09-18 16:40")], new Date(br("2026-09-18 17:00")));
confere("tentativa na sexta: a próxima pula o fim de semana", sexta.proximoDia, "2026-09-21");
const cinco = persistencia(
  ["2026-09-14 09:00", "2026-09-15 13:00", "2026-09-16 16:00", "2026-09-17 09:00", "2026-09-18 13:00"].map((em, i) => t(String(i), em)),
  new Date(br("2026-09-18 15:00"))
);
confere("cinco sem resposta: cadência esgotada", cinco.esgotada, true);
const semana = persistencia([t("1", "2026-09-01 09:00"), t("2", "2026-09-02 13:00")], new Date(br("2026-09-09 10:00")));
confere("passou a janela de 7 dias: esgotada", semana.esgotada, true);
const voltou = persistencia(
  [t("1", "2026-09-14 09:00"), t("2", "2026-09-14 15:00", "respondeu"), t("3", "2026-09-15 09:00")],
  new Date(br("2026-09-15 10:00"))
);
confere("a resposta do cliente zera a contagem", voltou.tentativas, 1);

console.log("\n— Cliente sem notícia (Passo 5) —");
const emAberto = caso({ primeiroContatoEm: br("2026-09-10 10:00"), ultimoContatoEm: br("2026-09-10 10:00"), status: "Em andamento" });
confere("quinta → sexta: 1 dia útil, ainda não", semNoticia(emAberto, new Date(br("2026-09-11 15:00"))), { dias: 1, atrasado: false });
confere("quinta → segunda: 2 dias úteis, sem notícia", semNoticia(emAberto, new Date(br("2026-09-14 09:00"))), { dias: 2, atrasado: true });
confere("respondido não entra", semNoticia({ ...emAberto, respondida: true }, new Date(br("2026-09-20 09:00"))), null);
confere("antes do 1º contato quem manda é o relógio da meta", semNoticia(caso(), new Date(br("2026-09-20 09:00"))), null);

console.log("\n— Resumo dos contatos —");
const pedido: ContatoView = { id: "p", tipo: "pedido-avaliacao", canal: "WhatsApp", resultado: "enviado", em: br("2026-09-01 10:00"), autor: "Isaac" };
const contato: ContatoView = { id: "c", tipo: "contato", canal: "WhatsApp", resultado: "respondeu", em: br("2026-09-02 10:00"), autor: "Thais" };
confere("pedido de avaliação não vira 1º contato", resumirContatos([pedido, contato]).primeiroContatoPor, "Thais");
confere("só pedido: sem 1º contato", resumirContatos([pedido]).primeiroContatoEm, undefined);
confere("pedido conta como pedido", resumirContatos([pedido, contato]).pedidosDeAvaliacao, 1);

console.log("\n— Linha do tempo —");
confere("instante vira Brasília com hora", quandoNaLinha(br("2026-09-10 14:05")), "10/09/2026 14:05");
confere("dia do portal fica só dia", quandoNaLinha("2026-08-21T00:00:00.000Z"), "21/08/2026");
confere("dia puro", quandoNaLinha("2026-08-21"), "21/08/2026");
confere("registro curto", descreverRegistro(br("2026-09-10 09:07")), "10/09 09:07");
const linha = buildTimeline(
  caso({ createdAt: "2026-09-10", recebidaEm: br("2026-09-10 09:40"), triadaEm: br("2026-09-10 11:00"), triadaPor: "Isaac", respondida: true, publicResponseAt: br("2026-09-11 16:00") }),
  [],
  [{ id: "c1", tipo: "contato", canal: "WhatsApp", resultado: "respondeu", em: br("2026-09-10 10:00"), autor: "Isaac" }]
);
confere("ordem cronológica: chegada, classificação, contato, triagem, resposta", linha.map((e) => e.id), ["registro", "classificacao", "contato-c1", "triagem", "resposta"]);
confere(
  "sem categoria, não há linha de classificação",
  buildTimeline(caso({ category: "Não classificado" })).some((e) => e.id === "classificacao"),
  false
);
confere("o primeiro contato é chamado de 1º contato", linha.find((e) => e.id === "contato-c1")?.title, "1º contato");

console.log("\n— Relógio das áreas —");
const mov = {
  id: "m",
  caseId: "RA-teste",
  destination: "Financeiro",
  reason: "estornar",
  actor: "Isaac",
  startedAt: br("2026-09-14 16:00"),
  dueHours: 4,
};
const s = movementStatus(mov, { agora: new Date(br("2026-09-15 09:00")) });
confere("4h úteis a partir das 16h vencem às 10h do dia seguinte", [descreverRegistro(s.prazo), s.decorridoMin, s.restanteMin], ["15/09 10:00", 180, 60]);
confere("retornada fora do prazo", movementStatus({ ...mov, returnedAt: br("2026-09-15 11:00") }).label, "Retornou fora do prazo");

console.log("\n— O modelo de acionamento —");
const msg = mensagemDeAcionamento({
  area: "Financeiro",
  cliente: "Maria Souza",
  estabelecimento: "Pizzaria Teste",
  assunto: "cobrança em duplicidade",
  tratativa: "estornar a cobrança de agosto",
  prioridade: "Alta",
  prazo: "até 1 dia útil (ter, 15/09 às 16:00)",
  telefone: "(11) 98765-4321",
  raUrl: "https://www.reclameaqui.com.br/x",
  portalUrl: "https://portal.cardapioweb.com/y",
  agora: new Date(br("2026-09-14 16:00")),
});
confere(
  "os quatro itens que a documentação exige estão lá",
  [msg.startsWith("@financeiro"), msg.includes("Link do RA: https://"), msg.includes("Conta do cliente: https://"), msg.includes("retorno até 1 dia útil"), msg.includes("Contato: (11) 98765-4321 - Maria")],
  [true, true, true, true, true]
);

console.log("\n— A validação com cara de validação (1.40) —");
{
  const ct = (tipo: ContatoView["tipo"], resultado: ContatoView["resultado"], em: string, nota?: string): ContatoView => ({
    id: `${tipo}-${em}`, tipo, canal: "WhatsApp", resultado, em: br(em), autor: "Isaac", ...(nota ? { nota } : {}),
  });
  const base = [ct("contato", "respondeu", "2026-09-14 09:30")];
  const perguntou = [...base, ct("validacao", "aguardando", "2026-09-15 14:10")];
  confere("a pergunta feita não valida o caso", resumirContatos(perguntou).validadoEm, undefined);
  confere("e não conta como resposta do cliente", resumirContatos(perguntou).ultimaRespostaEm, br("2026-09-14 09:30"));
  confere("o estado diz que aguarda desde a pergunta", estadoDaValidacao(perguntou), { pedidaEm: br("2026-09-15 14:10"), pedidaPor: "Isaac" });

  const pendente = [...perguntou, ct("validacao", "pendencia", "2026-09-15 15:00", 'O cliente: "a impressora ainda falha"')];
  confere("a pendência não valida, mas é o cliente respondendo", [resumirContatos(pendente).validadoEm, resumirContatos(pendente).ultimaRespostaEm], [undefined, br("2026-09-15 15:00")]);
  const comPendencia = { ...falou, ultimaRespostaEm: br("2026-09-15 15:00") };
  const passoVal = trilhaDoCaso(comPendencia, { agora: new Date(br("2026-09-15 16:00")), validacao: estadoDaValidacao(pendente) }).find((p) => p.id === "validacao");
  confere("a trilha mostra a pendência e pede para resolver", [passoVal?.estado, passoVal?.curto, passoVal?.detalhe?.includes("a impressora ainda falha")], ["atual", "resolver a pendência", true]);

  const confirmou = [...pendente, ct("validacao", "aguardando", "2026-09-16 10:00"), ct("validacao", "respondeu", "2026-09-16 11:00")];
  confere("só a confirmação valida — com a hora dela", resumirContatos(confirmou).validadoEm, br("2026-09-16 11:00"));
  confere("depois da confirmação, nada pendente", estadoDaValidacao(confirmou), {});
  confere("validação antiga sem resultado gravado continua valendo", resumirContatos([{ tipo: "validacao", canal: "WhatsApp", em: br("2026-09-16 11:00"), autor: "Isaac" }]).validadoEm, br("2026-09-16 11:00"));

  const validado = { ...comPendencia, validadoEm: br("2026-09-16 11:00"), createdAt: "2026-09-10" };
  const passoResp = trilhaDoCaso(validado, { agora: new Date(br("2026-09-16 12:00")) }).find((p) => p.id === "resposta");
  confere("validado: a resposta é a vez, com os dias sem resposta no portal", [passoResp?.estado, passoResp?.detalhe?.includes('"não respondida" há 6 dias')], ["atual", true]);
}

console.log(falhas === 0 ? "\nTudo certo.\n" : `\n${falhas} falha(s).\n`);
process.exit(falhas === 0 ? 0 : 1);
