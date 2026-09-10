import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { getPrisma } from "@/lib/prisma";

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
 * **Só responde "nova" ou "conhecida".** Nenhum dado de reclamação sai
 * daqui: a extensão manda códigos que leu na página que a pessoa está
 * vendo, e recebe de volta os que faltam. Importar continua sendo abrir
 * a reclamação e capturar, pelo fluxo que já existe.
 *
 * O aviso por e-mail (`importarAvisosDoRA`, na rotina diária) é o outro
 * caminho, o que funciona de madrugada. Os dois se completam: o e-mail
 * pega o que chega com todo mundo desconectado, e esta varredura pega
 * o que o e-mail não trouxe.
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

  let corpo: { codigos?: unknown } = {};

  try {
    corpo = (await request.json()) as { codigos?: unknown };
  } catch {
    return responder(request, { erro: "Corpo inválido." }, 400);
  }

  const codigos = [
    ...new Set(
      (Array.isArray(corpo.codigos) ? corpo.codigos : [])
        .map((c) => String(c ?? "").trim())
        .filter((c) => CODIGO.test(c))
    ),
  ].slice(0, TETO);

  if (codigos.length === 0) {
    return responder(request, {
      novos: [],
      conhecidos: 0,
      total: 0,
    });
  }

  const prisma = getPrisma();

  /* Sem banco, tudo seria "novo" — e isso não é verdade: é não saber. */
  if (!prisma) {
    return responder(request, {
      novos: [],
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

  return responder(request, {
    novos,
    conhecidos: codigos.length - novos.length,
    total: codigos.length,
  });
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
