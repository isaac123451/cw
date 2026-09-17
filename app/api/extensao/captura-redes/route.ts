import { revalidateTag } from "next/cache";

import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { getPrisma } from "@/lib/prisma";
import { CASES_TAG } from "@/lib/actions/tags";

import {
  colunasSuficientes,
  itemDoSlack,
  itensDaPlanilha,
  lerCsv,
  type CampoDaCaptura,
  type ItemCapturado,
} from "@/lib/models/capturaDasRedes";
import { gravarCaptura, previaDaCaptura } from "@/lib/services/capturaDasRedes.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Captura das Redes pela extensão: a planilha aberta e a mensagem do Slack.
 *
 * `acao: "previa"` só lê — conta novas, já no CW, duplicadas e sem rede,
 * e diz quais colunas foram reconhecidas. `acao: "gravar"` cria os
 * atendimentos novos (todos, ou só as chaves de `apenas`), em Recebido e
 * a triar. **Nada é gravado por abrir a planilha ou o canal**: a extensão
 * só chama `gravar` no clique.
 *
 * A planilha chega como o CSV que a própria pessoa baixaria da planilha
 * aberta; o Slack, como o texto da mensagem. As duas leituras terminam
 * em `ItemCapturado`, e daí para frente o caminho é um só.
 */

const TETO_CSV = 2_000_000;
const TETO_ITENS = 1_000;

const texto = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);

export async function POST(request: Request) {

  const { usuario, demonstracao } = await autenticar(request);
  if (!usuario && !demonstracao) return semSessao(request);
  if (!usuario) return responder(request, { erro: "Entre na aplicação para capturar os casos." }, 401);

  const prisma = getPrisma();
  if (!prisma) return responder(request, { erro: "Sem banco configurado." }, 503);

  const corpo = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const acao = corpo.acao === "gravar" ? "gravar" : "previa";

  if (acao === "gravar" && usuario.papel === "LEITURA") {
    return responder(request, { erro: "Seu acesso é somente leitura — dá para ver a prévia, não para gravar." }, 403);
  }

  let itens: ItemCapturado[] = [];
  let colunas: Partial<Record<CampoDaCaptura, string>> | undefined;
  let cabecalho: string[] | undefined;

  if (corpo.fonte === "planilha") {
    const csv = String(corpo.csv ?? "");
    const planilha = (corpo.planilha ?? {}) as Record<string, unknown>;
    const id = texto(planilha.id, 80);
    if (!/^[A-Za-z0-9_-]{20,80}$/.test(id)) return responder(request, { erro: "Não reconheci o endereço da planilha." }, 400);
    if (!csv.trim()) return responder(request, { erro: "A planilha veio vazia. Confira se a aba certa está aberta." }, 400);
    if (csv.length > TETO_CSV) return responder(request, { erro: "A planilha passou de 2 MB. Filtre as linhas de agora numa aba própria e leia essa aba." }, 413);

    const lido = itensDaPlanilha(lerCsv(csv), { id, gid: texto(planilha.gid, 20) || "0" });
    cabecalho = lido.cabecalho.map((h) => h.trim()).filter(Boolean).slice(0, 40);
    colunas = Object.fromEntries(Object.entries(lido.mapa).map(([campo, i]) => [campo, lido.cabecalho[i!]?.trim() ?? ""]));
    if (!colunasSuficientes(lido.mapa)) {
      return responder(request, {
        ok: true,
        suficientes: false,
        cabecalho,
        colunas,
        erro: "Não achei a coluna do relato nem a do link. Dê a uma delas um nome como Relato, Mensagem ou Link.",
      });
    }
    itens = lido.itens;
  } else if (corpo.fonte === "slack") {
    const mensagens = Array.isArray(corpo.mensagens) ? corpo.mensagens.slice(0, 200) : [];
    itens = mensagens
      .map((m) => m as Record<string, unknown>)
      .filter((m) => texto(m.texto, 4000).length > 0 && texto(m.ts, 40) && texto(m.canal, 80))
      .map((m) =>
        itemDoSlack({
          canal: texto(m.canal, 80),
          ts: texto(m.ts, 40),
          texto: texto(m.texto, 4000),
          quando: texto(m.quando, 40),
          links: Array.isArray(m.links) ? m.links.slice(0, 10).map((l) => texto(l, 500)) : [],
        })
      );
    if (itens.length === 0) return responder(request, { erro: "Nenhuma mensagem com texto para registrar." }, 400);
  } else {
    return responder(request, { erro: "Fonte desconhecida." }, 400);
  }

  if (itens.length > TETO_ITENS) {
    return responder(request, { erro: `São ${itens.length} linhas — o teto de uma leitura é ${TETO_ITENS}. Leia uma aba com as linhas recentes.` }, 413);
  }

  try {
    if (acao === "previa") {
      const linhas = await previaDaCaptura(prisma, itens);
      const contagem = { nova: 0, existente: 0, duplicada: 0, "sem-rede": 0 };
      for (const l of linhas) contagem[l.estado] += 1;
      return responder(request, { ok: true, suficientes: true, cabecalho, colunas, total: linhas.length, contagem, linhas: linhas.slice(0, 300) });
    }

    const apenas = Array.isArray(corpo.apenas) ? corpo.apenas.map((c) => texto(c, 120)).filter(Boolean) : undefined;
    const r = await gravarCaptura(prisma, itens, apenas);
    /* Sem isto, a tela das Redes seguiria servindo a lista de antes até o cache vencer. */
    if (r.criados.length > 0) revalidateTag(CASES_TAG, { expire: 0 });
    return responder(request, { ok: true, ...r });
  } catch (erro) {
    console.error("[extensao/captura-redes]", erro);
    return responder(request, { erro: "O banco não aceitou a leitura agora. Tente de novo em instantes." }, 500);
  }
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
