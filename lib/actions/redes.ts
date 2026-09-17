"use server";

import { updateTag } from "next/cache";

import { CASES_TAG } from "@/lib/actions/tags";
import { requireRole, SemPermissao } from "@/lib/auth/guard";

import { SOCIAL_SOURCES } from "@/lib/services/case.service";
import { CANAL_PARA_ORIGEM } from "@/lib/services/case.mapper";
import {
  FINAIS_DAS_REDES,
  SAIDAS_DA_TRIAGEM,
  TENTATIVAS_DAS_REDES,
  faltaNaTriagem,
  textoDoEncaminhamento,
  type TriagemDasRedes,
} from "@/lib/models/redes";
import { patchDoResumo } from "@/lib/models/tratativa";
import type { Case } from "@/lib/models/case";
import { gravarContato, triar } from "@/lib/services/tratativa.service";

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
    return { ok: false, erro: "Escolha como o atendimento terminou: resolvido, sem contato, sem identificação ou encaminhado." };
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

    if (entrada.resultado === "Encaminhado" && solucao.length < 8) {
      return { ok: false, erro: "Diga para qual área foi e por quê — é o que se consulta quando o cliente voltar." };
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

/**
 * A triagem das Redes numa gravação só: quem é, a rede, o assunto, a
 * gravidade e a saída — que pode ser um dos finais.
 *
 * Tudo é conferido antes da primeira escrita (a mesma `faltaNaTriagem`
 * da tela): uma triagem recusada não deixa o caso pela metade, com o
 * cliente trocado e a saída sem gravar.
 */
export async function triarAtendimento(entrada: TriagemDasRedes & { protocol: string }): Promise<
  { ok: true; patch: Partial<Case> } | Falha
> {

  if (!SAIDAS_DA_TRIAGEM.some((s) => s.id === entrada.saida)) {
    return { ok: false, erro: "Escolha a saída da triagem." };
  }

  const quem = await quemGrava();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const prisma = quem.ctx.prisma;
    const pessoa = await prisma.user.findUnique({ where: { id: quem.ctx.userId }, select: { name: true } });
    const autorNome = pessoa?.name ?? "—";

    const caso = await prisma.case.findUnique({
      where: { protocol: entrada.protocol },
      select: { id: true, channel: true, status: true, validadoEm: true, tentativasSemResposta: true, criterios: true, customer: true },
    });
    if (!caso) return { ok: false, erro: `O caso ${entrada.protocol} não existe mais.` };
    if (!SOCIAL_SOURCES.includes(CANAL_PARA_ORIGEM[caso.channel] ?? "")) {
      return { ok: false, erro: "Esta triagem é do fluxo das Redes Sociais." };
    }
    if (FINAIS_DAS_REDES.includes(caso.status)) {
      return { ok: false, erro: `O atendimento já está encerrado como ${caso.status}. Reabra antes de triar de novo.` };
    }

    const falta = faltaNaTriagem(entrada, { validadoEm: caso.validadoEm?.toISOString(), tentativasSemResposta: caso.tentativasSemResposta });
    if (falta.length > 0) return { ok: false, erro: `Para salvar, falta ${falta.join("; ")}.` };

    const categoria = await prisma.category.findUnique({ where: { name: entrada.category.trim() }, select: { id: true } });
    if (!categoria) return { ok: false, erro: `O assunto "${entrada.category}" não está cadastrado. Escolha um da lista.` };

    const canal = Object.entries(CANAL_PARA_ORIGEM).find(([, origem]) => origem === entrada.source)?.[0];
    const handle = entrada.socialHandle.trim().replace(/^@+/, "");
    const cliente = entrada.naoIdentificado ? (caso.customer?.trim() || "Não identificado") : entrada.customer.trim();

    await prisma.case.update({
      where: { id: caso.id },
      data: {
        customer: cliente.slice(0, 200),
        socialHandle: handle ? handle.slice(0, 80) : null,
        followers: entrada.followers != null && Number.isFinite(entrada.followers) && entrada.followers >= 0 ? Math.round(entrada.followers) : null,
        channel: canal as never,
        categoryId: categoria.id,
        ...(entrada.relato.trim() ? { description: entrada.relato.trim().slice(0, 20000) } : {}),
      },
      select: { id: true },
    });

    const triagem = await triar(prisma as never, { caseId: caso.id, prioridade: entrada.prioridade, criterios: caso.criterios, autorNome });

    const patch: Partial<Case> = {
      customer: cliente,
      socialHandle: handle || undefined,
      followers: entrada.followers ?? undefined,
      source: entrada.source,
      category: entrada.category.trim(),
      ...(entrada.relato.trim() ? { description: entrada.relato.trim() } : {}),
      priority: triagem.priority,
      triadaEm: triagem.triadaEm,
      triadaPor: triagem.triadaPor,
    };

    if (entrada.saida === "Resolvido" && !caso.validadoEm) {
      const { resumo } = await gravarContato(prisma as never, {
        caseId: caso.id,
        entrada: { tipo: "validacao", canal: entrada.source, nota: "Confirmado na triagem." },
        autorId: quem.ctx.userId,
        autorNome,
      });
      Object.assign(patch, patchDoResumo(resumo));
    }

    if (entrada.saida === "segue") {
      if (caso.status === "Recebido" || caso.status === "Novo") {
        await prisma.case.update({ where: { id: caso.id }, data: { status: "Em análise" }, select: { id: true } });
        patch.status = "Em análise";
      }
    } else {
      const agora = new Date();
      const solucao =
        entrada.saida === "Encaminhado"
          ? textoDoEncaminhamento(entrada.area, entrada.chamado, entrada.solucao)
          : entrada.solucao.trim();
      const causa = entrada.causaRaiz.trim();
      await prisma.case.update({
        where: { id: caso.id },
        data: {
          status: entrada.saida,
          resolved: entrada.saida === "Resolvido",
          encerradoEm: agora,
          solucaoAplicada: solucao || null,
          ...(causa ? { causaRaiz: causa } : {}),
        },
        select: { id: true },
      });
      Object.assign(patch, {
        status: entrada.saida,
        resolved: entrada.saida === "Resolvido",
        encerradoEm: agora.toISOString(),
        solucaoAplicada: solucao || undefined,
        ...(causa ? { causaRaiz: causa } : {}),
      });
    }

    updateTag(CASES_TAG);

    return { ok: true, patch };
  } catch (erro) {
    console.error("[redes] triagem", erro);
    return { ok: false, erro: "O banco não aceitou a gravação agora. Tente de novo em instantes." };
  }
}
