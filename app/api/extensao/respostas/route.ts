import { updateTag } from "next/cache";

import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { WORKSPACE_TAG } from "@/lib/actions/tags";
import { loadWorkspace } from "@/lib/actions/workspace";
import { getPrisma } from "@/lib/prisma";

import { tabelaDePlanos } from "@/lib/models/plan";
import { prepararRespostas } from "@/lib/services/respostas.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Os textos aprovados, prontos para colar na caixa de mensagem.
 *
 * **O que muda em relação ao painel.** A gaveta já mostrava macros, mas
 * só três, só da categoria do caso, e só quando o contato tinha caso —
 * e o botão era "copiar", que deixa a colagem por conta de quem está
 * com o cliente na linha. Aqui a lista é inteira, com busca, e o atalho
 * fica ao lado da caixa de mensagem, que é onde a pergunta "qual texto
 * eu mando?" acontece.
 *
 * **A rota preenche; ela não envia.** Nada daqui vai para o WhatsApp
 * sozinho: o texto entra na caixa e quem aperta enviar é a pessoa. É a
 * mesma linha que a extensão inteira respeita — ver `LEIA-ME.md`.
 *
 * `GET`  devolve a lista já com as variáveis resolvidas.
 * `POST` conta um uso, para o mais usado subir na lista.
 */

/** Os canais que a base tem hoje; o parâmetro só ordena, nunca filtra. */
const CANAL_PADRAO = "WhatsApp";

export async function GET(request: Request) {
  const { usuario, demonstracao } =
    await autenticar(request);

  if (!usuario && !demonstracao) {
    return semSessao(request);
  }

  const url = new URL(request.url);

  const canal =
    url.searchParams.get("canal")?.trim() || CANAL_PADRAO;

  const busca = url.searchParams.get("busca") ?? "";

  const protocolo = (
    url.searchParams.get("protocolo") ?? ""
  ).trim();

  const workspace = await loadWorkspace();

  /**
   * O caso manda no nome do consumidor e no estabelecimento.
   *
   * O nome que a extensão lê do WhatsApp é o da agenda — "Pizzaria do
   * João" —, e é ele que sobra quando não há caso. Havendo caso, o nome
   * do cadastro do consumidor é melhor: é como a pessoa se identificou
   * no portal, e é o nome que ela reconhece numa mensagem.
   */
  const doCaso = await dadosDoCaso(protocolo);

  const planos = tabelaDePlanos(workspace.plans, "plano");
  const modulos = tabelaDePlanos(workspace.plans, "modulo");

  const itens = prepararRespostas(
    workspace.macros,
    canal,
    {
      cliente:
        doCaso?.cliente ||
        (url.searchParams.get("cliente") ?? ""),

      /* Quem está digitando é quem fala. Ver ContextoDaResposta. */
      responsavel: usuario?.nome ?? "",

      protocolo: doCaso?.protocolo || protocolo,
      estabelecimento: doCaso?.estabelecimento ?? "",

      /**
       * Tabela vazia **não** é tabela.
       *
       * Sem plano nenhum cadastrado — que é o estado de hoje —,
       * `tabelaDePlanos` devolve string vazia, e substituir por ela
       * mandaria ao consumidor uma mensagem oferecendo preços com um
       * buraco no lugar deles. Vazio aqui vira variável não resolvida,
       * e a resposta aparece na lista com o aviso de que falta o
       * cadastro de planos.
       */
      planos,
      modulos,
    },
    busca
  );

  return responder(request, {
    canal,
    total: itens.length,
    itens,

    /** Para o atalho oferecer "gerenciar" sem saber o endereço. */
    url: `${url.origin}/base-conhecimento`,
  });
}

/**
 * Conta o uso do texto que acabou de ser colado.
 *
 * É o que faz a lista melhorar sozinha: a ordem é por afinidade de
 * canal e depois por uso, então o texto que a operação realmente manda
 * sobe para o topo em vez de ficar em ordem alfabética para sempre.
 *
 * Incremento no banco, não leitura-e-escrita: duas inserções ao mesmo
 * tempo em duas abas contariam uma só.
 */
export async function POST(request: Request) {
  const { usuario, demonstracao } =
    await autenticar(request);

  if (!usuario && !demonstracao) {
    return semSessao(request);
  }

  let corpo: { id?: string } = {};

  try {
    corpo = (await request.json()) as { id?: string };
  } catch {
    return responder(
      request,
      { erro: "Corpo inválido." },
      400
    );
  }

  const id = (corpo.id ?? "").trim();

  if (!id) {
    return responder(
      request,
      { erro: "Informe o id do texto usado." },
      400
    );
  }

  const prisma = getPrisma();

  /* Sem banco a extensão roda contra a demonstração: nada a contar. */
  if (!prisma) {
    return responder(request, { ok: true, usos: null });
  }

  try {
    const atualizado = await prisma.macro.update({
      where: { id },
      data: { uses: { increment: 1 } },
      select: { uses: true },
    });

    updateTag(WORKSPACE_TAG);

    return responder(request, {
      ok: true,
      usos: atualizado.uses,
    });
  } catch {
    /**
     * Texto apagado na aplicação enquanto a lista estava aberta.
     *
     * Não é erro de quem colou — o texto já está na caixa. Responder
     * 404 faria o atalho mostrar falha depois de uma inserção que deu
     * certo.
     */
    return responder(request, {
      ok: false,
      usos: null,
      erro: "Este texto não existe mais na base de conhecimento.",
    });
  }
}

/**
 * O consumidor e o estabelecimento, pelo protocolo.
 *
 * Uma consulta só, por campo único. A alternativa era mandar o painel
 * enviar tudo pronto, e aí o `{{estabelecimento}}` nunca seria
 * preenchido: o resumo de caso que a extensão recebe não carrega o
 * estabelecimento vinculado.
 */
async function dadosDoCaso(protocolo: string) {
  if (!protocolo) return null;

  const prisma = getPrisma();

  if (!prisma) return null;

  const caso = await prisma.case.findUnique({
    where: { protocol: protocolo },
    select: {
      protocol: true,
      customer: true,
      establishment: { select: { name: true } },
    },
  });

  if (!caso) return null;

  return {
    protocolo: caso.protocol,
    cliente: caso.customer,
    estabelecimento: caso.establishment?.name ?? "",
  };
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
