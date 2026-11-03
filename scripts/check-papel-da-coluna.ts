/**
 * O papel da coluna (03/11/2026).
 *
 *   npm run check:papel-da-coluna
 *
 * Em out/2026 "Resolvido" virou "Avaliado como resolvido" e "Não resolvido"
 * virou "Avaliado como não resolvido" no fluxo. O código perguntava pelos
 * nomes antigos: 240 avaliadas contavam como abertas, o vigia mandava a
 * avaliação para uma coluna que não existia e não corrigia a coluna que
 * contradizia o portal. Aqui: as regras, e a base real só leitura.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import type { Case } from "../lib/models/case";
import { colunaDaAvaliacao, mudancasDoPortal, type NoBancoDoPortal } from "../lib/services/atualizacaoDoPortal";
import { fetchCases } from "../lib/services/case.repository";
import { colunaNoFluxo, isOpen, isReclameAqui, moverPara, papelDaEtapa } from "../lib/services/case.service";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${String(JSON.stringify(obtido)).slice(0, 44)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(64)} ${String(JSON.stringify(esperado)).slice(0, 44)}`);
}

const FLUXO = ["Respostas para hoje", "Novo", "Aguardando retorno", "Em tratativa", "Aguardando avaliação", "Sem retorno (Resolvido)", "Avaliado como resolvido", "Avaliado como não resolvido", "Aguardando nossa réplica"];

console.log("\n  O PAPEL DA COLUNA\n");
conferir("os nomes de hoje e os antigos", ["Avaliado como resolvido", "Avaliado como não resolvido", "Resolvido", "Não resolvido", "avaliada como nao resolvida"].map(papelDaEtapa), ["Resolvido", "Não resolvido", "Resolvido", "Não resolvido", "Não resolvido"]);
conferir("encerrada sem avaliação", ["Sem retorno (Resolvido)", "Finalizado"].map(papelDaEtapa), ["Finalizado", "Finalizado"]);
conferir("coluna da operação fica como é", ["Em tratativa", "Aguardando avaliação"].map(papelDaEtapa), ["Em tratativa", "Aguardando avaliação"]);
conferir("o papel vira o nome do fluxo", [colunaNoFluxo("Resolvido", FLUXO), colunaNoFluxo("Não resolvido", FLUXO)], ["Avaliado como resolvido", "Avaliado como não resolvido"]);
conferir("sem fluxo, fica o papel", colunaNoFluxo("Resolvido", []), "Resolvido");

const base = { id: "x", protocol: "RA-x", status: "Aguardando avaliação", createdAt: "2026-10-01", evaluated: false, resolved: false } as unknown as Case;
conferir("avaliada na coluna nova é fechada", [isOpen({ ...base, status: "Avaliado como resolvido" }), isOpen({ ...base, status: "Avaliado como não resolvido" }), isOpen({ ...base, status: "Sem retorno (Resolvido)" })], [false, false, false]);
conferir("coluna da operação continua aberta", isOpen({ ...base, status: "Em tratativa" }), true);
const movido = moverPara(base, "Avaliado como não resolvido", "2026-11-03");
conferir("arrastar para a coluna nova marca a avaliação", [movido.evaluated, movido.resolved], [true, false]);
conferir("e para a de resolvido também", moverPara(base, "Avaliado como resolvido", "2026-11-03").resolved, true);

console.log("\n  O VIGIA: O PORTAL MANDA\n");
conferir("avaliação nova vai para a coluna do fluxo", colunaDaAvaliacao({ status: "Aguardando avaliação", evaluated: true, resolved: true }, FLUXO), "Avaliado como resolvido");
conferir("coluna final que contradiz a avaliação é corrigida", colunaDaAvaliacao({ status: "Avaliado como não resolvido", evaluated: true, resolved: true }, FLUXO), "Avaliado como resolvido");
conferir("coluna certa fica", colunaDaAvaliacao({ status: "Avaliado como resolvido", evaluated: true, resolved: true }, FLUXO), null);
conferir("encerrada pela operação fica", colunaDaAvaliacao({ status: "Sem retorno (Resolvido)", evaluated: true, resolved: false }, FLUXO), null);

const noBanco = (status: string, resolved: boolean): NoBancoDoPortal => ({ status, publicResponse: "ok", publicResponseAt: null, evaluated: true, score: 10, resolved, wouldDoBusiness: true, evaluatedAt: new Date("2026-10-29T00:00:00Z"), email: null, phone: null, city: null, state: null });
const lido = { ...base, status: "Resolvido", evaluated: true, resolved: true, score: 10, wouldDoBusiness: true } as Case;
conferir("o quadro dizia não resolvido, o portal diz resolvido", mudancasDoPortal(lido, noBanco("Não resolvido", true), FLUXO).dados.status, "Avaliado como resolvido");
conferir("o portal diz o que o quadro já diz: nada muda", mudancasDoPortal(lido, noBanco("Avaliado como resolvido", true), FLUXO).dados.status, undefined);
conferir("o portal diz não resolvido sobre a coluna de resolvido", mudancasDoPortal({ ...lido, resolved: false, status: "Não resolvido" } as Case, noBanco("Avaliado como resolvido", true), FLUXO).dados.status, "Avaliado como não resolvido");

async function noBancoReal() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) return;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    console.log("\n  A BASE REAL — só leitura\n");
    const casos = (await fetchCases(prisma)).filter(isReclameAqui);
    const avaliadasAbertas = casos.filter((c) => c.evaluated && isOpen(c));
    conferir("nenhuma avaliada conta como aberta", avaliadasAbertas.map((c) => `${c.protocol} ${c.status}`), []);
    const contraditas = casos.filter((c) => c.evaluated && ["Resolvido", "Não resolvido"].includes(papelDaEtapa(c.status)) && (papelDaEtapa(c.status) === "Resolvido") !== Boolean(c.resolved));
    console.log(`        coluna contra a avaliação: ${contraditas.map((c) => `${c.protocol} (${c.status})`).join(", ") || "nenhuma"}`);
  } finally {
    await prisma.$disconnect();
  }
}

noBancoReal().then(() => {
  console.log(falhas ? `\n  ${falhas} falha(s).\n` : "\n  Tudo confere.\n");
  process.exit(falhas ? 1 : 0);
});
