/**
 * O atalho de respostas prontas entrega o texto certo?
 *
 *   npm run check:atalho
 *
 * O atalho fica ao lado da caixa de mensagem do WhatsApp e escreve
 * dentro dela. Isso muda o custo do erro: o que a gaveta do painel
 * mostrava, alguém lia antes de copiar; o que este atalho cola, vai
 * para o campo de onde se aperta enviar.
 *
 * Então o que se prova aqui é o que dói lá:
 *
 *  1. Variável **sem valor continua aparecendo**. O caminho fácil —
 *     trocar `{{protocolo}}` por vazio quando não há caso — produz uma
 *     mensagem inteira, sem aviso nenhum, com um buraco no meio
 *     ("Reclamação: ") indo para o consumidor.
 *  2. Tabela de planos vazia **não** é tabela. Hoje não há plano
 *     cadastrado; substituir por string vazia mandaria uma oferta sem
 *     preço.
 *  3. Os trechos entre colchetes são contados. Oito textos usam
 *     `[NOME]`, `[SEU NOME]`, `[NOTA]` — são pedidos de escrita, e o
 *     atalho tem de avisar antes do clique, não depois do envio.
 *  4. A ordem: o que se manda por WhatsApp primeiro.
 *  5. A fiação: rota, service worker, manifesto e o script de conteúdo
 *     apontando uns para os outros.
 *
 * Roda contra as macros **do banco** quando ele responde, e contra um
 * conjunto fixo quando não responde — a parte 1 a 4 é conta pura e não
 * precisa de banco para estar certa.
 */
import "dotenv/config";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Macro } from "../lib/models/macro";

import {
  pedidosDeEscrita,
  prepararRespostas,
} from "../lib/services/respostas.service";

const RAIZ = resolve(__dirname, "..");

let falhas = 0;

function ok(titulo: string, detalhe = "") {
  console.log(
    `  ok     ${titulo}${detalhe ? `\n         ${detalhe}` : ""}`
  );
}

function falhar(titulo: string, detalhe: string) {
  falhas += 1;
  console.log(`FALHA    ${titulo}\n         ${detalhe}`);
}

function ler(caminho: string) {
  return readFileSync(resolve(RAIZ, caminho), "utf8");
}

/* ============================================================
   AS MACROS
============================================================ */

/**
 * Réplicas fiéis de textos que existem no banco.
 *
 * Copiados com as variáveis e os colchetes que eles têm de verdade —
 * é o que faz a conferência valer sem banco. Quando o banco responde,
 * a mesma bateria roda por cima do conteúdo real.
 */
const DE_MENTIRA: Macro[] = [
  {
    id: "wa-primeiro",
    title: "WhatsApp — primeiro contato",
    body: "Oi, {{cliente}}! 😊\nSou {{responsavel}}, representante do Reclame Aqui da Cardápio Web.",
    category: "Atendimento",
    channel: "WhatsApp",
    owner: "Isaac",
    tags: [],
    uses: 3,
    updatedAt: "2026-09-01",
  },
  {
    id: "wa-prazo",
    title: "WhatsApp — prazo de avaliação acabando",
    body: "Aqui é {{responsavel}}, da Cardápio Web.\n\nReclamação: {{protocolo}}",
    category: "Atendimento",
    channel: "WhatsApp",
    owner: "Isaac",
    tags: [],
    uses: 9,
    updatedAt: "2026-09-01",
  },
  {
    id: "nps-detrator",
    title: "NPS — primeiro contato com detrator",
    body: "Oi, [NOME]! Aqui é o [SEU NOME], da Cardápio Web.\n\n[O QUE ELE ESCREVEU, EM UMA FRASE]",
    category: "Atendimento",
    channel: "NPS" as Macro["channel"],
    owner: "Isaac",
    tags: [],
    uses: 0,
    updatedAt: "2026-09-01",
  },
  {
    id: "ra-cobranca",
    title: "Cobrança indevida — abertura da tratativa",
    body: "Prezado(a) {{cliente}}, sou {{responsavel}}. Protocolo {{protocolo}}. Nossos planos: {{planos}}",
    category: "Financeiro",
    channel: "Reclame Aqui",
    owner: "Isaac",
    tags: [],
    uses: 40,
    updatedAt: "2026-09-01",
  },
];

async function doBanco(): Promise<Macro[] | null> {
  if (!process.env.DATABASE_URL) return null;

  try {
    const { getPrisma } = await import("../lib/prisma");

    const prisma = getPrisma();

    if (!prisma) return null;

    const linhas = await prisma.macro.findMany({
      orderBy: { title: "asc" },
    });

    return linhas.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      category: r.category,
      channel: r.channel as Macro["channel"],
      owner: r.owner,
      tags: r.tags,
      uses: r.uses,
      updatedAt: String(r.updatedAt).slice(0, 10),
    }));
  } catch (erro) {
    console.log(
      `  --     o banco não respondeu: ${
        erro instanceof Error ? erro.message : erro
      }`
    );
    return null;
  }
}

/* ============================================================
   1 a 4 — A SUBSTITUIÇÃO
============================================================ */

function conferirSubstituicao(macros: Macro[], onde: string) {
  console.log(`\n  SUBSTITUIÇÃO — ${onde}\n`);

  /* ---- com tudo preenchido ---- */

  const cheio = prepararRespostas(macros, "WhatsApp", {
    cliente: "Vinícius Weber",
    responsavel: "Isaac",
    protocolo: "RA-256949163",
    estabelecimento: "Hamburgueria Tortellini",
    planos: "• Essencial: R$ 99/mês",
    modulos: "• Cardápio digital: R$ 29/mês",
  });

  const aindaComVariavel = cheio.filter(
    (item) => item.faltando.length > 0
  );

  if (aindaComVariavel.length === 0) {
    ok(
      "com todos os valores, nenhuma variável sobra",
      `${cheio.length} texto(s) conferido(s)`
    );
  } else {
    falhar(
      "com todos os valores, nenhuma variável sobra",
      aindaComVariavel
        .map(
          (item) =>
            `"${item.titulo}" ficou com ${item.faltando.join(", ")}`
        )
        .join("\n         ")
    );
  }

  const nomeColado = cheio.find((item) =>
    item.texto.includes("Vinícius Weber")
  );

  if (nomeColado) {
    ok(
      "o nome do consumidor entra mesmo no texto",
      `"${nomeColado.titulo}"`
    );
  } else {
    falhar(
      "o nome do consumidor entra mesmo no texto",
      "nenhum texto ficou com o nome — a substituição não aconteceu"
    );
  }

  /* ---- sem caso: o protocolo não tem valor ---- */

  const semCaso = prepararRespostas(macros, "WhatsApp", {
    cliente: "Vinícius Weber",
    responsavel: "Isaac",
    planos: "• Essencial: R$ 99/mês",
    modulos: "• Cardápio digital: R$ 29/mês",
  });

  const usamProtocolo = semCaso.filter((item) =>
    macros
      .find((m) => m.id === item.id)!
      .body.includes("{{protocolo}}")
  );

  const buracos = usamProtocolo.filter(
    (item) => !item.faltando.includes("{{protocolo}}")
  );

  if (usamProtocolo.length === 0) {
    console.log(
      "  --     nenhum texto usa {{protocolo}} — nada a conferir aqui"
    );
  } else if (buracos.length === 0) {
    ok(
      "sem caso, o protocolo continua à vista e é avisado",
      `${usamProtocolo.length} texto(s) com {{protocolo}}, todos marcados como pendentes`
    );
  } else {
    falhar(
      "sem caso, o protocolo continua à vista e é avisado",
      [
        `${buracos.length} texto(s) perderam o marcador sem ganhar valor:`,
        ...buracos.map(
          (item) => `"${item.titulo}" → ${item.texto.slice(0, 90)}`
        ),
        "",
        "         É a falha que manda 'Reclamação: ' ao consumidor.",
      ].join("\n         ")
    );
  }

  /* ---- tabela de planos vazia ---- */

  const semPlanos = prepararRespostas(macros, "WhatsApp", {
    cliente: "Vinícius Weber",
    responsavel: "Isaac",
    protocolo: "RA-256949163",
    planos: "",
    modulos: "",
  });

  const comPlanos = semPlanos.filter((item) =>
    macros
      .find((m) => m.id === item.id)!
      .body.includes("{{planos}}")
  );

  const sumiram = comPlanos.filter(
    (item) => !item.faltando.includes("{{planos}}")
  );

  if (comPlanos.length === 0) {
    console.log(
      "  --     nenhum texto usa {{planos}} — nada a conferir aqui"
    );
  } else if (sumiram.length === 0) {
    ok(
      "tabela de planos vazia não vira substituição",
      `${comPlanos.length} texto(s) com {{planos}}, avisados como pendentes`
    );
  } else {
    falhar(
      "tabela de planos vazia não vira substituição",
      `${sumiram.length} texto(s) sairiam oferecendo preço sem preço nenhum`
    );
  }

  /* ---- os colchetes ---- */

  const comColchete = cheio.filter(
    (item) => item.preencher.length > 0
  );

  const totalDeColchetes = comColchete.reduce(
    (soma, item) => soma + item.preencher.length,
    0
  );

  ok(
    "os pedidos de escrita entre colchetes são contados",
    comColchete.length === 0
      ? "nenhum texto usa colchetes"
      : `${comColchete.length} texto(s), ${totalDeColchetes} trecho(s) — ex.: ${comColchete[0].preencher
          .slice(0, 2)
          .join(" ")}`
  );

  /* ---- a ordem ---- */

  const canais = cheio.map((item) => item.canal);

  const primeiroForaDoWhats = canais.findIndex(
    (canal) => canal !== "WhatsApp"
  );

  const whatsDepois = canais
    .slice(primeiroForaDoWhats < 0 ? canais.length : primeiroForaDoWhats)
    .includes("WhatsApp");

  if (!whatsDepois) {
    ok(
      "os textos de WhatsApp vêm primeiro",
      canais.join(" · ")
    );
  } else {
    falhar(
      "os textos de WhatsApp vêm primeiro",
      `ordem entregue: ${canais.join(" · ")}`
    );
  }

  /* ---- a busca ---- */

  const semAcento = prepararRespostas(
    macros,
    "WhatsApp",
    { cliente: "Vinícius Weber", responsavel: "Isaac" },
    "avaliacao"
  );

  const comAcento = prepararRespostas(
    macros,
    "WhatsApp",
    { cliente: "Vinícius Weber", responsavel: "Isaac" },
    "avaliação"
  );

  if (semAcento.length === comAcento.length) {
    ok(
      "a busca não depende do acento",
      `"avaliacao" e "avaliação" acham os mesmos ${comAcento.length}`
    );
  } else {
    falhar(
      "a busca não depende do acento",
      `"avaliacao" achou ${semAcento.length} e "avaliação" achou ${comAcento.length}`
    );
  }
}

/* ============================================================
   O LEITOR DE COLCHETES, EM ISOLADO
============================================================ */

function conferirColchetes() {
  console.log("\n  COLCHETES — o que é pedido e o que é texto\n");

  const casos: [string, number][] = [
    ["Oi, [NOME]! Aqui é o [SEU NOME].", 2],
    ["Você deu nota [NOTA] na pesquisa.", 1],
    ["[O QUE PRECISA: CNPJ, NOME DO ESTABELECIMENTO]", 1],

    /* Minúscula dentro é texto do autor, não pedido de escrita. */
    ["Ela respondeu [não sei] e desligou.", 0],
    ["O status [Encerrado] Sem tratativa.", 0],

    /* Sem colchete nenhum. */
    ["Oi! Tudo bem por aí?", 0],
  ];

  const erradas = casos.filter(
    ([texto, esperado]) =>
      pedidosDeEscrita(texto).length !== esperado
  );

  if (erradas.length === 0) {
    ok(
      "colchete em maiúsculas é pedido; o resto é texto",
      `${casos.length} caso(s)`
    );
  } else {
    falhar(
      "colchete em maiúsculas é pedido; o resto é texto",
      erradas
        .map(
          ([texto, esperado]) =>
            `"${texto}" → esperava ${esperado}, achei ${pedidosDeEscrita(texto).length}`
        )
        .join("\n         ")
    );
  }
}

/* ============================================================
   5 — A FIAÇÃO
============================================================ */

function conferirFiacao() {
  console.log("\n  FIAÇÃO — cada ponta encontra a outra\n");

  const rota = ler("app/api/extensao/respostas/route.ts");
  const worker = ler("extensao/fundo/service-worker.js");
  const manifesto = ler("extensao/manifest.json");
  const script = ler("extensao/conteudo/respostas.js");
  const painel = ler("extensao/conteudo/painel.js");
  const estilo = ler("extensao/conteudo/estilo.js");

  const pontos: [string, boolean, string][] = [
    [
      "a rota atende GET e POST",
      rota.includes("export async function GET") &&
        rota.includes("export async function POST"),
      "a lista é GET; a contagem de uso é POST",
    ],
    [
      "o service worker conhece o endereço",
      worker.includes('respostas: "/api/extensao/respostas"'),
      "sem isto a extensão chamaria um caminho que não existe",
    ],
    [
      "o service worker trata os dois recados",
      worker.includes('mensagem?.tipo === "respostas"') &&
        worker.includes('mensagem?.tipo === "usarResposta"'),
      "listar e contar são recados diferentes",
    ],
    [
      "o manifesto carrega o script no WhatsApp",
      manifesto.includes('"conteudo/respostas.js"'),
      "script de conteúdo não declarado simplesmente não roda",
    ],
    [
      "o script vem depois do estilo e do painel",
      manifesto.indexOf('"conteudo/respostas.js"') >
        manifesto.indexOf('"conteudo/estilo.js"') &&
        manifesto.indexOf('"conteudo/respostas.js"') >
          manifesto.indexOf('"conteudo/painel.js"'),
      "ele lê CW.CSS_ATALHO e CW.painel.contextoAtual()",
    ],
    [
      "o estilo do atalho existe",
      estilo.includes("CW.CSS_ATALHO"),
      "sem ele o botão nasce sem forma dentro do rodapé alheio",
    ],
    [
      "o painel expõe o contato para o atalho",
      painel.includes("contextoAtual()"),
      "é de onde saem o nome do consumidor e o protocolo",
    ],
    [
      "o script pede a lista e conta o uso",
      script.includes('tipo: "respostas"') &&
        script.includes('tipo: "usarResposta"'),
      "contar o uso é o que faz o mais usado subir",
    ],
  ];

  for (const [titulo, passou, detalhe] of pontos) {
    if (passou) ok(titulo);
    else falhar(titulo, detalhe);
  }

  /* ---- a janela não pode ficar girando ---- */

  /**
   * O defeito que fez o atalho "não funcionar" no primeiro dia.
   *
   * `carregar` descartava a resposta quando o **contato** tinha
   * mudado entre o pedido e a volta. Parece prudente e é o contrário:
   * o contato muda exatamente nessa janela de tempo, porque o painel
   * está resolvendo quem é aquele telefone ao mesmo tempo — e quando
   * ele responde, o nome deixa de ser o apelido da agenda e passa a
   * ser o do cadastro. Ou seja, o caso mais comum de todos.
   *
   * Descartada a resposta, ninguém trocava o "Buscando os textos…"
   * que `abrir` tinha desenhado. A janela ficava girando para sempre.
   *
   * A pergunta certa é "esta resposta ainda é a mais nova?", que se
   * responde com um número de pedido — nunca com o contato.
   */
  const descartaPorContato =
    /if\s*\(\s*!?\s*aberto\s*\|\|\s*chave\s*!==\s*chaveDoContexto\(\)/.test(
      script
    );

  if (!descartaPorContato && script.includes("meu !== pedido")) {
    ok(
      "a resposta é descartada por ser velha, não por ser de outro contato",
      "contato diferente pede a lista de novo; não trava a janela"
    );
  } else {
    falhar(
      "a resposta é descartada por ser velha, não por ser de outro contato",
      "voltou a comparar o contexto para decidir se desenha — é o que deixava a janela em 'Buscando os textos…' para sempre"
    );
  }

  /**
   * E, aconteça o que acontecer, o "carregando" tem fim.
   *
   * Rede que não volta, caminho de código que sai calado: o sintoma é
   * o mesmo, e é o pior possível — a janela gira sem dizer nada para
   * quem está com o cliente na linha. O relógio não conserta a causa;
   * garante que a tela **diga** que não conseguiu.
   */
  if (
    script.includes("function esperando(") &&
    script.includes("esperando(true)") &&
    script.includes("esperando(false)")
  ) {
    ok(
      "o 'carregando' tem prazo e vira mensagem",
      "nenhum caminho deixa a janela girando calada"
    );
  } else {
    falhar(
      "o 'carregando' tem prazo e vira mensagem",
      "sem a rede de segurança, qualquer caminho calado prende a janela em 'Buscando os textos…'"
    );
  }

  /* ---- as três camadas da colagem ---- */

  const camadas = [
    ['ClipboardEvent("paste"', "evento de colagem"],
    ['execCommand("insertText"', "inserção como digitação"],
    ["navigator.clipboard.writeText", "área de transferência"],
  ] as const;

  const faltando = camadas.filter(
    ([marca]) => !script.includes(marca)
  );

  if (faltando.length === 0) {
    ok(
      "a colagem tem as três camadas",
      camadas.map(([, nome]) => nome).join(" → ")
    );
  } else {
    falhar(
      "a colagem tem as três camadas",
      `faltou: ${faltando.map(([, nome]) => nome).join(", ")}`
    );
  }

  /**
   * A caixa do WhatsApp é um editor rico.
   *
   * Escrever no `innerText` dela muda a tela sem o editor saber, e a
   * mensagem some no primeiro Enter — o pior defeito possível aqui,
   * porque parece funcionar.
   */
  const escreveDireto =
    /escrita\.(innerText|innerHTML|textContent)\s*=/.test(
      script
    );

  if (!escreveDireto) {
    ok(
      "ninguém escreve no DOM da caixa direto",
      "o editor é avisado por evento, como uma pessoa faria"
    );
  } else {
    falhar(
      "ninguém escreve no DOM da caixa direto",
      "há atribuição direta ao conteúdo da caixa — o texto some no Enter"
    );
  }

  /* ---- e o compromisso de não enviar ---- */

  const envia =
    /key:\s*["']Enter["']/.test(script) &&
    /dispatchEvent\(\s*new KeyboardEvent/.test(script);

  if (!envia) {
    ok(
      "o atalho não aperta enviar por ninguém",
      "o texto entra na caixa e para ali"
    );
  } else {
    falhar(
      "o atalho não aperta enviar por ninguém",
      "há simulação de Enter no script — a extensão não manda mensagem"
    );
  }
}

/* ============================================================
   PRINCIPAL
============================================================ */

async function main() {
  console.log(
    "\n  ATALHO DE RESPOSTAS — o texto certo, na caixa certa\n"
  );

  conferirColchetes();

  const reais = await doBanco();

  if (reais && reais.length > 0) {
    conferirSubstituicao(
      reais,
      `${reais.length} macros do banco`
    );
  } else {
    console.log(
      "\n  --     sem banco: a substituição roda sobre réplicas fiéis\n"
    );
  }

  conferirSubstituicao(
    DE_MENTIRA,
    "réplicas com todas as formas de variável"
  );

  conferirFiacao();

  console.log(
    falhas === 0
      ? "\n  Tudo certo. O que não tem valor aparece; nada é enviado sozinho.\n"
      : `\n  ${falhas} ponto(s) a corrigir.\n`
  );

  process.exitCode = falhas === 0 ? 0 : 1;
}

main().catch((erro) => {
  console.error("\n  Erro:", erro);
  process.exitCode = 1;
});
