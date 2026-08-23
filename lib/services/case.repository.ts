import { Case } from "@/lib/models/case";
import {
  Prisma,
  PrismaClient,
} from "@prisma/client";

import {
  digitosDoDocumento,
  documentoFormatado,
} from "@/lib/models/establishment";

import {
  parseElapsedText,
  toCaseColumns,
  toCaseModel,
} from "@/lib/services/case.mapper";

/**
 * Acesso ao banco para reclamações.
 *
 * Separado das server actions de propósito: a action cuida de sessão e
 * autorização, isto aqui cuida de Postgres. A divisão permite exercitar
 * a gravação num script, contra o banco de verdade, sem precisar de
 * cookie de sessão.
 */

const INCLUDE = {
  category: { select: { name: true } },
  subcategory: { select: { name: true } },
  owner: { select: { name: true } },
  team: { select: { name: true } },
  tags: { include: { tag: { select: { name: true } } } },
} as const;

/**
 * Lista das reclamações.
 *
 * `description` fica de fora por padrão: é o texto integral do relato e
 * responde por **53% do payload** (263 KB de 491 KB na base atual), mas
 * só a tela de detalhe o exibe. Carregar sempre custava mais de um
 * segundo em toda abertura da aplicação.
 */
export async function fetchCases(
  prisma: PrismaClient,
  { withDescription = false } = {}
): Promise<Case[]> {

  const rows = await prisma.case.findMany({
    include: INCLUDE,
    omit: withDescription
      ? undefined
      : { description: true },
    orderBy: { publishedAt: "desc" },
  });

  return rows.map((row) =>
    toCaseModel({
      ...row,
      description:
        "description" in row
          ? (row.description as string | null)
          : null,
    })
  );
}

/** Texto do relato, buscado só quando a tela de detalhe abre. */
export async function fetchCaseDescription(
  prisma: PrismaClient,
  protocol: string
) {

  const row = await prisma.case.findUnique({
    where: { protocol },
    select: { description: true },
  });

  return row?.description ?? "";
}

/**
 * Cache de nome → id das entidades de apoio.
 *
 * Gravar um caso exigia consultar categoria, subcategoria, responsável e
 * cada etiqueta — sete idas ao banco para salvar um arraste no Kanban,
 * cerca de 1,6 s. Estes ids não mudam: o nome pode ser editado, o id
 * não. Guardar em memória elimina quase todas essas idas.
 *
 * O TTL existe só para o caso de uma entidade ser apagada e recriada,
 * quando o id antigo deixaria de existir.
 */
const CACHE_TTL = 5 * 60 * 1000;

const cache = {
  expira: 0,
  categoria: new Map<string, string>(),
  subcategoria: new Map<string, string>(),
  usuario: new Map<string, string | null>(),
  time: new Map<string, string | null>(),
  etiqueta: new Map<string, string>(),
  estabelecimento: new Map<string, string | null>(),
};

function cacheValido() {

  if (Date.now() > cache.expira) {
    cache.categoria.clear();
    cache.subcategoria.clear();
    cache.usuario.clear();
    cache.time.clear();
    cache.etiqueta.clear();
    cache.estabelecimento.clear();
    cache.expira = Date.now() + CACHE_TTL;
  }

  return cache;
}

/**
 * Resolve as relações que a tela envia como texto.
 *
 * Categoria e subcategoria são criadas quando não existem — a base real
 * usa nomes que o cadastro não previa, e perder o vínculo empobreceria
 * o dado. Responsável **não** é criado: pessoa entra pelo cadastro de
 * Times, não digitando num formulário de caso.
 */
async function resolverRelacoes(
  prisma: PrismaClient,
  item: Case
) {

  const c = cacheValido();

  const temCategoria =
    Boolean(item.category) &&
    item.category !== "Não classificado";

  let categoryId: string | null = null;

  if (temCategoria) {

    categoryId = c.categoria.get(item.category) ?? null;

    if (!categoryId) {
      const row = await prisma.category.upsert({
        where: { name: item.category },
        update: {},
        create: {
          name: item.category,
          description: "Criada pela tela de reclamações.",
          order: 999,
          active: true,
        },
        select: { id: true },
      });

      categoryId = row.id;
      c.categoria.set(item.category, row.id);
    }
  }

  let subcategoryId: string | null = null;

  if (categoryId && item.subcategory) {

    const chave = `${categoryId}::${item.subcategory}`;

    subcategoryId = c.subcategoria.get(chave) ?? null;

    if (!subcategoryId) {
      const row = await prisma.subcategory.upsert({
        where: {
          categoryId_name: {
            categoryId,
            name: item.subcategory,
          },
        },
        update: {},
        create: {
          categoryId,
          name: item.subcategory,
          description: "Criada pela tela de reclamações.",
          order: 999,
          active: true,
        },
        select: { id: true },
      });

      subcategoryId = row.id;
      c.subcategoria.set(chave, row.id);
    }
  }

  let ownerId: string | null = null;

  if (item.owner) {

    if (c.usuario.has(item.owner)) {
      ownerId = c.usuario.get(item.owner) ?? null;
    } else {
      const row = await prisma.user.findFirst({
        where: { name: item.owner },
        select: { id: true },
      });

      ownerId = row?.id ?? null;
      c.usuario.set(item.owner, ownerId);
    }
  }

  /**
   * O time **não** é criado quando não existe.
   *
   * Mesma regra do responsável, e pelo mesmo motivo: time entra pelo
   * cadastro de Times, não digitando num formulário de caso. Uma carga
   * que criasse criaria "Implementacão" ao lado de "Implantação", e
   * ninguém saberia qual dos dois usar.
   */
  let teamId: string | null = null;

  if (item.department) {

    if (c.time.has(item.department)) {
      teamId = c.time.get(item.department) ?? null;
    } else {

      const row = await prisma.team.findFirst({
        where: { name: item.department },
        select: { id: true },
      });

      teamId = row?.id ?? null;
      c.time.set(item.department, teamId);
    }
  }

  /**
   * O CNPJ só é consultado quando ninguém decidiu na mão.
   *
   * A escolha da pessoa vence nos dois sentidos. Vincular à mão manda o
   * id; desvincular manda vazio **com a marca** — e é a marca que
   * impede o CNPJ de religar no salvamento seguinte, o que faria o
   * botão de desvincular parecer quebrado.
   */
  const establishmentId = item.establishmentManual
    ? item.establishmentId || null
    : item.establishmentId ||
      (await resolverEstabelecimento(prisma, item.document));

  return {
    categoryId,
    subcategoryId,
    ownerId,
    teamId,
    establishmentId,
  };
}


/**
 * O estabelecimento por trás do CNPJ, quando existe.
 *
 * **Só o CNPJ casa.** Medido nos casos importados: o export do Reclame
 * Aqui grava o reclamante no lugar da empresa, então casar por nome
 * ligaria a reclamação ao consumidor, não ao restaurante. O CNPJ vem do
 * RA Forms e é o mesmo número dos dois lados.
 *
 * Comparação por dígitos: o portal entrega `12.345.678/0001-90` e o
 * cadastro daqui costuma ter `12345678000190`.
 *
 * Devolve `null` — e guarda o `null` no cache — quando não há
 * estabelecimento com aquele CNPJ. É o caso comum: nem todo restaurante
 * que aparece no Reclame Aqui está cadastrado aqui, e repetir a consulta
 * a cada caso salvo custaria uma ida ao banco para confirmar a mesma
 * ausência.
 */
async function resolverEstabelecimento(
  prisma: PrismaClient,
  documento?: string | null
) {

  const digitos = digitosDoDocumento(documento);

  if (!digitos) return null;

  const c = cacheValido();

  if (c.estabelecimento.has(digitos)) {
    return c.estabelecimento.get(digitos) ?? null;
  }

  /**
   * A consulta cobre as duas grafias.
   *
   * O cadastro de estabelecimentos é preenchido à mão e a máscara não é
   * obrigatória — a base tem os dois formatos. Filtrar só por um
   * deixaria parte dos vínculos sem casar, sem nenhum sinal de erro.
   */
  const row = await prisma.establishment.findFirst({
    where: {
      OR: [
        { document: digitos },
        { document: documentoFormatado(digitos) },
      ],
    },
    select: { id: true },
  });

  const id = row?.id ?? null;

  c.estabelecimento.set(digitos, id);

  return id;
}

/**
 * Sincroniza as etiquetas do caso.
 *
 * Em lote: antes era um upsert por etiqueta, mais um por vínculo. Agora
 * são no máximo duas idas ao banco, independentemente da quantidade.
 */
async function sincronizarTags(
  prisma: PrismaClient,
  caseId: string,
  nomes: string[]
) {

  const c = cacheValido();

  const ids: string[] = [];
  const desconhecidas: string[] = [];

  for (const nome of nomes) {

    const id = c.etiqueta.get(nome);

    if (id) ids.push(id);
    else desconhecidas.push(nome);
  }

  if (desconhecidas.length > 0) {

    // Cria o que faltar e relê tudo de uma vez.
    await prisma.tag.createMany({
      data: desconhecidas.map((name) => ({
        name,
        order: 999,
        active: true,
      })),
      skipDuplicates: true,
    });

    const rows = await prisma.tag.findMany({
      where: { name: { in: desconhecidas } },
      select: { id: true, name: true },
    });

    for (const row of rows) {
      c.etiqueta.set(row.name, row.id);
      ids.push(row.id);
    }
  }

  /**
   * Sequencial, e não em `$transaction`.
   *
   * O pooler de transação do Supabase (porta 6543) — que é o que a
   * Vercel usa — recusa a transação em lote do Prisma e derruba a
   * conexão. Como são duas operações idempotentes, sequencial resolve
   * sem depender de transação.
   */
  await prisma.caseTag.deleteMany({
    where: { caseId, tagId: { notIn: ids } },
  });

  if (ids.length > 0) {
    await prisma.caseTag.createMany({
      data: ids.map((tagId) => ({ caseId, tagId })),
      skipDuplicates: true,
    });
  }
}

/**
 * Cria ou atualiza. A chave é o protocolo, que é único e estável — o id
 * da tela pode ser o do portal ou um uuid gerado no cadastro manual.
 */
/**
 * Um caso pelo protocolo, inteiro.
 *
 * Com a descrição, ao contrário de `fetchCases`: aqui é um registro
 * só, e quem pede um caso específico quer o relato junto. E é
 * necessário para gravar de volta — `persistCase` recebe o `Case`
 * completo, e um campo ausente viraria `null` na coluna.
 */
export async function fetchCaseByProtocol(
  prisma: PrismaClient,
  protocol: string
): Promise<Case | null> {

  const row = await prisma.case.findUnique({
    where: { protocol },
    include: INCLUDE,
  });

  return row ? toCaseModel(row) : null;
}

/**
 * Os casos que **podem** ser de um contato — não os que são.
 *
 * O painel da extensão carregava as 334 reclamações inteiras e decidia
 * em JavaScript quem casava. Medido: 1.448 ms e 233 KB por consulta, a
 * cada conversa aberta. É a lentidão que se sente ao abrir o painel.
 *
 * A divisão de trabalho passa a ser: o banco **estreita** de forma
 * generosa (últimos quatro dígitos do telefone, pedaço do nome, domínio
 * do e-mail) e o JavaScript **decide** com a mesma precisão de antes —
 * nono dígito, máscara, homônimo. Como o filtro do banco é um
 * superconjunto do que o casamento aceitaria, nenhum caso que era
 * encontrado deixa de ser.
 *
 * Sem nada para procurar devolve lista vazia, e não a base inteira: a
 * pergunta "quem é este contato?" sem contato nenhum não tem resposta.
 */
export async function fetchCandidateCases(
  prisma: PrismaClient,
  alvo: {
    protocolo?: string;
    digitosDoTelefone?: string;
    email?: string;
    nome?: string;
  },
  limite = 80
): Promise<Case[]> {

  const ou: Prisma.CaseWhereInput[] = [];

  if (alvo.protocolo) {

    const limpo = alvo.protocolo
      .replace(/^[A-Z]{2}-?/i, "")
      .trim();

    if (limpo) {
      ou.push(
        { protocol: { contains: limpo } },
        { externalId: limpo }
      );
    }
  }

  /**
   * Quatro dígitos, e não oito.
   *
   * O casamento aceita "parcial" com DDD + quatro últimos, e a base já
   * teve telefone mascarado nesse formato. Estreitar por oito deixaria
   * de fora exatamente os registros que a regra parcial existe para
   * alcançar.
   */
  if ((alvo.digitosDoTelefone ?? "").length >= 4) {
    ou.push({
      phone: {
        contains: alvo.digitosDoTelefone!.slice(-4),
      },
    });
  }

  if (alvo.email?.includes("@")) {
    ou.push({
      email: {
        contains: alvo.email.split("@")[1],
        mode: "insensitive",
      },
    });
  }

  if (alvo.nome) {

    const partes = alvo.nome
      .trim()
      .split(/\s+/)
      .filter((parte) => parte.length >= 3);

    /**
     * Primeiro e último pedaço, no consumidor **e na empresa**.
     *
     * O nome da empresa entra porque o WhatsApp mostra o nome do
     * estabelecimento ("Alquimia dos Doces by Jessy") enquanto a base
     * guarda o do consumidor — e sem isto o painel dizia "nada
     * encontrado" para um cliente que estava lá.
     */
    for (const parte of [
      partes[0],
      partes[partes.length - 1],
    ]) {
      if (!parte) continue;

      ou.push(
        {
          customer: {
            contains: parte,
            mode: "insensitive",
          },
        },
        {
          companyName: {
            contains: parte,
            mode: "insensitive",
          },
        }
      );
    }
  }

  if (ou.length === 0) return [];

  const rows = await prisma.case.findMany({
    where: { OR: ou },
    include: INCLUDE,
    omit: { description: true },
    orderBy: { publishedAt: "desc" },
    take: limite,
  });

  return rows.map((row) =>
    toCaseModel({ ...row, description: null })
  );
}


/**
 * Guarda da **importação da planilha**: campo vazio ali não apaga nada.
 *
 * O CNPJ não vem da planilha — vem do RA Forms, que só a extensão lê. Se
 * a atualização gravasse `null` por ele estar ausente na origem, a
 * próxima reimportação semanal apagaria em silêncio todo vínculo que a
 * extensão tivesse construído, e o sintoma só apareceria semanas depois,
 * como "os vínculos somem sozinhos".
 *
 * Vale só para o `update`: no `create` o nulo é o valor certo, porque
 * não há nada anterior para preservar.
 *
 * Desvincular na mão continua possível: a tela grava `establishmentManual`
 * junto, e esse caminho passa por `persistCase`, que não filtra nada.
 */
function semApagarVinculo<
  T extends {
    document?: string | null;
    establishmentId?: string | null;
  },
>(dados: T) {

  const saida = { ...dados };

  if (saida.document === null) delete saida.document;

  if (saida.establishmentId === null) {
    delete saida.establishmentId;
  }

  return saida;
}

export async function persistCase(
  prisma: PrismaClient,
  item: Case,
  /**
   * Mover no Kanban não toca em etiqueta. Pular a sincronização nesse
   * caso corta duas idas ao banco da interação mais frequente do quadro.
   */
  { syncTags = true } = {}
) {

  const relacoes = await resolverRelacoes(prisma, item);

  const dados = {
    ...toCaseColumns(item),
    ...relacoes,
  };

  /**
   * Aqui **não** passa por `semApagarVinculo`, e isso é o ponto.
   *
   * Este caminho vem da tela e da extensão, que carregam o caso inteiro:
   * campo vazio aqui significa "foi esvaziado", e desvincular precisa
   * gravar o vazio. Quem não conhece os campos é a planilha, e ela entra
   * por `importCasesBulk`.
   */
  const salvo = await prisma.case.upsert({
    where: { protocol: item.protocol },
    update: dados,
    create: { protocol: item.protocol, ...dados },
    select: { id: true },
  });

  if (syncTags) {
    await sincronizarTags(
      prisma,
      salvo.id,
      item.tags ?? []
    );
  }

  return salvo.id;
}

export async function removeCaseByProtocol(
  prisma: PrismaClient,
  protocol: string
) {
  await prisma.case.delete({ where: { protocol } });
}

/** Valores distintos e não vazios de um campo. */
function distintos(
  cases: Case[],
  pegar: (item: Case) => string | undefined
) {
  return [
    ...new Set(
      cases
        .map(pegar)
        .filter(
          (v): v is string =>
            Boolean(v) && v !== "Não classificado"
        )
    ),
  ];
}

function emLotes<T>(itens: T[], tamanho: number) {
  const lotes: T[][] = [];

  for (let i = 0; i < itens.length; i += tamanho) {
    lotes.push(itens.slice(i, i + tamanho));
  }

  return lotes;
}

/**
 * Executa em paralelo, com limite.
 *
 * O que custa aqui é latência de rede, não CPU: 334 idas em série ao
 * Supabase levavam dois minutos. Em paralelo o tempo cai para segundos.
 * O limite existe para não esgotar o pool de conexões — e transação não
 * serve: o lote estoura o timeout de 5s antes de terminar.
 */
async function emParalelo<T>(
  itens: T[],
  limite: number,
  executar: (item: T) => Promise<unknown>
) {
  for (const lote of emLotes(itens, limite)) {
    await Promise.all(lote.map(executar));
  }
}

/**
 * Importação em lote.
 *
 * `persistCase` resolve as relações caso a caso, o que é certo para uma
 * edição de tela mas péssimo para 334 linhas: dava 6 a 8 idas ao banco
 * por reclamação, ~2.500 no total, e a planilha levava dois minutos.
 *
 * Aqui as categorias, subcategorias e etiquetas distintas são resolvidas
 * **uma vez cada** e o resto vai em transações agrupadas.
 */
/**
 * Campos que a planilha manda. Mudou algum, o registro é regravado.
 *
 * Trabalho da operação — responsável, etiquetas aplicadas na tela — fica
 * de fora: o export não os conhece, e compará-los marcaria como alterado
 * um caso que a planilha nem toca.
 */
function mudouNaPlanilha(novo: Case, atual: Case) {
  return (
    novo.title !== atual.title ||
    novo.status !== atual.status ||
    novo.category !== atual.category ||
    (novo.subcategory ?? "") !==
      (atual.subcategory ?? "") ||
    novo.priority !== atual.priority ||
    novo.customer !== atual.customer ||
    novo.company !== atual.company ||
    /**
     * Contato entra na comparação.
     *
     * Ficava de fora, e isso escondia duas coisas: um consumidor que
     * troca de telefone entre um export e outro nunca era atualizado, e
     * — o caso que apareceu de verdade — uma base gravada com telefone
     * mascarado continuava mascarada mesmo reimportando o arquivo com o
     * número inteiro, porque todo o resto da linha estava igual.
     */
    (novo.email ?? "") !== (atual.email ?? "") ||
    (novo.phone ?? "") !== (atual.phone ?? "") ||
    (novo.city ?? "") !== (atual.city ?? "") ||
    (novo.state ?? "") !== (atual.state ?? "") ||
    Boolean(novo.evaluated) !==
      Boolean(atual.evaluated) ||
    (novo.score ?? null) !== (atual.score ?? null) ||
    Boolean(novo.scoreDisregarded) !==
      Boolean(atual.scoreDisregarded) ||
    novo.resolved !== atual.resolved ||
    novo.wouldDoBusiness !== atual.wouldDoBusiness ||
    (novo.evaluatedAt ?? "") !==
      (atual.evaluatedAt ?? "") ||
    // Em minutos, não no texto: o importador escreve "3h" e o banco
    // devolve "3 horas" — mesma duração, textos diferentes.
    parseElapsedText(novo.responseTime) !==
      parseElapsedText(atual.responseTime) ||
    parseElapsedText(novo.solutionTime) !==
      parseElapsedText(atual.solutionTime) ||
    novo.createdAt !== atual.createdAt
  );
}

export async function importCasesBulk(
  prisma: PrismaClient,
  cases: Case[]
) {

  /**
   * Só o que mudou é regravado.
   *
   * A planilha é reexportada inteira toda vez, mas o histórico não muda:
   * reimportar as 334 linhas leva ~45 s, e quase tudo seria escrita
   * inútil. Comparando antes, uma reimportação semanal grava só as
   * novidades e termina em segundos.
   */
  const atuais = new Map(
    (await fetchCases(prisma)).map((item) => [
      item.protocol,
      item,
    ])
  );

  const pendentes = cases.filter((item) => {

    const atual = atuais.get(item.protocol);

    return !atual || mudouNaPlanilha(item, atual);
  });

  const inalteradas = cases.length - pendentes.length;

  if (pendentes.length === 0) {
    return {
      gravadas: 0,
      inalteradas,
      novas: 0,
    };
  }

  return {
    ...(await gravarLote(prisma, pendentes)),
    inalteradas,
    novas: pendentes.filter(
      (item) => !atuais.has(item.protocol)
    ).length,
  };
}

async function gravarLote(
  prisma: PrismaClient,
  cases: Case[]
) {

  // 1. Categorias — dezenas, não centenas.
  const categorias = new Map<string, string>();

  for (const nome of distintos(
    cases,
    (c) => c.category
  )) {
    const row = await prisma.category.upsert({
      where: { name: nome },
      update: {},
      create: {
        name: nome,
        description: "Criada pela importação.",
        order: 999,
        active: true,
      },
      select: { id: true },
    });

    categorias.set(nome, row.id);
  }

  // 2. Subcategorias, sempre dentro da categoria do caso.
  const subcategorias = new Map<string, string>();

  const paresSub = [
    ...new Set(
      cases
        .filter((c) => c.subcategory && c.category)
        .map((c) => `${c.category}||${c.subcategory}`)
    ),
  ];

  for (const par of paresSub) {

    const [cat, sub] = par.split("||");
    const categoryId = categorias.get(cat);

    if (!categoryId) continue;

    const row = await prisma.subcategory.upsert({
      where: {
        categoryId_name: { categoryId, name: sub },
      },
      update: {},
      create: {
        categoryId,
        name: sub,
        description: "Criada pela importação.",
        order: 999,
        active: true,
      },
      select: { id: true },
    });

    subcategorias.set(par, row.id);
  }

  // 3. Etiquetas.
  const etiquetas = new Map<string, string>();

  for (const nome of [
    ...new Set(cases.flatMap((c) => c.tags ?? [])),
  ]) {
    const row = await prisma.tag.upsert({
      where: { name: nome },
      update: {},
      create: { name: nome, order: 999, active: true },
      select: { id: true },
    });

    etiquetas.set(nome, row.id);
  }

  /**
   * 4. Estabelecimentos, por CNPJ, em uma consulta só.
   *
   * Aqui não dá para usar `resolverEstabelecimento`: ele consulta um
   * por vez, e uma importação de 334 linhas viraria 334 idas ao banco
   * para responder a mesma pergunta sobre poucas dezenas de CNPJs.
   *
   * O mapa é indexado pelos dígitos, e cada cadastro entra uma vez só —
   * mesmo que esteja gravado com pontuação.
   */
  const estabelecimentos = new Map<string, string>();

  for (const row of await prisma.establishment.findMany({
    where: { document: { not: null } },
    select: { id: true, document: true },
  })) {

    const digitos = digitosDoDocumento(row.document);

    if (digitos) estabelecimentos.set(digitos, row.id);
  }

  // 5. Times existentes, em uma consulta só — nenhum é criado.
  const times = new Map(
    (
      await prisma.team.findMany({
        select: { id: true, name: true },
      })
    ).map((t) => [t.name, t.id])
  );

  // 6. Responsáveis existentes, em uma consulta só.
  const usuarios = new Map(
    (
      await prisma.user.findMany({
        select: { id: true, name: true },
      })
    ).map((u) => [u.name, u.id])
  );

  /**
   * 7. As reclamações, em paralelo limitado.
   *
   * Cinco por vez, e não vinte: o pooler do Supabase no plano gratuito
   * tem poucas conexões, e o lote maior derrubava a conexão no meio da
   * importação ("client has encountered a connection error").
   */
  await emParalelo(cases, 5, (item) => {

    const dados = {
      ...toCaseColumns(item),
      categoryId:
        categorias.get(item.category) ?? null,
      subcategoryId:
        subcategorias.get(
          `${item.category}||${item.subcategory}`
        ) ?? null,
      ownerId: item.owner
        ? usuarios.get(item.owner) ?? null
        : null,

      teamId: item.department
        ? times.get(item.department) ?? null
        : null,

      // Vínculo decidido na mão vence o do CNPJ — ver resolverRelacoes.
      establishmentId: item.establishmentManual
        ? item.establishmentId || null
        : item.establishmentId ||
          estabelecimentos.get(
            digitosDoDocumento(item.document) ?? ""
          ) ||
          null,
    };

    return prisma.case.upsert({
      where: { protocol: item.protocol },
      update: semApagarVinculo(dados),
      create: { protocol: item.protocol, ...dados },
      select: { id: true },
    });
  });

  // 8. Etiquetas dos casos: apaga e recria em bloco.
  const ids = new Map(
    (
      await prisma.case.findMany({
        where: {
          protocol: {
            in: cases.map((c) => c.protocol),
          },
        },
        select: { id: true, protocol: true },
      })
    ).map((c) => [c.protocol, c.id])
  );

  const vinculos = cases.flatMap((item) => {

    const caseId = ids.get(item.protocol);

    if (!caseId) return [];

    return (item.tags ?? [])
      .map((nome) => etiquetas.get(nome))
      .filter((tagId): tagId is string =>
        Boolean(tagId)
      )
      .map((tagId) => ({ caseId, tagId }));
  });

  await prisma.caseTag.deleteMany({
    where: { caseId: { in: [...ids.values()] } },
  });

  for (const lote of emLotes(vinculos, 500)) {
    await prisma.caseTag.createMany({
      data: lote,
      skipDuplicates: true,
    });
  }

  return { gravadas: ids.size };
}
