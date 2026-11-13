import type { PrismaClient } from "@prisma/client";

import { MARCA_DE_ATENDIMENTO } from "@/lib/auth/modules";
import type { DivisaoDoDia } from "@/lib/models/divisaoDoDia";
import type { FrenteId } from "@/lib/models/frentes";

/**
 * Quem recebe atendimentos, com as frentes de cada um (o papel no módulo,
 * como na Distribuição) e quem está ausente hoje — a base do "dia de cada
 * um" (`lib/models/divisaoDoDia.ts`). Usada pelo Meu dia da plataforma e
 * pela agenda da extensão, para as duas dividirem igual.
 */
export async function lerDivisao(prisma: PrismaClient, eu: string, hoje: string): Promise<DivisaoDoDia> {
  const contas = await prisma.user.findMany({
    where: { active: true, NOT: { email: { endsWith: "@sem-acesso.local" } } },
    select: { id: true, name: true },
  });
  const usuarios = await prisma.user.findMany({
    where: { active: true, moduleRoles: { some: { module: MARCA_DE_ATENDIMENTO } } },
    select: { id: true, name: true, role: true, ausenteAte: true, moduleRoles: { select: { module: true, role: true } } },
  });
  return {
    eu,
    pessoas: usuarios.map((u) => {
      const papel = (modulo: string) => u.moduleRoles.find((m) => m.module === modulo)?.role ?? u.role;
      const ra = papel("reclame-aqui") !== "LEITURA";
      const frentes: FrenteId[] = [...(ra ? (["reclame-aqui", "redes"] as const) : []), ...(papel("nps") !== "LEITURA" ? (["nps"] as const) : []), "google"];
      const ate = u.ausenteAte ? u.ausenteAte.toISOString().slice(0, 10) : null;
      return { id: u.id, nome: u.name, frentes, ausente: Boolean(ate && ate >= hoje) };
    }),
    usuarios: contas.map((u) => ({ id: u.id, nome: u.name })),
  };
}
