import type { PedacoDaConversa, PedidoDeIA, RespostaDeIA, Turno } from "@/lib/services/ia.service";

/**
 * Groq e OpenRouter — os dois gratuitos da cadeia (Fase 16).
 *
 * Os dois falam o mesmo formato (o de chat completions que virou padrão),
 * então um adaptador serve aos dois; o que muda é o endereço, a chave e o
 * modelo. Chamada por HTTP, sem SDK, como o Gemini.
 *
 * **Modelo.** Os nomes gratuitos mudam com o tempo. O padrão abaixo é o
 * que existia quando isto foi escrito; quando um sai do ar (404), a lista
 * do próprio provedor dá o substituto — ver `substitutoDe`. Sem
 * substituto, a mensagem diz qual variável definir (`GROQ_MODELO`,
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
    /*
     * Os Llama 3.x saíram da conta (09/10/2026: 404 "model_not_found" no
     * 3.3 70B, que a documentação ainda citava). O que /models lista hoje
     * para conversa: gpt-oss-120b, gpt-oss-20b e qwen3.8-27b.
     */
    modelo: "openai/gpt-oss-120b",
    modeloRapido: "openai/gpt-oss-20b",
  },
  openrouter: {
    nome: "OpenRouter",
    base: "https://openrouter.ai/api/v1",
    variavelDaChave: "OPENROUTER_API_KEY",
    variavelDoModelo: "OPENROUTER_MODELO",
    /*
     * 09/10/2026: o meta-llama/llama-3.3-70b-instruct:free saiu do
     * OpenRouter. O roteador `openrouter/free` foi testado e descartado
     * como padrão: em 6 chamadas, 2 caíram num modelo de moderação que
     * responde "User Safety: safe". O Nemotron Super acertou 3 de 3 em ~3 s;
     * o Gemma 4 vai de reserva na própria chamada (RESERVAS_DO_OPENROUTER).
     */
    modelo: "nvidia/nemotron-3-super-120b-a12b:free",
    modeloRapido: "nvidia/nemotron-3-super-120b-a12b:free",
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
  const escolhido =
    doAmbiente(rapido ? `${d.variavelDoModelo}_RAPIDO` : d.variavelDoModelo) ||
    (rapido ? d.modeloRapido : d.modelo);
  return TROCADO.get(`${provedor}:${escolhido}`) ?? escolhido;
}

/**
 * Modelo que saiu do ar → o que a lista do próprio provedor oferece
 * (09/10/2026).
 *
 * Os gratuitos giram rápido: em três semanas o padrão do Groq e o do
 * OpenRouter deixaram de existir, e cada vez a IA parava até alguém trocar
 * uma variável. Agora o 404 de modelo consulta `/models` do provedor, pega
 * o primeiro que serve para conversa na ordem de preferência, refaz o
 * pedido e lembra a troca enquanto a instância viver. A variável continua
 * mandando: só é trocado o nome que o provedor disse que não existe.
 */
const TROCADO = new Map<string, string>();

/**
 * O OpenRouter aceita uma lista de modelos na mesma chamada e passa ao
 * seguinte quando um está em limite (429) ou fora do ar — o gratuito vive
 * em limite. Só gratuitos: modelo pago gastaria crédito da conta.
 */
const RESERVAS_DO_OPENROUTER = ["nvidia/nemotron-3-super-120b-a12b:free", "google/gemma-4-31b-it:free"];

function comReservas(provedor: ProvedorCompativel, nome: string) {
  if (provedor !== "openrouter" || !nome.endsWith(":free")) return {};
  return { models: [nome, ...RESERVAS_DO_OPENROUTER.filter((m) => m !== nome)] };
}

const PREFERENCIA: Record<ProvedorCompativel, RegExp[]> = {
  groq: [/gpt-oss-120b$/, /qwen/, /llama.*70b/, /gpt-oss-20b$/, /llama/],
  openrouter: [/nemotron-3-super/, /gemma-4-31b/, /gpt-oss-120b:free$/, /:free$/],
};

/** Transcrição, voz e filtros de moderação também aparecem em /models — não conversam. */
const NAO_CONVERSA = /whisper|guard|orpheus|tts|allam|embed|safety/i;

export function escolherSubstituto(provedor: ProvedorCompativel, ids: string[], quebrado: string) {
  const candidatos = ids.filter((id) => id !== quebrado && !NAO_CONVERSA.test(id));
  for (const preferido of PREFERENCIA[provedor]) {
    const achado = candidatos.find((id) => preferido.test(id));
    if (achado) return achado;
  }
  return null;
}

async function substitutoDe(provedor: ProvedorCompativel, quebrado: string) {
  try {
    const r = await fetch(`${base(provedor)}/models`, { headers: cabecalhos(provedor), signal: AbortSignal.timeout(5_000) });
    if (!r.ok) return null;
    const lista = ((await r.json()) as { data?: { id: string; active?: boolean }[] }).data ?? [];
    const novo = escolherSubstituto(provedor, lista.filter((m) => m.active !== false).map((m) => m.id), quebrado);
    if (novo) TROCADO.set(`${provedor}:${quebrado}`, novo);
    return novo;
  } catch {
    return null;
  }
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

  let modelo = modeloCompativel(provedor, pedido.rapido === true);

  const sistema = [
    pedido.sistema,
    "",
    "Responda somente com um objeto JSON, sem texto antes ou depois, que siga este JSON Schema:",
    JSON.stringify(pedido.esquema),
  ].join("\n");

  const pedir = (nome: string) =>
    fetch(`${base(provedor)}/chat/completions`, {
      method: "POST",
      headers: cabecalhos(provedor),
      body: JSON.stringify({
        model: nome,
        ...comReservas(provedor, nome),
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sistema },
          { role: "user", content: pedido.prompt },
        ],
      }),
      signal: AbortSignal.timeout(prazoMs),
    });

  let resposta: Response;
  try {
    resposta = await pedir(modelo);
    if (resposta.status === 404) {
      const novo = await substitutoDe(provedor, modelo);
      if (novo) {
        modelo = novo;
        resposta = await pedir(novo);
      }
    }
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
    /** Quem respondeu de fato — no OpenRouter pode ser a reserva. */
    model?: string;
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  } | null;

  if (corpo?.model) modelo = corpo.model;
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

  let modelo = modeloCompativel(provedor, false);

  const abrir = (nome: string) =>
    fetch(`${base(provedor)}/chat/completions`, {
      method: "POST",
      headers: cabecalhos(provedor),
      body: JSON.stringify({
        model: nome,
        ...comReservas(provedor, nome),
        stream: true,
        stream_options: { include_usage: true },
        messages: [
          { role: "system", content: pedido.sistema },
          ...pedido.turnos.map((t) => ({ role: t.role, content: t.content })),
        ],
      }),
      signal: AbortSignal.timeout(prazoMs * 4),
    });

  let resposta: Response;
  try {
    resposta = await abrir(modelo);
    if (resposta.status === 404) {
      const novo = await substitutoDe(provedor, modelo);
      if (novo) {
        modelo = novo;
        resposta = await abrir(novo);
      }
    }
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
