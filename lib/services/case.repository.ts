import {
  mudancasDoPortal,
  SELECAO_DO_PORTAL,
} from "@/lib/services/atualizacaoDoPortal";
import { semApagarVazios } from "@/lib/services/semApagar";
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

  /*
    O nome do estabelecimento vinculado.

    Só o `name` — o cadastro inteiro tem endereço, plano, receita e
    contatos, e nada disso a lista precisa. Um `select` de um campo
    numa relação já carregada pelo id não custa consulta a mais.
  */
  establishment: { select: { name: true } },
} as const;

/**
 * Lista das reclamações.
 *
 * `description` fica de fora por padrão: é o texto integral do relato e
 * responde por **53% do payload** (263 KB de 491 KB na base atual), mas
 * só a tela de detalhe o exibe. Carregar sempre custava mais de um
 * segundo em toda abertura da aplicação.
 */
/** A linha achatada que o SELECT com JOIN devolve. */
interface CaseRowCru {
  id: string;
  externalId: string | null;
  protocol: string;
  companyName: string;
  document: string | null;
  establishmentId: string | null;
  establishmentManual: boolean;
  customer: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  channel: string;
  status: string;
  priority: string;
  title: string;
  description: string | null;
  /** Só vem no modo com textos (exportação); nulo na carga do quadro. */
  publicResponse: string | null;
  publicResponseAt: Date | null;
  draftResponse: string | null;
  dossierAt: Date | null;
  dossierBy: string | null;
  socialHandle: string | null;
  followers: number | null;
  evaluated: boolean;
  score: number | null;
  scoreDisregarded: boolean | null;
  resolved: boolean;
  wouldDoBusiness: boolean;
  evaluatedAt: Date | null;
  churnRisk: boolean;
  request: string | null;
  responseMinutes: number | null;
  solutionMinutes: number | null;
  slaTarget: string | null;
  externalUrl: string | null;
  publishedAt: Date;
  updatedAt: Date;

  respondida: boolean;

  categoryName: string | null;
  subcategoryName: string | null;
  ownerName: string | null;
  teamName: string | null;
  establishmentName: string | null;
  tagNames: string[] | null;
}

export async function fetchCases(
  prisma: PrismaClient,
  { withDescription = false } = {}
): Promise<Case[]> {
  /**
   * Uma ida ao banco, com JOIN — e não sete.
   *
   * **O que foi medido.** Conexão quente, mediana de cinco execuções
   * contra a base real de 352 reclamações:
   *
   * ```
   *   só contar (piso da rede)        67 ms
   *   um SQL com JOIN, ida única     124 ms   ← este
   *   colunas leves pelo Prisma      378 ms
   *   as seis relações do `include`  541 ms
   * ```
   *
   * O `include` do Prisma resolve cada relação numa consulta própria:
   * categoria, subcategoria, dono, time, etiquetas e estabelecimento
   * são seis idas e voltas, e cada ida paga a latência inteira até São
   * Paulo. Com o JOIN a espera é paga uma vez, e o resto é o banco
   * fazendo o que ele faz melhor.
   *
   * Os textos pesados continuam fora: `description`, `dossier` e
   * `publicResponse` somam meio megabyte que nenhuma tela da lista
   * mostra. No lugar de `publicResponse` vem `respondida`, calculada no
   * próprio SELECT — o fato sem o texto.
   *
   * **Por que SQL cru e não Prisma.** Não é preferência: o `include`
   * não sabe virar JOIN, e mesmo a consulta sem relação nenhuma custa
   * 378 ms pelo cliente contra 124 ms aqui. O preço é este bloco
   * precisar acompanhar o schema à mão — e é por isso que
   * `check:campos` existe e que a conferência abaixo compara campo a
   * campo com o caminho antigo.
   */
  const rows = await prisma.$queryRawUnsafe<CaseRowCru[]>(`
    SELECT c."id", c."externalId", c."protocol", c."companyName",
           c."document", c."establishmentId", c."establishmentManual",
           c."customer", c."email", c."phone", c."city", c."state",
           c."channel", c."status", c."priority", c."title",
           ${
             /*
               O modo com textos traz também a resposta pública.

               Ele existe para a exportação da base, e a exportação
               saía com a coluna "Resposta pública" vazia nas 353
               reclamações: esta consulta devolvia \`publicResponse:
               null\` sempre, inclusive aqui. Uma exportação usada como
               cópia de segurança perdia justamente o trabalho de
               resposta. Achado na revisão de 10/09/2026.
             */
             withDescription
               ? 'c."description", c."publicResponse",'
               : 'NULL AS description, NULL AS "publicResponse",'
           }
           c."publicResponseAt", c."draftResponse",
           c."dossierAt", c."dossierBy",
           c."socialHandle", c."followers",
           c."evaluated", c."score", c."scoreDisregarded",
           c."resolved", c."wouldDoBusiness", c."evaluatedAt",
           c."churnRisk", c."request",
           c."responseMinutes", c."solutionMinutes",
           c."slaTarget", c."externalUrl",
           c."publishedAt", c."updatedAt",

           (c."publicResponse" IS NOT NULL
            AND btrim(c."publicResponse") <> '') AS respondida,

           cat."name" AS "categoryName",
           sub."name" AS "subcategoryName",
           own."name" AS "ownerName",
           tea."name" AS "teamName",
           est."name" AS "establishmentName",

           COALESCE(
             (SELECT array_agg(t."name" ORDER BY t."name")
                FROM "CaseTag" ct
                JOIN "Tag" t ON t."id" = ct."tagId"
               WHERE ct."caseId" = c."id"),
             '{}'
           ) AS "tagNames"

      FROM "Case" c
      LEFT JOIN "Category" cat ON cat."id" = c."categoryId"
      LEFT JOIN "Subcategory" sub ON sub."id" = c."subcategoryId"
      LEFT JOIN "User" own ON own."id" = c."ownerId"
      LEFT JOIN "Team" tea ON tea."id" = c."teamId"
      LEFT JOIN "Establishment" est ON est."id" = c."establishmentId"
     ORDER BY c."publishedAt" DESC
  `);

  return rows.map((row) =>
    toCaseModel({
      ...row,

      /* O SELECT devolve nome achatado; o mapper espera objeto. */
      category: row.categoryName
        ? { name: row.categoryName }
        : null,
      subcategory: row.subcategoryName
        ? { name: row.subcategoryName }
        : null,
      owner: row.ownerName
        ? { name: row.ownerName }
        : null,
      team: row.teamName ? { name: row.teamName } : null,
      establishment: row.establishmentName
        ? { name: row.establishmentName }
        : null,

      tags: (row.tagNames ?? []).map((name) => ({
        tag: { name },
      })),

      /*
        Fora da lista de propósito — ver o comentário acima —, e dentro
        no modo com textos, que é o da exportação.
      */
      publicResponse: withDescription
        ? row.publicResponse ?? null
        : null,
      dossier: null,
    })
  );
}

/** Texto do relato, buscado só quando a tela de detalhe abre. */
/**
 * Os dois textos que a lista não traz: o relato e a resposta pública.
 *
 * Era só o relato. A resposta pública também saiu da carga do quadro em
 * 03/09 e ninguém a buscava de volta — a aba Avaliação da tela do caso
 * mostrava a resposta **vazia em todas as reclamações**, e o botão de
 * publicar o rascunho, que junta "resposta existente + rascunho",
 * gravava só o rascunho por cima da resposta de verdade. Achado na
 * revisão de 10/09/2026.
 */
export async function fetchCaseTexts(
  prisma: PrismaClient,
  protocol: string
) {

  const row = await prisma.case.findUnique({
    where: { protocol },
    select: { description: true, publicResponse: true },
  });

  return {
    description: row?.description ?? "",
    publicResponse: row?.publicResponse ?? "",
  };
}

/**
 * O dossiê guardado de um caso.
 *
 * **O defeito que isto conserta.** O dossiê saiu da listagem por peso —
 * milhares de caracteres por caso —, com a ideia de que a tela de
 * detalhe buscaria depois. Só que a busca sob demanda pedia **só** o
 * relato: o dossiê não chegava a tela nenhuma, `DossieCard` recebia
 * `undefined`, e o cartão some quando não há dossiê. Resultado: ele
 * nunca apareceu, uma vez sequer, desde que foi escrito.
 *
 * Nada quebrava. A extensão gravava, o banco guardava, a tela não
 * mostrava — e o sintoma era "cadê o campo do dossiê", sem erro nenhum
 * para investigar.
 *
 * **Consulta própria, e não junto com o relato.** O relato é campo
 * editável e entra no rascunho da tela; o dossiê não se edita. Trazer
 * os dois na mesma ida obrigaria a empurrar o dossiê pelo rascunho, e
 * a barra "Salvar" apareceria só de abrir o caso — anunciando uma
 * alteração que ninguém fez.
 */
export async function fetchCaseDossier(
  prisma: PrismaClient,
  protocol: string
) {

  const row = await prisma.case.findUnique({
    where: { protocol },
    select: {
      dossier: true,
      dossierAt: true,
      dossierBy: true,
    },
  });

  if (!row?.dossier) return null;

  return {
    dossier: row.dossier,
    dossierAt: row.dossierAt?.toISOString(),
    dossierBy: row.dossierBy ?? undefined,
  };
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
export async function resolverEstabelecimento(
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

    /**
     * CPF ou CNPJ, só dígitos.
     *
     * É o identificador mais forte que existe nesta base — 340 das 342
     * reclamações têm um — e não era usado em lugar nenhum da busca. A
     * extensão o lê do RA Forms desde sempre e o jogava fora.
     */
    documento?: string;
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
  /**
   * Documento primeiro, porque é igualdade e não semelhança.
   *
   * Telefone casa por quatro dígitos finais e nome casa por pedaço;
   * CPF e CNPJ casam ou não casam. Quando existe, é a resposta — e é
   * também a única chave que sobrevive a alguém trocar de número.
   */
  if ((alvo.documento ?? "").replace(/\D/g, "").length >= 11) {
    ou.push({
      document: alvo.documento!.replace(/\D/g, ""),
    });
  }

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
        },

        /**
         * E no **estabelecimento vinculado**.
         *
         * Faltava, e a falta apareceu depois que a tela passou a
         * mostrar o nome do estabelecimento no lugar do
         * `companyName` — que na base é o nome do próprio consumidor
         * e por isso foi limpo. A partir dali a extensão exibia
         * "Maceió Burgers" no caso e não encontrava nada ao procurar
         * por "Maceió Burgers": o nome estava numa tabela que a busca
         * não olhava.
         *
         * É o mesmo nome que o WhatsApp mostra no topo da conversa,
         * então é literalmente o que a pessoa digita.
         */
        {
          establishment: {
            name: {
              contains: parte,
              mode: "insensitive",
            },
          },
        }
      );
    }
  }

  if (ou.length === 0) return [];

  const rows = await prisma.case.findMany({
    where: { OR: ou },
    include: INCLUDE,
    omit: { description: true, dossier: true },
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

    /*
      Relato e resposta pública: vazio **não** apaga.

      A premissa do comentário acima — "a tela e a extensão carregam o
      caso inteiro" — deixou de valer em 03/09, quando a carga do quadro
      passou a trazer cada reclamação **sem** esses dois textos, para
      caber em 500 ms. A lista chega com o relato vazio e a resposta
      indefinida, e esta gravação transformava os dois em nulo: arrastar
      um cartão, ligar uma etiqueta ou salvar qualquer campo na tela do
      caso **apagava o relato e a resposta pública** daquela reclamação.
      Estava no ar desde o deploy de 09/09; conferido em 10/09 que
      ninguém tinha mexido ainda — nenhuma se perdeu. Achado na revisão
      crítica.

      É a mesma decisão que já tirava o dossiê daqui, e pelo mesmo
      motivo: campo que a tela não carrega para reenviar não pode virar
      nulo no banco. Na criação, vazio é o valor certo.
    */
    update: semApagarVazios(dados, ["description", "publicResponse"]),

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

/**
 * Cria a reclamação **só se ela não existir** — nunca atualiza.
 *
 * É o caminho do vigia do Reclame Aqui, que grava sem ninguém olhar.
 * `persistCase` é um upsert: se duas extensões abertas percebessem a
 * mesma reclamação nova no mesmo minuto, a segunda gravação viraria
 * atualização e passaria por cima de tudo o que a operação tivesse feito
 * no intervalo — responsável, etiqueta, coluna. Aqui a segunda esbarra
 * no protocolo único e volta `null`, sem tocar em nada.
 */
export async function criarSeNova(
  prisma: PrismaClient,
  item: Case
): Promise<string | null> {

  const relacoes = await resolverRelacoes(prisma, item);

  try {
    const salvo = await prisma.case.create({
      data: {
        protocol: item.protocol,
        ...toCaseColumns(item),
        ...relacoes,
      },
      select: { id: true },
    });

    await sincronizarTags(prisma, salvo.id, item.tags ?? []);

    return salvo.id;
  } catch (erro) {
    if (
      erro instanceof Prisma.PrismaClientKnownRequestError &&
      erro.code === "P2002"
    ) {
      return null;
    }

    throw erro;
  }
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
 * Importação da planilha: o que é novo entra inteiro; o que já existe
 * recebe só o que o portal pode mudar.
 *
 * **Era o contrário, e era o defeito mais destrutivo da plataforma.**
 * Esta função regravava a linha inteira de toda reclamação em que
 * qualquer campo da planilha diferisse do banco — e a planilha não
 * conhece o trabalho da operação. Medido em 10/09/2026 com a última
 * planilha, sem gravar nada: um clique no botão Importar teria trocado
 * **142 respostas públicas reais** pelo marcador de 38 caracteres que o
 * leitor põe no lugar do texto, **tirado o responsável de 141**
 * reclamações e refeito as etiquetas de 71 só com as da planilha.
 *
 * O script `ra:atualizar` já tinha a regra certa desde 03/09; o botão
 * ficou no caminho antigo. Agora os dois usam `mudancasDoPortal`, em
 * `lib/services/atualizacaoDoPortal.ts` — uma regra, dois chamadores.
 *
 * A chave casa pelo protocolo e pelo `externalId`, como o script: uma
 * reclamação capturada pela extensão e depois exportada pelo portal é a
 * mesma, ainda que um dos dois lados a tenha registrado pelo outro.
 */
export async function importCasesBulk(
  prisma: PrismaClient,
  cases: Case[]
) {

  const noBanco = await prisma.case.findMany({
    select: SELECAO_DO_PORTAL,
  });

  const porChave = new Map<string, (typeof noBanco)[number]>();

  for (const c of noBanco) {
    porChave.set(c.protocol, c);
    if (c.externalId) porChave.set(c.externalId, c);
  }

  const novas = cases.filter((item) => !porChave.has(item.protocol));

  const atualizacoes: {
    id: string;
    dados: Record<string, unknown>;
  }[] = [];

  let inalteradas = 0;

  for (const item of cases) {

    const atual = porChave.get(item.protocol);

    if (!atual) continue;

    const { dados } = mudancasDoPortal(item, atual);

    if (Object.keys(dados).length === 0) {
      inalteradas += 1;
      continue;
    }

    atualizacoes.push({ id: atual.id, dados });
  }

  /*
    Novas passam pelo caminho completo, que resolve categoria,
    subcategoria, etiquetas e vínculo — é lá que elas nascem inteiras.
  */
  const criadas =
    novas.length > 0 ? (await gravarLote(prisma, novas)).gravadas : 0;

  await emParalelo(atualizacoes, 5, ({ id, dados }) =>
    prisma.case.update({
      where: { id },
      data: dados,
      select: { id: true },
    })
  );

  return {
    gravadas: criadas + atualizacoes.length,
    inalteradas,
    novas: criadas,
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
