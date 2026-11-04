/**
 * O 1º contato com promotores em lote (04/11/2026), contra o banco, com
 * uma resposta de NPS descartável:
 *
 * - o modelo decide o que fica marcado (depoimento, indicação, avaliação);
 * - o envio vira a tentativa do ciclo, por WhatsApp, e conta como 1º contato;
 * - pulado não registra nada; ciclo encerrado não ganha tentativa.
 *
 * Tudo o que nasce aqui é apagado no fim, passe ou falhe.
 */
import "dotenv/config";

import { getPrisma } from "../lib/prisma";
import { pedidoDoModelo } from "../lib/models/disparos";
import { criarLote, marcarItem } from "../lib/services/disparos.service";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(62)} ${JSON.stringify(obtido)?.slice(0, 60)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(62)} ${JSON.stringify(esperado)?.slice(0, 60)}`);
}

const CLIENTE = "zz-disparo-nps-descartavel";

async function main() {
  console.log("\n  DISPARO EM LOTE PARA PROMOTORES DO NPS\n");

  conferir("o modelo diz o que pede", ["NPS — promotor, pedido de depoimento", "NPS — promotor, pedido de indicação", "Promotor: avaliação no Google", "Promotor — obrigado"].map(pedidoDoModelo), ["depoimento", "indicacao", "avaliacao", "contato"]);

  const prisma = getPrisma();
  if (!prisma) throw new Error("Sem banco.");
  const loteIds: string[] = [];
  try {
    const agora = new Date();
    const nova = (fechado = false) =>
      prisma.npsResponse.create({
        data: { score: 10, comment: "", respondedAt: new Date(agora.getTime() - 86_400_000), customer: CLIENTE, firstContactDueAt: new Date(agora.getTime() - 3_600_000), ...(fechado ? { closedAt: agora, status: "[Encerrado] Sem retorno" } : {}) },
        select: { id: true },
      });
    const [aberta, pulada, encerrada] = [await nova(), await nova(), await nova(true)];
    const autor = { id: "conferencia", nome: "Conferência" };

    const lote = await criarLote(prisma, {
      nome: "Conferência · promotores",
      origem: "nps",
      autor,
      itens: [
        { nome: "A", telefone: "85999990001", mensagem: "Oi! Obrigado pela nota.", ref: `nps:${aberta.id}:depoimento` },
        { nome: "B", telefone: "85999990002", mensagem: "Oi! Obrigado pela nota.", ref: `nps:${pulada.id}:depoimento` },
        { nome: "C", telefone: "85999990003", mensagem: "Oi! Obrigado pela nota.", ref: `nps:${encerrada.id}:indicacao` },
      ],
    });
    if ("erro" in lote) throw new Error(lote.erro);
    loteIds.push(lote.id);
    const itens = await prisma.itemDeDisparo.findMany({ where: { loteId: lote.id }, orderBy: { ordem: "asc" }, select: { id: true } });

    await marcarItem(prisma, itens[0].id, "enviado", autor);
    await marcarItem(prisma, itens[1].id, "pulado", autor);
    await marcarItem(prisma, itens[2].id, "enviado", autor);

    const ler = (id: string) => prisma.npsResponse.findUnique({ where: { id }, select: { firstContactAt: true, testimonialAsked: true, referralAsked: true, attempts: { select: { channel: true, resultado: true } } } });
    const [a, b, c] = [await ler(aberta.id), await ler(pulada.id), await ler(encerrada.id)];

    conferir("enviado: tentativa por WhatsApp, aguardando retorno", a?.attempts, [{ channel: "WhatsApp", resultado: "aguardando" }]);
    conferir("e conta como 1º contato", Boolean(a?.firstContactAt), true);
    conferir("e marca o pedido do modelo (depoimento)", a?.testimonialAsked, true);
    conferir("pulado: nada registrado", [b?.attempts.length, Boolean(b?.firstContactAt), b?.testimonialAsked], [0, false, false]);
    conferir("ciclo encerrado: não ganha tentativa nem marca", [c?.attempts.length, c?.referralAsked], [0, false]);
  } finally {
    await prisma.loteDeDisparo.deleteMany({ where: { id: { in: loteIds } } });
    await prisma.npsResponse.deleteMany({ where: { customer: CLIENTE } });
    conferir("as descartáveis saíram do banco", await prisma.npsResponse.count({ where: { customer: CLIENTE } }), 0);
  }

  console.log(falhas ? `\n  ${falhas} falha(s).\n` : "\n  O disparo para promotores registra o que saiu, e só o que saiu.\n");
  process.exit(falhas ? 1 : 0);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
