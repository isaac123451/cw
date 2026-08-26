import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { getPrisma } from "@/lib/prisma";
import {
  fetchCaseByProtocol,
  fetchCases,
} from "@/lib/services/case.repository";

import {
  compararNome,
  compararTelefone,
  lerTelefone,
} from "@/lib/services/contato.service";
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

- "dossie": **tudo que aconteceu, na ordem em que aconteceu.** Quando houver transcrição do Crisp no material, ela entra na narrativa junto do resto, na ordem cronológica: quantas vezes o consumidor procurou o suporte, o que foi prometido a ele, quem atendeu, onde travou. O que aconteceu no chat costuma explicar por que a reclamação existe. Este é o campo longo e não tem limite de tamanho: escreva o quanto for preciso para alguém que nunca viu o caso conseguir assumi-lo sem ler mais nada. Comece pelo que o consumidor relatou, com os detalhes concretos que ele deu. Depois, cada movimento na sequência: o que a empresa respondeu publicamente, cada anotação interna e o que ela mudou, cada movimentação entre times e se voltou. Cite datas quando existirem. Termine dizendo em que estado o caso está agora. Se o material for pobre, diga o que falta em vez de inventar — um dossiê curto e honesto vale mais do que um longo e imaginado.

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

  /**
   * O teto de 40 mil caracteres não é economia — é proteção.
   *
   * Uma transcrição longa demais empurra o relato e a linha do tempo
   * para fora da janela do modelo, e o dossiê sairia contando bem o
   * chat e mal a reclamação. Quarenta mil cobrem um atendimento inteiro
   * com folga; o que passar disso é conversa de meses, e o começo é o
   * que menos importa.
   */
  const transcricao = String(entrada.transcricao ?? "")
    .trim()
    .slice(-40_000);

  /** Quem é o contato, quando não há caso para dizer. */
  const contato = {
    nome: String(entrada.nome ?? "").trim(),
    telefone: String(entrada.telefone ?? "").trim(),

    /** A chave que liga o NPS aos outros canais — ver `alvo` abaixo. */
    email: String(entrada.email ?? "").trim(),
  };

  /**
   * **Dá para montar dossiê sem caso cadastrado.**
   *
   * A primeira versão exigia protocolo e devolvia 400 sem ele — e o
   * Isaac apontou o buraco: cliente que ainda não abriu reclamação
   * pública é justamente quem mais precisa de dossiê. É a conversa que
   * pode virar reclamação, e ler o atendimento antes de responder é o
   * que evita que vire.
   *
   * O que muda é o material, não o formato: sem caso, o dossiê se apoia
   * na transcrição e no contato. Sem caso **e** sem transcrição não há
   * o que resumir, e aí a recusa é honesta — não há material nenhum.
   */
  if (!protocolo && !transcricao) {
    return responder(
      request,
      {
        erro: "Sem caso e sem transcrição não há o que resumir.",
        dica: "Cole a transcrição do atendimento no Crisp, ou abra um caso deste cliente.",
      },
      400
    );
  }

  const prisma = getPrisma();

  if (!prisma && protocolo) {
    return responder(
      request,
      {
        erro: "Sem banco configurado — o resumo lê o caso no Postgres.",
      },
      503
    );
  }

  const caso =
    prisma && protocolo
      ? await fetchCaseByProtocol(prisma, protocolo)
      : null;

  /**
   * Protocolo pedido e não achado é erro; protocolo ausente não é.
   *
   * A diferença importa: quem mandou um número e não recebe nada
   * precisa saber que o número está errado, e não receber um dossiê
   * genérico como se estivesse tudo bem.
   */
  if (protocolo && !caso) {
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
  const anotacoes =
    prisma && caso
      ? await prisma.caseComment.findMany({
          where: { case: { protocol: protocolo } },
          include: { author: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
          take: 30,
        })
      : [];

  /**
   * As movimentações entre times entram junto.
   *
   * "Foi para a Tecnologia há seis dias e não voltou" é a informação
   * mais importante que existe sobre alguns casos, e ela não está no
   * relato nem nas anotações — está aqui.
   */
  const movimentacoes =
    prisma && caso
      ? await prisma.caseMovement.findMany({
          where: { case: { protocol: protocolo } },
          orderBy: { startedAt: "asc" },
          take: 20,
        })
      : [];

  const dia = (d: Date) =>
    d.toISOString().slice(0, 10);

  /**
   * O histórico do contato inteiro: NPS e os outros casos dele.
   *
   * O dossiê nasceu preso a um caso, e por isso descrevia uma
   * reclamação — não um cliente. O Isaac pediu o mesmo recurso no NPS e
   * nas Redes Sociais, e a leitura certa do pedido não é "faça outro
   * dossiê para cada canal": é que o cliente é um só. Quem detratou no
   * NPS em março e abriu reclamação em agosto está contando a mesma
   * história em dois lugares, e o dossiê que enxerga só um dos dois faz
   * quem atende repetir a pergunta que já foi respondida.
   *
   * Por isso a busca é por contato, não por canal — e o mesmo bloco
   * serve o Reclame Aqui, o NPS e as Redes Sociais sem nenhum ramo
   * dedicado.
   */
  const alvo = {
    telefone: lerTelefone(
      contato.telefone || caso?.phone || ""
    ),
    nome: contato.nome || caso?.customer || "",

    /**
     * O e-mail é o que **de fato** liga os canais nesta base.
     *
     * Medido antes de escrever este código, sobre os dados reais: dos
     * 868 ciclos de NPS, **zero** têm telefone e 867 têm e-mail. E o
     * campo `customer` do NPS não guarda nome de pessoa — guarda o
     * começo do e-mail ("northparrilla", "dtchellopizzaria"), porque a
     * carga veio da ferramenta de pesquisa e não do cadastro. Cruzar
     * por telefone ou por nome ali é procurar o que não existe.
     *
     * Por isso o e-mail vem primeiro e é igualdade, não semelhança.
     * Telefone e nome ficam como as rungs seguintes: servem para os
     * outros casos do mesmo cliente, onde o telefone existe nos dois
     * lados.
     */
    email: (contato.email || caso?.email || "")
      .trim()
      .toLowerCase(),
  };

  const temContato = Boolean(
    alvo.email || alvo.telefone?.digitos || alvo.nome
  );

  const [ciclosDeNps, outrosCasos] =
    prisma && temContato
      ? await Promise.all([
          prisma.npsResponse.findMany({
            orderBy: { respondedAt: "desc" },
            take: 400,
            select: {
              customer: true,
              email: true,
              phone: true,
              score: true,
              comment: true,
              respondedAt: true,
              status: true,
              kind: true,
              rootCause: true,
              postContactNote: true,
              resolvedAfter: true,
            },
          }),
          fetchCases(prisma),
        ])
      : [[], []];

  /** E-mail primeiro, telefone depois, nome por último. */
  const eDele = (
    telefone?: string | null,
    nome?: string | null,
    email?: string | null
  ) => {

    /*
      E-mail é igualdade — ou é a mesma caixa, ou não é.

      Vem antes de tudo porque não erra: telefone precisa tolerar o
      nono dígito e nome precisa tolerar abreviação, e cada tolerância
      dessas é uma chance de juntar duas pessoas diferentes.
    */
    const dele = (email ?? "").trim().toLowerCase();

    if (alvo.email && dele) {
      return alvo.email === dele;
    }

    if (alvo.telefone?.digitos) {

      const casou = compararTelefone(
        alvo.telefone,
        lerTelefone(telefone ?? "")
      );

      if (casou) return true;

      /*
        Telefone dos dois lados e discordante encerra a comparação.

        Com telefone disponível em ambos, nome igual é coincidência mais
        provável do que a mesma pessoa — "Maria Silva" aparece às
        dezenas nesta base.
      */
      if (telefone) return false;
    }

    return compararNome(alvo.nome, nome ?? "") === "exata";
  };

  const npsDoContato = ciclosDeNps
    .filter((n) => eDele(n.phone, n.customer, n.email))
    .slice(0, 12);

  const casosDoContato = outrosCasos
    .filter((c) => c.protocol !== protocolo)
    .filter((c) => eDele(c.phone, c.customer, c.email))
    .slice(0, 12);

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

  /**
   * O que o contato já viveu nos outros canais, em texto.
   *
   * Vai como bloco próprio e rotulado. Misturado à linha do tempo do
   * caso, o modelo dataria um comentário de NPS de março como se fosse
   * anotação da reclamação de agosto.
   */
  const historicoDoContato = [
    ...npsDoContato.map(
      (n) =>
        `${dia(n.respondedAt)} — NPS nota ${n.score}${n.kind ? ` (${n.kind})` : ""}, situação ${n.status}${n.rootCause ? `, causa raiz: ${n.rootCause}` : ""}${n.comment ? `. Comentário: "${n.comment}"` : ""}${n.postContactNote ? `. Tratativa: ${n.postContactNote}` : ""}${
          n.resolvedAfter === true
            ? ". Resolvido depois do contato."
            : n.resolvedAfter === false
              ? ". **Não** resolvido depois do contato."
              : ""
        }`
    ),
    ...casosDoContato.map(
      (c) =>
        `${c.createdAt} — ${c.source}: ${c.protocol} "${c.title}" — situação ${c.status}${c.evaluated ? `, avaliado como ${c.resolved ? "resolvido" : "NÃO resolvido"}` : ", ainda sem avaliação"}`
    ),
  ];

  /**
   * O material muda conforme o que existe, e o formato não.
   *
   * Com caso, o dossiê nasce da reclamação e a transcrição entra como
   * contexto. Sem caso — cliente que ainda não abriu reclamação
   * pública —, a transcrição **é** o material, e o dossiê descreve o
   * atendimento em vez da reclamação.
   *
   * Vale a pena atender os dois: é justamente antes de virar reclamação
   * que ler o histórico ainda muda o desfecho.
   */
  const doCaso = caso
    ? [
        `Reclamação ${caso.protocol}, canal ${caso.source}, status "${caso.status}".`,
        caso.category &&
          `Categoria: ${caso.category}${caso.subcategory ? ` / ${caso.subcategory}` : ""}.`,
        `Aberta em ${caso.createdAt}. Consumidor: ${caso.customer}.`,
        caso.evaluated
          ? `Avaliada: nota ${caso.score ?? "—"}, ${caso.resolved ? "resolvida" : "NÃO resolvida"}, ${caso.wouldDoBusiness ? "voltaria" : "não voltaria"} a fazer negócio.`
          : "Ainda sem avaliação do consumidor.",
        caso.churnRisk
          ? "Marcada como risco de cancelamento."
          : "",
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
    : [
        "**Este cliente não tem reclamação cadastrada.**",
        "",
        contato.nome
          ? `Contato: ${contato.nome}${contato.telefone ? ` · ${contato.telefone}` : ""}.`
          : contato.telefone
            ? `Telefone: ${contato.telefone}.`
            : "Sem identificação do contato.",
        "",
        "Não existe relato público, resposta publicada nem linha do tempo interna — o que há é o atendimento abaixo. Descreva o atendimento, não uma reclamação: não invente protocolo, avaliação nem histórico que não estejam na transcrição.",
      ];

  const prompt = [
    ...doCaso,

    /*
      O histórico do contato nos outros canais.

      Rotulado e separado de propósito: o modelo precisa saber que isto
      é outra conversa, de outra data, em outro lugar — e não mais uma
      anotação deste caso.
    */
    historicoDoContato.length > 0
      ? `\n--- ESTE MESMO CLIENTE, EM OUTROS CANAIS ---\n${historicoDoContato.join("\n")}\n--- fim do histórico ---`
      : "",

    /**
     * A transcrição do Crisp, quando alguém cola uma.
     *
     * É a peça que faltava para o dossiê ser completo: a reclamação
     * pública conta o que o consumidor decidiu tornar público, e o
     * atendimento no chat conta o que realmente aconteceu antes —
     * quantas vezes ele tentou, o que foi prometido, quem atendeu, onde
     * travou. Nada disso está no Reclame Aqui, e é o material que mais
     * muda a resposta.
     *
     * Vem colada à mão, e não por integração, porque o Crisp fica fora
     * daqui: exportar a conversa é um clique lá, e uma integração
     * exigiria credencial, permissão e um contrato de dados que
     * ninguém pediu para manter.
     */
    transcricao
      ? `\n--- TRANSCRIÇÃO DO ATENDIMENTO NO CRISP (arquivo importado pelo atendente) ---\n${transcricao}\n--- fim da transcrição ---`
      : "",
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

  /**
   * As **peças** do dossiê — o conjunto organizado de registros.
   *
   * O Isaac mandou a definição de dicionário: dossiê é "conjunto
   * organizado de documentos ou informações sobre um assunto
   * específico", que "reúne papéis, relatórios, registros ou arquivos
   * digitais focados em um único tema".
   *
   * O que existia era só a leitura — um texto escrito pelo modelo,
   * bem escrito e mesmo assim uma versão da história, sem os documentos
   * atrás dela. Quem lê uma narrativa não consegue conferir nada: não
   * sabe quantas anotações existem, de que data, quem escreveu, nem se
   * o modelo deixou alguma de fora.
   *
   * Estas peças são **fato**, montadas do banco, e não passam pelo
   * modelo. Cada uma diz o que é, de onde veio, quando, e o começo do
   * conteúdo. Juntas com a leitura, o dossiê passa a ser as duas coisas
   * que o nome promete: a pasta e o parecer.
   */
  const pecas: {
    tipo: string;
    origem: string;
    quando?: string;
    autor?: string;
    trecho: string;
  }[] = [];

  if (caso) {

    pecas.push({
      tipo: "Reclamação",
      origem: caso.source,
      quando: caso.createdAt,
      autor: caso.customer,
      trecho: (caso.description || "").slice(0, 400),
    });

    if ((caso.publicResponse ?? "").trim()) {
      /*
        Sem data: o modelo da tela não carrega `publicResponseAt`.

        A coluna existe no banco, e a lista não a traz — como não traz
        o relato nem o dossiê, pelo mesmo motivo de peso. Uma peça sem
        data ordena junto das sem data, o que é honesto; inventar a data
        do caso aqui seria dizer que a resposta saiu no dia da abertura.
      */
      pecas.push({
        tipo: "Resposta pública",
        origem: caso.source,
        trecho: caso.publicResponse!.slice(0, 400),
      });
    }

    if (caso.evaluated) {
      pecas.push({
        tipo: "Avaliação do consumidor",
        origem: caso.source,
        quando: caso.evaluatedAt,
        autor: caso.customer,
        trecho: `Nota ${caso.score ?? "—"} · ${
          caso.resolved ? "resolvida" : "NÃO resolvida"
        } · ${
          caso.wouldDoBusiness
            ? "voltaria a fazer negócio"
            : "não voltaria"
        }`,
      });
    }
  }

  for (const nota of anotacoes) {
    pecas.push({
      tipo: "Anotação interna",
      origem: "CW Reputação",
      quando: nota.createdAt.toISOString(),
      autor: nota.author?.name ?? undefined,
      trecho: nota.body.slice(0, 400),
    });
  }

  for (const m of movimentacoes) {
    pecas.push({
      tipo: "Movimentação",
      origem: "CW Reputação",
      quando: m.startedAt.toISOString(),
      trecho: `Para ${m.destination}${
        m.reason ? ` — ${m.reason}` : ""
      }. ${
        m.returnedAt
          ? `Devolvida em ${dia(m.returnedAt)}${m.outcome ? `: ${m.outcome}` : ""}`
          : "**Ainda não devolvida.**"
      }`,
    });
  }

  for (const n of npsDoContato) {
    pecas.push({
      tipo: "Resposta de NPS",
      origem: "Pesquisa",
      quando: n.respondedAt.toISOString(),
      trecho: `Nota ${n.score}${n.kind ? ` (${n.kind})` : ""}${
        n.comment ? `: "${n.comment}"` : ""
      }`,
    });
  }

  for (const c of casosDoContato) {
    pecas.push({
      tipo: "Caso em outro canal",
      origem: c.source,
      quando: c.createdAt,
      trecho: `${c.protocol} — "${c.title}" · ${c.status}`,
    });
  }

  if (transcricao) {
    pecas.push({
      tipo: "Transcrição do Crisp",
      origem: "Crisp",
      autor: String(
        entrada.arquivoDaTranscricao ?? ""
      ).slice(0, 200),
      trecho: `${transcricao.length.toLocaleString("pt-BR")} caracteres de atendimento, lidos para este dossiê. Não são guardados — ver a rota de salvar.`,
    });
  }

  /*
    Do mais antigo para o mais recente.

    Uma pasta de documentos se lê na ordem em que os fatos aconteceram;
    invertida, ela conta a história de trás para a frente, que é
    exatamente o que um dossiê não deve fazer.
  */
  pecas.sort((a, b) =>
    String(a.quando ?? "").localeCompare(
      String(b.quando ?? "")
    )
  );

  return responder(request, {
    ...resultado.dados,
    protocolo: caso?.protocol ?? null,

    /** O conjunto organizado — ver o comentário acima. */
    pecas,

    /** Houve caso, ou o dossiê saiu só do atendimento? */
    semCaso: !caso,

    /**
     * Quantos ciclos de NPS e casos de outros canais entraram.
     *
     * A tela precisa poder dizer "leu 2 ciclos de NPS e 1 caso de
     * Instagram". Sem esse número, um dossiê que menciona o NPS e um
     * que o ignorou têm exatamente a mesma cara — e quem lê não sabe se
     * o cliente nunca respondeu NPS ou se o cruzamento falhou.
     */
    npsLidos: npsDoContato.length,
    casosLidos: casosDoContato.length,

    /**
     * Quantos fatos internos o resumo teve para ler.
     *
     * Sem isso, "nada aconteceu depois do relato" e "o modelo não
     * recebeu a linha do tempo" ficam indistinguíveis na tela — e são
     * coisas muito diferentes para quem vai decidir o que fazer.
     */
    fatos: linhaDoTempo.length,

    /**
     * A transcrição entrou na leitura?
     *
     * A tela precisa dizer isso: "o dossiê não menciona o chat" e "o
     * dossiê não recebeu o chat" são coisas diferentes, e sem o sinal
     * quem cola a transcrição não tem como saber se ela chegou.
     */
    comTranscricao: transcricao.length > 0,
    tamanhoDaTranscricao: transcricao.length,

    /**
     * O nome do arquivo volta para a tela conferir o que foi lido.
     *
     * Sem ele, "transcrição lida (38.412 caracteres)" não distingue o
     * arquivo certo do arquivo do cliente anterior — e é exatamente o
     * erro que dá, porque o importador guarda a última escolha.
     */
    arquivoDaTranscricao: String(
      entrada.arquivoDaTranscricao ?? ""
    ).slice(0, 200),

    provedor: resultado.provedor,
    rapido,
    custo: resultado.uso,
  });
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
