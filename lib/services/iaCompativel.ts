import type { PedacoDaConversa, PedidoDeIA, RespostaDeIA, Turno } from "@/lib/services/ia.service";

/**
 * Groq e OpenRouter — os dois gratuitos da cadeia (Fase 16).
 *
 * Os dois falam o mesmo formato (o de chat completions que virou padrão),
 * então um adaptador serve aos dois; o que muda é o endereço, a chave e o
 * modelo. Chamada por HTTP, sem SDK, como o Gemini.
 *
 * **Modelo.** Os nomes gratuitos mudam com o tempo. O padrão abaixo é o
 * que existia quando isto foi escrito; quando um sair do ar, o provedor
 * responde 404 e a mensagem diz qual variável definir (`GROQ_MODELO`,
 * `OPENROUTER_MODELO`) — sem deploy.
 *
 * **Formato.** Pede JSON (`response_format`) e manda o JSON Schema na
 * instrução. Mesmo assim confere: resposta sem um campo obrigatório é
 * tratada como falha do provedor, e a cadeia passa para o próximo —
 * entregar meio resumo seria pior que tentar outro.
 */

export type ProvedorCompativel = "groq" | "openrouter";

function doAmbiente(nome: string) {
  const valor = (process.env[nome] ?? "").trim();
  return valor === "" || valor.endsWith("...") ? "" : valor;
}

const DESTINO: Record<
  ProvedorCompativel,
  { nome: string; base: string; variavelDaChave: string; variavelDoModelo: string; modelo: string; modeloRapido: string }
> = {
  groq: {
    nome: "Groq",
    base: "https://api.groq.com/openai/v1",
    variavelDaChave: "GROQ_API_KEY",
    variavelDoModelo: "GROQ_MODELO",
    modelo: "llama-3.3-70b-versatile",
    modeloRapido: "llama-3.1-8b-instant",
  },
  openrouter: {
    nome: "OpenRouter",
    base: "https://openrouter.ai/api/v1",
    variavelDaChave: "OPENROUTER_API_KEY",
    variavelDoModelo: "OPENROUTER_MODELO",
    modelo: "meta-llama/llama-3.3-70b-instruct:free",
    modeloRapido: "meta-llama/llama-3.3-70b-instruct:free",
  },
};

export function temChaveCompativel(provedor: ProvedorCompativel) {
  return doAmbiente(DESTINO[provedor].variavelDaChave) !== "";
}

/** O endereço pode ser trocado por variável — é o que o check usa para não gastar cota. */
function base(provedor: ProvedorCompativel) {
  const variavel = provedor === "groq" ? "GROQ_BASE_URL" : "OPENROUTER_BASE_URL";
  return (doAmbiente(variavel) || DESTINO[provedor].base).replace(/\/$/, "");
}

export function modeloCompativel(provedor: ProvedorCompativel, rapido: boolean) {
  const d = DESTINO[provedor];
  return (
    doAmbiente(rapido ? `${d.variavelDoModelo}_RAPIDO` : d.variavelDoModelo) ||
    (rapido ? d.modeloRapido : d.modelo)
  );
}

function cabecalhos(provedor: ProvedorCompativel) {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${doAmbiente(DESTINO[provedor].variavelDaChave)}`,
  };
  /* O OpenRouter pede que o app se identifique; não muda a resposta. */
  if (provedor === "openrouter") h["X-Title"] = "CW Reputacao";
  return h;
}

/** O que o provedor respondeu, em português e com a saída certa. */
function falha(provedor: ProvedorCompativel, modelo: string, status: number, detalhe: string): RespostaDeIA {
  const d = DESTINO[provedor];

  if (status === 401 || status === 403) {
    return { provedor, modelo, status: 502, erro: `O ${d.nome} recusou a chave. Confira ${d.variavelDaChave}.` };
  }
  if (status === 404) {
    return {
      provedor,
      modelo,
      status: 502,
      erro: `O modelo ${modelo} não existe mais no ${d.nome}. Defina outro em ${d.variavelDoModelo}.`,
    };
  }
  if (status === 429) {
    return { provedor, modelo, status: 503, erro: `A cota gratuita do ${d.nome} acabou por agora. Tente de novo em alguns minutos.` };
  }
  if (status >= 500) {
    return { provedor, modelo, status: 503, erro: `O ${d.nome} está congestionado neste momento.` };
  }
  return {
    provedor,
    modelo,
    status: 502,
    erro: `O ${d.nome} não aceitou o pedido (${status}). ${detalhe.slice(0, 160)}`.trim(),
  };
}

/** Tira o JSON de dentro de cercas ```json, que alguns modelos gratuitos insistem em mandar. */
export function lerJsonDaResposta(texto: string): Record<string, unknown> | null {
  const limpo = texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const inicio = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  if (inicio < 0 || fim <= inicio) return null;
  try {
    const valor = JSON.parse(limpo.slice(inicio, fim + 1));
    return valor && typeof valor === "object" && !Array.isArray(valor) ? (valor as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Os campos obrigatórios do esquema que não vieram. */
export function faltandoNoEsquema(dados: Record<string, unknown>, esquema: Record<string, unknown>) {
  const obrigatorios = Array.isArray(esquema.required) ? (esquema.required as string[]) : [];
  return obrigatorios.filter((campo) => dados[campo] === undefined || dados[campo] === null);
}

export async function pelaApiCompativel(
  provedor: ProvedorCompativel,
  pedido: PedidoDeIA,
  prazoMs: number
): Promise<RespostaDeIA> {

  const modelo = modeloCompativel(provedor, pedido.rapido === true);

  const sistema = [
    pedido.sistema,
    "",
    "Responda somente com um objeto JSON, sem texto antes ou depois, que siga este JSON Schema:",
    JSON.stringify(pedido.esquema),
  ].join("\n");

  let resposta: Response;
  try {
    resposta = await fetch(`${base(provedor)}/chat/completions`, {
      method: "POST",
      headers: cabecalhos(provedor),
      body: JSON.stringify({
        model: modelo,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sistema },
          { role: "user", content: pedido.prompt },
        ],
      }),
      signal: AbortSignal.timeout(prazoMs),
    });
  } catch {
    return {
      provedor,
      modelo,
      status: 503,
      erro: `O ${DESTINO[provedor].nome} não respondeu em ${Math.round(prazoMs / 1000)} s.`,
    };
  }

  if (!resposta.ok) {
    return falha(provedor, modelo, resposta.status, await resposta.text().catch(() => ""));
  }

  const corpo = (await resposta.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  } | null;

  const texto = corpo?.choices?.[0]?.message?.content ?? "";
  const dados = lerJsonDaResposta(texto);

  if (!dados) {
    return { provedor, modelo, status: 502, erro: `O ${DESTINO[provedor].nome} respondeu fora do formato combinado.` };
  }

  const faltam = faltandoNoEsquema(dados, pedido.esquema);
  if (faltam.length > 0) {
    return {
      provedor,
      modelo,
      status: 502,
      erro: `O ${DESTINO[provedor].nome} respondeu sem ${faltam.join(", ")}.`,
    };
  }

  return {
    provedor,
    modelo,
    dados,
    uso: { entrada: corpo?.usage?.prompt_tokens ?? 0, saida: corpo?.usage?.completion_tokens ?? 0 },
  };
}

/**
 * O assistente em fluxo, no mesmo formato: cada linha `data:` traz um
 * pedaço do texto, e `[DONE]` fecha.
 */
export async function* conversarCompativel(
  provedor: ProvedorCompativel,
  pedido: { sistema: string; turnos: Turno[] },
  prazoMs: number
): AsyncGenerator<PedacoDaConversa> {

  const modelo = modeloCompativel(provedor, false);

  let resposta: Response;
  try {
    resposta = await fetch(`${base(provedor)}/chat/completions`, {
      method: "POST",
      headers: cabecalhos(provedor),
      body: JSON.stringify({
        model: modelo,
        stream: true,
        stream_options: { include_usage: true },
        messages: [
          { role: "system", content: pedido.sistema },
          ...pedido.turnos.map((t) => ({ role: t.role, content: t.content })),
        ],
      }),
      signal: AbortSignal.timeout(prazoMs * 4),
    });
  } catch {
    yield { tipo: "erro", mensagem: `O ${DESTINO[provedor].nome} não respondeu.` };
    return;
  }

  if (!resposta.ok || !resposta.body) {
    const f = falha(provedor, modelo, resposta.status, await resposta.text().catch(() => ""));
    yield { tipo: "erro", mensagem: f.erro ?? "Falha no provedor." };
    return;
  }

  const leitor = resposta.body.getReader();
  const decodificador = new TextDecoder();
  let sobra = "";
  const uso = { entrada: 0, saida: 0 };

  while (true) {
    const { value, done } = await leitor.read();
    if (done) break;
    sobra += decodificador.decode(value, { stream: true });
    const linhas = sobra.split("\n");
    sobra = linhas.pop() ?? "";
    for (const linha of linhas) {
      const dado = linha.trim();
      if (!dado.startsWith("data:")) continue;
      const conteudo = dado.slice(5).trim();
      if (conteudo === "[DONE]") continue;
      try {
        const pedaco = JSON.parse(conteudo) as {
          choices?: { delta?: { content?: string } }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const texto = pedaco.choices?.[0]?.delta?.content;
        if (texto) yield { tipo: "delta", texto };
        if (pedaco.usage) {
          uso.entrada = pedaco.usage.prompt_tokens ?? uso.entrada;
          uso.saida = pedaco.usage.completion_tokens ?? uso.saida;
        }
      } catch {
        /* Linha de manutenção (comentário do OpenRouter) — segue. */
      }
    }
  }

  yield { tipo: "fim", uso };
}
