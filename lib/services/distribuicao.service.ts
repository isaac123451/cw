import type { PrismaClient } from "@prisma/client";

import { MARCA_DE_ATENDIMENTO, type Modulo } from "@/lib/auth/modules";
import {
  chaveDoCliente,
  estaAusente,
  FRENTES_DA_FILA,
  type FrenteDaFila,
  type ItemDaFila,
  type PessoaDoTime,
} from "@/lib/models/distribuicao";
import { CLOSED_STATUS } from "@/lib/services/case.service";
import { paredeDe } from "@/lib/services/horasUteis";

/**
 * A leitura da distribuição do time (1.106) — ver `lib/models/distribuicao.ts`.
 *
 * "Aberto" é o mesmo do quadro: o caso fora das colunas de fechado e o
 * NPS sem o prefixo [Encerrado]. O "Aguardando avaliação" fica de fora de
 * propósito — é a fila de pedir avaliação, que tem tela própria; contada
 * aqui, somaria mais de cem casos antigos sem dono à carga de hoje.
 */

/** O módulo que dá o direito de receber itens de cada frente. */
const MODULO_DA_FRENTE: Record<FrenteDaFila, Modulo> = {
  "reclame-aqui": "reclame-aqui",
  redes: "reclame-aqui",
  nps: "nps",
};

/* Instante → o dia em Brasília: depois das 21h o dia em UTC já é o seguinte (out/2026). */
const dia = (d: Date) => paredeDe(d).dia;
/* Coluna só de data (@db.Date), gravada à meia-noite UTC: o dia é o que está escrito. */
const diaDaData = (d: Date) => d.toISOString().slice(0, 10);

function frenteDoCaso(channel: string): FrenteDaFila {
  return channel === "RECLAME_AQUI" ? "reclame-aqui" : "redes";
}

/** Todos os itens abertos das três frentes, com e sem dono. */
export async function lerItensAbertos(prisma: PrismaClient): Promise<ItemDaFila[]> {
  const [casos, nps] = await Promise.all([
    prisma.case.findMany({
      where: { status: { notIn: CLOSED_STATUS } },
      select: { id: true, protocol: true, channel: true, customer: true, email: true, document: true, recebidaEm: true, publishedAt: true, ownerId: true },
    }),
    prisma.npsResponse.findMany({
      where: { NOT: { status: { startsWith: "[Encerrado]" } } },
      select: { id: true, score: true, customer: true, customerName: true, email: true, respondedAt: true, ownerId: true },
    }),
  ]);

  return [
    ...casos.map((c) => {
      const frente = frenteDoCaso(c.channel);
      return {
        tipo: "caso" as const,
        id: c.id,
        frente,
        rotulo: `${c.protocol} · ${c.customer}`,
        cliente: chaveDoCliente({ email: c.email, documento: c.document, nome: c.customer }),
        /* `publishedAt` é só a data; `recebidaEm`, o instante. */
        desde: c.recebidaEm ? dia(c.recebidaEm) : diaDaData(c.publishedAt),
        donoId: c.ownerId,
        href: frente === "reclame-aqui" ? `/reclame-aqui/${c.id}` : `/redes-sociais/${c.id}`,
      };
    }),
    ...nps.map((r) => ({
      tipo: "nps" as const,
      id: r.id,
      frente: "nps" as const,
      rotulo: `NPS ${r.score} · ${r.customerName || r.customer}`,
      cliente: chaveDoCliente({ email: r.email, nome: r.customerName || r.customer }),
      desde: dia(r.respondedAt),
      donoId: r.ownerId,
      href: `/nps/${r.id}`,
    })),
  ];
}

/**
 * As pessoas ativas, com a carga de cada uma e se podem receber em cada
 * frente — papel de agente ou mais no módulo, contando a exceção gravada
 * por módulo (a mesma regra de `lib/auth/guard.ts`).
 */
export async function lerPessoasDoTime(prisma: PrismaClient, itens: ItemDaFila[], hoje: string): Promise<PessoaDoTime[]> {
  const [usuarios, semResposta] = await Promise.all([
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, role: true, ausenteAte: true, moduleRoles: { select: { module: true, role: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.case.groupBy({
      by: ["ownerId"],
      where: { channel: "RECLAME_AQUI", status: { notIn: CLOSED_STATUS }, publicResponseAt: null, publicResponse: null },
      _count: true,
    }),
  ]);

  /*
    Só recebe fila quem está marcado em Permissões → "Recebe atendimentos"
    (07/10/2026). Antes toda conta ativa era destino — inclusive a das
    conferências ("Conferência"), com quem três reclamações reais foram
    parar. Quem não está marcado só aparece se ainda carregar algo, para a
    fila dele poder ser passada adiante.
  */
  return usuarios.map((u) => {
    const recebe = u.moduleRoles.some((m) => m.module === MARCA_DE_ATENDIMENTO);
    const papel = (modulo: Modulo) => (recebe ? u.moduleRoles.find((m) => m.module === modulo)?.role ?? u.role : "LEITURA");
    const carga = { "reclame-aqui": 0, redes: 0, nps: 0 } as Record<FrenteDaFila, number>;
    for (const i of itens) if (i.donoId === u.id) carga[i.frente] += 1;
    const ausenteAte = u.ausenteAte ? diaDaData(u.ausenteAte) : null;
    return {
      id: u.id,
      nome: u.name,
      ausenteAte,
      ausente: estaAusente(ausenteAte, hoje),
      podeReceber: Object.fromEntries(FRENTES_DA_FILA.map((f) => [f, papel(MODULO_DA_FRENTE[f]) !== "LEITURA"])) as Record<FrenteDaFila, boolean>,
      carga,
      semResposta: semResposta.find((s) => s.ownerId === u.id)?._count ?? 0,
      recebe,
    };
  })
    .filter((p) => p.recebe || Object.values(p.carga).some((n) => n > 0))
    .map(({ recebe: _recebe, ...p }) => p);
}

/** O módulo que a gravação exige para mexer num item desta frente. */
export function moduloDaFrente(frente: FrenteDaFila): Modulo {
  return MODULO_DA_FRENTE[frente];
}
