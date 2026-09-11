import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { getPrisma } from "@/lib/prisma";

import {
  atrasadasNaLista,
  type ItemDaLista,
} from "@/lib/services/raPortal.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Quais destas reclamações ainda não estão na plataforma?
 *
 * **O pedido que isto atende.** "Preciso de uma forma de importar os
 * casos do Reclame Aqui sem o uso da API. Talvez a aplicação abrisse a
 * página do Reclame Aqui e verificasse se houve um novo caso."
 *
 * A aplicação **não** abre o portal sozinha, e de propósito: a página é
 * protegida contra robôs (Cloudflare) e só abre com login. Fazer o
 * servidor entrar exigiria guardar a senha do portal e contornar a
 * proteção deles. Quem abre é a pessoa, no navegador dela, logada — e a
 * extensão, que já roda ali, lê os links das reclamações da lista e
 * pergunta aqui quais são novas.
 *
 * **Só responde "nova", "conhecida" ou "atrasada".** Nenhum dado de
 * reclamação sai daqui: a extensão manda códigos que leu na lista do
 * portal, e recebe de volta os que faltam — e, quando manda também o
 * estado de cada um (`itens`), os que o portal já passou à frente:
 * respondidos lá e sem resposta aqui, avaliados lá e não aqui.
 *
 * Dois chamadores: o aviso na página de lista (`hugme.js`, só códigos)
 * e o vigia do service worker, que lê a lista pública sozinho de tempos
 * em tempos e grava pelo `/api/extensao/ra-vigia`.
 */

/** O código de 16 caracteres do portal. */
const CODIGO = /^[A-Za-z0-9_-]{16}$/;

/** Uma lista do portal mostra dezenas; mais que isto não é lista. */
const TETO = 300;

export async function POST(request: Request) {
  const { usuario, demonstracao } =
    await autenticar(request);

  if (!usuario && !demonstracao) {
    return semSessao(request);
  }

  let corpo: { codigos?: unknown; itens?: unknown } = {};

  try {
    corpo = (await request.json()) as {
      codigos?: unknown;
      itens?: unknown;
    };
  } catch {
    return responder(request, { erro: "Corpo inválido." }, 400);
  }

  /* O estado que a lista mostra, quando quem chama é o vigia. */
  const itens: ItemDaLista[] = (Array.isArray(corpo.itens) ? corpo.itens : [])
    .slice(0, TETO)
    .map((i) => {
      const item = (i ?? {}) as Record<string, unknown>;
      return {
        codigo: String(item.codigo ?? "").trim(),
        status: String(item.status ?? "").slice(0, 30),
        avaliada: item.avaliada === true,
      };
    })
    .filter((i) => CODIGO.test(i.codigo));

  const codigos = [
    ...new Set(
      [
        ...(Array.isArray(corpo.codigos) ? corpo.codigos : []),
        ...itens.map((i) => i.codigo),
      ]
        .map((c) => String(c ?? "").trim())
        .filter((c) => CODIGO.test(c))
    ),
  ].slice(0, TETO);

  if (codigos.length === 0) {
    return responder(request, {
      novos: [],
      atrasadas: [],
      conhecidos: 0,
      total: 0,
    });
  }

  const prisma = getPrisma();

  /* Sem banco, tudo seria "novo" — e isso não é verdade: é não saber. */
  if (!prisma) {
    return responder(request, {
      novos: [],
      atrasadas: [],
      conhecidos: 0,
      total: codigos.length,
      erro: "Sem banco configurado.",
    });
  }

  const comPrefixo = codigos.map((c) => `RA-${c}`);

  const pelosProtocolos = await prisma.case.findMany({
    where: {
      OR: [
        { protocol: { in: comPrefixo } },
        { externalId: { in: comPrefixo } },
      ],
    },
    select: { protocol: true, externalId: true },
  });

  const conhecidos = new Set<string>();

  for (const linha of pelosProtocolos) {
    for (const valor of [linha.protocol, linha.externalId]) {
      if (valor?.startsWith("RA-")) conhecidos.add(valor.slice(3));
    }
  }

  /**
   * O que sobrou, conferido pelo endereço.
   *
   * Medido em 10/09/2026: em 2 das 297 reclamações com endereço do
   * portal, o código do endereço **não é** o do protocolo. Conferir só o
   * protocolo anunciaria essas duas como novas toda vez que aparecessem
   * na lista — e a pessoa as capturaria de novo.
   *
   * Uma consulta só, e só para o que o protocolo não resolveu, que numa
   * lista do dia a dia é quase nada.
   */
  const restantes = codigos.filter((c) => !conhecidos.has(c));

  if (restantes.length > 0) {
    const pelosEnderecos = await prisma.case.findMany({
      where: {
        OR: restantes.map((c) => ({
          externalUrl: { contains: c },
        })),
      },
      select: { externalUrl: true },
    });

    for (const linha of pelosEnderecos) {
      for (const c of restantes) {
        if (linha.externalUrl?.includes(c)) conhecidos.add(c);
      }
    }
  }

  const novos = codigos.filter((c) => !conhecidos.has(c));

  const atrasadas =
    itens.length > 0 ? await atrasadasNaLista(prisma, itens) : [];

  return responder(request, {
    novos,
    atrasadas,
    conhecidos: codigos.length - novos.length,
    total: codigos.length,
  });
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
