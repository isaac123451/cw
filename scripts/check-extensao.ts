/**
 * Prova as rotas que a extensão chama, contra a aplicação rodando.
 *
 *   npm run dev            (noutra janela)
 *   npm run check:extensao
 *
 * Os `check:` que já existiam provam **regra** — a conta da nota, o
 * movimento de etapa, o casamento do telefone. Este prova a outra
 * metade: que o contrato entre a extensão e a aplicação continua de pé.
 *
 * É o defeito que mais custou aqui, e ele nunca aparece no `tsc`: a rota
 * passa a devolver um campo com outro nome, ou deixa de aceitar um
 * parâmetro, e o painel simplesmente mostra uma lista vazia. Ninguém
 * percebe até alguém abrir o WhatsApp e a gaveta não ter nada dentro.
 *
 * Assina uma sessão com o `AUTH_SECRET` do `.env`, como o navegador
 * faria depois do login, e chama as rotas por HTTP.
 *
 * Quase tudo é leitura. A exceção é uma tarefa de agenda **descartável**
 * — criada pela rota real e apagada aqui no fim —, porque o horário só
 * se prova indo até o banco e voltando.
 */
import "dotenv/config";

import { SignJWT } from "jose";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const base = (
  process.env.CW_BASE ?? "http://localhost:3000"
).replace(/\/$/, "");

const url =
  process.env.DIRECT_URL || process.env.DATABASE_URL;

const segredo =
  process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

if (!url || !segredo) {
  console.error(
    "\n  Faltou DATABASE_URL ou AUTH_SECRET no .env.\n"
  );
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

let falhas = 0;

function conferir(
  campo: string,
  obtido: unknown,
  esperado: unknown
) {

  const ok =
    JSON.stringify(obtido) === JSON.stringify(esperado);

  if (!ok) falhas += 1;

  console.log(
    `${ok ? "  ok  " : "FALHA "} ${campo.padEnd(46)} ${JSON.stringify(obtido)}`
  );

  if (!ok) {
    console.log(
      `${" ".repeat(7)}${"esperado".padEnd(46)} ${JSON.stringify(esperado)}`
    );
  }
}

let sessao = "";

async function pegar(
  caminho: string,
  parametros: Record<string, string> = {}
) {

  const destino = new URL(base + caminho);

  for (const [chave, valor] of Object.entries(
    parametros
  )) {
    if (valor) destino.searchParams.set(chave, valor);
  }

  const resposta = await fetch(destino.toString(), {
    headers: {
      Accept: "application/json",
      "X-CW-Sessao": sessao,
    },
    cache: "no-store",
  });

  /**
   * 200 com HTML não é sucesso.
   *
   * Já aconteceu: um endereço errado devolvia a página de login com
   * status 200, e o painel morria em `Unexpected token '<'`.
   */
  const tipo =
    resposta.headers.get("content-type") ?? "";

  if (!tipo.includes("json")) {
    throw new Error(
      `${caminho} respondeu ${resposta.status} em ${tipo || "tipo desconhecido"}, não JSON.`
    );
  }

  return {
    status: resposta.status,
    corpo: (await resposta.json()) as Record<
      string,
      unknown
    >,
  };
}

async function main() {

  /* ---- a sessão, como o navegador teria ---- */

  const admin = await prisma.user.findFirst({
    where: { active: true, role: "ADMIN" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });

  if (!admin) {
    throw new Error(
      "Nenhum ADMIN ativo no banco — rode npm run db:seed."
    );
  }

  sessao = await new SignJWT({ ...admin })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("600s")
    .sign(new TextEncoder().encode(segredo));

  console.log(
    `\nContra ${base}, como ${admin.name}.\n`
  );

  /* ============================================================
     SESSÃO
  ============================================================ */

  const sessaoResposta = await pegar(
    "/api/extensao/sessao"
  );

  conferir(
    "a sessão é aceita",
    sessaoResposta.status,
    200
  );

  conferir(
    "e devolve quem é",
    (
      sessaoResposta.corpo.usuario as {
        nome?: string;
      } | null
    )?.nome,
    admin.name
  );

  /* ============================================================
     PAINEL DO DIA — OS CONTADORES QUE VIRARAM LISTA
  ============================================================ */

  const resumo = await pegar("/api/extensao/resumo");

  const contagens = resumo.corpo.contagens as Record<
    string,
    number
  >;

  console.log(
    "\n  contadores do painel:",
    JSON.stringify(contagens),
    "\n"
  );

  conferir(
    "o painel devolve os quatro contadores",
    Object.keys(contagens ?? {}).sort(),
    ["abertos", "replicas", "risco", "semResposta"]
  );

  /**
   * O número que se clica e a lista que abre têm de bater.
   *
   * É a razão de o recorte existir na fila com o mesmo nome: um painel
   * que diz "4 sem resposta" e abre uma lista de 7 ensina a operação a
   * desconfiar dele.
   */
  for (const [recorte, contador] of [
    ["", "abertos"],
    ["sem-resposta", "semResposta"],
    ["replicas", "replicas"],
    ["risco", "risco"],
  ] as const) {

    const fila = await pegar("/api/extensao/fila", {
      canal: "todos",
      recorte,
    });

    conferir(
      `fila "${recorte || "abertos"}" bate com o contador`,
      fila.corpo.totalGeral,
      contagens[contador]
    );
  }

  /* ============================================================
     ATIVIDADES
  ============================================================ */

  const vencendo = await pegar("/api/extensao/agenda");

  const contagensDaAgenda = vencendo.corpo
    .contagens as Record<string, number>;

  console.log(
    "\n  atividades:",
    JSON.stringify(contagensDaAgenda),
    "\n"
  );

  conferir(
    "a agenda devolve as quatro contagens",
    Object.keys(contagensDaAgenda ?? {}).sort(),
    [
      "atrasadas",
      "concluidas",
      "pendentes",
      "proximos",
    ]
  );

  conferir(
    "o recorte que vence bate com a contagem",
    (vencendo.corpo.itens as unknown[]).length,
    Math.min(contagensDaAgenda.pendentes, 40)
  );

  const proximas = await pegar("/api/extensao/agenda", {
    escopo: "proximos",
  });

  conferir(
    "o recorte das próximas é aceito",
    proximas.corpo.escopo,
    "proximos"
  );

  conferir(
    "e nenhuma delas está atrasada",
    (
      proximas.corpo.itens as { atrasada: boolean }[]
    ).some((t) => t.atrasada),
    false
  );

  const concluidas = await pegar(
    "/api/extensao/agenda",
    { escopo: "concluidas" }
  );

  conferir(
    "o recorte das concluídas só traz concluída",
    (
      concluidas.corpo.itens as { concluida: boolean }[]
    ).every((t) => t.concluida),
    true
  );

  /* ============================================================
     O HORÁRIO DA ATIVIDADE
  ============================================================ */

  /**
   * Marcar pela extensão passou a aceitar hora.
   *
   * A coluna sempre existiu (`AgendaTask.time`) e a tela sempre soube
   * mostrá-la — faltava o campo no painel, e a tarefa nascia só com o
   * dia. O que se prova aqui é o caminho inteiro: a rota aceita, o
   * banco guarda, e a listagem devolve.
   */
  const marcaDaTarefa = `ZZ Conferência ${Date.now().toString(36).toUpperCase()}`;

  const criada = await fetch(
    `${base}/api/extensao/anotar`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-CW-Sessao": sessao,
      },
      body: JSON.stringify({
        tipo: "agenda",
        titulo: marcaDaTarefa,
        quando: new Date().toISOString().slice(0, 10),
        hora: "09:30",
        tipoDeTarefa: "Pendência",
      }),
    }
  );

  const corpoDaTarefa = (await criada.json()) as {
    id?: string;
    hora?: string | null;
  };

  conferir(
    "a rota aceita hora na atividade",
    corpoDaTarefa.hora,
    "09:30"
  );

  const noBanco = corpoDaTarefa.id
    ? await prisma.agendaTask.findUnique({
        where: { id: corpoDaTarefa.id },
        select: { time: true, dueDate: true },
      })
    : null;

  conferir(
    "o banco guardou o horário",
    noBanco?.time,
    "09:30"
  );

  /**
   * A hora entra também no `dueDate`.
   *
   * A agenda ordena por ele: uma tarefa das 9h30 que ficasse com 00:00
   * apareceria misturada com as sem hora, na ordem de criação.
   */
  conferir(
    "e o vencimento carrega a hora, para a ordenação",
    noBanco?.dueDate.toISOString().slice(11, 16),
    "09:30"
  );

  /**
   * Hora inválida não pode sujar a agenda.
   *
   * O corpo é escrito pelo script de conteúdo, que roda dentro da
   * página alheia — e a coluna é texto livre no banco.
   */
  const comHoraInvalida = await fetch(
    `${base}/api/extensao/anotar`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-CW-Sessao": sessao,
      },
      body: JSON.stringify({
        tipo: "agenda",
        titulo: `${marcaDaTarefa} sem hora`,
        hora: "25:99",
      }),
    }
  );

  const corpoInvalido =
    (await comHoraInvalida.json()) as {
      id?: string;
      hora?: string | null;
    };

  conferir(
    "hora fora de HH:MM é descartada, não gravada",
    corpoInvalido.hora,
    null
  );

  await prisma.agendaTask.deleteMany({
    where: { title: { startsWith: marcaDaTarefa } },
  });

  conferir(
    "as tarefas descartáveis saíram da base",
    await prisma.agendaTask.findFirst({
      where: { title: { startsWith: marcaDaTarefa } },
    }),
    null
  );

  /* ============================================================
     A ESCADA DO NPS VEM DO CADASTRO
  ============================================================ */

  const filaNps = await pegar("/api/extensao/fila", {
    canal: "nps",
  });

  const doBanco = (
    await prisma.npsStage.findMany({
      where: { active: true, final: false },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { name: true },
    })
  ).map((e) => e.name);

  console.log(
    "\n  escada do NPS:",
    (filaNps.corpo.etapasNps as string[])?.join(" → "),
    "\n"
  );

  /**
   * A extensão rotula os botões com a lista que o servidor manda.
   *
   * Se ela viesse da constante do arquivo, uma etapa renomeada na tela
   * faria o painel esconder os botões de avançar e voltar — porque o
   * status atual não estaria na lista dele.
   */
  conferir(
    "a escada do NPS é a do cadastro",
    filaNps.corpo.etapasNps,
    doBanco.length > 0
      ? doBanco
      : ["Novo", "Em tratativa", "[Aguardando Resposta]"]
  );

  conferir(
    "e nenhum ciclo encerrado está na fila",
    (
      filaNps.corpo.itens as { status: string }[]
    ).some((i) => i.status.startsWith("[Encerrado]")),
    false
  );

  /* ============================================================
     CANAL INVÁLIDO CONTINUA SENDO RECUSADO
  ============================================================ */

  const invalido = await pegar("/api/extensao/fila", {
    canal: "telepatia",
  });

  conferir(
    "canal inválido é recusado com 400",
    invalido.status,
    400
  );

  /* ============================================================
     ANOTAR NUM CICLO DE NPS, E O WHATSAPP POR FRENTE

     O Isaac pediu as duas do painel: "preciso que seja possível
     adicionar notas assim nos casos de nps, também seja possível via
     extensão" e "whatsapp do reclame aqui ter a possibilidade de
     selecionar esse wpp, no do nps ser possível selecionar que é do
     nps".

     Tudo acontece num ciclo **descartável**, criado e apagado aqui —
     nenhuma resposta real é tocada.
  ============================================================ */

  const marcaNps = Date.now().toString(36).toUpperCase();

  const cicloDescartavel =
    await prisma.npsResponse.create({
      data: {
        externalId: `ZZ-EXT-${marcaNps}`,
        score: 4,
        comment: "Conferência da extensão — descartável.",
        respondedAt: new Date(),
        customer: `ZZ Extensão ${marcaNps}`,
        source: "Wootric",
        status: "Novo",
        firstContactDueAt: new Date(),
      },
      select: { id: true },
    });

  const anotouNoNps = await fetch(
    `${base}/api/extensao/anotar`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-CW-Sessao": sessao,
      },
      body: JSON.stringify({
        tipo: "nps",
        npsId: cicloDescartavel.id,
        texto: "Falei com o dono pela extensão.",
      }),
    }
  );

  conferir(
    "anotar num ciclo de NPS pela extensão",
    anotouNoNps.status,
    201
  );

  const anotacoes = await prisma.npsNote.findMany({
    where: { responseId: cicloDescartavel.id },
    select: { body: true, actor: true },
  });

  conferir(
    "a anotação chegou ao banco, com autor",
    anotacoes,
    [
      {
        body: "Falei com o dono pela extensão.",
        actor: admin.name,
      },
    ]
  );

  /*
    E **não** virou tentativa de contato.

    A tentativa tem canal e significa "liguei"; é a contagem dela que
    decide se o ciclo encerra por "sem retorno". Anotação virando
    tentativa faria esse número mentir.
  */
  conferir(
    "e não virou tentativa de contato",
    await prisma.npsAttempt.count({
      where: { responseId: cicloDescartavel.id },
    }),
    0
  );

  /* ---- o WhatsApp da conversa, na frente escolhida ---- */

  const numero = "11987654321";

  const gravouNoNps = await fetch(
    `${base}/api/extensao/whatsapp`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-CW-Sessao": sessao,
      },
      body: JSON.stringify({
        numero: `(11) 98765-4321`,
        frente: "nps",
        npsId: cicloDescartavel.id,
      }),
    }
  );

  conferir(
    'WhatsApp gravado na frente "nps"',
    gravouNoNps.status,
    200
  );

  /*
    Só os dígitos são guardados.

    A base tem telefone com e sem máscara, e é isso que faz a busca por
    quatro últimos casar depois.
  */
  conferir(
    "e a máscara foi descartada, sobrando os dígitos",
    (
      await prisma.npsResponse.findUnique({
        where: { id: cicloDescartavel.id },
        select: { phone: true },
      })
    )?.phone,
    numero
  );

  /* ---- frente inválida e número curto são recusados ---- */

  const frenteInvalida = await fetch(
    `${base}/api/extensao/whatsapp`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-CW-Sessao": sessao,
      },
      body: JSON.stringify({
        numero,
        frente: "telepatia",
        npsId: cicloDescartavel.id,
      }),
    }
  );

  conferir(
    "frente inventada é recusada com 400",
    frenteInvalida.status,
    400
  );

  /*
    Fragmento de número não vira cadastro.

    A leitura da página às vezes pega um pedaço, e um telefone de três
    dígitos gravado é pior do que campo vazio: ele parece preenchido.
  */
  const numeroCurto = await fetch(
    `${base}/api/extensao/whatsapp`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-CW-Sessao": sessao,
      },
      body: JSON.stringify({
        numero: "987",
        frente: "nps",
        npsId: cicloDescartavel.id,
      }),
    }
  );

  conferir(
    "número curto demais é recusado com 400",
    numeroCurto.status,
    400
  );

  await prisma.npsResponse.delete({
    where: { id: cicloDescartavel.id },
  });

  conferir(
    "o ciclo descartável saiu da base",
    await prisma.npsResponse.findUnique({
      where: { id: cicloDescartavel.id },
      select: { id: true },
    }),
    null
  );


  /* ==========================================================
     O BOTÃO DO PORTAL, E O NOME QUE NÃO CASA SOZINHO

     Os dois últimos pedidos da fila da extensão. Estavam
     construídos e sem conferência nenhuma — que é o estado em que
     um recurso volta a quebrar sem ninguém notar.
  ========================================================== */

  console.log("\n  O portal da Cardápio Web\n");

  /**
   * O link do portal chega ao painel?
   *
   * O botão só aparece quando `contexto` devolve `portal`, e esse
   * campo sai do `portalUrl` do estabelecimento. Duas coisas quebram
   * em silêncio aqui: o campo sumir da resposta (o botão some, e a
   * pessoa acha que o restaurante não tem conta) e o campo vir
   * preenchido para quem não tem cadastro (o botão leva a lugar
   * nenhum).
   */
  const comPortal = await prisma.establishment.findFirst({
    where: { NOT: { portalUrl: null } },
    select: { id: true, name: true, portalUrl: true },
  });

  const casoDoPortal = comPortal
    ? await prisma.case.findFirst({
        where: {
          establishmentId: comPortal.id,
          NOT: { phone: null },
        },
        select: { phone: true, customer: true },
      })
    : null;

  if (!comPortal) {
    console.log(
      "  --   nenhum estabelecimento tem portalUrl preenchido — nada a conferir"
    );
  } else if (!casoDoPortal?.phone) {
    console.log(
      `  --   "${comPortal.name}" tem portal, mas nenhuma reclamação com telefone para consultar`
    );
  } else {

    const r = await pegar("/api/extensao/contexto", {
      telefone: casoDoPortal.phone,
      canal: "reclame-aqui",
    });

    const est = (
      r.corpo as {
        estabelecimento?: { portal?: string | null };
      }
    ).estabelecimento;

    conferir(
      "o link do portal chega ao painel",
      est?.portal ?? null,
      comPortal.portalUrl
    );
  }

  /**
   * E não chega inventado para quem não tem.
   *
   * Um endereço montado a partir do nome ou do id levaria a uma conta
   * que não existe, ou pior, à conta de outro restaurante.
   */
  const semPortal = await prisma.establishment.findFirst({
    where: { portalUrl: null },
    select: { id: true, name: true },
  });

  const casoSemPortal = semPortal
    ? await prisma.case.findFirst({
        where: {
          establishmentId: semPortal.id,
          NOT: { phone: null },
        },
        select: { phone: true },
      })
    : null;

  if (casoSemPortal?.phone) {

    const r = await pegar("/api/extensao/contexto", {
      telefone: casoSemPortal.phone,
      canal: "reclame-aqui",
    });

    const est = (
      r.corpo as {
        estabelecimento?: { portal?: string | null };
      }
    ).estabelecimento;

    conferir(
      "e não vem inventado para quem não tem cadastro no portal",
      est?.portal ?? null,
      null
    );
  }

  console.log(
    "\n  O nome confirma, mas não acha sozinho\n"
  );

  /**
   * A regra que o Isaac pediu: achar pelo número do cliente, com o
   * nome servindo só para conferir.
   *
   * **Por que ela importa.** O nome que a extensão lê vem da agenda do
   * celular de quem atende — "João Pizzaria", "Maria RA". Casar por ele
   * mostrava, às vezes, a reclamação de outra família para quem estava
   * no WhatsApp. O prejuízo é assimétrico: não achar custa uma busca à
   * mão; achar errado é dado de terceiro na tela de quem não devia ver.
   *
   * Três perguntas, e a primeira é a que protege.
   */
  const comNomeETelefone = await prisma.case.findFirst({
    where: {
      NOT: [{ phone: null }, { customer: "" }],
    },
    select: { phone: true, customer: true },
  });

  if (!comNomeETelefone?.phone) {
    console.log(
      "  --   nenhuma reclamação com nome e telefone para conferir"
    );
  } else {

    const soNome = await pegar(
      "/api/extensao/contexto",
      {
        nome: comNomeETelefone.customer,
        canal: "reclame-aqui",
      }
    );

    const casosPeloNome = (
      soNome.corpo as { casos?: unknown[] }
    ).casos;

    conferir(
      "o nome sozinho não acha reclamação nenhuma",
      (casosPeloNome ?? []).length,
      0
    );

    const comAmbos = await pegar(
      "/api/extensao/contexto",
      {
        telefone: comNomeETelefone.phone,
        nome: comNomeETelefone.customer,
        canal: "reclame-aqui",
      }
    );

    const achou =
      ((comAmbos.corpo as { casos?: unknown[] }).casos ?? [])
        .length > 0;

    conferir(
      "o telefone acha, e o nome certo junto confirma",
      achou,
      true
    );

    const comNomeErrado = await pegar(
      "/api/extensao/contexto",
      {
        telefone: comNomeETelefone.phone,
        nome: "Nome Que Nao Existe Na Base",
        canal: "reclame-aqui",
      }
    );

    const porQueErrado = (
      comNomeErrado.corpo as { porQue?: string }
    ).porQue;

    /**
     * O nome errado não pode aparecer como motivo.
     *
     * Uma primeira versão desta conferência exigia que a confiança
     * deixasse de ser "exata" — e estava errada. Telefone conferindo
     * **por inteiro** é prova exata sozinho; o nome não entra nessa
     * conta, nem deveria. Exigir o contrário teria me feito piorar um
     * código que estava certo.
     *
     * O que de fato não pode é a tela **atribuir ao nome** uma
     * confirmação que ele não deu: é a frase do motivo que alguém lê
     * antes de decidir tratar o resultado sem conferir. Então a
     * pergunta certa é sobre o texto, não sobre o grau.
     */
    conferir(
      "nome errado não entra como motivo do casamento",
      /nome/i.test(porQueErrado ?? ""),
      false
    );
  }

  await prisma.$disconnect();

  console.log(
    falhas === 0
      ? "\nO contrato entre a extensão e a aplicação está de pé.\n"
      : `\n${falhas} conferência(s) fora do esperado.\n`
  );

  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (erro) => {

  console.error(
    "\n  Falhou:",
    erro instanceof Error ? erro.message : erro
  );

  console.error(
    `\n  A aplicação está no ar em ${base}? Suba com "npm run dev".\n`
  );

  await prisma.$disconnect();
  process.exit(1);
});
