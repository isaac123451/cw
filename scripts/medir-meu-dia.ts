/**
 * Quanto cada atividade do Meu dia tem hoje, na base real — e o que
 * fica de fora de todas elas.
 *
 *   npx tsx scripts/medir-meu-dia.ts
 *
 * Só leitura. Monta as listas como a tela monta (casos, NPS, Google,
 * áreas, agenda) e roda a mesma conta do Meu dia. Serve para conferir,
 * antes de mudar a regra, o tamanho do que ela move.
 */
import "dotenv/config";

import { getPrisma } from "../lib/prisma";
import { fetchCases } from "../lib/services/case.repository";
import { contarRotina } from "../lib/models/meuDia";
import { filaDoDia } from "../lib/models/guiaParaFechar";
import { ROTINA_PADRAO, atividadesDoDia } from "../lib/models/rotina";
import { isEncerrado, type NpsResponseView } from "../lib/models/nps";
import { isOpen, isReclameAqui, isSocial } from "../lib/services/case.service";
import { primeiroContatoFeito } from "../lib/services/sla.service";
import { respondida } from "../lib/models/case";
import { paredeDe } from "../lib/services/horasUteis";

const iso = (d?: Date | null) => (d ? d.toISOString() : undefined);

async function main() {
  const prisma = getPrisma();
  if (!prisma) throw new Error("Sem banco.");

  const agora = new Date();
  const hoje = paredeDe(agora).dia;

  const [casos, npsLinhas, google, tarefas] = await Promise.all([
    fetchCases(prisma),
    prisma.npsResponse.findMany({ include: { attempts: { orderBy: { createdAt: "asc" } } } }),
    prisma.avaliacaoGoogle.findMany({
      select: { id: true, autor: true, status: true, respondidaEm: true, classificacao: true, tratativaResultado: true, publicadaEm: true },
    }),
    prisma.agendaTask.findMany(),
  ]);

  const nps: NpsResponseView[] = npsLinhas.map((r) => ({
    id: r.id,
    score: r.score,
    comment: r.comment,
    respondedAt: r.respondedAt.toISOString(),
    customer: r.customer,
    customerName: r.customerName ?? undefined,
    kind: r.kind ?? undefined,
    rootCause: r.rootCause ?? undefined,
    status: r.status,
    firstContactDueAt: r.firstContactDueAt.toISOString(),
    firstContactAt: iso(r.firstContactAt),
    confirmedAt: iso(r.confirmedAt),
    closedAt: iso(r.closedAt),
    postContactAt: iso(r.postContactAt),
    resolvedAfter: r.resolvedAfter ?? undefined,
    reviewAsked: r.reviewAsked,
    testimonialAsked: r.testimonialAsked,
    referralAsked: r.referralAsked,
    source: r.source,
    churnRisk: r.churnRisk,
    wootricNotes: r.wootricNotes,
    notes: [],
    attempts: r.attempts.map((a) => ({ id: a.id, channel: a.channel, note: a.note, actor: a.actor, createdAt: a.createdAt.toISOString() })),
  }));

  const contagens = contarRotina(
    {
      casos,
      nps,
      google: google.map((g) => ({ ...g, respondidaEm: iso(g.respondidaEm), publicadaEm: g.publicadaEm.toISOString() })) as never,
      movimentos: [],
      tarefas: tarefas.map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate, time: t.time ?? undefined, done: t.done })) as never,
      regrasSla: [],
    },
    agora
  );

  console.log(`\n  MEU DIA NA BASE REAL — ${hoje}\n`);
  for (const [chave, c] of Object.entries(contagens)) {
    if (!c.total) continue;
    const porFrente = Object.entries(c.porFrente).map(([f, n]) => `${f} ${n}`).join(", ");
    console.log(`  ${chave.padEnd(11)} ${String(c.total).padStart(4)}  atrasados ${String(c.atrasados).padStart(3)}  (${porFrente})`);
  }

  const fila = filaDoDia(atividadesDoDia(ROTINA_PADRAO, hoje), contagens);
  console.log(`\n  fila do "um por vez": ${fila.length} itens, ${fila.filter((i) => i.atrasado).length} fora do prazo`);
  console.log(`  primeiros 8: ${fila.slice(0, 8).map((i) => `${i.frente ?? "-"}${i.atrasado ? "!" : ""}`).join(" ")}`);

  /* O que não está em atividade nenhuma. */
  const ids = new Set(Object.values(contagens).flatMap((c) => c.itens.map((i) => i.id)));
  const abertos = casos.filter(isOpen);
  const raForaDeTudo = abertos.filter((c) => isReclameAqui(c) && !ids.has(c.id) && !respondida(c));
  const raLegado = raForaDeTudo.filter((c) => !primeiroContatoFeito(c));
  const redesForaDeTudo = abertos.filter((c) => isSocial(c) && !ids.has(c.id));
  const npsAbertos = nps.filter((r) => !isEncerrado(r.status));
  const npsForaDeTudo = npsAbertos.filter((r) => !ids.has(r.id));
  const npsSoTentativa = npsAbertos.filter((r) => r.firstContactAt && !r.postContactAt && r.attempts.length > 0);
  const npsSemComentario = npsAbertos.filter((r) => !r.comment.trim() && !r.kind);

  console.log(`\n  FORA DE TODAS AS ATIVIDADES`);
  console.log(`  RA aberto e sem resposta pública: ${raForaDeTudo.length} (sem 1º contato registrado: ${raLegado.length})`);
  console.log(`  Redes abertas: ${redesForaDeTudo.length}`);
  console.log(`  NPS aberto: ${npsForaDeTudo.length} de ${npsAbertos.length}`);
  console.log(`\n  NPS só com tentativa (sem conversa): ${npsSoTentativa.length}`);
  console.log(`  NPS aberto sem comentário e sem tipo: ${npsSemComentario.length} de ${npsAbertos.length}`);
  const emAbertoNpsSoTentativa = contagens["em-aberto"].itens.filter((i) => npsSoTentativa.some((r) => r.id === i.id)).length;
  console.log(`  ... desses, em "em aberto": ${emAbertoNpsSoTentativa}`);
  const emAbertoCadencia = contagens["em-aberto"].itens.filter((i) => casos.find((c) => c.id === i.id)?.tentativasSemResposta).length;
  console.log(`  casos na cadência de tentativas que também estão em "em aberto": ${emAbertoCadencia}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => getPrisma()?.$disconnect());
