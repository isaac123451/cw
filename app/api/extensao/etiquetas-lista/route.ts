import { unstable_cache } from "next/cache";

import { autenticar, responder, responderPreVoo, semSessao } from "@/lib/api/extensao";
import { CASES_TAG, WORKSPACE_TAG } from "@/lib/actions/tags";
import { chaveDoNome, chaveDoTelefone, DIAS_DO_NPS, etiquetasDasFichas, type FichaDoIndice } from "@/lib/models/etiquetasDaLista";
import { eFinalDasRedes } from "@/lib/models/redes";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TETO = 60;

/*
  O índice dos contatos que o CW conhece, com um minuto de cache: a lista
  do WhatsApp pergunta a cada poucos segundos, e o índice é o mesmo para
  todo mundo. Reclamações abertas, NPS dos últimos 180 dias e os números
  já confirmados no "É este".
*/
const indice = unstable_cache(
  async () => {
    const prisma = getPrisma();
    if (!prisma) return [] as { tel: string | null; nome: string | null; ficha: FichaDoIndice }[];
    const desde = new Date(Date.now() - DIAS_DO_NPS * 86_400_000);
    const [casos, nps, conhecidos] = await Promise.all([
      prisma.case.findMany({
        where: { evaluated: false, encerradoEm: null, status: { notIn: ["Resolvido", "Não resolvido"] } },
        select: { protocol: true, phone: true, customer: true, channel: true, priority: true, status: true, createdAt: true },
      }),
      prisma.npsResponse.findMany({
        where: { respondedAt: { gte: desde } },
        select: { id: true, phone: true, customerName: true, company: true, score: true, respondedAt: true },
      }),
      prisma.contatoConhecido.findMany({ select: { telefone: true, protocolo: true, npsResponseId: true } }),
    ]);
    const saida: { tel: string | null; nome: string | null; ficha: FichaDoIndice }[] = [];
    const porProtocolo = new Map<string, FichaDoIndice>();
    const porNps = new Map<string, FichaDoIndice>();
    for (const c of casos) {
      const social = c.channel !== "RECLAME_AQUI";
      if (social && eFinalDasRedes(c.status)) continue;
      const ficha: FichaDoIndice = { tipo: social ? "redes" : "ra", prioridade: c.priority, quando: c.createdAt.toISOString() };
      porProtocolo.set(c.protocol, ficha);
      saida.push({ tel: chaveDoTelefone(c.phone), nome: chaveDoNome(c.customer), ficha });
    }
    for (const r of nps) {
      const ficha: FichaDoIndice = { tipo: "nps", nota: r.score, quando: r.respondedAt.toISOString() };
      porNps.set(r.id, ficha);
      saida.push({ tel: chaveDoTelefone(r.phone), nome: chaveDoNome(r.customerName), ficha });
    }
    /* O número confirmado no "É este" liga a conversa à ficha mesmo sem telefone no cadastro. */
    for (const k of conhecidos) {
      const tel = chaveDoTelefone(k.telefone.length <= 11 ? `55${k.telefone}` : k.telefone);
      const ficha = (k.protocolo && porProtocolo.get(k.protocolo)) || (k.npsResponseId && porNps.get(k.npsResponseId));
      if (tel && ficha) saida.push({ tel, nome: null, ficha });
    }
    return saida;
  },
  ["etiquetas-lista"],
  { tags: [CASES_TAG, WORKSPACE_TAG], revalidate: 60 }
);

/**
 * As etiquetas de cada conversa visível na lista do WhatsApp (1.84).
 *
 * A extensão manda, de cada linha, o nome que a lista mostra e — quando o
 * contato não está salvo — o número. Nada de mensagem. Volta, por chave,
 * o que o CW sabe: "Reclame Aqui", "Redes sociais", "Detrator · NPS 3".
 */
export async function POST(request: Request) {
  const { usuario, demonstracao } = await autenticar(request);
  if (!usuario && !demonstracao) return semSessao(request);

  let corpo: { contatos?: { chave?: string; nome?: string; telefone?: string }[] } = {};
  try {
    corpo = await request.json();
  } catch {
    return responder(request, { erro: "Corpo inválido." }, 400);
  }
  const contatos = (Array.isArray(corpo.contatos) ? corpo.contatos : []).slice(0, TETO);
  if (contatos.length === 0) return responder(request, { etiquetas: {} });

  try {
    const linhas = await indice();
    const porTel = new Map<string, FichaDoIndice[]>();
    const porNome = new Map<string, FichaDoIndice[]>();
    for (const l of linhas) {
      if (l.tel) porTel.set(l.tel, [...(porTel.get(l.tel) ?? []), l.ficha]);
      if (l.nome) porNome.set(l.nome, [...(porNome.get(l.nome) ?? []), l.ficha]);
    }
    const etiquetas: Record<string, ReturnType<typeof etiquetasDasFichas>> = {};
    for (const c of contatos) {
      const chave = String(c.chave ?? "").slice(0, 200);
      if (!chave) continue;
      const tel = chaveDoTelefone(c.telefone);
      const nome = chaveDoNome(c.nome);
      const fichas = [...(tel ? porTel.get(tel) ?? [] : []), ...(nome ? porNome.get(nome) ?? [] : [])];
      const lista = etiquetasDasFichas([...new Set(fichas)]);
      if (lista.length) etiquetas[chave] = lista;
    }
    return responder(request, { etiquetas });
  } catch (erro) {
    console.error("[extensao/etiquetas-lista]", erro);
    return responder(request, { etiquetas: {}, erro: "Não deu para ler as etiquetas agora." });
  }
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
