/**
 * Retenção no Reclame Aqui (1.113): a chance de cancelar por reclamação,
 * as atitudes por motivo e a regra "cancelou no prazo do contato não
 * conta". Sem banco.
 *
 *   npm run check:retencao
 */
import { clientesEmCancelamento, juntarCancelamento, resumoDeRetencao, setorDoCancelamento, sinaisDoTexto, type CasoParaCancelamento } from "../lib/models/cancelamento";
import { riscoDeCancelamento } from "../lib/models/riscoDeCancelamento";
import { acharCaso } from "../lib/models/case";

let falhas = 0;
function ok(nome: string, cond: boolean, extra = "") {
  if (!cond) falhas++;
  console.log(`${cond ? "ok " : "ERRO"} ${nome}${extra ? ` — ${extra}` : ""}`);
}

/* ---- a chance de cancelar ---- */
const pedido = riscoDeCancelamento({ titulo: "Quero cancelar meu plano", relato: "Solicito o cancelamento do contrato, o sistema não imprime e ninguém responde." });
ok("pedido de cancelamento: chance alta", pedido.nivel === "alto", `${pedido.pontos} · ${pedido.motivos.map((m) => m.id).join(",")}`);
ok("a primeira atitude é ligar no mesmo dia útil", pedido.atitudes[0]?.id === "ligar");
ok("e pergunta o motivo real", pedido.atitudes.some((a) => a.id === "motivo-real"));

const ameaca = riscoDeCancelamento({ titulo: "Sistema não imprime", relato: "Estou pensando em trocar de sistema, vou procurar outra plataforma se não resolverem." });
ok("ameaça de trocar de sistema pesa", ameaca.motivos.some((m) => m.id === "ameaca") && ameaca.nivel !== "baixo", ameaca.nivel);
ok("com responsável com nome entre as atitudes", ameaca.atitudes.some((a) => a.id === "dono"));

const duvida = riscoDeCancelamento({ titulo: "Dúvida sobre o cardápio", relato: "Como faço para mudar a foto de um produto?" });
ok("dúvida simples: chance baixa, sem atitudes", duvida.nivel === "baixo" && duvida.atitudes.length === 0);

const repetido = riscoDeCancelamento({ titulo: "Cobrança indevida", relato: "Fui cobrado duas vezes na mensalidade.", reincidencia: 2, detratorRecente: 3 });
ok("cobrança + 3ª reclamação + detrator: alta", repetido.nivel === "alto", `${repetido.pontos} · ${repetido.motivos.map((m) => m.id).join(",")}`);
ok("acertar o valor antes da proposta", repetido.atitudes.some((a) => a.id === "valor"));
ok("ler as reclamações anteriores", repetido.atitudes.some((a) => a.id === "historico"));

const cancelou = riscoDeCancelamento({ titulo: "Cobrança após cancelamento", relato: "Já cancelei o plano em agosto e continuam cobrando no cartão." });
ok("já cancelou: recuperação", cancelou.nivel === "cancelou", cancelou.motivos.map((m) => m.id).join(","));
ok("recuperação: resolver mesmo assim e reconquistar", cancelou.atitudes.every((a) => a.tipo === "recuperacao" || a.id === "cobranca-apos") && cancelou.atitudes.some((a) => a.id === "reconquista"));

const voltaria = riscoDeCancelamento({ titulo: "Quero cancelar", relato: "Quero cancelar o plano.", avaliado: true, voltaria: true });
ok("avaliou dizendo que voltaria: o risco cai", voltaria.pontos < pedido.pontos && voltaria.nivel !== "alto", `${voltaria.pontos}`);

/* ---- cancelou no prazo do contato não conta ---- */
const caso = (protocolo: string, extra: Partial<CasoParaCancelamento>): CasoParaCancelamento => ({
  protocolo,
  frente: "reclame-aqui",
  cliente: protocolo,
  titulo: "",
  criadoEm: "2026-09-01T12:00:00.000Z",
  prazoDoContato: "2026-09-02T12:00:00.000Z",
  ...extra,
});
const clientes = clientesEmCancelamento({
  casos: [
    /* Chegou dizendo que já cancelou: cancelado antes de chegar ao time — outro setor. */
    caso("A", { titulo: "Cobrança após cancelamento", relato: "Já cancelei o plano e continuam cobrando.", documento: "11111111111" }),
    /* Pediu, e avaliou depois do prazo dizendo que não voltaria: conta. */
    caso("B", { titulo: "Quero cancelar o plano", avaliado: true, voltaria: false, avaliadoEm: "2026-09-10T12:00:00.000Z", documento: "22222222222" }),
    /* Cancelou dentro do prazo do contato, numa conversa: no prazo. */
    caso("D", { titulo: "Quero cancelar o plano", documento: "44444444444" }),
    /* Pediu e ficou. */
    caso("C", { titulo: "Quero cancelar o plano", avaliado: true, voltaria: true, avaliadoEm: "2026-09-10T12:00:00.000Z", documento: "33333333333" }),
  ],
  nps: [],
  mensagens: [{ conversaId: "v-d", texto: "Pronto, cancelamento efetuado.", quando: "2026-09-01T18:00:00.000Z", caseProtocolo: "D" }],
});
const porNome = (n: string) => clientes.find((c) => c.protocolos.includes(n))!;
ok("A chegou cancelado: outro setor", porNome("A").desfecho === "cancelado" && porNome("A").canceladoPor === "outro-setor");
ok("B cancelou depois do prazo: conta", porNome("B").desfecho === "cancelado" && porNome("B").canceladoPor === "atendimento");
ok("D cancelou no prazo do contato", porNome("D").desfecho === "cancelado" && porNome("D").canceladoPor === "prazo");
ok("C ficou", porNome("C").desfecho === "retido");
const r = resumoDeRetencao(clientes);
ok("o total de cancelamentos tem os três", r.cancelados === 3 && r.canceladosOutroSetor === 1 && r.canceladosNoPrazo === 1 && r.canceladosQueContam === 1, JSON.stringify(r).slice(0, 120));
ok("a taxa deixa A e D de fora: 1 retido ÷ (1 + 1)", r.taxaDeRetencao === 0.5, `${r.taxaDeRetencao}`);
ok("e o mês conta outro setor e no prazo à parte", r.porMes[0]?.canceladosNoPrazo === 1 && r.porMes[0]?.canceladosOutroSetor === 1);

/* ---- 20/10: pediu e não cancelou é retido; o mesmo cliente é um só; outro setor à mão ---- */
const juntado = juntarCancelamento({
  casos: [
    caso("E1", { titulo: "Exijo o cancelamento do contrato", documento: "55555555555", email: "eduardo@x.com", cliente: "Eduardo", criadoEm: "2026-08-19T00:00:00.000Z" }),
    caso("E2", { titulo: "WhatsApp bloqueia", relato: "Vou ter que solicitar o cancelamento do contrato.", email: "eduardo@x.com", cliente: "Eduardo", criadoEm: "2026-10-08T00:00:00.000Z" }),
    caso("F", { titulo: "Quero cancelar o plano", documento: "66666666666", cliente: "Fábio" }),
    caso("G", { titulo: "Sistema lento", cliente: "Gina", documento: "77777777777" }),
  ],
  nps: [],
  mensagens: [{ conversaId: "v-g", texto: "Quero cancelar o contrato", quando: "2026-09-03T12:00:00.000Z", caseProtocolo: "G", contato: "+55 11 99999-0000" }],
  manuais: new Map([
    ["doc:55555555555", { desfecho: "retido" as const, em: "2026-09-25T20:00:00.000Z" }],
    ["doc:66666666666", { desfecho: "cancelado-outro-setor" as const, em: "2026-09-25T20:00:00.000Z", setor: "Financeiro" }],
  ]),
});
const eduardo = juntado.clientes.filter((c) => c.protocolos.includes("E1") || c.protocolos.includes("E2"));
ok("CPF numa e só e-mail na outra: um cliente só", eduardo.length === 1 && eduardo[0].protocolos.length === 2, String(eduardo.length));
ok("pediu de novo depois do retido à mão: segue retido, sem marca", eduardo[0]?.desfecho === "retido" && !eduardo[0]?.manual && /pediu de novo em 08\/10/.test(eduardo[0]?.porque ?? ""), eduardo[0]?.porque);
const fabio = juntado.clientes.find((c) => c.protocolos.includes("F"))!;
ok("outro setor à mão: cancelado, Financeiro", fabio.desfecho === "cancelado" && fabio.canceladoPor === "outro-setor" && fabio.setor === "Financeiro");
const gina = juntado.clientes.find((c) => c.protocolos.includes("G"))!;
ok("conversa de um caso: nome do caso, não o telefone", gina?.nome === "Gina" && gina.protocolos.includes("G"), gina?.nome);
ok("pediu e não cancelou: retido sem sinal", gina?.desfecho === "retido" && gina.retidoSemSinal === true);
const rj = resumoDeRetencao(juntado.clientes);
ok("sem \"em aberto\": todo cliente é retido ou cancelado", rj.retidos + rj.cancelados === rj.clientes);

/* ---- o botão "Cancelamento?" da ficha e da lista: reclamação marcada à mão entra na conta ---- */
const marcadas = juntarCancelamento({
  casos: [
    caso("H", { titulo: "Sistema não imprime", cliente: "Hugo", documento: "88888888888" }),
    caso("I", { titulo: "Sistema lento", cliente: "Iara", documento: "99999999999" }),
    caso("J", { titulo: "Quero cancelar o plano", cliente: "João", documento: "10101010101" }),
  ],
  nps: [],
  mensagens: [],
  manuais: new Map([
    ["caso:H", { desfecho: "cancelado-outro-setor" as const, em: "2026-10-20T12:00:00.000Z", setor: "Comercial" }],
    ["caso:I", { desfecho: "retido" as const, em: "2026-10-20T12:00:00.000Z" }],
    ["caso:J", { desfecho: "nao-e-cancelamento" as const, em: "2026-10-20T12:00:00.000Z" }],
  ]),
});
const hugo = marcadas.clientes.find((c) => c.protocolos.includes("H"));
ok("sem falar em cancelar, marcada 'cancelou · Comercial': entra como outro setor", hugo?.desfecho === "cancelado" && hugo.canceladoPor === "outro-setor" && hugo.setor === "Comercial");
ok("marcada 'retido': entra como retido, marcado à mão", marcadas.clientes.find((c) => c.protocolos.includes("I"))?.desfecho === "retido");
ok("marcada 'não pediu': sai da conta", !marcadas.clientes.some((c) => c.protocolos.includes("J")) && marcadas.foraDaConta.some((c) => c.protocolos.includes("J")));

/* ---- a leitura de reclamações e conversas que escapavam ---- */
const tem = (t: string, tipo: string) => sinaisDoTexto(t).some((s) => s.tipo === tipo);
ok("\"estou seriamente considerando cancelar\" é pedido", tem("estou seriamente considerando cancelar essa parceria", "pedido"));
ok("\"Estou cancelando\" (WhatsApp) é pedido", tem("Estou cancelando", "pedido"));
ok("\"Entendo que você deseja cancelar\" é pedido", tem("Oii! Entendo que você deseja cancelar.", "pedido"));
ok("a nossa pergunta \"Você deseja cancelar o módulo?\" não é pedido", !tem("Você deseja cancelar o módulo gestão de entregas?", "pedido"));
ok("o pedido do cliente fica guardado (quem queria cancelar)", gina?.pedido?.trecho === "Quero cancelar o contrato" && gina.pedido.frente === "conversa");
ok("\"nada do cancelamento e nada do estorno\" é pedido", tem("até agora nada do cancelamento e nada do estorno", "pedido"));
ok("\"cancelei minha renovação automática\" é cancelado", tem("já deixo dito que cancelei minha renovação automática", "cancelado"));
ok("\"fiz o cancelamento, me enviaram o pix\" é cancelado", tem("não gostei, fiz o cancelamento, me enviaram o pix de volta", "cancelado"));
ok("\"cancelado por falta de pagamento\" é cancelado pelo Financeiro", tem("fui avisado que havia sido cancelado por falta de pagamento", "cancelado") && setorDoCancelamento("havia sido cancelado por falta de pagamento") === "Financeiro");
ok("\"pedidos cancelados\" do restaurante não é", !tem("tivemos 9 pedidos cancelados pelo sistema", "pedido") && !tem("tivemos 9 pedidos cancelados pelo sistema", "cancelado"));
ok("\"estou cancelando pedidos\" não é", !tem("estou cancelando pedidos toda hora", "pedido"));

/* ---- "pediu para cancelar" só com pedido de verdade ---- */
const concorrente = riscoDeCancelamento({ titulo: "Sugestões paradas", relato: "O concorrente Repediu já tem isso há anos." });
ok("citar o concorrente não é \"pediu para cancelar\"", !concorrente.motivos.some((m) => m.id === "pedido"));
const naoE = riscoDeCancelamento({ titulo: "Quero cancelar o plano", relato: "", desfecho: "nao-e-cancelamento" });
ok("marcado \"não é cancelamento\": sem pedido", !naoE.motivos.some((m) => m.id === "pedido"));
const marcadoCancelado = riscoDeCancelamento({ titulo: "Quero cancelar o plano", relato: "", desfecho: "cancelado" });
ok("marcado cancelado: recuperação", marcadoCancelado.nivel === "cancelou");

/* ---- o link de qualquer tela abre a ficha (1.113) ---- */
const casos = [
  { id: "uPDvBFKmssmEmxVa", dbId: "cmt6ai0dw006y48tqoqj8chvp", protocol: "RA-uPDvBFKmssmEmxVa" },
  { id: "cmabc", protocol: "IG-1" },
];
ok("pelo id da tela", acharCaso(casos, "uPDvBFKmssmEmxVa")?.protocol === "RA-uPDvBFKmssmEmxVa");
ok("pelo id do banco (radar, distribuição, Respostas, retenção)", acharCaso(casos, "cmt6ai0dw006y48tqoqj8chvp")?.protocol === "RA-uPDvBFKmssmEmxVa");
ok("pelo protocolo, mesmo codificado", acharCaso(casos, encodeURIComponent("RA-uPDvBFKmssmEmxVa"))?.id === "uPDvBFKmssmEmxVa");
ok("sem id do portal, o do banco é o próprio id", acharCaso(casos, "cmabc")?.protocol === "IG-1");
ok("o que não existe continua não existindo", acharCaso(casos, "nada") === undefined);

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
