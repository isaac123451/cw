import type { Prisma, PrismaClient } from "@prisma/client";

import { Case } from "@/lib/models/case";

import {
  COLUNAS_DO_PORTAL,
  mudancasDoPortal,
  SELECAO_DO_PORTAL,
} from "@/lib/services/atualizacaoDoPortal";

import { criarSeNova } from "@/lib/services/case.repository";
import { classificarPorProblema } from "@/lib/services/raClassify";

import {
  RELATO_SINTETICO,
  RESPOSTA_SINTETICA,
} from "@/lib/services/raMarcadores";

import {
  decorrido,
  prioridadePeloPortal,
} from "@/lib/services/raRegras";

/**
 * O Reclame Aqui como ele se mostra ao público — lido pela extensão,
 * gravado aqui.
 *
 * **O pedido.** "Queria que você ficasse verificando na página da
 * Cardápio Web no Reclame Aqui para adicionar as reclamações." Ler o
 * e-mail o Isaac recusou, e o servidor não entra no portal: o
 * Cloudflare deles responde "Just a moment…" a qualquer cliente que não
 * seja navegador — medido em 11/09/2026, até de uma máquina comum.
 *
 * Quem lê é a extensão, no Chrome de quem está logado, de tempos em
 * tempos: a lista pública da empresa e a página de cada reclamação.
 * Aqui chega o que ela leu, e é aqui que se decide o que grava — a
 * extensão não é confiável para isso, ela só transporta.
 *
 * **As travas, todas do lado de cá:**
 *
 * - reclamação de outra empresa é recusada;
 * - reclamação que já existe **nunca** é recriada nem sobrescrita: só
 *   recebe o que o portal é dono (`mudancasDoPortal`), e texto só onde
 *   o banco está vazio;
 * - a mesma reclamação com outro número — o Hugme numera diferente —
 *   é reconhecida pelo número antigo e pelo título na mesma data.
 *
 * `npm run check:vigia` prova o leitor contra a estrutura real das
 * páginas e as travas contra o banco.
 */

/** O `shortname` da Cardápio Web no portal. */
export const EMPRESA_NO_PORTAL =
  "cardapio-web-servicos-de-tecnologia";

/** O código de 16 caracteres, que também é o fim do endereço público. */
export const CODIGO_DO_PORTAL = /^[A-Za-z0-9_-]{16}$/;

/** Uma volta do vigia não traz mais que isto; mais seria abuso. */
export const TETO_POR_VOLTA = 30;

/** Tag das reclamações que entraram pela extensão, sem prévia ou com. */
export const TAG_DA_EXTENSAO = "Capturada pela extensão";

export interface InteracaoDoPortal {
  /** `ANSWER`, `REPLY`, `COMPANY_REPLY`, `FINAL_ANSWER`. */
  tipo: string;
  /** Como o portal escreve: `2026-06-11T16:46:28`, horário de Brasília. */
  em: string;
  /** HTML do portal, com `<br />`. */
  texto: string;
}

export interface ReclamacaoDoPortal {
  codigo: string;
  /** O "ID: 249505087" da página. */
  numero?: number;
  empresa: string;
  /** O fim do endereço público: `titulo-da-reclamacao_<codigo>`. */
  slug?: string;
  titulo: string;
  relato: string;
  criadaEm: string;
  /** `PENDING`, `ANSWERED`, `SOLVED`, `NOT_SOLVED`. */
  status: string;
  cidade?: string;
  estado?: string;
  avaliada: boolean;
  resolvida: boolean;
  nota?: number;
  voltaria: boolean;
  problema?: string;
  interacoes: InteracaoDoPortal[];
}

/* ============================================================
   VALIDAÇÃO
============================================================ */

function texto(valor: unknown, teto: number) {
  return typeof valor === "string" ? valor.slice(0, teto) : "";
}

/**
 * O que a extensão mandou, conferido campo a campo.
 *
 * Tudo que chega aqui veio de uma página de terceiros, lida no navegador
 * de alguém. Tamanho, formato e empresa são conferidos antes de
 * qualquer consulta — um corpo estranho vira `null`, não exceção.
 */
export function validarReclamacao(
  bruto: unknown
): ReclamacaoDoPortal | null {

  if (!bruto || typeof bruto !== "object") return null;

  const r = bruto as Record<string, unknown>;

  const codigo = texto(r.codigo, 16);
  const empresa = texto(r.empresa, 120);
  const titulo = texto(r.titulo, 300).trim();
  const criadaEm = texto(r.criadaEm, 40);

  if (!CODIGO_DO_PORTAL.test(codigo)) return null;
  if (empresa !== EMPRESA_NO_PORTAL) return null;
  if (titulo === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}/.test(criadaEm)) return null;

  const numero = Number(r.numero);
  const nota = Number(r.nota);

  const interacoes = (Array.isArray(r.interacoes) ? r.interacoes : [])
    .slice(0, 40)
    .map((i) => {
      const item = (i ?? {}) as Record<string, unknown>;
      return {
        tipo: texto(item.tipo, 30),
        em: texto(item.em, 40),
        texto: texto(item.texto, 20000),
      };
    })
    .filter((i) => i.tipo !== "");

  const slug = texto(r.slug, 400);

  return {
    codigo,
    numero:
      Number.isInteger(numero) && numero > 0 ? numero : undefined,
    empresa,
    slug:
      slug.endsWith(`_${codigo}`) && /^[A-Za-z0-9_-]+$/.test(slug)
        ? slug
        : undefined,
    titulo,
    relato: texto(r.relato, 30000),
    criadaEm,
    status: texto(r.status, 30),
    cidade: texto(r.cidade, 80).trim() || undefined,
    estado: texto(r.estado, 4).trim() || undefined,
    avaliada: r.avaliada === true,
    resolvida: r.resolvida === true,
    nota:
      Number.isInteger(nota) && nota >= 0 && nota <= 10
        ? nota
        : undefined,
    voltaria: r.voltaria === true,
    problema: texto(r.problema, 120).trim() || undefined,
    interacoes,
  };
}

/* ============================================================
   TRADUÇÃO
============================================================ */

function caractere(codigo: number) {
  return codigo > 0 && codigo <= 0x10ffff
    ? String.fromCodePoint(codigo)
    : "";
}

/**
 * O HTML do portal em texto de gente.
 *
 * O relato e as respostas chegam com `<br />` e entidades
 * (`&amp;#8212;` vira `&#8212;` depois do primeiro desescape, e só aqui
 * vira travessão). O texto é o que se grava: a tela e a extensão
 * mostram com `textContent`, e HTML guardado seria marcação de terceiro
 * esperando um descuido para virar código.
 */
export function textoDoPortal(html: string) {
  return String(html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => caractere(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => caractere(Number(d)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&(#39|apos);/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** `AAAA-MM-DD` do jeito que o portal escreve — o dia de Brasília. */
function diaDoPortal(valor: string) {
  const m = String(valor ?? "").match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : undefined;
}

/**
 * O instante para medir tempo de resposta.
 *
 * O portal escreve a hora de Brasília sem fuso, e às vezes com um `Z`
 * que não é verdade (a data da reclamação). Os dois lados são lidos do
 * mesmo jeito, então a **diferença** sai certa — é o mesmo acordo que o
 * leitor da planilha faz.
 */
function instante(valor: string) {
  const limpo = String(valor ?? "").replace(/(\.\d+)?Z$/, "");
  const t = Date.parse(`${limpo}Z`);
  return Number.isFinite(t) ? new Date(t) : null;
}

/**
 * A coluna do quadro, pelo que a página diz.
 *
 * O mesmo ciclo do leitor da planilha: respondida é "aguardando
 * avaliação", e só vira "aguardando nossa réplica" quando a última
 * palavra é do consumidor.
 */
export function statusPeloPortal(r: ReclamacaoDoPortal) {

  if (r.avaliada || r.status === "SOLVED" || r.status === "NOT_SOLVED") {
    return r.resolvida || r.status === "SOLVED"
      ? "Resolvido"
      : "Não resolvido";
  }

  if (r.status === "PENDING") return "Novo";

  if (r.status === "ANSWERED") {
    const ultima = r.interacoes[r.interacoes.length - 1];
    return ultima?.tipo === "REPLY"
      ? "Aguardando nossa réplica"
      : "Aguardando avaliação";
  }

  return undefined;
}

/** As falas da empresa: a resposta e as tréplicas. */
const DA_EMPRESA = new Set(["ANSWER", "COMPANY_REPLY"]);

export function casoDoPortal(r: ReclamacaoDoPortal): Case {

  const daEmpresa = r.interacoes.filter((i) => DA_EMPRESA.has(i.tipo));

  /*
    A consideração final é do consumidor, não da empresa.

    `FINAL_ANSWER` parece "resposta final" e é o comentário de quem
    avaliou ("Resolveram meu problema!"). Somá-la à resposta pública
    poria a frase do consumidor na boca da Cardápio Web.
  */
  const final = r.interacoes.find((i) => i.tipo === "FINAL_ANSWER");

  const resposta = daEmpresa
    .map((i) => textoDoPortal(i.texto))
    .filter(Boolean)
    .join("\n\n");

  const primeira = daEmpresa[0];

  const { categoria, subcategoria } = classificarPorProblema(
    r.problema ?? "",
    r.titulo
  );

  const nota = r.avaliada ? (r.nota ?? null) : null;

  const criada = diaDoPortal(r.criadaEm) as string;

  const ultima = r.interacoes[r.interacoes.length - 1];

  const endereco = `https://www.reclameaqui.com.br/${EMPRESA_NO_PORTAL}/${r.slug ?? `x_${r.codigo}`}/`;

  return {
    id: r.codigo,
    protocol: `RA-${r.codigo}`,

    /**
     * O nome do consumidor não é público no portal.
     *
     * "Não informado" é o mesmo que a planilha grava quando a coluna vem
     * vazia. Quem abrir a reclamação na área da empresa e clicar em
     * "Criar no Kanban" completa nome, telefone e e-mail — a rota da
     * captura preenche o que estiver vazio.
     */
    company: "Não informado",
    customer: "Não informado",

    city: r.cidade,
    state: r.estado,

    source: "Reclame Aqui",

    category: categoria,
    subcategory: subcategoria,

    priority: prioridadePeloPortal({
      score: nota,
      resolved: r.resolvida,
      evaluated: r.avaliada,
      answered: resposta !== "",
    }),

    status: statusPeloPortal(r) ?? "Novo",

    title: r.titulo.trim(),
    description: textoDoPortal(r.relato),

    publicResponse: resposta,
    publicResponseAt: primeira ? diaDoPortal(primeira.em) : undefined,

    evaluated: r.avaliada,
    score: nota ?? undefined,
    resolved: r.resolvida,
    wouldDoBusiness: r.voltaria,
    evaluatedAt:
      r.avaliada && final ? diaDoPortal(final.em) : undefined,

    responseTime: primeira
      ? decorrido(instante(r.criadaEm), instante(primeira.em))
      : "-",
    solutionTime:
      r.avaliada && final
        ? decorrido(instante(r.criadaEm), instante(final.em))
        : "-",

    sla: r.resolvida ? "Concluído" : "48h",

    raUrl: endereco,

    createdAt: criada,
    updatedAt: diaDoPortal(ultima?.em ?? "") ?? criada,
    lastInteraction: diaDoPortal(ultima?.em ?? "") ?? criada,

    churnRisk: r.avaliada && !r.resolvida && !r.voltaria,

    tags: [TAG_DA_EXTENSAO],
  };
}

/* ============================================================
   QUEM JÁ EXISTE
============================================================ */

const DOIS_DIAS = 2 * 86_400_000;

type NoBanco = Awaited<ReturnType<typeof carregar>>[number];

function carregar(
  prisma: PrismaClient,
  where: Prisma.CaseWhereInput
) {
  return prisma.case.findMany({
    where,
    select: {
      ...SELECAO_DO_PORTAL,
      description: true,
      externalUrl: true,
      title: true,
      publishedAt: true,
    },
  });
}

/**
 * Para cada reclamação lida, a que já está no banco — se estiver.
 *
 * Quatro chaves, da mais forte para a mais fraca: o protocolo, o
 * endereço, o número antigo e o título na mesma data. As duas últimas
 * existem por causa do Hugme, que numera a mesma reclamação de outro
 * jeito — sem elas, uma reclamação capturada pelo número entraria de
 * novo pelo código, e o quadro teria dois cartões do mesmo problema.
 */
export async function jaNoBanco(
  prisma: PrismaClient,
  reclamacoes: ReclamacaoDoPortal[]
) {

  const achadas = new Map<string, NoBanco>();

  if (reclamacoes.length === 0) return achadas;

  const codigos = reclamacoes.map((r) => r.codigo);

  const numeros = reclamacoes
    .map((r) => r.numero)
    .filter((n): n is number => typeof n === "number");

  const candidatos = await carregar(prisma, {
    OR: [
      { protocol: { in: codigos.map((c) => `RA-${c}`) } },
      { externalId: { in: [...codigos, ...codigos.map((c) => `RA-${c}`)] } },
      ...codigos.map((c) => ({ externalUrl: { contains: c } })),
      ...(numeros.length > 0
        ? [
            { protocol: { in: numeros.map((n) => `RA-${n}`) } },
            { externalId: { in: numeros.map(String) } },
          ]
        : []),
    ],
  });

  for (const r of reclamacoes) {
    const chaves = new Set([
      `RA-${r.codigo}`,
      r.codigo,
      ...(r.numero ? [`RA-${r.numero}`, String(r.numero)] : []),
    ]);

    const achada = candidatos.find(
      (c) =>
        chaves.has(c.protocol) ||
        chaves.has(c.externalId ?? "") ||
        (c.externalUrl ?? "").includes(r.codigo)
    );

    if (achada) achadas.set(r.codigo, achada);
  }

  /* A última chave, uma consulta por reclamação — só para as que sobraram. */
  for (const r of reclamacoes) {

    if (achadas.has(r.codigo)) continue;

    const dia = Date.parse(`${diaDoPortal(r.criadaEm)}T00:00:00Z`);

    if (!Number.isFinite(dia)) continue;

    const [mesmoTitulo] = await carregar(prisma, {
      title: { equals: r.titulo.trim(), mode: "insensitive" },
      publishedAt: {
        gte: new Date(dia - DOIS_DIAS),
        lte: new Date(dia + DOIS_DIAS),
      },
    });

    if (mesmoTitulo) achadas.set(r.codigo, mesmoTitulo);
  }

  return achadas;
}

/* ============================================================
   GRAVAÇÃO
============================================================ */

function vazioOuMarcador(valor: string | null, marcador: string) {
  const limpo = (valor ?? "").trim();
  return limpo === "" || limpo === marcador;
}

export interface ResultadoDoVigia {
  criadas: { protocolo: string; titulo: string }[];
  completadas: { protocolo: string; campos: string[] }[];
  inalteradas: number;
}

/**
 * Grava o que o vigia leu.
 *
 * Nova entra inteira, por `criarSeNova` — que esbarra no protocolo
 * único em vez de sobrescrever, se outra extensão tiver chegado antes.
 * Existente recebe só o que o portal é dono, pela mesma regra da
 * planilha, com uma trava a mais: **resposta e relato só onde o banco
 * está vazio**. O texto que a operação publicou pela plataforma pode
 * diferir do portal em espaço e quebra de linha, e trocar um pelo outro
 * a cada volta seria mexer no que ninguém pediu.
 */
export async function gravarDoPortal(
  prisma: PrismaClient,
  reclamacoes: ReclamacaoDoPortal[]
): Promise<ResultadoDoVigia> {

  const resultado: ResultadoDoVigia = {
    criadas: [],
    completadas: [],
    inalteradas: 0,
  };

  const existentes = await jaNoBanco(prisma, reclamacoes);

  for (const r of reclamacoes) {

    const doPortal = casoDoPortal(r);
    const atual = existentes.get(r.codigo);

    if (!atual) {
      const id = await criarSeNova(prisma, doPortal);

      if (id) {
        resultado.criadas.push({
          protocolo: doPortal.protocol,
          titulo: doPortal.title,
        });
      } else {
        resultado.inalteradas += 1;
      }

      continue;
    }

    const temResposta = !vazioOuMarcador(
      atual.publicResponse,
      RESPOSTA_SINTETICA
    );

    const portal: Case = { ...doPortal };

    /*
      O vigia não devolve ninguém para "Novo".

      Uma reclamação pendente no portal e adiantada aqui — alguém marcou
      a resposta na plataforma antes de publicá-la lá — voltaria à
      primeira coluna a cada volta, e o quadro piscaria. Para trás, só a
      operação move.
    */
    if (portal.status === "Novo") portal.status = atual.status;

    if (temResposta) {
      delete portal.publicResponse;
      if (atual.publicResponseAt) delete portal.publicResponseAt;
    }

    const { dados } = mudancasDoPortal(portal, atual);

    const semRelato = vazioOuMarcador(
      atual.description,
      RELATO_SINTETICO
    );

    const mudancas: Record<string, unknown> = { ...dados };

    if (semRelato && doPortal.description) {
      mudancas.description = doPortal.description;
    }

    if (!atual.externalUrl && doPortal.raUrl) {
      mudancas.externalUrl = doPortal.raUrl;
    }

    if (Object.keys(mudancas).length === 0) {
      resultado.inalteradas += 1;
      continue;
    }

    await prisma.case.update({
      where: { id: atual.id },
      data: mudancas,
      select: { id: true },
    });

    resultado.completadas.push({
      protocolo: atual.protocol,
      campos: Object.keys(mudancas),
    });
  }

  return resultado;
}

/* ============================================================
   CONTATO, PELA ÁREA DA EMPRESA
============================================================ */

/** O que a planilha e o vigia gravam quando não sabem o nome. */
const SEM_NOME = new Set(["", "não informado", "nao informado"]);

const MASCARA = /•/;

/**
 * Completa, numa reclamação que já existe, o contato que está vazio.
 *
 * **Por que existe.** O vigia do Reclame Aqui cria a reclamação a partir
 * da página pública, e o portal não mostra o nome do consumidor em
 * público — ela nasce com "Não informado", sem telefone e sem e-mail.
 * Quem abre a mesma reclamação na área da empresa tem tudo isso na
 * tela, e "Criar no Kanban" respondia só "já estava no Kanban".
 *
 * Só onde está vazio, mascarado ou "Não informado". Valor real no banco
 * fica, mesmo que a página mostre outro — a operação pode ter corrigido
 * à mão, e a rota da captura continua não sobrescrevendo nada.
 *
 * Mora aqui, e não na rota, para o `check:vigia` provar contra o banco.
 */
export async function completarContato(
  prisma: PrismaClient,
  atual: {
    id: string;
    customer: string;
    companyName: string;
    email: string | null;
    phone: string | null;
    document: string | null;
    city: string | null;
    state: string | null;
  },
  lido: {
    cliente: string;
    email: string;
    telefone: string;
    documento?: string;
    cidade: string;
    estado: string;
  }
) {

  const vazio = (valor: string | null) =>
    !valor || valor.trim() === "" || MASCARA.test(valor);

  const real = (valor: string) =>
    valor.trim() !== "" && !MASCARA.test(valor);

  const dados: Record<string, string> = {};
  const campos: string[] = [];

  if (
    real(lido.cliente) &&
    SEM_NOME.has(atual.customer.trim().toLowerCase())
  ) {
    dados.customer = lido.cliente;
    campos.push("nome");

    if (SEM_NOME.has(atual.companyName.trim().toLowerCase())) {
      dados.companyName = lido.cliente;
    }
  }

  if (real(lido.email) && vazio(atual.email)) {
    dados.email = lido.email;
    campos.push("e-mail");
  }

  if (real(lido.telefone) && vazio(atual.phone)) {
    dados.phone = lido.telefone;
    campos.push("telefone");
  }

  if (lido.documento && !atual.document) {
    dados.document = lido.documento;
    campos.push("documento");
  }

  if (real(lido.cidade) && vazio(atual.city)) {
    dados.city = lido.cidade;
    campos.push("cidade");
  }

  if (real(lido.estado) && vazio(atual.state)) {
    dados.state = lido.estado;
    campos.push("UF");
  }

  if (campos.length > 0) {
    await prisma.case.update({
      where: { id: atual.id },
      data: dados,
      select: { id: true },
    });
  }

  return campos;
}

/* ============================================================
   O QUE O VIGIA DEVE BUSCAR
============================================================ */

/**
 * Reclamações que o portal pode completar: respondidas sem o texto da
 * resposta, ou sem relato.
 *
 * Em 11/09/2026 eram seis — cinco respondidas sem texto, gravadas pelo
 * script de 03/09 a partir de uma planilha que dizia "respondida" sem
 * dizer o quê, e uma sem relato. O vigia busca a página de cada uma.
 */
export async function pendentesDoPortal(
  prisma: PrismaClient,
  teto = 200
) {

  const linhas = await prisma.case.findMany({
    where: {
      protocol: { startsWith: "RA-" },
      OR: [
        {
          publicResponseAt: { not: null },
          OR: [
            { publicResponse: null },
            { publicResponse: "" },
            { publicResponse: RESPOSTA_SINTETICA },
          ],
        },
        { description: null },
        { description: "" },
        { description: RELATO_SINTETICO },
      ],
    },
    orderBy: { publishedAt: "desc" },
    select: { protocol: true },
    take: teto,
  });

  return linhas
    .map((l) => l.protocol.slice(3))
    .filter((c) => CODIGO_DO_PORTAL.test(c));
}

/** O que a lista mostra de cada reclamação, sem abrir a página dela. */
export interface ItemDaLista {
  codigo: string;
  status: string;
  avaliada: boolean;
}

/**
 * Das reclamações conhecidas na lista, quais o portal já passou à frente.
 *
 * A lista diz, sem abrir a página, se a reclamação foi respondida e se
 * foi avaliada. Quando o banco está atrás — sem resposta aqui e
 * respondida lá, ou avaliada lá e não aqui —, vale abrir a página e
 * trazer o resto. É o que faz a avaliação do consumidor aparecer no
 * quadro sem ninguém importar planilha.
 */
export async function atrasadasNaLista(
  prisma: PrismaClient,
  itens: ItemDaLista[]
) {

  const validos = itens.filter((i) => CODIGO_DO_PORTAL.test(i.codigo));

  if (validos.length === 0) return [];

  const noBanco = await prisma.case.findMany({
    where: {
      protocol: { in: validos.map((i) => `RA-${i.codigo}`) },
    },
    select: {
      protocol: true,
      status: true,
      evaluated: true,
      publicResponse: true,
    },
  });

  const porCodigo = new Map(
    noBanco.map((c) => [c.protocol.slice(3), c])
  );

  return validos
    .filter((item) => {
      const caso = porCodigo.get(item.codigo);

      if (!caso) return false;

      const semResposta = vazioOuMarcador(
        caso.publicResponse,
        RESPOSTA_SINTETICA
      );

      const respondidaLa = item.status !== "PENDING";

      if (respondidaLa && semResposta) return true;
      if (item.avaliada && !caso.evaluated) return true;

      /* Coluna do portal parada em "Novo" com a reclamação já respondida. */
      return (
        respondidaLa &&
        caso.status === "Novo" &&
        COLUNAS_DO_PORTAL.has(caso.status)
      );
    })
    .map((item) => item.codigo);
}
