import { unstable_cache } from "next/cache";

import { CASES_TAG } from "@/lib/actions/tags";
import { getPrisma } from "@/lib/prisma";
import { criarIndice, parecidos, type Exemplo, type Indice } from "@/lib/models/sugestaoPorTexto";
import { tendenciaDoHumor, type MensagemDaConversa } from "@/lib/services/motorProprio";

/**
 * Os avisos que só a conversa dá (Fase 17).
 *
 * O painel já avisa prazo, risco e reincidência com o que a consulta traz.
 * Dois avisos pedem o texto da conversa: o humor que piorou nas últimas
 * mensagens, e a mensagem que é (quase) a mesma de uma reclamação do
 * Reclame Aqui — o cliente colou o relato no WhatsApp, e quem atende
 * precisa saber que está falando do RA-x antes de responder.
 *
 * Os dois saem sem IA: o léxico do motor próprio e o índice TF-IDF da
 * sugestão de assunto.
 */

export interface AvisoDaConversa {
  tom: "perigo" | "atencao" | "neutro";
  texto: string;
}

/** A partir daqui é a mesma reclamação colada; abaixo, só parecida. */
export const IGUAL = 0.85;
/** Abaixo disso o parecido é assunto comum, não a mesma história. */
export const PARECIDA = 0.55;
/** Texto curto demais casa com qualquer coisa. */
const MINIMO_DE_CARACTERES = 80;

export function avisosDaConversa(mensagens: MensagemDaConversa[], indice: Indice | null): AvisoDaConversa[] {

  const avisos: AvisoDaConversa[] = [];

  const humor = tendenciaDoHumor(mensagens);
  if (humor?.piorou) {
    avisos.push({ tom: "perigo", texto: "O humor piorou nas últimas mensagens" });
  } else if (humor?.melhorou) {
    avisos.push({ tom: "neutro", texto: "O humor melhorou nas últimas mensagens" });
  }

  const doCliente = mensagens
    .filter((m) => m.de === "cliente")
    .map((m) => m.texto)
    .join("\n");

  if (indice && doCliente.length >= MINIMO_DE_CARACTERES) {
    const [melhor] = parecidos(indice, doCliente, 1);
    if (melhor && melhor.semelhanca >= PARECIDA && melhor.referencia) {
      const pct = Math.round(melhor.semelhanca * 100);
      avisos.push(
        melhor.semelhanca >= IGUAL
          ? { tom: "atencao", texto: `A mensagem é a mesma da reclamação ${melhor.referencia} (${pct}%)` }
          : { tom: "neutro", texto: `Parecida com a reclamação ${melhor.referencia} (${pct}%)` }
      );
    }
  }

  return avisos;
}

/**
 * Os relatos do Reclame Aqui, com e sem categoria — aqui importa o
 * texto, não o assunto. Cacheado por etiqueta de caso: mexer num caso
 * invalida, e abrir conversas em sequência não refaz o índice.
 */
const relatosCacheados = unstable_cache(
  async (): Promise<Exemplo[]> => {
    const prisma = getPrisma();
    if (!prisma) return [];
    const linhas = await prisma.case.findMany({
      where: { channel: "RECLAME_AQUI" },
      select: { id: true, protocol: true, title: true, description: true },
      orderBy: { createdAt: "desc" },
      take: 2000,
    });
    return linhas
      .filter((l) => (l.description ?? "").trim().length > 0)
      .map((l) => ({ id: l.id, referencia: l.protocol, texto: `${l.title}\n${l.description}`, rotulo: "" }));
  },
  ["sinais-conversa-relatos"],
  { tags: [CASES_TAG], revalidate: 300 }
);

let indiceGuardado: { chave: string; indice: Indice } | null = null;

export async function indiceDosRelatos(): Promise<Indice | null> {
  const relatos = await relatosCacheados();
  if (relatos.length === 0) return null;
  const chave = `${relatos.length}:${relatos[0]?.id}`;
  if (indiceGuardado?.chave !== chave) indiceGuardado = { chave, indice: criarIndice(relatos) };
  return indiceGuardado.indice;
}
