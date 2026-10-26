import type { PrismaClient } from "@prisma/client";

/**
 * O telefone do NPS, pelo portal da Cardápio Web (26/10/2026).
 *
 * "Eu queria sempre verificar o número de telefone." O Wootric não manda
 * telefone nem nome — manda `properties.company_id`, que é o id do
 * estabelecimento no portal. A extensão, dentro de uma aba do portal e com a
 * sessão de quem está logado, busca o estabelecimento por esse id, chega ao
 * dono e lê o telefone dele. Este serviço diz **quais** estabelecimentos
 * buscar e grava o que voltou; o token do portal nunca passa por aqui.
 *
 * Medido em 23/10: nos 6 detratores mais recentes o e-mail do Wootric era o
 * do dono, e o telefone estava lá.
 */

/** Um estabelecimento conferido de novo só depois de uma semana, se não tinha telefone. */
const RECONFERIR_EM_MS = 7 * 86_400_000;

const COMPANY_ID = /^\d{1,9}$/;

/** "(14) 99602-9938", "62996588482", "+55 62 9 9658-8482" → "62 99658-8482". */
export function formatarTelefone(bruto: unknown): string | null {
  let d = String(bruto ?? "").replace(/\D/g, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) return `${d.slice(0, 2)} ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 2)} ${d.slice(2, 6)}-${d.slice(6)}`;
  return null;
}

/**
 * Os estabelecimentos a buscar nesta volta: os de NPS sem telefone, nunca
 * conferidos ou conferidos há mais de uma semana. Primeiro os detratores e
 * neutros em aberto, depois os outros em aberto, depois o resto — sempre os
 * mais recentes antes.
 */
export async function pendentesDeTelefone(
  prisma: PrismaClient,
  agora = new Date(),
  teto = 40
): Promise<string[]> {
  const linhas = await prisma.npsResponse.findMany({
    where: {
      OR: [{ phone: null }, { phone: "" }],
      externalCompanyId: { not: null },
      AND: [{ OR: [{ portalConferidoEm: null }, { portalConferidoEm: { lt: new Date(agora.getTime() - RECONFERIR_EM_MS) } }] }],
    },
    select: { externalCompanyId: true, status: true, score: true, respondedAt: true },
    orderBy: { respondedAt: "desc" },
    take: 5000,
  });

  const peso = (l: (typeof linhas)[number]) => {
    const aberto = !l.status.startsWith("[Encerrado]");
    return aberto && l.score <= 8 ? 0 : aberto ? 1 : 2;
  };

  const ordenadas = linhas
    .map((l, i) => ({ l, i }))
    .sort((a, b) => peso(a.l) - peso(b.l) || a.i - b.i)
    .map(({ l }) => String(l.externalCompanyId ?? "").trim())
    .filter((c) => COMPANY_ID.test(c));

  return [...new Set(ordenadas)].slice(0, teto);
}

/** O que a extensão leu no portal sobre um estabelecimento. */
export interface LidoDoPortal {
  companyId: string;
  /** O portal achou o estabelecimento com esse id exato. */
  achou: boolean;
  telefone?: string;
  dono?: string;
  emailDono?: string;
  loja?: string;
}

function texto(v: unknown, teto: number) {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, teto) : undefined;
}

/** O que veio da página é conferido campo a campo; o resto é descartado. */
export function validarLido(bruto: unknown): LidoDoPortal | null {
  if (!bruto || typeof bruto !== "object") return null;
  const b = bruto as Record<string, unknown>;
  const companyId = String(b.companyId ?? "").trim();
  if (!COMPANY_ID.test(companyId)) return null;
  return {
    companyId,
    achou: b.achou === true,
    telefone: texto(b.telefone, 40),
    dono: texto(b.dono, 120),
    emailDono: texto(b.emailDono, 160)?.toLowerCase(),
    loja: texto(b.loja, 160),
  };
}

/**
 * Grava o que veio do portal em todos os NPS daquele estabelecimento.
 *
 * Só preenche o que está vazio — telefone, loja e nome digitados à mão
 * ficam. O nome da pessoa só entra quando o e-mail de quem respondeu é o do
 * dono; o telefone entra sempre, marcado como "do dono" quando o e-mail é
 * de outra pessoa.
 */
export async function gravarDoPortalCw(
  prisma: PrismaClient,
  lidos: LidoDoPortal[],
  agora = new Date()
): Promise<{ conferidos: number; comTelefone: number; nps: number }> {
  let comTelefone = 0;
  let nps = 0;

  for (const lido of lidos) {
    const telefone = lido.achou ? formatarTelefone(lido.telefone) : null;
    if (telefone) comTelefone += 1;

    const linhas = await prisma.npsResponse.findMany({
      where: { externalCompanyId: lido.companyId },
      select: { id: true, phone: true, email: true, customerName: true, company: true },
    });

    for (const l of linhas) {
      const mesmoEmail = Boolean(lido.emailDono && (l.email ?? "").trim().toLowerCase() === lido.emailDono);
      const dados: Record<string, unknown> = { portalConferidoEm: agora };
      if (telefone && !(l.phone ?? "").trim()) {
        dados.phone = telefone;
        dados.phoneOrigem = mesmoEmail ? "portal" : "portal-dono";
        nps += 1;
      }
      if (lido.achou && lido.loja && !(l.company ?? "").trim()) dados.company = lido.loja;
      if (mesmoEmail && lido.dono && !(l.customerName ?? "").trim()) dados.customerName = lido.dono;
      await prisma.npsResponse.update({ where: { id: l.id }, data: dados, select: { id: true } });
    }
  }

  return { conferidos: lidos.length, comTelefone, nps };
}
