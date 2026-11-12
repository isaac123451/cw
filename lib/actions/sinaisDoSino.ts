"use server";

import { minhaExtensao } from "@/lib/actions/minhaExtensao";
import { contarPropostasPendentes } from "@/lib/actions/revisaoDeCategorias";
import { ultimaLeituraDoVigia } from "@/lib/actions/saudeDoVigia";
import type { ExtensaoVista } from "@/lib/models/versaoDaExtensao";

/**
 * O que o sino lê do servidor, numa ida só (12/11/2026).
 *
 * O Next executa as server actions de uma aba em fila, uma de cada vez. O
 * sino fazia três ao abrir qualquer tela (as categorias propostas, o vigia e
 * a versão da extensão), e cada uma esperava a anterior. Juntas, rodam em
 * paralelo e ocupam uma volta da fila. Cada leitura que falha volta vazia,
 * como antes.
 */
export async function lerSinaisDoSino(): Promise<{ propostas: number; vigiaLeuEm: string | null; extensao: ExtensaoVista | null }> {
  const [propostas, vigiaLeuEm, extensao] = await Promise.all([
    contarPropostasPendentes().catch(() => 0),
    ultimaLeituraDoVigia().catch(() => null),
    minhaExtensao().catch(() => null),
  ]);
  return { propostas, vigiaLeuEm, extensao };
}
