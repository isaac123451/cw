/**
 * Metas do dia editáveis e metas do ciclo (1.114). A conta sobre casos
 * montados à mão e, no fim, as metas de hoje da base real — só leitura.
 *
 *   npm run check:metas
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { alvoComAjuste, alvoValido } from "@/lib/models/ajusteDeMeta";
import { metasDoCiclo } from "@/lib/models/metasDoCiclo";
import { metasDoDia } from "@/lib/models/motivacaoDoDia";
import { fetchCases } from "@/lib/services/case.repository";
import { lerRespostasDoNps } from "@/lib/services/npsLista.service";

let falhas = 0;
function ok(nome: string, cond: boolean, extra = "") {
  if (!cond) falhas++;
  console.log(`${cond ? "ok " : "ERRO"} ${nome}${extra ? ` — ${extra}` : ""}`);
}

/* ---- o alvo com ajuste ---- */
const gerar = (teto = 5) => Math.min(teto, 8);
ok("sem ajuste, o automático", JSON.stringify(alvoComAjuste("x", undefined, gerar)) === JSON.stringify({ alvo: 5, automatico: 5, origem: "automatico" }));
ok("o padrão vira o teto da conta", alvoComAjuste("x", { doPeriodo: {}, padrao: { x: 7 } }, gerar).alvo === 7);
ok("o padrão nunca passa do que existe para fazer", alvoComAjuste("x", { doPeriodo: {}, padrao: { x: 20 } }, gerar).alvo === 8);
ok("o de hoje vale como veio, acima do padrão", JSON.stringify(alvoComAjuste("x", { doPeriodo: { x: 12 }, padrao: { x: 7 } }, gerar)) === JSON.stringify({ alvo: 12, automatico: 5, origem: "periodo" }));
ok("número inválido é recusado", alvoValido("abc") === null && alvoValido(-1) === null && alvoValido(501) === null && alvoValido("3") === 3);

/* ---- as metas de hoje e do ciclo, na base real ---- */
async function real() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const [casos, nps] = await Promise.all([fetchCases(prisma), lerRespostasDoNps(prisma)]);
    const agora = new Date();
    const dia = metasDoDia({ casos, nps, agora });
    console.log("\nhoje:", dia.map((m) => `${m.titulo} ${m.feito}/${m.alvo}`).join(" · "));
    const ajustadas = metasDoDia({ casos, nps, agora, ajustes: { doPeriodo: { respostas: 9 }, padrao: { "primeiros-contatos": 1 } } });
    const respostas = ajustadas.find((m) => m.chave === "respostas");
    ok("na base real, o ajuste de hoje troca o alvo e guarda o automático", !respostas || (respostas.alvo === 9 && respostas.origem === "periodo" && respostas.automatico === dia.find((m) => m.chave === "respostas")?.alvo));
    const contatos = ajustadas.find((m) => m.chave === "primeiros-contatos");
    ok("e o padrão menor reduz o alvo", !contatos || (contatos.alvo <= 1 && contatos.origem === "padrao"));

    const ciclo = metasDoCiclo({ casos, nps, agora });
    console.log(`ciclo ${ciclo.ciclo.rotulo} (faltam ${ciclo.faltamDias} dias):`);
    for (const m of ciclo.metas) console.log(`  ${m.titulo}: ${m.feito}/${m.alvo} — ${m.porque}`);
    ok("o ciclo tem metas e dias contados", ciclo.metas.length > 0 && ciclo.faltamDias >= 1 && ciclo.faltamDias <= 7);
    const ajustado = metasDoCiclo({ casos, nps, agora, ajustes: { doPeriodo: {}, padrao: { avaliacoes: 40 } } });
    ok("no ciclo, o padrão vale como veio", ajustado.metas.find((m) => m.chave === "avaliacoes")?.alvo === 40);
  } finally {
    await prisma.$disconnect();
  }
}

real().then(() => {
  console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
  process.exit(falhas ? 1 : 0);
});
