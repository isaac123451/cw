import { revalidateTag } from "next/cache";

import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import {
  CASES_TAG,
  WORKSPACE_TAG,
} from "@/lib/actions/tags";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Este WhatsApp é de qual frente?"
 *
 * O Isaac pediu: "whatsapp do reclame aqui ter a possibilidade de
 * selecionar esse wpp, no do nps ser possível selecionar que é do nps".
 *
 * **O problema que isto resolve.** A extensão sempre soube ler o número
 * da conversa aberta e usá-lo para *procurar* casos. O caminho de volta
 * não existia: encontrado o caso, não havia como dizer "e este número é
 * o dele". O resultado está medido na base — 868 respostas de NPS sem
 * telefone nenhum, enquanto quem atendia estava com a conversa aberta
 * na frente, com o número na tela.
 *
 * **Duas frentes, e a pessoa escolhe qual.** O mesmo número pode ser de
 * um caso do Reclame Aqui, de um ciclo de NPS, ou dos dois — e nada no
 * número diz qual. Adivinhar levaria o WhatsApp do consumidor que
 * reclamou para o campo do dono do restaurante que respondeu a
 * pesquisa, que são pessoas diferentes com problemas diferentes. Quem
 * está na conversa sabe; a rota pergunta.
 *
 * **Nunca envia mensagem.** Grava um número de contato, e nada mais.
 */

interface Entrada {
  /** O número, como veio da conversa. Só os dígitos são guardados. */
  numero?: string;

  /** "reclame-aqui" ou "nps". */
  frente?: string;

  /** Para `reclame-aqui`: o protocolo do caso. */
  protocolo?: string;

  /** Para `nps`: o id do ciclo. */
  npsId?: string;

  /**
   * Guardar também no cadastro do estabelecimento.
   *
   * Só no NPS, e só quando o ciclo tem estabelecimento vinculado: é o
   * campo que faz o botão "falar no WhatsApp" aparecer no painel para
   * os **próximos** ciclos daquela conta, e não só para este.
   */
  tambemNoEstabelecimento?: boolean;
}

/**
 * Só dígitos, e com um piso.
 *
 * O WhatsApp mostra o número formatado, e a base guarda telefone com e
 * sem máscara. Guardar dígitos é o que faz a busca por quatro últimos
 * casar depois. O piso de dez existe porque a leitura da página às
 * vezes pega um fragmento — e um telefone de três dígitos gravado no
 * cadastro é pior do que campo vazio: ele parece preenchido.
 */
function digitos(valor?: string) {

  const so = (valor ?? "").replace(/\D/g, "");

  return so.length >= 10 && so.length <= 15 ? so : "";
}

export async function POST(request: Request) {

  const { usuario, demonstracao } =
    await autenticar(request);

  if (!usuario && !demonstracao) {
    return semSessao(request);
  }

  if (usuario && usuario.papel === "LEITURA") {
    return responder(
      request,
      {
        erro: "Seu acesso é somente leitura — não dá para gravar contato.",
      },
      403
    );
  }

  const prisma = getPrisma();

  if (!prisma) {
    return responder(
      request,
      { erro: "Sem banco configurado — não há onde gravar." },
      503
    );
  }

  let entrada: Entrada;

  try {
    entrada = (await request.json()) as Entrada;
  } catch {
    return responder(
      request,
      { erro: "Corpo inválido." },
      400
    );
  }

  const numero = digitos(entrada.numero);

  if (!numero) {
    return responder(
      request,
      {
        erro: "Número inválido — esperava de 10 a 15 dígitos.",
      },
      400
    );
  }

  /* ---------------------------------------- Reclame Aqui ---- */

  if (entrada.frente === "reclame-aqui") {

    const protocolo = (entrada.protocolo ?? "")
      .trim()
      .slice(0, 60);

    if (!protocolo) {
      return responder(
        request,
        { erro: "Faltou o caso." },
        400
      );
    }

    const caso = await prisma.case.findUnique({
      where: { protocol: protocolo },
      select: { id: true, customer: true, phone: true },
    });

    if (!caso) {
      return responder(
        request,
        { erro: `Não achei o caso ${protocolo}.` },
        404
      );
    }

    await prisma.case.update({
      where: { id: caso.id },
      data: { phone: numero },
    });

    revalidateTag(CASES_TAG, "max");

    return responder(request, {
      gravado: true,
      frente: "reclame-aqui",
      onde: protocolo,
      cliente: caso.customer,

      /*
        Diz se havia outro número no lugar.

        Substituir em silêncio é como se perde o telefone que alguém
        tinha conferido — e quem clicou não tinha como saber que havia
        um ali.
      */
      substituiu: caso.phone ?? null,
    });
  }

  /* ---------------------------------------- NPS ---- */

  if (entrada.frente === "nps") {

    const id = (entrada.npsId ?? "").trim().slice(0, 60);

    if (!id) {
      return responder(
        request,
        { erro: "Faltou o ciclo do NPS." },
        400
      );
    }

    const ciclo = await prisma.npsResponse.findUnique({
      where: { id },
      select: {
        id: true,
        customer: true,
        phone: true,
        establishmentId: true,
      },
    });

    if (!ciclo) {
      return responder(
        request,
        { erro: "Esse ciclo de NPS não existe mais." },
        404
      );
    }

    await prisma.npsResponse.update({
      where: { id: ciclo.id },
      data: { phone: numero },
    });

    /**
     * E no cadastro do estabelecimento, quando pedido.
     *
     * `npsWhatsapp` é separado do `phone` do estabelecimento de
     * propósito: aquele é a recepção, o fixo, o número do cardápio.
     * Quem responde o NPS é uma pessoa, com o WhatsApp dela — e ligar
     * para a loja para falar de uma nota que o dono deu em particular
     * é o tipo de contato que piora a relação.
     */
    let noEstabelecimento = false;

    if (
      entrada.tambemNoEstabelecimento &&
      ciclo.establishmentId
    ) {
      await prisma.establishment.update({
        where: { id: ciclo.establishmentId },
        data: { npsWhatsapp: numero },
      });

      noEstabelecimento = true;
    }

    revalidateTag(WORKSPACE_TAG, "max");

    return responder(request, {
      gravado: true,
      frente: "nps",
      onde: ciclo.id,
      cliente: ciclo.customer,
      substituiu: ciclo.phone ?? null,
      noEstabelecimento,
    });
  }

  return responder(
    request,
    {
      erro: 'Frente inválida — use "reclame-aqui" ou "nps".',
    },
    400
  );
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
