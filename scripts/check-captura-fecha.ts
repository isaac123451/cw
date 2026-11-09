/**
 * A leitura da planilha finaliza o que já foi fechado lá (09/11/2026),
 * contra o banco, com atendimentos descartáveis: STATUS final na planilha
 * fecha o caso aberto aqui; nunca reabre nem troca um fechamento por outro;
 * STATUS em andamento não mexe. Tudo o que nasce aqui é apagado no fim.
 */
import "dotenv/config";

import { getPrisma } from "../lib/prisma";
import { gravarCaptura, previaDaCaptura } from "../lib/services/capturaDasRedes.service";
import type { ItemCapturado } from "../lib/models/capturaDasRedes";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(62)} ${JSON.stringify(obtido)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(62)} ${JSON.stringify(esperado)}`);
}

const MARCA = `zz-fecha-${Date.now()}`;

async function main() {
  console.log("\n  A PLANILHA FINALIZA O QUE JÁ FOI FECHADO LÁ\n");
  const prisma = getPrisma();
  if (!prisma) throw new Error("Sem banco.");
  try {
    const nasce = (sufixo: string, status: string) =>
      prisma.case.create({ data: { protocol: `IG-${MARCA}-${sufixo}`, externalId: `${MARCA}-${sufixo}`, channel: "INSTAGRAM", companyName: "Loja", customer: "Cliente", title: "Descartável", status, publishedAt: new Date() }, select: { id: true } });
    await nasce("A", "Em tratativa");
    await nasce("B", "Sem contato");
    await nasce("C", "Recebido");
    const item = (sufixo: string, status: string): ItemCapturado => ({ origem: "planilha", chave: `${MARCA}-${sufixo}`, referencia: `linha ${sufixo}`, rede: "Instagram", perfil: "", nome: "Cliente", seguidores: null, telefone: "", email: "", link: "", texto: "Relato", assunto: "", status, quando: "" });
    const itens = [item("A", "Resolvido"), item("B", "Resolvido"), item("C", "Em tratativa")];

    const previa = await previaDaCaptura(prisma, itens);
    conferir("prévia: só o aberto aqui e fechado lá vai finalizar", previa.map((l) => l.fechar ?? null), ["Resolvido", null, null]);

    const r = await gravarCaptura(prisma, itens, previa.map((l) => l.chave));
    conferir("finalizado, com a etapa da planilha", r.finalizados.map((f) => f.etapa), ["Resolvido"]);
    const ler = (s: string) => prisma.case.findUnique({ where: { protocol: `IG-${MARCA}-${s}` }, select: { status: true, resolved: true } });
    conferir("A: Resolvido e resolvido", await ler("A"), { status: "Resolvido", resolved: true });
    conferir("B: Sem contato não vira Resolvido", (await ler("B"))?.status, "Sem contato");
    conferir("C: \"Em tratativa\" na planilha não mexe", (await ler("C"))?.status, "Recebido");
    const evento = await prisma.caseEvent.count({ where: { case: { protocol: `IG-${MARCA}-A` }, actor: "Leitura da planilha" } });
    conferir("o histórico diz que veio da planilha", evento, 1);
    conferir("ler de novo não finaliza outra vez", (await gravarCaptura(prisma, itens, itens.map((i) => i.chave))).finalizados.length, 0);
  } finally {
    await prisma.case.deleteMany({ where: { protocol: { startsWith: `IG-${MARCA}` } } });
    conferir("as descartáveis saíram do banco", await prisma.case.count({ where: { protocol: { startsWith: `IG-${MARCA}` } } }), 0);
  }
  console.log(falhas ? `\n  ${falhas} falha(s).\n` : "\n  A planilha fecha o que fechou lá, e só isso.\n");
  process.exit(falhas ? 1 : 0);
}
main();
