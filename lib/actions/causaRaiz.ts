"use server";

import { updateTag } from "next/cache";

import { WORKSPACE_TAG } from "@/lib/actions/tags";
import { requireRole, SemPermissao } from "@/lib/auth/guard";

import {
  donoDoItem,
  REINCIDENCIA_DIAS,
  REINCIDENCIA_MINIMA,
  reincidenciasCruzadas,
} from "@/lib/models/causaRaiz";
import { acharCausa } from "@/lib/models/catalogoDeCausas";
import { abrirItemDaReincidencia, catalogoComDono, registrosComCausa } from "@/lib/services/reincidencia.service";

type Falha = { ok: false; erro: string };

/**
 * Reincidência vira item em Projetos.
 *
 * A tela mostra a causa que passou de três registros em 30 dias; o botão
 * pede ao servidor para abrir o item. A conta é refeita aqui, contra o
 * banco — a tela pode estar com a lista de ontem —, e o item leva a lista
 * dos registros, para a área responsável começar pelos casos e não por
 * um número.
 */
export async function abrirProjetoDeReincidencia(entrada: {
  causa: string;
}): Promise<{ ok: true; projeto: { id: string; title: string }; jaExistia: boolean; registros: number } | Falha> {

  const causa = entrada.causa.trim();
  if (!causa) return { ok: false, erro: "Diga qual causa." };

  let ctx;
  try {
    ctx = await requireRole("AGENTE", "projetos");
  } catch (erro) {
    return { ok: false, erro: erro instanceof SemPermissao ? erro.message : "Não foi possível confirmar sua sessão. Entre de novo." };
  }
  if (!ctx) return { ok: false, erro: "Sem banco configurado — nada é gravado no modo demonstração." };

  const agora = new Date();
  const desde = new Date(agora.getTime() - REINCIDENCIA_DIAS * 86_400_000);

  try {
    const [registros, catalogo, pessoa] = await Promise.all([
      registrosComCausa(ctx.prisma, desde, causa),
      catalogoComDono(ctx.prisma),
      ctx.prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } }),
    ]);

    const [achada] = reincidenciasCruzadas(registros, agora);

    if (!achada) {
      return {
        ok: false,
        erro: `"${causa}" tem ${registros.length} registro(s) nos últimos ${REINCIDENCIA_DIAS} dias — reincidência começa em ${REINCIDENCIA_MINIMA}.`,
      };
    }

    /* O dono é a área da causa (Fase 27); sem área no catálogo, quem abriu. */
    const doCatalogo = acharCausa(causa, catalogo);
    const { projeto, jaExistia } = await abrirItemDaReincidencia(ctx.prisma, achada, agora, {
      dono: donoDoItem(doCatalogo, pessoa?.name ?? ""),
      prazoHoras: doCatalogo?.prazoHoras,
      quem: `Aberto por ${pessoa?.name ?? "alguém da operação"}`,
    });
    if (jaExistia) return { ok: true, projeto, jaExistia: true, registros: achada.registros.length };

    updateTag(WORKSPACE_TAG);

    return { ok: true, projeto, jaExistia: false, registros: achada.registros.length };
  } catch (erro) {
    console.error("[causa raiz] reincidência", erro);
    return { ok: false, erro: "O banco não aceitou a gravação agora. Tente de novo em instantes." };
  }
}
