"use server";

import { requireRole, tryRole } from "@/lib/auth/guard";

import { lerEstadoGravado, ROTEIRO, type EstadoDoGuia } from "@/lib/models/primeiroAcesso";

/**
 * O roteiro do primeiro acesso de quem está na sessão.
 *
 * Sempre da própria pessoa — como as outras preferências, nenhuma ação
 * aceita `userId` de fora. As marcas gravam com resposta; o último passo
 * vem do registro de contatos, sem marca nenhuma.
 */

type Falha = { ok: false; erro: string };

/** O primeiro contato que a pessoa registrou, em qualquer frente. */
async function primeiroCasoDe(prisma: NonNullable<Awaited<ReturnType<typeof tryRole>>>["prisma"], userId: string, nome: string | null) {
  const [contato, tentativaNps, npsEncerrado] = await Promise.all([
    prisma.caseContato.findFirst({
      where: { autorId: userId },
      orderBy: { em: "asc" },
      select: { em: true, tipo: true, case: { select: { protocol: true, channel: true } } },
    }),
    nome
      ? prisma.npsAttempt.findFirst({ where: { actor: nome }, orderBy: { createdAt: "asc" }, select: { createdAt: true, responseId: true } })
      : Promise.resolve(null),
    prisma.npsResponse.findFirst({
      where: { ownerId: userId, firstContactAt: { not: null } },
      orderBy: { firstContactAt: "asc" },
      select: { id: true, firstContactAt: true },
    }),
  ]);

  const candidatos: { quando: Date; onde: string; link: string }[] = [];
  if (contato) {
    const ra = contato.case.channel === "RECLAME_AQUI";
    candidatos.push({
      quando: contato.em,
      onde: `${ra ? "Reclame Aqui" : "Redes Sociais"} · ${contato.case.protocol}`,
      link: `/${ra ? "reclame-aqui" : "redes-sociais"}/${encodeURIComponent(contato.case.protocol)}`,
    });
  }
  if (tentativaNps) candidatos.push({ quando: tentativaNps.createdAt, onde: "NPS", link: `/nps/${tentativaNps.responseId}` });
  if (npsEncerrado?.firstContactAt) candidatos.push({ quando: npsEncerrado.firstContactAt, onde: "NPS", link: `/nps/${npsEncerrado.id}` });

  const primeiro = candidatos.sort((a, b) => a.quando.getTime() - b.quando.getTime())[0];
  return primeiro ? { quando: primeiro.quando.toISOString(), onde: primeiro.onde, link: primeiro.link } : null;
}

async function gravar(mudar: (atual: ReturnType<typeof lerEstadoGravado>) => ReturnType<typeof lerEstadoGravado>): Promise<{ ok: true; estado: EstadoDoGuia } | Falha> {
  let ctx;
  try {
    ctx = await requireRole("LEITURA");
  } catch {
    return { ok: false, erro: "Não foi possível confirmar sua sessão. Entre de novo." };
  }
  if (!ctx) return { ok: false, erro: "Sem banco configurado — nada é gravado no modo demonstração." };

  try {
    const pref = await ctx.prisma.userPreference.findUnique({ where: { userId: ctx.userId }, select: { primeiroAcesso: true } });
    const novo = mudar(lerEstadoGravado(pref?.primeiroAcesso));
    const valor = { passos: novo.passos, ...(novo.dispensadoEm ? { dispensadoEm: novo.dispensadoEm } : {}) };
    await ctx.prisma.userPreference.upsert({
      where: { userId: ctx.userId },
      update: { primeiroAcesso: valor },
      /* Quem nunca mexeu nos avisos ainda não tem linha: nasce com os avisos vazios (vale o padrão). */
      create: { userId: ctx.userId, notifications: {}, primeiroAcesso: valor },
    });
    const usuario = await ctx.prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } });
    return { ok: true, estado: { ...novo, primeiroCaso: await primeiroCasoDe(ctx.prisma, ctx.userId, usuario?.name ?? null) } };
  } catch (erro) {
    console.error("[primeiro-acesso] gravar", erro);
    return { ok: false, erro: "O banco não aceitou agora. Tente de novo em instantes." };
  }
}

export async function lerPrimeiroAcesso(): Promise<{ ok: true; estado: EstadoDoGuia } | Falha> {
  const ctx = await tryRole("LEITURA");
  if (!ctx) return { ok: false, erro: "Sem sessão." };
  try {
    const [pref, usuario] = await Promise.all([
      ctx.prisma.userPreference.findUnique({ where: { userId: ctx.userId }, select: { primeiroAcesso: true } }),
      ctx.prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } }),
    ]);
    const gravado = lerEstadoGravado(pref?.primeiroAcesso);
    return { ok: true, estado: { ...gravado, primeiroCaso: await primeiroCasoDe(ctx.prisma, ctx.userId, usuario?.name ?? null) } };
  } catch (erro) {
    console.error("[primeiro-acesso] ler", erro);
    return { ok: false, erro: "Não foi possível ler o seu roteiro agora." };
  }
}

/** Marca (ou desmarca) um passo de leitura ou de tela. O último não se marca à mão. */
export async function marcarPassoDoGuia(id: string, feito: boolean) {
  const passo = ROTEIRO.find((p) => p.id === id);
  if (!passo) return { ok: false, erro: "Passo desconhecido." } as Falha;
  if (passo.automatico) return { ok: false, erro: "Este passo se marca sozinho, quando o seu primeiro contato for registrado." } as Falha;
  return gravar((atual) => {
    const passos = { ...atual.passos };
    if (feito) passos[id] = new Date().toISOString();
    else delete passos[id];
    return { ...atual, passos };
  });
}

/** Esconde o roteiro do Meu dia (ou traz de volta). A página continua no menu. */
export async function dispensarGuia(dispensar: boolean) {
  return gravar((atual) => ({ ...atual, dispensadoEm: dispensar ? new Date().toISOString() : undefined }));
}
