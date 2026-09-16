/**
 * A urgência sugerida por dado acerta — e na base real, quanto ela pega?
 *
 *   npm run check:urgencia
 *
 * **A ideia do roadmap.** "O documento chama de Urgente o cliente de alto
 * ticket, a reincidência e o risco de cancelamento. A plataforma já sabe
 * o plano do estabelecimento, as reclamações anteriores e a marca de
 * churn, então pode sugerir a prioridade sozinha e dizer por quê."
 *
 * Duas metades:
 *
 * 1. **a regra**, com dados montados — documento com e sem pontuação,
 *    janela de 90 dias, reclamação de depois não conta, base pequena não
 *    define "alto ticket";
 * 2. **a base real**, só leitura: quantos casos abertos cada sinal pega.
 *    Um sinal que pega tudo não sugere nada; um que não pega nada precisa
 *    de explicação.
 */
import "dotenv/config";

import type { Case } from "../lib/models/case";
import type { Establishment } from "../lib/models/establishment";
import { limiteDeAltoTicket, urgenciaPorDado } from "../lib/models/urgenciaPorDado";
import { getPrisma } from "../lib/prisma";

let falhas = 0;

function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${JSON.stringify(obtido)?.slice(0, 44)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(64)} ${JSON.stringify(esperado)?.slice(0, 44)}`);
}

type CasoMin = Pick<Case, "id" | "protocol" | "document" | "establishmentId" | "createdAt" | "churnRisk">;
type ContaMin = Pick<Establishment, "id" | "name" | "plan" | "mrr" | "status">;

const caso = (c: Partial<CasoMin>): CasoMin => ({ id: "c0", protocol: "RA-0", createdAt: "2026-09-10", churnRisk: false, ...c });
const conta = (c: Partial<ContaMin>): ContaMin => ({ id: "e0", name: "Conta", plan: "", status: "Ativo", ...c });

const PLANOS = [
  { name: "Básico", priceCents: 9900, kind: "plano" },
  { name: "Pro", priceCents: 19900, kind: "plano" },
  { name: "Rede", priceCents: 59900, kind: "plano" },
];

async function main() {
  console.log("\n  URGÊNCIA SUGERIDA POR DADO\n");
  console.log("— A regra —\n");

  {
    const atual = caso({ id: "a", document: "12.345.678/0001-90" });
    const outros = [
      caso({ id: "b", protocol: "RA-B", document: "12345678000190", createdAt: "2026-08-01" }),
      caso({ id: "c", protocol: "RA-C", document: "12345678000190", createdAt: "2026-01-01" }),
      caso({ id: "d", protocol: "RA-D", document: "12345678000190", createdAt: "2026-09-12" }),
    ];
    const r = urgenciaPorDado(atual, { casos: [atual, ...outros], estabelecimentos: [], planos: PLANOS });
    conferir("reincidência pelo CNPJ, com e sem pontuação", r.sinais.map((s) => s.criterio), ["reincidencia"]);
    conferir("só dentro de 90 dias antes (nem velha, nem de depois)", r.sinais[0]?.motivo.startsWith("1 outra"), true);
    conferir("e reincidência é Urgente, como na tabela", r.nivel, "Urgente");

    const semDoc = urgenciaPorDado(caso({ id: "x", document: "123" }), { casos: outros, estabelecimentos: [], planos: PLANOS });
    conferir("documento inválido não casa com ninguém", semDoc.sinais, []);
  }

  {
    const pequenas = Array.from({ length: 5 }, (_, i) => conta({ id: `p${i}`, plan: i === 0 ? "Rede" : "Básico" }));
    conferir("com menos de 8 contas com mensalidade, 'alto' não existe", limiteDeAltoTicket(pequenas, PLANOS), null);

    const iguais = Array.from({ length: 10 }, (_, i) => conta({ id: `i${i}`, plan: "Pro" }));
    conferir("todas no mesmo plano: ninguém é alto ticket", limiteDeAltoTicket(iguais, PLANOS), null);

    const base = [
      ...Array.from({ length: 9 }, (_, i) => conta({ id: `b${i}`, plan: "Básico" })),
      conta({ id: "rede", name: "Rede Grande", plan: "Rede" }),
      conta({ id: "mrr", name: "Com MRR", plan: "Básico", mrr: 800 }),
    ];
    const r = urgenciaPorDado(caso({ id: "z", establishmentId: "rede" }), { casos: [], estabelecimentos: base, planos: PLANOS });
    conferir("plano do quartil de cima vira 'alto ticket', dizendo o valor", [r.sinais[0]?.criterio, /R\$\s?599,00/.test(r.sinais[0]?.motivo ?? "")], ["estrategico", true]);

    const comum = urgenciaPorDado(caso({ id: "z", establishmentId: "b1" }), { casos: [], estabelecimentos: base, planos: PLANOS });
    conferir("plano comum não sugere nada", comum.sinais, []);
  }

  {
    const contas = [conta({ id: "e1", name: "Pizzaria", status: "Em risco" })];
    const nps = [
      { id: "n1", score: 3, churnRisk: true, establishmentId: "e1", respondedAt: "2026-09-01T12:00:00Z" },
      { id: "n2", score: 9, churnRisk: true, establishmentId: "e1", respondedAt: "2026-09-01T12:00:00Z" },
    ];
    const r = urgenciaPorDado(caso({ id: "k", establishmentId: "e1", churnRisk: true }), { casos: [], estabelecimentos: contas, planos: PLANOS, nps });
    conferir("cancelamento junta os três motivos num sinal só", r.sinais.map((s) => s.criterio), ["cancelamento"]);
    conferir("e cita a marca do caso, a conta e o detrator (não o promotor)", (r.sinais[0]?.motivo.match(/;/g) ?? []).length, 2);
  }

  console.log("\n— A base real (só leitura) —\n");

  const prisma = getPrisma();
  if (!prisma) {
    console.log("  sem banco: a metade real não rodou.");
  } else {
    const [linhas, contas, planos, nps] = await Promise.all([
      prisma.case.findMany({ select: { id: true, protocol: true, document: true, establishmentId: true, publishedAt: true, createdAt: true, churnRisk: true, status: true } }),
      prisma.establishment.findMany({ select: { id: true, name: true, plan: true, mrrCents: true, status: true } }),
      prisma.plan.findMany({ select: { name: true, priceCents: true, kind: true } }),
      prisma.npsResponse.findMany({ select: { id: true, score: true, churnRisk: true, establishmentId: true, respondedAt: true } }),
    ]);

    const casos: CasoMin[] = linhas.map((l) => ({
      id: l.id,
      protocol: l.protocol,
      document: l.document ?? undefined,
      establishmentId: l.establishmentId ?? undefined,
      createdAt: (l.publishedAt ?? l.createdAt).toISOString().slice(0, 10),
      churnRisk: l.churnRisk,
    }));
    const estabelecimentos: ContaMin[] = contas.map((c) => ({
      id: c.id,
      name: c.name,
      plan: c.plan,
      mrr: c.mrrCents ? c.mrrCents / 100 : undefined,
      status: c.status as Establishment["status"],
    }));
    const respostas = nps.map((r) => ({ ...r, establishmentId: r.establishmentId ?? undefined, respondedAt: r.respondedAt.toISOString() }));

    const conta = { reincidencia: 0, estrategico: 0, cancelamento: 0, algum: 0 };
    for (const c of casos) {
      const r = urgenciaPorDado(c, { casos, estabelecimentos, planos, nps: respostas });
      for (const s of r.sinais) conta[s.criterio] += 1;
      if (r.sinais.length) conta.algum += 1;
    }

    const limite = limiteDeAltoTicket(estabelecimentos, planos);
    console.log(`  ${casos.length} casos · ${estabelecimentos.length} contas · limite de alto ticket: ${limite === null ? "sem base (contas sem mensalidade conhecida)" : `R$ ${limite}`}`);
    console.log(`  reincidência ${conta.reincidencia} · alto ticket ${conta.estrategico} · cancelamento ${conta.cancelamento} · algum sinal ${conta.algum}`);

    conferir("a sugestão não pega a base inteira (senão não sugere nada)", conta.algum < casos.length * 0.5, true);
  }

  console.log(falhas === 0 ? "\n  A urgência sugerida diz por quê, e só quando o dado sustenta.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
