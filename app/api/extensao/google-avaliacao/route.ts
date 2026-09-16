import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { getPrisma } from "@/lib/prisma";

import {
  dataDaAvaliacao,
  gravarAvaliacaoDoGoogle,
  problemaDaAvaliacao,
  type NovaAvaliacaoDoGoogle,
} from "@/lib/services/avaliacoesGoogle.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Registrar uma avaliação do Google de dentro do Perfil da Empresa.
 *
 * A extensão lê o cartão que está na tela — estrelas, autor, texto, a
 * data — e manda para cá. A regra é a **mesma** da tela de Avaliações:
 * `gravarAvaliacaoDoGoogle` classifica pela tabela do documento, marca a
 * repetição de problema nos últimos 14 dias e casa com o promotor do NPS
 * que foi convidado a avaliar. Não existe uma segunda contabilidade
 * dentro da extensão.
 *
 * **Só no clique.** Nada é registrado por abrir a página: a pessoa
 * confere estrelas, autor e data no próprio cartão e aperta "Registrar".
 *
 * A mesma avaliação apertada duas vezes não vira duas linhas: mesmo
 * autor, mesmo dia e mesma nota devolvem a que já existe, com
 * `repetida: true`, em vez de criar a segunda cópia.
 */

/** A chave de repetição: mesmo autor, mesmo dia, mesma nota. */
async function jaRegistrada(
  prisma: NonNullable<ReturnType<typeof getPrisma>>,
  entrada: { autor: string; estrelas: number; publicadaEm: Date }
) {
  const dia = new Date(entrada.publicadaEm);
  dia.setUTCHours(0, 0, 0, 0);
  const seguinte = new Date(dia.getTime() + 86_400_000);

  return prisma.avaliacaoGoogle.findFirst({
    where: {
      autor: entrada.autor,
      estrelas: entrada.estrelas,
      publicadaEm: { gte: dia, lt: seguinte },
    },
    select: { id: true, classificacao: true, criticidade: true, status: true },
  });
}

function entradaDoCorpo(bruto: Record<string, unknown>): NovaAvaliacaoDoGoogle {
  return {
    estrelas: Number(bruto.estrelas ?? 0),
    autor: String(bruto.autor ?? "").trim(),
    texto: String(bruto.texto ?? "").trim() || undefined,
    link: String(bruto.link ?? "").trim() || undefined,
    publicadaEm: String(bruto.publicadaEm ?? "").trim(),
    identificado: Boolean(bruto.identificado),
  };
}

export async function POST(request: Request) {

  const { usuario, demonstracao } = await autenticar(request);

  if (!usuario && !demonstracao) return semSessao(request);

  if (!usuario) {
    return responder(request, { erro: "Entre na aplicação para registrar a avaliação." }, 401);
  }

  if (usuario.papel === "LEITURA") {
    return responder(request, { erro: "Seu acesso é somente leitura — não dá para registrar." }, 403);
  }

  const prisma = getPrisma();
  if (!prisma) return responder(request, { erro: "Sem banco configurado." }, 503);

  const bruto = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const entrada = entradaDoCorpo(bruto);

  const problema = problemaDaAvaliacao(entrada);
  if (problema) return responder(request, { erro: problema }, 400);

  const publicadaEm = dataDaAvaliacao(entrada.publicadaEm)!;

  try {
    const repetida = await jaRegistrada(prisma, {
      autor: entrada.autor,
      estrelas: entrada.estrelas,
      publicadaEm,
    });

    if (repetida) {
      return responder(request, {
        ok: true,
        repetida: true,
        id: repetida.id,
        classificacao: repetida.classificacao,
        criticidade: repetida.criticidade,
        status: repetida.status,
        resumo: `${entrada.autor} já estava registrado.`,
      });
    }

    const { criada, promotor } = await gravarAvaliacaoDoGoogle(prisma, entrada, usuario.nome);

    return responder(request, {
      ok: true,
      repetida: false,
      id: criada.id,
      classificacao: criada.classificacao,
      criticidade: criada.criticidade,
      motivos: criada.motivosDeUrgencia,
      status: criada.status,
      promotor: promotor ? { id: promotor.id, nome: promotor.customerName ?? promotor.customer } : null,
      resumo: promotor
        ? `Registrada e casada com o promotor ${promotor.customerName ?? promotor.customer} do NPS.`
        : "Registrada.",
    });
  } catch (erro) {
    console.error("[extensao/google-avaliacao]", erro);
    return responder(request, { erro: "O banco não aceitou o registro agora. Tente de novo em instantes." }, 500);
  }
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
