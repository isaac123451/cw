"use server";

import { tryRole } from "@/lib/auth/guard";
import { listarAvaliacoesGoogle } from "@/lib/actions/avaliacoesGoogle";
import { listCases } from "@/lib/actions/cases";
import { listNpsResponses, listNpsRootCauses } from "@/lib/actions/nps";
import { getPreferences } from "@/lib/actions/preferences";
import { listSavedFilters } from "@/lib/actions/savedFilters";
import { loadWorkspace } from "@/lib/actions/workspace";

/**
 * A carga de quando a plataforma abre, numa ida só (Fase 10.2).
 *
 * **Por que existe.** O Next executa as server actions de uma aba **uma
 * de cada vez**: os sete providers do layout raiz pediam cada um a sua
 * leitura, e cada leitura esperava a anterior terminar. Medido em
 * 16/09/2026, no painel: a última parte chegava 2,9 s depois da
 * primeira, e o NPS e as avaliações do Google — que não dependem de
 * nada — esperavam o cadastro, os casos e as preferências.
 *
 * Aqui as sete rodam **em paralelo no servidor** e voltam juntas. Cada
 * uma continua sendo a própria action, com a própria checagem de acesso:
 * nada de permissão nova, só a fila a menos.
 *
 * Uma parte que falha não derruba as outras — volta `{ ok: false }`, e o
 * provider daquela parte tenta sozinho, pelo caminho de antes.
 */

type Parte<T> = { ok: true; valor: T } | { ok: false };

async function parte<T>(nome: string, ler: () => Promise<T>): Promise<Parte<T>> {
  try {
    return { ok: true, valor: await ler() };
  } catch (erro) {
    console.error(`[carga inicial] ${nome}`, erro);
    return { ok: false };
  }
}

export async function cargaInicial() {
  /*
    Sem sessão, nada vai junto: cada provider tenta pelo próprio caminho,
    que sabe dizer por que a leitura foi recusada (a faixa amarela).
  */
  if (!(await tryRole("LEITURA"))) {
    const nada = { ok: false } as const;
    return { workspace: nada, casos: nada, nps: nada, causasDoNps: nada, preferencias: nada, filtros: nada, google: nada } as unknown as Awaited<ReturnType<typeof lerTudo>>;
  }

  return lerTudo();
}

async function lerTudo() {
  const [workspace, casos, nps, causasDoNps, preferencias, filtros, google] = await Promise.all([
    parte("workspace", loadWorkspace),
    parte("casos", listCases),
    parte("nps", listNpsResponses),
    parte("causas do NPS", listNpsRootCauses),
    parte("preferências", getPreferences),
    parte("filtros", listSavedFilters),
    parte("google", listarAvaliacoesGoogle),
  ]);

  return { workspace, casos, nps, causasDoNps, preferencias, filtros, google };
}

export type CargaInicial = Awaited<ReturnType<typeof cargaInicial>>;
