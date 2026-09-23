import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { avisosDaConversa, indiceDosRelatos } from "@/lib/services/sinaisDaConversa";

/**
 * POST /api/extensao/sinais
 *
 * Os avisos que só a conversa aberta dá: o humor que piorou e a mensagem
 * que é a mesma de uma reclamação do Reclame Aqui. Sem IA e sem gravar
 * nada — o painel chama uma vez por contato, depois de desenhar.
 */

const MAXIMO_MENSAGENS = 60;
const MAXIMO_CARACTERES = 2000;

interface Corpo {
  mensagens?: { de?: string; texto?: string }[];
}

export async function POST(request: Request) {

  const { usuario, demonstracao } = await autenticar(request);

  if (!usuario && !demonstracao) return semSessao(request);

  let corpo: Corpo;
  try {
    corpo = (await request.json()) as Corpo;
  } catch {
    return responder(request, { erro: "Corpo inválido." }, 400);
  }

  const mensagens = (corpo.mensagens ?? [])
    .filter((m) => typeof m?.texto === "string" && m.texto.trim() !== "")
    .slice(-MAXIMO_MENSAGENS)
    .map((m) => ({
      de: m.de === "nos" ? ("nos" as const) : ("cliente" as const),
      texto: String(m.texto).trim().slice(0, MAXIMO_CARACTERES),
    }));

  /* Na demonstração não há base de relatos para comparar: só o humor. */
  const indice = demonstracao ? null : await indiceDosRelatos().catch(() => null);

  return responder(request, { avisos: avisosDaConversa(mensagens, indice) });
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
