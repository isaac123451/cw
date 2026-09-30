/**
 * Prova do analista de respostas públicas (1.94): cada regra acende no
 * texto que a quebra e fica apagada na resposta boa — e, com a base real,
 * quanto das publicadas cai em cada regra.
 *
 *   npx tsx --env-file=.env scripts/check-analista.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { analisarResposta } from "@/lib/models/analistaDeRespostas";
import { RESPOSTA_SINTETICA } from "@/lib/services/raMarcadores";
import { INICIO_DA_TRILHA } from "@/lib/models/trilha";
import { dadosSensiveis } from "@/lib/services/lgpd";

let falhas = 0;
function conferir(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${nome.padEnd(60)} ${JSON.stringify(obtido)}${ok ? "" : `\n        esperado ${JSON.stringify(esperado)}`}`);
}

const BOA = `Oi, Marina!

Sou o Carlos, do atendimento da Cardápio Web no Reclame Aqui. Entendo o transtorno de ficar sem o bot do WhatsApp justo no horário de pedidos. Verificamos a integração da sua loja e ajustamos a configuração do robô; os detalhes foram enviados por mensagem privada.

Se puder, avalie o atendimento aqui no Reclame Aqui — sua opinião nos ajuda a melhorar.

Carlos | Cardápio Web`;

const tipos = (t: string, ctx = {}) => analisarResposta(t, { nome: "Marina Lopes", ...ctx }).achados.map((a) => a.tipo);

console.log("\n— As regras —\n");
conferir("a resposta boa não tem achado", tipos(BOA, { validado: true }), []);
conferir("a boa tira 100", analisarResposta(BOA, { nome: "Marina", validado: true }).nota, 100);
conferir("sem nome, sem convite, sem assinatura, sem caminho", tipos("Olá. Verificamos o problema na sua loja e ajustamos o robô de atendimento, que já está funcionando normalmente desde hoje de manhã, lamentamos o ocorrido e seguimos à disposição para o que precisar no dia a dia.").sort(), ["sem-assinatura", "sem-caminho", "sem-convite", "sem-nome"]);
conferir("defensiva é erro", tipos(`${BOA}\nConforme já informado, o senhor não seguiu o passo a passo.`), ["defensiva"]);
conferir("resolvido sem o cliente confirmar é erro", tipos(BOA.replace("ajustamos a configuração do robô", "o problema já foi resolvido"), { validado: false }), ["resolvido-sem-validar"]);
conferir("mas com a confirmação, não", tipos(BOA.replace("ajustamos a configuração do robô", "o problema já foi resolvido"), { validado: true }), []);
conferir("curta demais", tipos("Oi, Marina! Resolvemos. Avalie. Carlos | Cardápio Web"), ["sem-validacao", "sem-caminho", "curta"]);
conferir("o marcador não é analisado", analisarResposta(RESPOSTA_SINTETICA).achados, []);

(async () => {
  console.log("\n— Na base real (publicadas dos últimos 90 dias) —\n");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const desde = new Date(Date.now() - 90 * 86_400_000);
  const casos = await prisma.case.findMany({
    where: { protocol: { startsWith: "RA-" }, publicResponseAt: { gte: desde }, publicResponse: { not: null } },
    select: { protocol: true, customer: true, publicResponse: true, validadoEm: true, publishedAt: true },
  });
  const reais = casos.filter((c) => c.publicResponse && c.publicResponse !== RESPOSTA_SINTETICA);
  const conta: Record<string, number> = {};
  let soma = 0;
  for (const c of reais) {
    const outras = reais.filter((o) => o.protocol !== c.protocol).map((o) => o.publicResponse!);
    const a = analisarResposta(c.publicResponse!, { nome: c.customer, publicadas: outras, validado: c.publishedAt.toISOString().slice(0, 10) < INICIO_DA_TRILHA ? undefined : Boolean(c.validadoEm) });
    for (const d of dadosSensiveis(c.publicResponse!)) conta[`  lgpd:${d.tipo}`] = (conta[`  lgpd:${d.tipo}`] ?? 0) + 1;
    soma += a.nota;
    for (const x of a.achados) conta[x.tipo] = (conta[x.tipo] ?? 0) + 1;
  }
  console.log(`  ${reais.length} respostas com texto · nota média ${reais.length ? Math.round(soma / reais.length) : 0}`);
  for (const [tipo, n] of Object.entries(conta).sort((a, b) => b[1] - a[1])) console.log(`    ${tipo.padEnd(24)} ${n}`);
  await prisma.$disconnect();
  console.log(falhas === 0 ? "\n  O analista aponta o que quebra o documento, e só isso.\n" : `\n  ${falhas} ponto(s) fora.\n`);
  process.exit(falhas === 0 ? 0 : 1);
})();
