import { revalidateTag } from "next/cache";

import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { WORKSPACE_TAG } from "@/lib/actions/tags";
import { getPrisma } from "@/lib/prisma";
import { loadWorkspace } from "@/lib/actions/workspace";

import {
  fetchCaseByProtocol,
  persistCase,
} from "@/lib/services/case.repository";
import {
  etapaVizinha,
  moverPara,
} from "@/lib/services/case.service";
import { REFERENCE_DATE } from "@/lib/services/reputation.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Avança ou volta um caso uma etapa do quadro.
 *
 * É a ação que faltava para a extensão servir durante o atendimento:
 * quem acabou de responder o consumidor está no WhatsApp ou no portal,
 * e mover o cartão exigia abrir o Kanban noutra aba. Etapa que só muda
 * quando alguém lembra de abrir o quadro é etapa que fica velha.
 *
 * **Quem decide a próxima etapa é o servidor, não a extensão.** A ordem
 * das colunas é cadastro (`WorkflowStatus.order`), muda na tela de
 * configurações, e uma extensão instalada há três semanas teria uma
 * cópia velha dela. A extensão manda a direção; o servidor resolve.
 *
 * **Não circula.** Na ponta a resposta é um aviso, não um salto: um
 * caso em "Novo" que "voltasse" para a última coluna seria a forma mais
 * rápida de dar baixa sem querer numa reclamação que ninguém atendeu.
 */

interface Entrada {
  /** Protocolo do caso — `RA-101491955`, `WA-...`. */
  protocolo?: string;
  direcao?: string;
}

export async function POST(request: Request) {

  const { usuario, demonstracao } =
    await autenticar(request);

  if (!usuario && !demonstracao) {
    return semSessao(request);
  }

  if (usuario && usuario.papel === "LEITURA") {
    return responder(
      request,
      {
        erro: "Seu acesso é somente leitura — não dá para mover o caso.",
      },
      403
    );
  }

  const prisma = getPrisma();

  if (!prisma) {
    return responder(
      request,
      { erro: "Sem banco configurado — não há onde gravar." },
      503
    );
  }

  let entrada: Entrada;

  try {
    entrada = (await request.json()) as Entrada;
  } catch {
    return responder(
      request,
      { erro: "Corpo inválido." },
      400
    );
  }

  const protocolo = (entrada.protocolo ?? "").trim();

  const direcao =
    entrada.direcao === "voltar" ? "voltar" : "avancar";

  if (!protocolo) {
    return responder(
      request,
      { erro: "Faltou o protocolo do caso." },
      400
    );
  }

  const caso = await fetchCaseByProtocol(
    prisma,
    protocolo
  );

  if (!caso) {
    return responder(
      request,
      { erro: `Não achei o caso ${protocolo}.` },
      404
    );
  }

  const workspace = await loadWorkspace();

  /**
   * Só as etapas ativas entram na fila.
   *
   * Etapa desativada continua existindo para os casos que já estão nela
   * — desativar não é apagar —, mas ninguém deve ser **movido para**
   * ela. Incluí-la faria "avançar" empurrar o caso para uma coluna que
   * nem aparece no quadro.
   */
  const etapas = workspace.workflow
    .filter((item) => item.active)
    .sort((a, b) => a.order - b.order)
    .map((item) => item.name);

  const alvo = etapaVizinha(etapas, caso.status, direcao);

  if (!alvo) {

    /**
     * Duas razões diferentes, e o aviso precisa dizer qual: estar na
     * ponta é normal, ter um status fora do quadro é sintoma — acontece
     * com caso importado cujo status nunca foi cadastrado como etapa.
     */
    const foraDoQuadro = !etapas.includes(caso.status);

    return responder(request, {
      movido: false,
      protocolo,
      status: caso.status,
      aviso: foraDoQuadro
        ? `"${caso.status}" não é uma etapa ativa do quadro, então não dá para saber qual é a seguinte.`
        : direcao === "avancar"
          ? `${protocolo} já está na última etapa ("${caso.status}").`
          : `${protocolo} já está na primeira etapa ("${caso.status}").`,
    });
  }

  const movido = moverPara(caso, alvo, REFERENCE_DATE);

  // Mover não mexe em etiqueta: uma ida ao banco em vez de três.
  await persistCase(prisma, movido, { syncTags: false });

  revalidateTag(WORKSPACE_TAG, "max");

  const host = new URL(request.url).origin;

  return responder(request, {
    movido: true,
    protocolo,
    de: caso.status,
    status: alvo,

    /**
     * A avaliação some ao voltar de "Resolvido"/"Não resolvido" — é
     * regra de `moverPara`, e a extensão precisa dizer isso na tela:
     * apagar uma nota sem avisar é a definição de efeito colateral.
     */
    notaRemovida:
      Boolean(caso.score) && movido.score === undefined,

    url: `${host}/reclame-aqui/${movido.id}`,
  });
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
