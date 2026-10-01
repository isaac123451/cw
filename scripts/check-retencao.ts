/**
 * Retenção no Reclame Aqui (1.113): a chance de cancelar por reclamação,
 * as atitudes por motivo e a regra "cancelou no prazo do contato não
 * conta". Sem banco.
 *
 *   npm run check:retencao
 */
import { clientesEmCancelamento, resumoDeRetencao, type CasoParaCancelamento } from "../lib/models/cancelamento";
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
    /* Chegou dizendo que já cancelou: cancelado antes do prazo. */
    caso("A", { titulo: "Cobrança após cancelamento", relato: "Já cancelei o plano e continuam cobrando.", documento: "11111111111" }),
    /* Pediu, e avaliou depois do prazo dizendo que não voltaria: conta. */
    caso("B", { titulo: "Quero cancelar o plano", avaliado: true, voltaria: false, avaliadoEm: "2026-09-10T12:00:00.000Z", documento: "22222222222" }),
    /* Pediu e ficou. */
    caso("C", { titulo: "Quero cancelar o plano", avaliado: true, voltaria: true, avaliadoEm: "2026-09-10T12:00:00.000Z", documento: "33333333333" }),
  ],
  nps: [],
  mensagens: [],
});
const porNome = (n: string) => clientes.find((c) => c.protocolos.includes(n))!;
ok("A cancelou no prazo do contato", porNome("A").desfecho === "cancelado" && porNome("A").canceladoNoPrazo === true);
ok("B cancelou depois do prazo: conta", porNome("B").desfecho === "cancelado" && !porNome("B").canceladoNoPrazo);
ok("C ficou", porNome("C").desfecho === "retido");
const r = resumoDeRetencao(clientes);
ok("a taxa deixa A de fora: 1 retido ÷ (1 + 1)", r.canceladosNoPrazo === 1 && r.taxaDeRetencao === 0.5, `${r.taxaDeRetencao}`);
ok("e o mês conta o no prazo à parte", r.porMes[0]?.canceladosNoPrazo === 1);

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
