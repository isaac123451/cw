import { cadeiaDeProvedores, pedirEstruturado, pedirSoA, type ProvedorExterno } from "@/lib/services/ia.service";

/**
 * A mesma pergunta para cada IA, e a melhor ideia (09/10/2026).
 *
 * "Comparação de melhor ideia com base nas respostas de cada modelo." Cada
 * provedor com chave responde sozinho (fora da cadeia de reserva), com o
 * mesmo contexto do assistente. Depois um juiz — a primeira IA da cadeia —
 * lê as respostas lado a lado e diz qual é a melhor e por quê, e escreve a
 * síntese: o que cada uma tem de certo, sem o que contradiz o retrato.
 */

export interface RespostaDeModelo {
  provedor: ProvedorExterno;
  nome: string;
  modelo?: string;
  ms: number;
  texto?: string;
  erro?: string;
}

export interface Comparacao {
  respostas: RespostaDeModelo[];
  melhor: { provedor: ProvedorExterno | null; porque: string; sintese: string };
}

const NOME: Record<ProvedorExterno, string> = { anthropic: "Anthropic", gemini: "Gemini", groq: "Groq", openrouter: "OpenRouter" };

/*
  O plano gratuito de Groq e OpenRouter não aceita o contexto inteiro do
  assistente (medido em 21/10/2026: Groq 413 "Request too large … tokens
  per minute", OpenRouter 402). Para elas vai o começo do contexto — as
  regras e o retrato —, cortado num tamanho que cabe.
*/
const LIMITE_DO_PLANO_GRATUITO: Partial<Record<ProvedorExterno, number>> = { groq: 16_000, openrouter: 16_000 };

function sistemaPara(provedor: ProvedorExterno, sistema: string) {
  const limite = LIMITE_DO_PLANO_GRATUITO[provedor];
  if (!limite || sistema.length <= limite) return sistema;
  return `${sistema.slice(0, limite)}

[O contexto foi cortado aqui para caber no plano gratuito desta IA. Responda só com o que está acima.]`;
}

/** O erro do provedor em uma frase — sem o JSON cru nem o id da conta. */
export function erroLegivel(erro: string) {
  if (/413|too large|tokens per m/i.test(erro)) return "Contexto grande demais para o plano gratuito.";
  if (/402|credit/i.test(erro)) return "A conta não tem crédito para este pedido.";
  if (/429|rate limit|quota/i.test(erro)) return "No limite de pedidos agora.";
  if (/sem chave/i.test(erro)) return "Sem chave configurada.";
  if (/timeout|abort|tempo/i.test(erro)) return "Demorou demais para responder.";
  return "Não respondeu agora.";
}

export async function compararModelos(
  sistema: string,
  turnos: { role: "user" | "assistant"; content: string }[]
): Promise<Comparacao> {
  const pergunta = [...turnos].reverse().find((t) => t.role === "user")?.content ?? "";
  const conversa = turnos
    .slice(-6)
    .map((t) => `${t.role === "user" ? "Pessoa" : "Assistente"}: ${t.content}`)
    .join("\n\n");
  const provedores = cadeiaDeProvedores();

  const respostas = await Promise.all(
    provedores.map(async (provedor): Promise<RespostaDeModelo> => {
      const inicio = Date.now();
      const r = await pedirSoA(provedor, {
        sistema: sistemaPara(provedor, sistema),
        prompt: `${conversa}\n\nResponda à última pergunta da Pessoa, seguindo as regras do sistema. Escreva a resposta completa no campo "resposta" (pode usar listas e negrito em Markdown).`,
        esquema: { type: "object", properties: { resposta: { type: "string" } }, required: ["resposta"] },
      }).catch((erro) => ({ provedor, erro: String((erro as Error)?.message ?? erro) }) as { provedor: ProvedorExterno; erro: string; dados?: undefined; modelo?: undefined });
      const texto = String((r as { dados?: { resposta?: unknown } }).dados?.resposta ?? "").trim();
      return {
        provedor,
        nome: NOME[provedor],
        modelo: (r as { modelo?: string }).modelo,
        ms: Date.now() - inicio,
        ...(texto ? { texto } : { erro: (r as { erro?: string }).erro ? erroLegivel((r as { erro?: string }).erro!) : "Não respondeu no formato." }),
      };
    })
  );

  const boas = respostas.filter((r) => r.texto);
  if (boas.length === 0) {
    return { respostas, melhor: { provedor: null, porque: "Nenhuma IA respondeu agora.", sintese: "" } };
  }
  if (boas.length === 1) {
    return { respostas, melhor: { provedor: boas[0].provedor, porque: `Só o ${boas[0].nome} respondeu — as outras falharam ou não têm chave.`, sintese: boas[0].texto! } };
  }

  const letra = (i: number) => String.fromCharCode(65 + i);
  const juiz = await pedirEstruturado({
    sistema: `${sistema}\n\n--- SEU PAPEL AGORA ---\nVocê é o juiz. Várias IAs responderam à mesma pergunta com o contexto acima. Compare com rigor: vale mais a resposta que usa os números e as conversas do contexto sem inventar, segue a documentação, é acionável e direta. Penalize número que não está no contexto, regra inventada, resposta genérica e ordem de atendimento diferente da PRIORIDADE DE RESPOSTA calculada no contexto.`,
    prompt: [
      `Pergunta: ${pergunta}`,
      "",
      ...boas.map((r, i) => `--- Resposta ${letra(i)} (${r.nome}) ---\n${r.texto!.slice(0, 4000)}`),
      "",
      `Diga qual é a melhor (${boas.map((_, i) => letra(i)).join(", ")}), por quê em uma ou duas frases, e escreva a síntese: a melhor resposta final, juntando o que estiver certo nas outras e tirando o que contradiz o contexto. A síntese é o que a pessoa vai ler — completa, em português do Brasil, em Markdown.`,
    ].join("\n"),
    esquema: {
      type: "object",
      properties: {
        melhor: { type: "string", enum: boas.map((_, i) => letra(i)) },
        porque: { type: "string" },
        sintese: { type: "string" },
      },
      required: ["melhor", "porque", "sintese"],
    },
  }).catch(() => null);

  const escolhida = juiz?.dados ? boas[String(juiz.dados.melhor ?? "A").charCodeAt(0) - 65] : undefined;
  if (!juiz || juiz.erro || !escolhida) {
    /* Sem juiz: a primeira da cadeia (a escolhida em Configurações) fica como a melhor, dito com franqueza. */
    return { respostas, melhor: { provedor: boas[0].provedor, porque: "O juiz não respondeu agora; fica a resposta da IA preferida.", sintese: boas[0].texto! } };
  }
  return {
    respostas,
    melhor: {
      provedor: escolhida.provedor,
      porque: String(juiz.dados?.porque ?? "").trim(),
      sintese: String(juiz.dados?.sintese ?? "").trim() || escolhida.texto!,
    },
  };
}
