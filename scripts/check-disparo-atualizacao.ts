/**
 * A atualização em lote para quem está sem notícia (05/11/2026), contra o
 * banco, com uma reclamação descartável: o envio vira o contato de
 * atualização do caso, ele sai de "sem notícia", e o pulado não registra
 * nada. Tudo o que nasce aqui é apagado no fim, passe ou falhe.
 */
import "dotenv/config";

import { getPrisma } from "../lib/prisma";
import { criarLote, marcarItem } from "../lib/services/disparos.service";
import { semNoticia } from "../lib/models/cadencia";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(62)} ${JSON.stringify(obtido)?.slice(0, 60)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(62)} ${JSON.stringify(esperado)?.slice(0, 60)}`);
}

const MARCA = `RA-ZZ-ATUALIZA-${Date.now()}`;

async function main() {
  console.log("\n  ATUALIZAÇÃO EM LOTE PARA QUEM ESTÁ SEM NOTÍCIA\n");
  const prisma = getPrisma();
  if (!prisma) throw new Error("Sem banco.");
  const loteIds: string[] = [];
  try {
    const agora = new Date();
    const cincoDias = new Date(agora.getTime() - 5 * 86_400_000);
    const nova = (sufixo: string) =>
      prisma.case.create({
        data: { protocol: `${MARCA}-${sufixo}`, companyName: "Loja Descartável", customer: "Paula Descartável", title: "Descartável", status: "Em tratativa", publishedAt: cincoDias, primeiroContatoEm: cincoDias, ultimoContatoEm: cincoDias },
        select: { id: true, protocol: true },
      });
    const [enviada, pulada] = [await nova("E"), await nova("P")];
    const eu = await prisma.user.findFirst({ where: { active: true, role: "ADMIN" }, select: { id: true, name: true } });
    if (!eu) throw new Error("Sem conta ADMIN ativa.");
    const autor = { id: eu.id, nome: eu.name };
    conferir("antes: as duas estão sem notícia", [enviada, pulada].length, 2);

    const lote = await criarLote(prisma, {
      nome: "Conferência · atualização",
      origem: "atualizacao",
      autor,
      itens: [
        { nome: "Paula", telefone: "85999990001", mensagem: "Oi, Paula! Estou passando para te avisar…", ref: `caso:${enviada.protocol}` },
        { nome: "Paula", telefone: "85999990002", mensagem: "Oi, Paula! Estou passando para te avisar…", ref: `caso:${pulada.protocol}` },
      ],
    });
    if ("erro" in lote) throw new Error(lote.erro);
    loteIds.push(lote.id);
    const itens = await prisma.itemDeDisparo.findMany({ where: { loteId: lote.id }, orderBy: { ordem: "asc" }, select: { id: true } });
    await marcarItem(prisma, itens[0].id, "enviado", autor);
    await marcarItem(prisma, itens[1].id, "pulado", autor);

    const ler = (id: string) => prisma.case.findUnique({ where: { id }, select: { ultimoContatoEm: true, primeiroContatoEm: true, resolved: true, publicResponse: true, status: true, contatos: { select: { tipo: true, canal: true } } } });
    const [e, p] = [await ler(enviada.id), await ler(pulada.id)];
    conferir("enviado: contato de atualização por WhatsApp", e?.contatos, [{ tipo: "atualizacao", canal: "WhatsApp" }]);
    const se = e ? semNoticia({ ...e, ultimoContatoEm: e.ultimoContatoEm?.toISOString(), primeiroContatoEm: e.primeiroContatoEm?.toISOString(), publicResponse: e.publicResponse ?? undefined, respondida: false } as never, agora) : null;
    conferir("e sai de \"sem notícia\"", se?.atrasado ?? false, false);
    conferir("pulado: nada registrado", p?.contatos.length, 0);
  } finally {
    await prisma.loteDeDisparo.deleteMany({ where: { id: { in: loteIds } } });
    await prisma.case.deleteMany({ where: { protocol: { startsWith: MARCA } } });
    conferir("as descartáveis saíram do banco", await prisma.case.count({ where: { protocol: { startsWith: MARCA } } }), 0);
  }
  console.log(falhas ? `\n  ${falhas} falha(s).\n` : "\n  A atualização em lote registra o que saiu, e só o que saiu.\n");
  process.exit(falhas ? 1 : 0);
}
main();
