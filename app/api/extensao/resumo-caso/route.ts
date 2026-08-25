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
 * O caso em duas leituras: o geral e o que aconteceu por último.
 *
 * Quem atende chega no caso no meio da história. O relato do consumidor
 * costuma ter mil e poucos caracteres, a resposta pública mais alguns
 * centenas, e por cima disso vem a linha do tempo — anotações de quem
 * mexeu antes, cada uma escrita para quem já sabia do assunto. Ler tudo
 * antes de responder é o certo e é o que ninguém faz com a fila cheia.
 *
 * **São duas perguntas diferentes, e é por isso que são dois campos.**
 *
 * "O que é este caso" é a história inteira: do que o consumidor
 * reclamou, o que já foi feito, onde parou. Serve para quem nunca viu.
 *
 * "O que aconteceu por último" é o estado de agora: a última
 * movimentação real e o que ela exige. Serve para quem já conhece o
 * caso e voltou nele depois de dois dias — e é a pergunta que o resumo
 * geral responde mal, porque o geral dilui o recente no meio do resto.
 *
 * Juntar as duas num texto só faria as duas piores: o começo repetiria
 * o que a pessoa já sabe, e o que ela precisa saber ficaria no fim.
 *
 * **Nada é gravado e nada é enviado ao consumidor.** É leitura, como a
 * triagem — a extensão segue sem mandar mensagem em site nenhum.
 */

const SISTEMA = `Você resume reclamações da Cardápio Web, empresa de sistema para restaurantes (PDV, cardápio online, integrações de delivery), para quem vai atender agora.

Escreva em português do Brasil, direto, sem preâmbulo e sem repetir o que o campo já diz.

Duas leituras, e elas não se repetem:

- "geral": a história do caso para quem nunca viu. Do que o consumidor reclamou, o que já foi feito, onde parou. No máximo quatro frases.
- "ultimo": o que aconteceu por último e o que isso exige agora. Se a última coisa foi uma anotação interna, diga o que ela mudou. Se nada aconteceu depois do relato, diga exatamente isso — não invente movimento. No máximo duas frases.

Regras que valem para as duas:
- Nunca invente protocolo, valor, data, prazo, nome ou promessa que não esteja no material.
- Não sugira resposta e não escreva rascunho: quem faz isso é a triagem.
- Não repita o título do caso; quem lê já está olhando para ele.
- Se o material for curto demais para resumir, diga isso em vez de encher linguiça.

"pontos" são os fatos que mudam a decisão de quem atende: valor citado, prazo prometido, produto envolvido, o que o consumidor pediu. No máximo quatro, cada um em poucas palavras. Fato, não conselho.`;

const ESQUEMA = {
  type: "object",
  properties: {
    geral: {
      type: "string",
      description:
        "A história do caso para quem nunca viu. Até quatro frases.",
    },
    ultimo: {
      type: "string",
      description:
        "O que aconteceu por último e o que exige agora. Até duas frases.",
    },
    pontos: {
      type: "array",
      items: { type: "string" },
      description:
        "Fatos que mudam a decisão de quem atende. Até quatro.",
    },
  },
  required: ["geral", "ultimo"],
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
