import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { getPrisma } from "@/lib/prisma";
import { fetchCaseByProtocol } from "@/lib/services/case.repository";
import { pedirEstruturado } from "@/lib/services/ia.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O dossiê do caso: tudo que aconteceu, e o que fazer com isso.
 *
 * Quem atende chega no caso no meio da história. O relato do consumidor
 * costuma ter mil e poucos caracteres, a resposta pública mais algumas
 * centenas, e por cima disso vem a linha do tempo — anotações de quem
 * mexeu antes, cada uma escrita para quem já sabia do assunto. Ler tudo
 * antes de responder é o certo e é o que ninguém faz com a fila cheia.
 *
 * **A primeira versão trazia só duas frases curtas**, e o Isaac apontou
 * o problema: "traz só uma situação". Um resumo enxuto serve para
 * situar e não serve para assumir o caso — quem precisa responder ainda
 * tinha de ler tudo de novo.
 *
 * Agora são seis campos, e cada um responde uma pergunta que os outros
 * não respondem:
 *
 * - `geral` — para situar em dez segundos. Continua curto de propósito.
 * - `ultimo` — o que mudou desde a última vez que alguém olhou.
 * - `dossie` — **tudo, na ordem, sem limite de tamanho.** É o campo que
 *   o Isaac pediu: o suficiente para assumir o caso sem ler mais nada.
 * - `proximaResposta` — o que dizer na próxima interação, e por quê.
 * - `pendencias` — o que falta para o caso fechar.
 * - `respostas` — três textos prontos, um para cada situação em que o
 *   caso pode estar: acolher e apurar, responder com solução, encerrar
 *   e pedir reavaliação.
 *
 * **Por que três respostas e não uma.** A triagem já decide "responder
 * ou analisar" e escreve um rascunho para aquela decisão. Aqui é outra
 * coisa: o caso pode estar em três estados diferentes conforme o que a
 * apuração descobrir, e escrever os três de uma vez evita uma segunda
 * chamada ao modelo no momento em que a pessoa já sabe o que quer
 * dizer. Quem atende escolhe qual serve.
 *
 * **Nada é gravado e nada é enviado ao consumidor.** É leitura e
 * rascunho, como a triagem — a extensão segue sem mandar mensagem em
 * site nenhum.
 */

const SISTEMA = `Você monta o dossiê de uma reclamação da Cardápio Web, empresa de sistema para restaurantes (PDV, cardápio online, integrações de delivery), para quem vai atender agora.

Escreva em português do Brasil, direto, sem preâmbulo e sem repetir o que o campo já diz.

São seis coisas, e cada uma responde uma pergunta diferente. Não repita conteúdo entre elas.

- "geral": para situar em dez segundos. Do que o consumidor reclamou e onde o caso parou. No máximo quatro frases.

- "ultimo": o que aconteceu por último e o que isso exige agora. Se a última coisa foi uma anotação interna, diga o que ela mudou. Se nada aconteceu depois do relato, diga exatamente isso — não invente movimento. No máximo duas frases.

- "dossie": **tudo que aconteceu, na ordem em que aconteceu.** Este é o campo longo e não tem limite de tamanho: escreva o quanto for preciso para alguém que nunca viu o caso conseguir assumi-lo sem ler mais nada. Comece pelo que o consumidor relatou, com os detalhes concretos que ele deu. Depois, cada movimento na sequência: o que a empresa respondeu publicamente, cada anotação interna e o que ela mudou, cada movimentação entre times e se voltou. Cite datas quando existirem. Termine dizendo em que estado o caso está agora. Se o material for pobre, diga o que falta em vez de inventar — um dossiê curto e honesto vale mais do que um longo e imaginado.

- "proximaResposta": o que dizer na próxima interação com o consumidor, e por quê. Duas ou três frases. Não é o texto da resposta — é a orientação de conteúdo: o que reconhecer, o que informar, o que não prometer.

- "pendencias": o que precisa ser resolvido para este caso fechar. Cada item é uma coisa concreta que alguém tem de fazer ou descobrir, com o responsável quando o material disser. Não repita o que já foi feito. Se não houver pendência, devolva lista vazia — não invente trabalho.

- "respostas": exatamente três textos prontos, cada um para uma situação diferente do mesmo caso. Sempre estes três, nesta ordem:
  1. titulo "Acolher e apurar" — quando ainda não há resposta e é preciso responder dentro do prazo sem prometer solução. Reconhece o problema, diz que está sendo apurado, não dá prazo em número.
  2. titulo "Responder com solução" — quando há o que informar. Explica o que foi feito ou o que o consumidor precisa fazer, em passos concretos tirados do material.
  3. titulo "Encerrar e pedir reavaliação" — para quando o assunto está resolvido. Confirma a solução e convida o consumidor a atualizar a avaliação, sem cobrar nota.
  Cada uma tem "quando" (uma frase dizendo em que situação usar) e "texto" (a mensagem pronta para revisar e enviar).

Regras que valem para tudo:
- Nunca invente protocolo, valor, data, prazo, nome ou promessa que não esteja no material.
- Não prometa prazo em número. Se precisar falar de tempo, diga que a equipe retorna com a apuração.
- Os textos de "respostas" são para o atendente revisar antes de enviar — escreva-os prontos, mas nada é enviado automaticamente.
- Não repita o título do caso; quem lê já está olhando para ele.

"pontos" são os fatos que mudam a decisão de quem atende: valor citado, prazo prometido, produto envolvido, o que o consumidor pediu. No máximo seis, cada um em poucas palavras. Fato, não conselho.`;

const ESQUEMA = {
  type: "object",
  properties: {
    geral: {
      type: "string",
      description:
        "Para situar em dez segundos. Até quatro frases.",
    },
    ultimo: {
      type: "string",
      description:
        "O que aconteceu por último e o que exige agora. Até duas frases.",
    },
    dossie: {
      type: "string",
      description:
        "Tudo que aconteceu, na ordem. Sem limite de tamanho — o suficiente para alguém assumir o caso sem ler mais nada.",
    },
    proximaResposta: {
      type: "string",
      description:
        "O que dizer na próxima interação e por quê. Orientação de conteúdo, não o texto.",
    },
    pendencias: {
      type: "array",
      items: { type: "string" },
      description:
        "O que precisa ser resolvido para o caso fechar. Vazio quando não há nada.",
    },
    respostas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          quando: {
            type: "string",
            description:
              "Uma frase dizendo em que situação usar esta.",
          },
          texto: {
            type: "string",
            description:
              "A mensagem pronta para revisar e enviar.",
          },
        },
        required: ["titulo", "quando", "texto"],
      },
      description:
        "Exatamente três: acolher e apurar, responder com solução, encerrar e pedir reavaliação.",
    },
    pontos: {
      type: "array",
      items: { type: "string" },
      description:
        "Fatos que mudam a decisão de quem atende. Até seis.",
    },
  },
  required: [
    "geral",
    "ultimo",
    "dossie",
    "proximaResposta",
  ],
} as const;

export async function POST(request: Request) {

  /**
   * `autenticar` devolve **um objeto**, sempre verdadeiro.
   *
   * A primeira versão desta rota fazia `if (!sessao) return semSessao()`
   * — e `{ usuario: null, demonstracao: false }` é truthy, então a
   * guarda nunca disparava. Medido contra o servidor: a rota respondia
   * **200 sem sessão nenhuma**, devolvendo o relato inteiro do
   * consumidor e gastando uma chamada ao modelo para quem soubesse a
   * URL. As outras rotas da extensão devolviam 401 no mesmo teste.
   *
   * A desestruturação é o que torna o erro impossível: não há um valor
   * único para testar por engano.
   */
  const { usuario, demonstracao } =
    await autenticar(request);

  if (!usuario && !demonstracao) {
    return semSessao(request);
  }

  const entrada = await request
    .json()
    .catch(() => ({}) as Record<string, unknown>);

  const protocolo = String(
    entrada.protocolo ?? ""
  ).trim();

  if (!protocolo) {
    return responder(
      request,
      { erro: "Informe o protocolo." },
      400
    );
  }

  const prisma = getPrisma();

  if (!prisma) {
    return responder(
      request,
      {
        erro: "Sem banco configurado — o resumo lê o caso no Postgres.",
      },
      503
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

  /**
   * A linha do tempo, do mais antigo para o mais recente.
   *
   * O detalhe mostra ao contrário — o mais novo em cima, que é o certo
   * para ler na tela. Aqui a ordem se inverte de propósito: o modelo
   * precisa da sequência dos fatos para dizer o que veio depois do
   * quê, e uma lista invertida faz ele descrever a história de trás
   * para a frente.
   */
  const anotacoes = await prisma.caseComment.findMany({
    where: { case: { protocol: protocolo } },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
    take: 30,
  });

  /**
   * As movimentações entre times entram junto.
   *
   * "Foi para a Tecnologia há seis dias e não voltou" é a informação
   * mais importante que existe sobre alguns casos, e ela não está no
   * relato nem nas anotações — está aqui.
   */
  const movimentacoes =
    await prisma.caseMovement.findMany({
      where: { case: { protocol: protocolo } },
      orderBy: { startedAt: "asc" },
      take: 20,
    });

  const dia = (d: Date) =>
    d.toISOString().slice(0, 10);

  const linhaDoTempo = [
    ...anotacoes.map((item) => ({
      quando: item.createdAt,
      texto: `${dia(item.createdAt)} — anotação de ${item.author?.name ?? "alguém"}: ${item.body}`,
    })),
    ...movimentacoes.map((item) => ({
      quando: item.startedAt,
      texto: `${dia(item.startedAt)} — movido para ${item.destination}${
        item.reason ? ` (${item.reason})` : ""
      }${
        item.returnedAt
          ? `, devolvido em ${dia(item.returnedAt)}${item.outcome ? `: ${item.outcome}` : ""}`
          : ", **ainda não devolvido**"
      }`,
    })),
  ]
    .sort(
      (a, b) => a.quando.getTime() - b.quando.getTime()
    )
    .map((item) => item.texto);

  const prompt = [
    `Reclamação ${caso.protocol}, canal ${caso.source}, status "${caso.status}".`,
    caso.category &&
      `Categoria: ${caso.category}${caso.subcategory ? ` / ${caso.subcategory}` : ""}.`,
    `Aberta em ${caso.createdAt}. Consumidor: ${caso.customer}.`,
    caso.evaluated
      ? `Avaliada: nota ${caso.score ?? "—"}, ${caso.resolved ? "resolvida" : "NÃO resolvida"}, ${caso.wouldDoBusiness ? "voltaria" : "não voltaria"} a fazer negócio.`
      : "Ainda sem avaliação do consumidor.",
    caso.churnRisk ? "Marcada como risco de cancelamento." : "",
    "",
    `Título: ${caso.title}`,
    "",
    "Relato do consumidor:",
    caso.description || "(sem relato registrado)",
    "",
    (caso.publicResponse ?? "").trim()
      ? `Resposta pública que já publicamos:\n${caso.publicResponse}`
      : "Ainda sem resposta pública nossa.",
    "",
    linhaDoTempo.length > 0
      ? `Linha do tempo interna, do mais antigo para o mais recente:\n${linhaDoTempo.join("\n")}`
      : "Nenhuma anotação nem movimentação interna registrada — nada aconteceu depois do relato.",
  ]
    .filter(Boolean)
    .join("\n");

  const rapido = entrada.rapido === true;

  const resultado = await pedirEstruturado({
    sistema: SISTEMA,
    prompt,
    esquema: ESQUEMA,
    rapido,
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

    /**
     * Quantos fatos internos o resumo teve para ler.
     *
     * Sem isso, "nada aconteceu depois do relato" e "o modelo não
     * recebeu a linha do tempo" ficam indistinguíveis na tela — e são
     * coisas muito diferentes para quem vai decidir o que fazer.
     */
    fatos: linhaDoTempo.length,

    provedor: resultado.provedor,
    rapido,
    custo: resultado.uso,
  });
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
