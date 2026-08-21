import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { getPrisma } from "@/lib/prisma";
import { loadWorkspace } from "@/lib/actions/workspace";
import { fetchCaseByProtocol } from "@/lib/services/case.repository";
import { pedirEstruturado } from "@/lib/services/ia.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dá para responder agora, ou precisa de análise?
 *
 * É a primeira pergunta de quem abre uma reclamação, e a que mais custa
 * quando é respondida errado nos dois sentidos: responder o que exigia
 * apuração vira promessa que não se cumpre; mandar para análise o que
 * já tinha resposta pronta queima o prazo do índice de resposta, que é
 * o item de maior peso da nota.
 *
 * **A triagem sugere, não decide.** Devolve a leitura e o rascunho para
 * alguém conferir — nada é gravado, nada é enviado ao consumidor. A
 * extensão continua sem mandar mensagem em site nenhum.
 *
 * O que ela vê: o relato, o estado do caso e os **textos aprovados**
 * (macros) que existem para aquele canal. É o que separa "sei responder"
 * de "inventei uma resposta": se nenhuma macro cobre o assunto e o
 * relato pede dado que não está ali, a resposta certa é analisar.
 */

const SISTEMA = `Você faz a triagem de reclamações da Cardápio Web, empresa de sistema para restaurantes (PDV, cardápio online, integrações de delivery).

Lê uma reclamação e decide uma coisa só: dá para responder agora, ou precisa de análise interna antes?

Regras:
- Escreva em português do Brasil, direto, sem preâmbulo.
- "responder" só quando a resposta não depende de nenhum dado que você não tem. Pedido de desculpa com orientação já existente, dúvida coberta por um texto aprovado, ou pergunta que se responde com o que está no relato — isso é responder.
- "analisar" quando for preciso olhar o sistema, conferir cobrança, checar log, envolver outro time, ou quando o relato afirma um fato que só a operação pode confirmar. Na dúvida entre os dois, escolha analisar: prometer o que não se sabe é pior do que demorar.
- "oQueFalta" só aparece quando a decisão é analisar, e lista o que precisa ser descoberto — cada item é uma coisa concreta de verificar, não um conselho.
- "rascunho" é um texto para o atendente enviar depois de conferir. Mesmo quando a decisão é analisar, escreva o rascunho de acolhimento: o consumidor precisa de retorno dentro do prazo mesmo que a solução demore.
- Nunca invente protocolo, valor, data, prazo ou nome que não apareça no material fornecido.
- Não prometa prazo. Se o rascunho precisar falar de tempo, diga que a equipe retorna com a apuração, sem número.`;

const ESQUEMA = {
  type: "object",
  properties: {
    decisao: {
      type: "string",
      enum: ["responder", "analisar"],
      description:
        "responder = dá para responder agora; analisar = precisa de apuração interna.",
    },
    porque: {
      type: "string",
      description:
        "Uma ou duas frases dizendo o que levou a essa decisão.",
    },
    assunto: {
      type: "string",
      description: "O tema em três a seis palavras.",
    },
    gravidade: {
      type: "string",
      enum: ["baixa", "media", "alta"],
      description:
        "alta quando há risco de cancelamento, prejuízo financeiro declarado ou ameaça de ação.",
    },
    oQueFalta: {
      type: "array",
      items: { type: "string" },
      description:
        "Só quando analisar: o que precisa ser verificado, um item por coisa concreta.",
    },
    areaSugerida: {
      type: "string",
      description:
        "Só quando analisar: qual time deve apurar. Vazio quando não der para saber.",
    },
    rascunho: {
      type: "string",
      description:
        "Texto para o atendente revisar e enviar. Sempre presente.",
    },
  },
  required: [
    "decisao",
    "porque",
    "assunto",
    "gravidade",
    "rascunho",
  ],
};

interface Entrada {
  protocolo?: string;
}

export async function POST(request: Request) {

  const { usuario, demonstracao } =
    await autenticar(request);

  if (!usuario && !demonstracao) {
    return semSessao(request);
  }

  const prisma = getPrisma();

  if (!prisma) {
    return responder(
      request,
      {
        erro: "Sem banco configurado — a triagem lê o caso do Postgres.",
      },
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

  const protocolo = (entrada.protocolo ?? "").trim();

  if (!protocolo) {
    return responder(
      request,
      { erro: "Faltou o protocolo." },
      400
    );
  }

  const caso = await fetchCaseByProtocol(
    prisma,
    protocolo
  );

  if (!caso) {
    return responder(
      request,
      { erro: `Não achei o caso ${protocolo}.` },
      404
    );
  }

  if (!(caso.description ?? "").trim()) {
    return responder(
      request,
      {
        erro: "Este caso não tem relato gravado — sem texto não há o que triar.",
      },
      422
    );
  }

  const workspace = await loadWorkspace();

  /**
   * As macros entram para o modelo saber o que **já** existe resposta.
   *
   * Sem isso ele decidiria "responder" com um texto inventado, ou
   * "analisar" um assunto que a operação já resolveu cem vezes. Só
   * título e trecho: o corpo inteiro de cinco macros dominaria o
   * contexto e afogaria o relato, que é o que importa ler.
   */
  const aprovados = workspace.macros
    .slice(0, 12)
    .map(
      (macro) =>
        `- ${macro.title}: ${macro.body.slice(0, 200)}`
    )
    .join("\n");

  const prompt = [
    `Reclamação ${caso.protocol}, canal ${caso.source}, status "${caso.status}".`,
    caso.category && `Categoria: ${caso.category}.`,
    caso.evaluated
      ? `Já avaliada: nota ${caso.score ?? "—"}, ${caso.resolved ? "resolvida" : "não resolvida"}.`
      : "Ainda sem avaliação do consumidor.",
    (caso.publicResponse ?? "").trim()
      ? `Já respondemos publicamente:\n${caso.publicResponse}`
      : "Ainda sem resposta pública nossa.",
    "",
    `Título: ${caso.title}`,
    "",
    "Relato do consumidor:",
    caso.description,
    "",
    aprovados
      ? `Textos aprovados que a operação já usa:\n${aprovados}`
      : "Não há textos aprovados cadastrados.",
  ]
    .filter(Boolean)
    .join("\n");

  const resultado = await pedirEstruturado({
    sistema: SISTEMA,
    prompt,
    esquema: ESQUEMA,
  });

  if (resultado.erro || !resultado.dados) {
    return responder(
      request,
      {
        erro: resultado.erro,
        provedor: resultado.provedor,
      },
      resultado.status ?? 502
    );
  }

  return responder(request, {
    ...resultado.dados,
    protocolo: caso.protocol,
    provedor: resultado.provedor,
    custo: resultado.uso,
  });
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
