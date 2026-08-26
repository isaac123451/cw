import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { getPrisma } from "@/lib/prisma";
import { loadWorkspace } from "@/lib/actions/workspace";
import { fetchCases } from "@/lib/services/case.repository";
import { pedirEstruturado } from "@/lib/services/ia.service";

import { isOpen, isReclameAqui } from "@/lib/services/case.service";
import { slaStatus } from "@/lib/services/sla.service";
import {
  movementStatus,
  openMovementOf,
} from "@/lib/services/movement.service";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O que está em aberto no Reclame Aqui, e o que falta em cada um.
 *
 * A aba de Atividades mostrava a agenda — tarefas que alguém marcou. É
 * metade do trabalho: a outra metade são as reclamações em aberto, que
 * ninguém precisou marcar porque elas já estão lá cobrando sozinhas.
 *
 * **O checkpoint é calculado, não escrito por modelo.** "Sem resposta
 * pública", "fora do prazo", "sem responsável" são fatos do banco, e
 * fato não se pede para um modelo — ele erraria de vez em quando, e um
 * erro numa lista de pendências manda alguém trabalhar no caso errado
 * ou ignorar o certo. O modelo entra depois, e só para dizer por onde
 * começar.
 *
 * **Por que a conversa do WhatsApp entra.** Quando o painel está aberto
 * numa conversa, o que foi dito ali muda a ordem: um cliente que acabou
 * de escrever cobrando é mais urgente do que um que sumiu há um mês,
 * mesmo que o prazo do segundo esteja pior. Sem a conversa a lista é
 * boa; com ela, é a lista daquele atendimento.
 */

const SISTEMA = `Você organiza a fila de reclamações em aberto da Cardápio Web para quem vai trabalhar nela agora.

Recebe a lista de casos com o que falta em cada um — isso já vem calculado e é fato. Não recalcule, não invente pendência e não contradiga a lista.

Escreva em português do Brasil, direto, sem preâmbulo.

- "porOndeComecar": duas ou três frases dizendo qual caso pegar primeiro e por quê. Use o protocolo. Se houver conversa do WhatsApp no material, ela pesa: cliente que acabou de escrever cobrando vem antes de quem sumiu, mesmo com prazo pior.
- "linhas": uma frase por caso, na mesma ordem em que vieram, dizendo em uma linha do que se trata. Não repita o título nem o que já está no checkpoint — diga o assunto. Se um caso não tiver material para resumir, escreva o que se sabe dele e pare.
- "atencao": o que a lista inteira revela e que não aparece caso a caso. Por exemplo: muitos sem responsável, ou uma categoria concentrando o atraso. No máximo duas frases. Vazio se não houver nada assim.`;

const ESQUEMA = {
  type: "object",
  properties: {
    porOndeComecar: { type: "string" },
    linhas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          protocolo: { type: "string" },
          resumo: { type: "string" },
        },
        required: ["protocolo", "resumo"],
      },
    },
    atencao: { type: "string" },
  },
  required: ["porOndeComecar", "linhas"],
} as const;

/** Quantos casos entram no retrato. Além disso, ninguém lê. */
const TETO = 25;

export async function POST(request: Request) {

  const { usuario, demonstracao } =
    await autenticar(request);

  if (!usuario && !demonstracao) {
    return semSessao(request);
  }

  const entrada = await request
    .json()
    .catch(() => ({}) as Record<string, unknown>);

  const prisma = getPrisma();

  if (!prisma) {
    return responder(
      request,
      {
        erro: "Sem banco configurado — a fila vem do Postgres.",
      },
      503
    );
  }

  const [todos, workspace] = await Promise.all([
    fetchCases(prisma),
    loadWorkspace(),
  ]);

  const abertos = todos
    .filter(isReclameAqui)
    .filter(isOpen);

  /**
   * O que falta em cada caso — calculado, um por um.
   *
   * Cada item é uma coisa que alguém tem de fazer, e nenhum é opinião:
   * ou o campo está vazio, ou o prazo passou, ou a movimentação não
   * voltou. É isso que separa um checkpoint de um palpite.
   */
  const comFaltas = abertos.map((caso) => {

    const sla = slaStatus(
      caso,
      workspace.slaRules,
      hojeNaOperacao()
    );

    const movimento = openMovementOf(
      caso.id,
      workspace.movements
    );

    const situacaoDoMovimento = movimento
      ? movementStatus(movimento, hojeNaOperacao())
      : null;

    const falta: string[] = [];

    if ((caso.publicResponse ?? "").trim() === "") {
      falta.push("sem resposta pública no portal");
    }

    if ((caso.draftResponse ?? "").trim() !== "") {
      falta.push(
        "tem rascunho escrito e ainda não publicado"
      );
    }

    if (!caso.owner) {
      falta.push("sem responsável");
    }

    if (sla.situation === "estourado") {
      falta.push(
        `fora do prazo há ${Math.abs(Math.round(sla.remainingHours / 24))} dia(s)`
      );
    } else if (sla.situation === "atencao") {
      falta.push("prazo perto de vencer");
    }

    if (
      movimento &&
      situacaoDoMovimento?.situation === "estourado"
    ) {
      falta.push(
        `parado em ${movimento.destination} além do prazo de retorno`
      );
    } else if (movimento) {
      falta.push(
        `aguardando ${movimento.destination}`
      );
    }

    if (caso.churnRisk) {
      falta.push("marcado como risco de cancelamento");
    }

    return {
      protocolo: caso.protocol,
      id: caso.id,
      titulo: caso.title,
      cliente: caso.customer,
      categoria: caso.category,
      prioridade: caso.priority,
      status: caso.status,
      responsavel: caso.owner,
      criadoEm: caso.createdAt,
      risco: caso.churnRisk,

      sla: {
        situacao: sla.situation,
        rotulo: sla.label,
      },

      /** O checkpoint: o que **não** foi feito neste caso. */
      falta,

      /** Para ordenar: quanto mais falta e mais atrasado, mais em cima. */
      peso:
        (sla.situation === "estourado" ? 100 : 0) +
        (caso.churnRisk ? 50 : 0) +
        ((caso.publicResponse ?? "").trim() === ""
          ? 40
          : 0) +
        falta.length,
    };
  });

  const ordenados = comFaltas
    .sort((a, b) => b.peso - a.peso)
    .slice(0, TETO);

  /**
   * O retrato da fila inteira, e não só do que coube no teto.
   *
   * Sem isto, "25 casos" seria lido como o total — e a decisão de quem
   * olha (dá para virar hoje?) depende de saber que há mais.
   */
  const contagens = {
    abertos: abertos.length,
    semResposta: comFaltas.filter((c) =>
      c.falta.includes("sem resposta pública no portal")
    ).length,
    foraDoPrazo: comFaltas.filter(
      (c) => c.sla.situacao === "estourado"
    ).length,
    semResponsavel: comFaltas.filter((c) =>
      c.falta.includes("sem responsável")
    ).length,
    comRascunho: comFaltas.filter((c) =>
      c.falta.includes(
        "tem rascunho escrito e ainda não publicado"
      )
    ).length,
    risco: comFaltas.filter((c) => c.risco).length,
    mostrados: ordenados.length,

    /**
     * Quantos casos não têm nenhuma regra de prazo que os alcance.
     *
     * Sem isto, "0 fora do prazo" é a mentira mais tranquilizadora que
     * esta tela sabe contar. Zero atrasados e zero prazos definidos
     * produzem exatamente o mesmo número, e significam o contrário um
     * do outro: no primeiro caso a operação está em dia, no segundo
     * ninguém está medindo. Hoje a base tem **nenhuma** regra de SLA
     * cadastrada, então todo caso cai aqui.
     */
    semRegraDeSla: comFaltas.filter(
      (c) => c.sla.situacao === "sem-regra"
    ).length,

    /**
     * Os avaliados como "Não resolvido" — que não entram na lista.
     *
     * Para o fluxo de trabalho eles estão fechados, e é por isso que
     * `isOpen` os exclui: já respondemos e o consumidor já deu a nota.
     * Para a **reputação** eles são o oposto de fechados — cada um
     * puxa o índice de solução para baixo, e o índice de solução é o
     * item de maior peso da nota do Reclame Aqui.
     *
     * Fica como número, não como linha da fila. Misturá-los com o que
     * está em aberto quebraria a definição que o resto da plataforma
     * usa; escondê-los de vez esconderia o trabalho de recuperação que
     * mais move a nota.
     */
    naoResolvidos: todos
      .filter(isReclameAqui)
      .filter((c) => c.evaluated && !c.resolved).length,
  };

  /**
   * O resumo do modelo é **opcional**, e por isso vem depois.
   *
   * A lista com o checkpoint já responde "o que fazer" sozinha, em
   * milissegundos e sem custo. A leitura da IA acrescenta a ordem e o
   * assunto de cada linha, e custa uma chamada — quem quer paga, quem
   * não quer tem a lista de qualquer jeito.
   */
  const querResumo = entrada.resumir === true;

  if (!querResumo || ordenados.length === 0) {
    return responder(request, {
      referencia: hojeNaOperacao(),
      contagens,
      casos: ordenados,
      resumo: null,
    });
  }

  /**
   * A conversa do WhatsApp, quando o painel está aberto numa.
   *
   * Muda a ordem da fila: quem acabou de escrever cobrando vem antes de
   * quem sumiu há um mês, por pior que esteja o prazo do segundo.
   */
  const conversa = String(entrada.conversa ?? "")
    .trim()
    .slice(-12_000);

  const prompt = [
    `Fila de ${contagens.abertos} reclamação(ões) em aberto no Reclame Aqui. Mostrando as ${ordenados.length} mais urgentes.`,
    `Sem resposta pública: ${contagens.semResposta}. Fora do prazo: ${contagens.foraDoPrazo}. Sem responsável: ${contagens.semResponsavel}. Risco de cancelamento: ${contagens.risco}.`,
    "",
    "Casos, do mais urgente para o menos:",
    ...ordenados.map(
      (c) =>
        `- ${c.protocolo} | ${c.cliente} | ${c.categoria} | prioridade ${c.prioridade} | aberto em ${c.criadoEm} | "${c.titulo}"\n  falta: ${c.falta.join("; ") || "nada apontado"}`
    ),
    conversa
      ? `\n--- CONVERSA ABERTA NO WHATSAPP ---\n${conversa}\n--- fim da conversa ---`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const resultado = await pedirEstruturado({
    sistema: SISTEMA,
    prompt,
    esquema: ESQUEMA,
    rapido: entrada.rapido === true,
  });

  return responder(request, {
    referencia: hojeNaOperacao(),
    contagens,
    casos: ordenados,

    resumo: resultado.dados ?? null,
    erroDoResumo: resultado.erro,

    comConversa: conversa.length > 0,
    provedor: resultado.provedor,
  });
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
