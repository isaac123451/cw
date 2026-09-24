import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { getPrisma } from "@/lib/prisma";
import {
  avisosDaConversa,
  dadosDaConversa,
  humorDoCabecalho,
  indiceDosRelatos,
  oQueCompletar,
} from "@/lib/services/sinaisDaConversa";
import { nomeDeContato } from "@/lib/models/case";

/**
 * POST /api/extensao/sinais
 *
 * O que só a conversa aberta dá: o humor que piorou, a mensagem que é a
 * mesma de uma reclamação do Reclame Aqui e, com o caso do contato, o
 * e-mail, telefone ou documento que o cliente escreveu e o cadastro não
 * tem. Sem IA e sem gravar nada — o painel chama uma vez por contato,
 * depois de desenhar, e só grava se a pessoa clicar em Completar.
 */

const MAXIMO_MENSAGENS = 60;
const MAXIMO_CARACTERES = 2000;

interface Corpo {
  mensagens?: { de?: string; texto?: string }[];
  /** O caso aberto mais recente do contato, se houver. */
  protocolo?: string;
  /** O número do contato na página (WhatsApp). */
  telefone?: string;
  /** O nome do contato como o WhatsApp mostra — completa a reclamação que chegou sem nome. */
  nome?: string;
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

  /* O que dá para completar — só para quem pode gravar, e só o que falta. */
  let completar: { protocolo: string; campos: ReturnType<typeof oQueCompletar> } | null = null;

  const protocolo = typeof corpo.protocolo === "string" ? corpo.protocolo.trim().slice(0, 40) : "";
  const prisma = getPrisma();

  if (protocolo && prisma && usuario && usuario.papel !== "LEITURA") {
    const caso = await prisma.case
      .findUnique({ where: { protocol: protocolo }, select: { protocol: true, email: true, phone: true, document: true, customer: true } })
      .catch(() => null);
    if (caso) {
      const nome = nomeDeContato(corpo.nome);
      const campos = oQueCompletar(caso, { ...dadosDaConversa(mensagens, corpo.telefone), ...(nome ? { nome } : {}) });
      if (campos.length > 0) completar = { protocolo: caso.protocol, campos };
    }
  }

  return responder(request, {
    avisos: avisosDaConversa(mensagens, indice),
    completar,
    humor: humorDoCabecalho(mensagens),
  });
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
