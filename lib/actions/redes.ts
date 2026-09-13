"use server";

import { updateTag } from "next/cache";

import { CASES_TAG } from "@/lib/actions/tags";
import { requireRole, SemPermissao } from "@/lib/auth/guard";

import { SOCIAL_SOURCES } from "@/lib/services/case.service";
import { CANAL_PARA_ORIGEM } from "@/lib/services/case.mapper";
import { FINAIS_DAS_REDES, TENTATIVAS_DAS_REDES } from "@/lib/models/redes";

/**
 * Encerrar e reabrir um atendimento das Redes Sociais.
 *
 * O documento pede o encerramento registrado — "resultado final,
 * solução aplicada e causa raiz", com data e hora — e separa três
 * finais: resolvido, sem contato e sem identificação. Só o primeiro
 * conta como resolvido. Reabrir "preserva o histórico": o mesmo caso,
 * com a contagem de reaberturas.
 */

type Falha = { ok: false; erro: string };

async function quemGrava() {
  try {
    const ctx = await requireRole("AGENTE", "reclame-aqui");
    if (!ctx) return { erro: "Sem banco configurado — nada é gravado no modo demonstração." } as const;
    return { ctx } as const;
  } catch (erro) {
    return { erro: erro instanceof SemPermissao ? erro.message : "Não foi possível confirmar sua sessão. Entre de novo." } as const;
  }
}

export async function encerrarAtendimento(entrada: {
  protocol: string;
  resultado: string;
  solucaoAplicada?: string;
  causaRaiz?: string;
}): Promise<
  | { ok: true; status: string; resolved: boolean; encerradoEm: string; solucaoAplicada?: string; causaRaiz?: string }
  | Falha
> {

  if (!FINAIS_DAS_REDES.includes(entrada.resultado)) {
    return { ok: false, erro: "Escolha como o atendimento terminou: resolvido, sem contato ou sem identificação." };
  }

  const solucao = entrada.solucaoAplicada?.trim() || "";
  const causa = entrada.causaRaiz?.trim() || "";

  const quem = await quemGrava();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const caso = await quem.ctx.prisma.case.findUnique({
      where: { protocol: entrada.protocol },
      select: { id: true, channel: true, validadoEm: true, tentativasSemResposta: true },
    });

    if (!caso) return { ok: false, erro: `O caso ${entrada.protocol} não existe mais.` };

    if (!SOCIAL_SOURCES.includes(CANAL_PARA_ORIGEM[caso.channel] ?? "")) {
      return { ok: false, erro: "Este encerramento é do fluxo das Redes Sociais." };
    }

    if (entrada.resultado === "Resolvido") {
      if (!caso.validadoEm) {
        return { ok: false, erro: "Antes de encerrar como resolvido, registre a validação: o cliente confirmou que a solicitação foi atendida." };
      }
      if (solucao.length < 8) return { ok: false, erro: "Descreva a solução aplicada — é o que se consulta quando o cliente voltar." };
      if (!causa) return { ok: false, erro: "Escolha a causa raiz: o documento pede para permitir a apuração de causa." };
    }

    if (entrada.resultado === "Sem contato" && caso.tentativasSemResposta < TENTATIVAS_DAS_REDES) {
      const faltam = TENTATIVAS_DAS_REDES - caso.tentativasSemResposta;
      return {
        ok: false,
        erro: `Faltam ${faltam} tentativa(s) antes de encerrar sem contato — a 2ª em até 24h (WhatsApp e canal de origem), a 3ª em até 48h (e-mail ou telefone).`,
      };
    }

    const agora = new Date();

    await quem.ctx.prisma.case.update({
      where: { id: caso.id },
      data: {
        status: entrada.resultado,
        resolved: entrada.resultado === "Resolvido",
        encerradoEm: agora,
        solucaoAplicada: solucao || null,
        ...(causa ? { causaRaiz: causa } : {}),
      },
      select: { id: true },
    });

    updateTag(CASES_TAG);

    return {
      ok: true,
      status: entrada.resultado,
      resolved: entrada.resultado === "Resolvido",
      encerradoEm: agora.toISOString(),
      solucaoAplicada: solucao || undefined,
      causaRaiz: causa || undefined,
    };
  } catch (erro) {
    console.error("[redes] encerrar", erro);
    return { ok: false, erro: "O banco não aceitou a gravação agora. Tente de novo em instantes." };
  }
}

export async function reabrirAtendimento(
  protocol: string
): Promise<{ ok: true; status: string; reaberturas: number } | Falha> {

  const quem = await quemGrava();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const caso = await quem.ctx.prisma.case.findUnique({
      where: { protocol },
      select: { id: true, status: true, reaberturas: true },
    });

    if (!caso) return { ok: false, erro: `O caso ${protocol} não existe mais.` };
    if (!FINAIS_DAS_REDES.includes(caso.status)) return { ok: false, erro: "O atendimento não está encerrado." };

    const salvo = await quem.ctx.prisma.case.update({
      where: { id: caso.id },
      data: {
        status: "Em tratativa",
        resolved: false,
        encerradoEm: null,
        reaberturas: { increment: 1 },
      },
      select: { reaberturas: true },
    });

    updateTag(CASES_TAG);

    return { ok: true, status: "Em tratativa", reaberturas: salvo.reaberturas };
  } catch (erro) {
    console.error("[redes] reabrir", erro);
    return { ok: false, erro: "O banco não aceitou a gravação agora. Tente de novo em instantes." };
  }
}
