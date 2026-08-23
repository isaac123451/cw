import { revalidateTag } from "next/cache";

import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { WORKSPACE_TAG } from "@/lib/actions/tags";
import { getPrisma } from "@/lib/prisma";

import {
  CHANNELS,
  FLUXO_EM_ANDAMENTO,
  isEncerrado,
  MOODS,
} from "@/lib/models/nps";
import {
  aplicarPosContato,
  registrarTentativa,
  retratoNps,
  SELECAO_NPS,
} from "@/lib/services/nps.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fecha o ciclo de NPS sem sair da conversa.
 *
 * O painel já **mostrava** o ciclo — nota, status, tentativas e prazo.
 * Faltava a outra metade: quem acabou de ligar para o cliente estava no
 * WhatsApp, e tinha de abrir a aplicação em outra aba para registrar o
 * que aconteceu. Registro que exige troca de contexto é registro que
 * não acontece, e o indicador de recuperação nasce vazio.
 *
 * Duas escritas, e só estas duas:
 *
 * - **`tentativa`** — liguei e não atenderam. É a contagem que a regra
 *   das três em 7 dias usa para autorizar o encerramento por falta de
 *   retorno.
 * - **`pos-contato`** — falei com a pessoa: como ela ficou (a régua de
 *   humor) e se a situação foi resolvida.
 *
 * **O que a rota não faz de propósito:** não encerra o ciclo, não muda
 * o tipo, não classifica causa raiz e **não toca na nota do NPS**. A
 * nota é de antes — mede o estado em que o cliente respondeu a pesquisa
 * e é ela que compõe o indicador. Encerrar tem checklist próprio, que
 * mora na tela; espremer isso numa gaveta de 380 px seria convidar ao
 * encerramento sem lastro.
 *
 * A regra em si mora em `lib/services/nps.repository.ts`, compartilhada
 * com as server actions da tela: assim o que a extensão grava e o que a
 * gaveta do `/nps` grava são, literalmente, o mesmo código.
 */

interface Entrada {
  id?: string;
  /** Para `acao: "contato"` — telefone e e-mail do cliente. */
  telefone?: string;
  email?: string;
  /** "pos-contato" (padrão), "tentativa" ou "status". */
  acao?: string;
  /** Para `acao: "status"` — "avancar" ou "voltar". */
  direcao?: string;
  /** Régua de humor, 1 a 5. `null` limpa o registro. */
  humor?: number | null;
  /** A situação foi resolvida? `null` = não respondido. */
  resolvido?: boolean | null;
  /** O que ficou combinado, ou o que aconteceu na tentativa. */
  nota?: string;
  /** Canal da tentativa. Só vale um dos de `CHANNELS`. */
  canal?: string;
}

const VALORES_DE_HUMOR = MOODS.map((m) => m.value);

function limpo(valor?: string, teto = 400) {
  return (valor ?? "").replace(/\s+/g, " ").trim().slice(0, teto);
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
        erro: "Seu acesso é somente leitura — não dá para registrar tratativa.",
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

  const id = limpo(entrada.id, 60);

  if (!id) {
    return responder(
      request,
      { erro: "Faltou o id da resposta de NPS." },
      400
    );
  }

  /**
   * Confere que a resposta existe **antes** de gravar.
   *
   * `aplicarPosContato` já devolve `null` nesse caso, mas a tentativa
   * não: `npsAttempt.create` com um `responseId` inexistente estoura
   * violação de chave estrangeira, e o painel receberia um 500 em vez
   * de "não achei esse registro".
   */
  const existente = await prisma.npsResponse.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!existente) {
    return responder(
      request,
      { erro: "Essa resposta de NPS não existe mais." },
      404
    );
  }

  /**
   * Quem registrou vem da sessão, nunca do corpo.
   *
   * O corpo é escrito pelo script de conteúdo, que roda dentro do
   * WhatsApp Web — aceitar o nome dali seria deixar a página dizer
   * quem fez o atendimento.
   */
  const autor = usuario?.nome ?? "Extensão";

  const acao = [
    "tentativa",
    "status",
    "contato",
  ].includes(entrada.acao ?? "")
    ? (entrada.acao as string)
    : "pos-contato";

  /**
   * Preencher o contato que a pesquisa não trouxe.
   *
   * O Wootric manda o telefone quando o cliente o cadastrou no portal —
   * e em boa parte das respostas ele vem vazio. Sem número, o ciclo não
   * casa com nenhuma conversa do WhatsApp e some do painel justamente
   * quando alguém está falando com a pessoa. Digitar ali resolve, e é o
   * único caminho: a pesquisa não pergunta telefone.
   */
  if (acao === "contato") {

    const telefone = limpo(entrada.telefone, 40);
    const email = limpo(entrada.email, 160);

    if (!telefone && !email) {
      return responder(
        request,
        {
          erro: "Informe um telefone ou um e-mail para gravar.",
        },
        400
      );
    }

    await prisma.npsResponse.update({
      where: { id },
      data: {
        ...(telefone ? { phone: telefone } : {}),
        ...(email ? { email } : {}),
      },
    });

    revalidateTag(WORKSPACE_TAG, "max");

    const comContato =
      await prisma.npsResponse.findUnique({
        where: { id },
        select: SELECAO_NPS,
      });

    return responder(request, {
      gravado: true,
      nps: comContato ? retratoNps(comContato) : null,
    });
  }

  if (acao === "status") {

    const direcao =
      entrada.direcao === "voltar"
        ? "voltar"
        : "avancar";

    /**
     * Ciclo encerrado não volta por botão.
     *
     * Reabrir uma tratativa é decisão com consequência no indicador —
     * o caso volta para a fila de quem ainda não foi atendido. Isso tem
     * lugar próprio na tela, com o histórico à vista.
     */
    if (isEncerrado(existente.status)) {
      return responder(request, {
        movido: false,
        status: existente.status,
        aviso:
          "Este ciclo já foi encerrado. Reabrir é pela tela do NPS, que mostra o histórico inteiro.",
      });
    }

    /**
     * A escada vem do **cadastro**, não da constante.
     *
     * As etapas do NPS viraram tabela (`NpsStage`), e a extensão sobe e
     * desce pela mesma escada que a tela desenha. Lendo a constante,
     * uma etapa nova nasceria inalcançável pela extensão — e as duas
     * pontas discordariam sobre qual é o próximo passo, que é pior do
     * que a extensão não mover nada.
     *
     * Banco sem cadastro nenhum cai nos degraus do guia, que é o mesmo
     * que a tela mostra nesse caso.
     */
    const cadastradas = await prisma.npsStage.findMany({
      where: { active: true, final: false },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { name: true },
    });

    const escada =
      cadastradas.length > 0
        ? cadastradas.map((e) => e.name)
        : FLUXO_EM_ANDAMENTO;

    const i = escada.indexOf(existente.status);

    const alvo =
      i < 0
        ? null
        : (escada[
            direcao === "avancar" ? i + 1 : i - 1
          ] ?? null);

    if (!alvo) {
      return responder(request, {
        movido: false,
        status: existente.status,
        aviso:
          i < 0
            ? `"${existente.status}" está fora do fluxo de andamento.`
            : direcao === "avancar"
              ? "Daqui em diante é encerramento, e encerrar pede o checklist — é pela tela do NPS."
              : `Já está no primeiro passo ("${existente.status}").`,
      });
    }

    await prisma.npsResponse.update({
      where: { id },
      data: { status: alvo },
    });

    revalidateTag(WORKSPACE_TAG, "max");

    const atual = await prisma.npsResponse.findUnique({
      where: { id },
      select: SELECAO_NPS,
    });

    return responder(request, {
      movido: true,
      de: existente.status,
      status: alvo,
      nps: atual ? retratoNps(atual) : null,
    });
  }

  if (acao === "tentativa") {

    const canal = CHANNELS.includes(entrada.canal ?? "")
      ? (entrada.canal as string)
      : CHANNELS[0];

    const nota = limpo(entrada.nota);

    /**
     * Tentativa sem descrição é uma linha inútil no histórico — a
     * gaveta da aplicação também exige, e por isso mesmo: "3
     * tentativas" sem dizer o que houve em cada uma não sustenta um
     * encerramento por falta de retorno.
     */
    if (!nota) {
      return responder(
        request,
        {
          erro: "Descreva a tentativa — ex.: ligou, caiu na caixa postal.",
        },
        400
      );
    }

    await registrarTentativa(prisma, {
      responseId: id,
      channel: canal,
      note: nota,
      actor: autor,
    });

  } else {

    const humor =
      typeof entrada.humor === "number" &&
      VALORES_DE_HUMOR.includes(entrada.humor)
        ? entrada.humor
        : null;

    const resolvido =
      typeof entrada.resolvido === "boolean"
        ? entrada.resolvido
        : null;

    /**
     * Registro vazio não é registro. Sem humor e sem "resolveu?", o
     * único efeito da chamada seria carimbar `postContactAt` — e o
     * painel passaria a dizer "registrado" sobre um contato do qual
     * não se sabe nada.
     */
    if (humor === null && resolvido === null) {
      return responder(
        request,
        {
          erro: "Marque como o cliente ficou, ou se a situação foi resolvida.",
        },
        400
      );
    }

    await aplicarPosContato(prisma, {
      id,
      mood: humor,
      resolved: resolvido,
      note: limpo(entrada.nota),
      actor: autor,
    });
  }

  /**
   * `revalidateTag` e não `updateTag`: o segundo só existe dentro de
   * server action — numa rota ele lança. Sem isto, a tela do `/nps`
   * poderia mostrar por até dois minutos o retrato anterior ao que
   * acabou de ser gravado daqui.
   */
  revalidateTag(WORKSPACE_TAG, "max");

  const atualizado = await prisma.npsResponse.findUnique({
    where: { id },
    select: SELECAO_NPS,
  });

  const host = new URL(request.url).origin;

  return responder(request, {
    registrado: true,
    acao,
    nps: atualizado ? retratoNps(atualizado) : null,
    url: `${host}/nps`,
  });
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
