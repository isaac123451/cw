import "server-only";

import { getApiCases } from "@/lib/api/source";
import { getSession } from "@/lib/auth/session";
import { getPrisma } from "@/lib/prisma";
import { ASSISTANT_SYSTEM } from "@/lib/services/assistant.context";
import { dadosParaMedir, escolherMedicoes, medir } from "@/lib/services/assistant.agent";
import { trechosParaAPergunta, trechosParaOPrompt } from "@/lib/services/documentacao.service";
import { COMO_USAR_A_MEMORIA, memoriaDoAssistente } from "@/lib/services/memoriaDoAssistente.service";

/**
 * A instrução de sistema do assistente da plataforma, montada para a
 * pergunta: o retrato da operação (vindo da tela), as medições pedidas, a
 * documentação do time e a memória (conversas, combinados, Slack). Sai da
 * rota em 09/10/2026 para servir também à comparação entre modelos — as
 * duas leem exatamente o mesmo contexto.
 */
export async function montarSistemaDoAssistente(
  messages: { role: "user" | "assistant"; content: string }[],
  snapshot: string
): Promise<string> {
  /**
   * O agente: o modelo escolhe o que medir, o servidor mede.
   *
   * O retrato abaixo é fixo — foi montado antes de a pergunta existir.
   * Serve para o que ele cobre e não serve para o resto: se o número
   * que a pergunta pede não estiver ali, o modelo dizia que não sabia
   * ou, pior, arredondava a partir do que tinha.
   *
   * Aqui uma chamada curta pergunta **quais medições** a pergunta
   * precisa, entre as do catálogo. As escolhidas rodam contra o
   * Postgres, pelas mesmas funções que as telas usam. O que chega ao
   * modelo são números conferíveis, e a resposta dele é escrita só com
   * eles.
   *
   * **Falha em silêncio.** Se a escolha não vier — modelo fora do ar,
   * pergunta que não é sobre a operação —, a conversa segue com o
   * retrato de sempre. É enriquecimento, não dependência.
   */
  let medicoes = "";

  try {

    const pergunta =
      [...messages]
        .reverse()
        .find((m) => m.role === "user")?.content ?? "";

    const escolhas = await escolherMedicoes(pergunta);

    if (escolhas.length > 0) {

      const prisma = getPrisma();

      if (prisma) {
        medicoes = medir(
          await dadosParaMedir(
            prisma,
            await getApiCases("all")
          ),
          escolhas
        );
      }
    }

  } catch (erro) {
    console.error("[assistente] medições", erro);
  }

  /**
   * A documentação, procurada antes de responder (Fase 9.1).
   *
   * O assistente sabia os números da operação e não sabia as regras
   * dela. Perguntado "qual o prazo de uma urgente?", respondia pelo que
   * parece razoável — e o que parece razoável é justamente o que a
   * documentação existe para substituir.
   *
   * As seções que casam com a pergunta vão **literalmente** para a
   * instrução, com título e endereço. Não há resumo pelo caminho: o
   * modelo lê o texto do documento. Nada casou? Nada vai — e a
   * instrução manda dizer que a documentação não cobre aquilo.
   */
  let documentacao = "";

  try {
    const prisma = getPrisma();

    if (prisma) {
      const pergunta =
        [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

      const trechos = await trechosParaAPergunta(prisma, pergunta);

      if (trechos.length > 0) documentacao = trechosParaOPrompt(trechos);
    }
  } catch (erro) {
    console.error("[assistente] documentação", erro);
  }

  /*
    A memória (09/10/2026): as conversas guardadas, os combinados em aberto,
    o Slack e o que a IA já fez. "Verifique minhas últimas mensagens" era
    respondido com "não possuo acesso ao histórico" — e a plataforma tinha
    as mensagens. Falha em silêncio, como as medições.
  */
  let memoria = "";

  try {
    const prisma = getPrisma();
    const sessao = await getSession();
    if (prisma) {
      const pergunta = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
      memoria = await memoriaDoAssistente(prisma, { userId: sessao?.id ?? null, pergunta });
    }
  } catch (erro) {
    console.error("[assistente] memória", erro);
  }

  /*
    O retrato da operação entra na instrução de sistema.

    Antes era o primeiro turno da conversa, para aproveitar o cache de
    prompt entre perguntas. No sistema ele continua sendo o trecho
    estável que o cache marca — e é a única forma que os dois provedores
    tratam do mesmo jeito.
  */
  const sistema = `${ASSISTANT_SYSTEM}
${memoria ? `
${COMO_USAR_A_MEMORIA}
` : ""}
--- RETRATO DA OPERAÇÃO ---
${snapshot}${memoria ? `

--- SUAS CONVERSAS E COMBINADOS ---
${memoria}` : ""}${
    medicoes
      ? `

--- MEDIÇÕES PEDIDAS PARA ESTA PERGUNTA ---
Estes números foram calculados agora, no banco, pelas mesmas funções
das telas. Use-os literalmente e cite o nome da medição quando fizer
sentido. Não recalcule nem arredonde.

${medicoes}`
      : ""
  }${
    documentacao
      ? `

--- A DOCUMENTAÇÃO DO TIME, SOBRE ESTA PERGUNTA ---
Estes são trechos literais dos documentos guardados na plataforma.
Quando a resposta vier de uma regra, ela sai daqui: cite a seção pelo
nome ("Atendimento no Reclame Aqui → 2. Prazos e Classificação de
Criticidade") e, se ajudar, o endereço entre parênteses. Não complete
nem generalize uma regra que não esteja escrita abaixo — se o trecho
não responde, diga o que ele cobre e o que ficou de fora.

${documentacao}`
      : `

--- A DOCUMENTAÇÃO DO TIME ---
Nenhuma seção dos documentos guardados casou com esta pergunta. Então
não há regra documentada para citar: se a pergunta for sobre "o que o
processo manda fazer", diga que a documentação da plataforma não cobre
isso e sugira procurar em Documentação. Nunca invente uma regra, um
prazo ou um limite.`
  }`;


  return sistema;
}
