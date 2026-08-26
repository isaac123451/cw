import { NextResponse } from "next/server";

import { tryRole } from "@/lib/auth/guard";
import { getPrisma } from "@/lib/prisma";
import { loadWorkspace } from "@/lib/actions/workspace";
import { fetchCases } from "@/lib/services/case.repository";
import { pedirEstruturado } from "@/lib/services/ia.service";

import {
  isOpen,
  isReclameAqui,
  isSocial,
} from "@/lib/services/case.service";

import { slaStatus } from "@/lib/services/sla.service";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

import { isEncerrado, segmentOf } from "@/lib/models/nps";
import { slaState } from "@/lib/services/nps.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O checklist do dia, lendo as três frentes.
 *
 * O Isaac pediu: "um checklist seria interessante seguindo algo com IA
 * para adicionar nesta funcionalidade, e assim ele entender o que
 * precisaria verificando os casos das 3 frentes".
 *
 * A agenda mostra o que **alguém marcou**. Isso é metade do dia: a outra
 * metade é o que está aberto e ninguém marcou — a reclamação sem
 * resposta, o detrator sem primeiro contato, o atendimento do Instagram
 * parado. Nenhuma dessas vira tarefa sozinha, e é justamente por isso
 * que somem.
 *
 * **Os fatos são calculados; a IA só ordena e explica.** Cada item da
 * lista vem de uma consulta ao banco — "sem resposta pública", "fora do
 * prazo de primeiro contato", "sem responsável". Pedir isso a um modelo
 * seria trocar um número exato por um plausível, e numa lista de
 * pendências um item inventado manda alguém trabalhar no caso errado.
 *
 * O que o modelo faz é o que ele faz bem: olhar as três frentes juntas,
 * dizer por onde começar e escrever cada linha em português de gente.
 */

const SISTEMA = `Você monta o checklist do dia de quem cuida da Experiência do Cliente da Cardápio Web.

Recebe o retrato das três frentes — Reclame Aqui, Redes Sociais e NPS — já contado e conferido. Os números são fatos: não recalcule, não invente pendência, não contradiga o material.

Escreva em português do Brasil, direto, sem preâmbulo e sem repetir o número que já está no material.

- "abertura": duas frases dizendo como está o dia e o que decide a ordem. Se uma frente está muito pior que as outras, diga qual e por quê.

- "itens": de quatro a oito tarefas, na ordem em que devem ser feitas. Cada uma com:
  · "titulo" — a ação, começando por verbo, no máximo oito palavras.
  · "porque" — uma frase dizendo o que acontece se ficar para depois. É o que faz alguém escolher esta e não outra.
  · "frente" — "reclame-aqui", "social", "nps" ou "geral".
  · "quantos" — o número de casos que este item cobre, tirado do material. Zero se não for uma contagem.

  Ordene por consequência, não por tamanho: um detrator sem contato há cinco dias vem antes de trinta reclamações já respondidas esperando avaliação.

- "atencao": uma coisa que o conjunto revela e que nenhum item isolado mostra — uma categoria concentrando o atraso, uma frente sem responsável, um padrão entre as três. Vazio se não houver.

Se o dia estiver limpo, diga isso em "abertura" e devolva poucos itens, ou nenhum. Inventar trabalho para encher a lista é pior do que uma lista curta.`;

const ESQUEMA = {
  type: "object",
  properties: {
    abertura: { type: "string" },
    itens: {
      type: "array",
      items: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          porque: { type: "string" },
          frente: {
            type: "string",
            enum: [
              "reclame-aqui",
              "social",
              "nps",
              "geral",
            ],
          },
          quantos: { type: "integer" },
        },
        required: ["titulo", "porque", "frente"],
      },
    },
    atencao: { type: "string" },
  },
  required: ["abertura", "itens"],
} as const;

export async function POST(request: Request) {

  const ctx = await tryRole("LEITURA", "reclame-aqui");

  if (!ctx) {
    return NextResponse.json(
      { erro: "Sessão expirada. Entre novamente." },
      { status: 401 }
    );
  }

  const prisma = getPrisma();

  if (!prisma) {
    return NextResponse.json(
      { erro: "Sem banco configurado." },
      { status: 503 }
    );
  }

  const entrada = await request
    .json()
    .catch(() => ({}) as Record<string, unknown>);

  const hoje = hojeNaOperacao();

  const [casos, workspace, nps, tarefas] =
    await Promise.all([
      fetchCases(prisma),
      loadWorkspace(),
      prisma.npsResponse.findMany({
        select: {
          score: true,
          status: true,
          firstContactAt: true,
          firstContactDueAt: true,
          rootCause: true,
          ownerId: true,
        },
      }),
      prisma.agendaTask.findMany({
        where: { done: false },
        select: { title: true, dueDate: true },
      }),
    ]);

  /* ------------------------------------------ RECLAME AQUI ---- */

  const ra = casos.filter(isReclameAqui).filter(isOpen);

  const raSemResposta = ra.filter(
    (c) => (c.publicResponse ?? "").trim() === ""
  );

  const raSemDono = ra.filter((c) => !c.owner);

  const raForaDoPrazo = ra.filter(
    (c) =>
      slaStatus(c, workspace.slaRules, hoje).situation ===
      "estourado"
  );

  const raRisco = casos
    .filter(isReclameAqui)
    .filter((c) => c.churnRisk && isOpen(c));

  /*
    Os avaliados como não resolvido ficam de fora de `isOpen` — para o
    fluxo estão fechados. Para a reputação são o oposto: cada um puxa o
    índice de solução, que é o item de maior peso da nota.
  */
  const raNaoResolvidos = casos
    .filter(isReclameAqui)
    .filter((c) => c.evaluated && !c.resolved).length;

  /* --------------------------------------- REDES SOCIAIS ---- */

  const social = casos.filter(isSocial).filter(isOpen);

  const socialSemDono = social.filter((c) => !c.owner);

  /* ------------------------------------------------- NPS ---- */

  const npsAbertos = nps.filter(
    (r) => !isEncerrado(r.status)
  );

  const npsForaDoPrazo = npsAbertos.filter(
    (r) =>
      slaState({
        firstContactAt: r.firstContactAt?.toISOString(),
        firstContactDueAt:
          r.firstContactDueAt.toISOString(),
        status: r.status,
      } as never) === "estourado"
  );

  const detratoresSemContato = npsAbertos.filter(
    (r) =>
      segmentOf(r.score).label === "Detrator" &&
      !r.firstContactAt
  );

  const npsSemCausa = npsAbertos.filter(
    (r) => !r.rootCause
  );

  /* --------------------------------------------- retrato ---- */

  const retrato = {
    dia: hoje,

    reclameAqui: {
      emAberto: ra.length,
      semRespostaPublica: raSemResposta.length,
      semResponsavel: raSemDono.length,
      foraDoPrazo: raForaDoPrazo.length,
      riscoDeCancelamento: raRisco.length,
      avaliadosComoNaoResolvido: raNaoResolvidos,
      semRegraDeSla: workspace.slaRules.length === 0,
    },

    redesSociais: {
      emAberto: social.length,
      semResponsavel: socialSemDono.length,
    },

    nps: {
      emTratativa: npsAbertos.length,
      foraDoPrazoDePrimeiroContato:
        npsForaDoPrazo.length,
      detratoresSemPrimeiroContato:
        detratoresSemContato.length,
      semCausaRaiz: npsSemCausa.length,
    },

    agenda: {
      tarefasPendentes: tarefas.length,
      atrasadas: tarefas.filter(
        (t) => t.dueDate.toISOString().slice(0, 10) < hoje
      ).length,
    },
  };

  /**
   * Sem IA configurada, o checklist ainda sai.
   *
   * Os fatos são a parte que importa e não dependem de modelo nenhum.
   * Devolver 503 aqui deixaria a tela sem nada por causa de uma chave
   * de API — e o que ela pediria de volta já está calculado.
   */
  const querIa = entrada.ia !== false;

  if (!querIa) {
    return NextResponse.json({ retrato, checklist: null });
  }

  const prompt = [
    `Dia ${hoje}.`,
    "",
    "RECLAME AQUI",
    `- ${retrato.reclameAqui.emAberto} reclamação(ões) em aberto`,
    `- ${retrato.reclameAqui.semRespostaPublica} sem resposta pública no portal`,
    `- ${retrato.reclameAqui.semResponsavel} sem responsável`,
    retrato.reclameAqui.semRegraDeSla
      ? "- nenhuma regra de SLA cadastrada, então nada pode ser apontado como fora do prazo"
      : `- ${retrato.reclameAqui.foraDoPrazo} fora do prazo`,
    `- ${retrato.reclameAqui.riscoDeCancelamento} marcadas como risco de cancelamento`,
    `- ${retrato.reclameAqui.avaliadosComoNaoResolvido} avaliadas como NÃO resolvida (fechadas para o fluxo, mas puxando o índice de solução)`,
    "",
    "REDES SOCIAIS",
    `- ${retrato.redesSociais.emAberto} atendimento(s) em aberto`,
    `- ${retrato.redesSociais.semResponsavel} sem responsável`,
    "",
    "NPS",
    `- ${retrato.nps.emTratativa} ciclo(s) em tratativa`,
    `- ${retrato.nps.foraDoPrazoDePrimeiroContato} fora do prazo de primeiro contato`,
    `- ${retrato.nps.detratoresSemPrimeiroContato} detratores sem nenhum contato ainda`,
    `- ${retrato.nps.semCausaRaiz} sem causa raiz classificada`,
    "",
    "AGENDA",
    `- ${retrato.agenda.tarefasPendentes} tarefa(s) marcada(s) e não concluída(s), ${retrato.agenda.atrasadas} atrasada(s)`,
  ].join("\n");

  const resultado = await pedirEstruturado({
    sistema: SISTEMA,
    prompt,
    esquema: ESQUEMA,
    rapido: entrada.rapido === true,
  });

  return NextResponse.json({
    retrato,
    checklist: resultado.dados ?? null,
    erro: resultado.erro,
    provedor: resultado.provedor,
  });
}
