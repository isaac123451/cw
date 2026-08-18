import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { getApiCases } from "@/lib/api/source";
import { loadWorkspace } from "@/lib/actions/workspace";
import { getPrisma } from "@/lib/prisma";

import { Case } from "@/lib/models/case";
import { Establishment } from "@/lib/models/establishment";

import { isOpen } from "@/lib/services/case.service";
import { slaStatus } from "@/lib/services/sla.service";
import {
  movementStatus,
  openMovementOf,
} from "@/lib/services/movement.service";
import { slugify } from "@/lib/services/slug";
import { REFERENCE_DATE } from "@/lib/services/reputation.service";

import {
  chaveTelefone,
  compararEmail,
  compararNome,
  compararTelefone,
  Confianca,
  lerTelefone,
  normalizarNome,
  TelefoneLido,
} from "@/lib/services/contato.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O que a extensão pergunta quando você abre uma conversa.
 *
 * Recebe o que a tela de fora sabe — telefone, nome, protocolo ou um
 * termo digitado — e devolve o retrato do cliente do lado de cá: casos
 * abertos, prazo, risco, estabelecimento, ciclo de NPS e o que fazer a
 * seguir.
 *
 * Somente leitura, por decisão registrada em `EXTENSAO.md`: numa base
 * com consumidor real, um painel que só mostra tem superfície de erro
 * muito menor do que um que também grava.
 */

const MAXIMO_CASOS = 12;

interface CasoResumo {
  id: string;
  protocolo: string;
  titulo: string;
  status: string;
  categoria: string;
  subcategoria?: string;
  prioridade: string;
  responsavel?: string;
  canal: string;
  criadoEm: string;
  aberto: boolean;
  respondido: boolean;
  avaliado: boolean;
  nota?: number;
  resolvido: boolean;
  voltaria: boolean;
  risco: boolean;
  sla: {
    situacao: string;
    rotulo: string;
    horasRestantes: number;
  };
  movimentacao?: {
    destino: string;
    situacao: string;
    rotulo: string;
  };
  url: string;
  urlPortal?: string;
}

interface Sugestao {
  tom: "danger" | "warning" | "info";
  texto: string;
}

/** Data de referência da operação, não a do relógio do navegador. */
const HOJE = REFERENCE_DATE;

function diasEntre(de: string, ate: string) {
  return Math.round(
    (Date.parse(`${ate}T00:00:00Z`) -
      Date.parse(`${de}T00:00:00Z`)) /
      86400000
  );
}

export async function GET(request: Request) {

  const { usuario, demonstracao } =
    await autenticar(request);

  if (!usuario && !demonstracao) {
    return semSessao(request);
  }

  const url = new URL(request.url);
  const params = url.searchParams;
  const origem = url.origin;

  const telefoneBruto = params.get("telefone") ?? "";
  const nomeBruto = params.get("nome") ?? "";
  const emailBruto = params.get("email") ?? "";
  const protocoloBruto = params.get("protocolo") ?? "";

  /**
   * `termo` é o campo de busca manual do painel: uma caixa só, em que
   * cabe telefone, nome ou protocolo. Ele existe porque a leitura
   * automática do DOM do WhatsApp vai quebrar algum dia — quando
   * quebrar, o painel continua servindo para alguma coisa.
   */
  const termo = (params.get("termo") ?? "").trim();

  const alvo = interpretar({
    telefone: telefoneBruto,
    nome: nomeBruto,
    email: emailBruto,
    protocolo: protocoloBruto,
    termo,
  });

  if (
    !alvo.telefone &&
    !alvo.nome &&
    !alvo.email &&
    !alvo.protocolo
  ) {
    return responder(
      request,
      {
        erro: "Informe telefone, nome, e-mail, protocolo ou termo.",
      },
      400
    );
  }

  const [casos, workspace] = await Promise.all([
    getApiCases("all"),
    loadWorkspace(),
  ]);

  const encontro = casar(casos, alvo);

  const nps = await buscarNps(alvo);

  const estabelecimento = acharEstabelecimento(
    workspace.establishments,
    alvo,
    encontro.casos,
    nps?.establishmentId
  );

  const resumos = encontro.casos
    .slice(0, MAXIMO_CASOS)
    .map((item) =>
      resumir(item, workspace, origem)
    );

  return responder(request, {
    usuario: usuario
      ? { nome: usuario.nome, papel: usuario.papel }
      : null,

    demonstracao,

    referencia: HOJE,

    consulta: {
      telefone: alvo.telefone?.digitos,
      chave: chaveTelefone(alvo.telefone),
      nome: nomeBruto || termo || undefined,
      protocolo: alvo.protocolo,
    },

    confianca: encontro.confianca,
    porQue: encontro.porQue,
    aviso: encontro.aviso,

    cliente: encontro.casos.length
      ? perfil(encontro.casos, origem)
      : null,

    estabelecimento: estabelecimento
      ? {
          nome: estabelecimento.name,
          plano: estabelecimento.plan,
          status: estabelecimento.status,
          mrr: estabelecimento.mrr,
          segmento: estabelecimento.segment,
          responsavel: estabelecimento.owner,
          cidade: estabelecimento.city,
          estado: estabelecimento.state,
          url: `${origem}/estabelecimentos/${estabelecimento.slug}`,
        }
      : null,

    nps,

    casos: resumos,

    totalCasos: encontro.casos.length,

    sugestoes: sugerir(encontro.casos, resumos, nps),

    macros: macrosDe(encontro.casos, workspace, origem),
  });
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}

/* ============================================================
   O QUE A EXTENSÃO MANDOU
============================================================ */

interface Alvo {
  telefone: TelefoneLido | null;
  nome: string;
  email: string;
  protocolo: string;
}

/**
 * Descobre o que cada pedaço da consulta é.
 *
 * O termo livre precisa ser classificado aqui e não no navegador: é a
 * mesma regra que decide o casamento, e duas cópias dela divergiriam na
 * primeira correção.
 */
function interpretar(entrada: {
  telefone: string;
  nome: string;
  email: string;
  protocolo: string;
  termo: string;
}): Alvo {

  let telefone = lerTelefone(entrada.telefone);
  let nome = entrada.nome.trim();
  let email = entrada.email.trim();
  let protocolo = entrada.protocolo.trim();

  const termo = entrada.termo;

  if (termo) {

    const digitos = termo.replace(/\D/g, "");

    if (termo.includes("@")) {
      email = email || termo;
    } else if (/^RA-?\d{6,}$/i.test(termo)) {
      protocolo = protocolo || termo;
    } else if (
      digitos.length >= 6 &&
      digitos.length === termo.replace(/[\s()+\-.]/g, "").length
    ) {
      /**
       * Só dígitos e pontuação de telefone. Um protocolo do portal
       * também é só dígitos — por isso ele entra nos dois lados, e o
       * casamento por protocolo tem prioridade na hora de decidir.
       */
      telefone = telefone ?? lerTelefone(termo);
      protocolo = protocolo || digitos;
    } else {
      nome = nome || termo;
    }
  }

  return { telefone, nome, email, protocolo };
}

/* ============================================================
   O CASAMENTO
============================================================ */

interface Encontro {
  casos: Case[];
  confianca: Confianca;
  porQue: string;
  aviso?: string;
}

function ordenar(casos: Case[]) {
  return [...casos].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

function casar(base: Case[], alvo: Alvo): Encontro {

  /** 1. Protocolo é identificador: quando bate, não há dúvida. */
  if (alvo.protocolo) {

    const limpo = alvo.protocolo
      .replace(/^RA-?/i, "")
      .trim();

    const achados = base.filter(
      (item) =>
        item.protocol === alvo.protocolo ||
        item.protocol === `RA-${limpo}` ||
        item.id === limpo ||
        (item.raUrl ?? "").includes(limpo)
    );

    if (achados.length > 0) {
      return {
        casos: ordenar(achados),
        confianca: "exata",
        porQue: `Protocolo ${achados[0].protocol}.`,
      };
    }
  }

  /** 2. Telefone. */
  if (alvo.telefone) {

    const exatos: Case[] = [];
    const parciais: Case[] = [];

    for (const item of base) {

      const resultado = compararTelefone(
        alvo.telefone,
        lerTelefone(item.phone)
      );

      if (resultado === "exata") exatos.push(item);
      if (resultado === "parcial") parciais.push(item);
    }

    if (exatos.length > 0) {
      return {
        casos: ordenar(exatos),
        confianca: "exata",
        porQue: "Telefone confere por inteiro.",
      };
    }

    if (parciais.length > 0) {

      const pessoas = new Set(
        parciais.map((item) => slugify(item.customer))
      );

      /**
       * Mais de uma pessoa na mesma chave significa que DDD e quatro
       * dígitos finais não bastam ali. Na base atual isso acontece em
       * uma chave entre 291 — raro, mas não zero, e quem está falando
       * com o cliente precisa saber que é esse o caso.
       */
      if (pessoas.size > 1) {
        return {
          casos: ordenar(parciais),
          confianca: "ambigua",
          porQue:
            "DDD e quatro dígitos finais conferem em mais de um cliente.",
          aviso: `Esta chave aponta para ${pessoas.size} pessoas diferentes. Confirme o nome antes de tratar como o mesmo cliente.`,
        };
      }

      // O nome, quando veio junto, transforma "provável" em confirmação.
      const confirmadoPeloNome =
        alvo.nome &&
        parciais.some(
          (item) => compararNome(alvo.nome, item.customer)
        );

      return {
        casos: ordenar(parciais),
        confianca: confirmadoPeloNome
          ? "exata"
          : "provavel",
        porQue: confirmadoPeloNome
          ? "DDD, quatro dígitos finais e nome conferem."
          : "DDD e quatro dígitos finais conferem.",
        aviso: confirmadoPeloNome
          ? undefined
          : "O telefone da base está mascarado: só DDD e os quatro últimos dígitos são comparáveis.",
      };
    }
  }

  /** 3. E-mail — reforço, nunca prova sozinho. */
  if (alvo.email) {

    const achados = base.filter((item) =>
      compararEmail(alvo.email, item.email)
    );

    if (achados.length > 0) {
      return {
        casos: ordenar(achados),
        confianca: "provavel",
        porQue: "E-mail compatível com o registro mascarado.",
        aviso:
          "O e-mail da base está mascarado: conferem as duas primeiras letras, o domínio e o comprimento.",
      };
    }
  }

  /** 4. Nome. */
  if (alvo.nome) {

    const exatos = base.filter(
      (item) =>
        compararNome(alvo.nome, item.customer) === "exata"
    );

    if (exatos.length > 0) {
      return {
        casos: ordenar(exatos),
        confianca: "provavel",
        porQue: "Nome idêntico ao do cadastro.",
        aviso:
          "Encontrado por nome. Homônimo é possível — confirme o contato.",
      };
    }

    const parciais = base.filter(
      (item) => compararNome(alvo.nome, item.customer)
    );

    if (parciais.length > 0) {
      return {
        casos: ordenar(parciais),
        confianca: "ambigua",
        porQue: "Primeiro e último nome conferem.",
        aviso:
          "Encontrado só por primeiro e último nome. Confirme antes de tratar como o mesmo cliente.",
      };
    }

    /** Última tentativa: pedaço do nome, como uma busca de tela faria. */
    const alvoNormalizado = normalizarNome(alvo.nome);

    if (alvoNormalizado.length >= 4) {

      const contem = base.filter((item) =>
        normalizarNome(item.customer).includes(
          alvoNormalizado
        )
      );

      if (contem.length > 0) {
        return {
          casos: ordenar(contem),
          confianca: "ambigua",
          porQue: `Busca por "${alvo.nome}" no nome do cliente.`,
        };
      }
    }
  }

  return {
    casos: [],
    confianca: "nenhuma",
    porQue: "Nenhuma reclamação encontrada para este contato.",
  };
}

/* ============================================================
   O RETRATO
============================================================ */

function perfil(casos: Case[], origem: string) {

  const avaliados = casos.filter(
    (item) => typeof item.score === "number"
  );

  const media =
    avaliados.length === 0
      ? undefined
      : Math.round(
          (avaliados.reduce(
            (soma, item) => soma + (item.score ?? 0),
            0
          ) /
            avaliados.length) *
            10
        ) / 10;

  const categorias = new Map<string, number>();

  for (const item of casos) {
    categorias.set(
      item.category,
      (categorias.get(item.category) ?? 0) + 1
    );
  }

  const ordenados = [...casos].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  );

  const nome = casos[0].customer;

  return {
    nome,
    slug: slugify(nome),
    telefone: casos[0].phone,
    email: casos[0].email,
    cidade: casos[0].city,
    estado: casos[0].state,

    total: casos.length,
    abertos: casos.filter(isOpen).length,
    resolvidos: casos.filter((item) => item.resolved)
      .length,
    naoResolvidos: casos.filter(
      (item) => item.evaluated && !item.resolved
    ).length,
    risco: casos.filter((item) => item.churnRisk).length,

    notaMedia: media,
    avaliados: avaliados.length,
    voltariam: casos.filter(
      (item) => item.wouldDoBusiness
    ).length,

    primeiroCaso: ordenados[0]?.createdAt,
    ultimoCaso: ordenados[ordenados.length - 1]?.createdAt,

    categoriaTop: [...categorias.entries()].sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0],

    url: `${origem}/clientes/${slugify(nome)}`,
  };
}

type Workspace = Awaited<ReturnType<typeof loadWorkspace>>;

function resumir(
  item: Case,
  workspace: Workspace,
  origem: string
): CasoResumo {

  const sla = slaStatus(item, workspace.slaRules, HOJE);

  const movimento = openMovementOf(
    item.id,
    workspace.movements
  );

  const situacaoMovimento = movimento
    ? movementStatus(movimento, HOJE)
    : null;

  return {
    id: item.id,
    protocolo: item.protocol,
    titulo: item.title,
    status: item.status,
    categoria: item.category,
    subcategoria: item.subcategory,
    prioridade: item.priority,
    responsavel: item.owner,
    canal: item.source,
    criadoEm: item.createdAt,
    aberto: isOpen(item),
    respondido:
      (item.publicResponse ?? "").trim() !== "",
    avaliado: Boolean(item.evaluated),
    nota: item.score,
    resolvido: item.resolved,
    voltaria: item.wouldDoBusiness,
    risco: Boolean(item.churnRisk),

    sla: {
      situacao: sla.situation,
      rotulo: sla.label,
      horasRestantes: sla.remainingHours,
    },

    movimentacao:
      movimento && situacaoMovimento
        ? {
            destino: movimento.destination,
            situacao: situacaoMovimento.situation,
            rotulo: situacaoMovimento.label,
          }
        : undefined,

    url: `${origem}/reclame-aqui/${item.id}`,
    urlPortal: item.raUrl,
  };
}

/* ============================================================
   ESTABELECIMENTO
============================================================ */

/**
 * O vínculo cliente → estabelecimento **não persiste** hoje:
 * `ClientsContext` guarda o enriquecimento em memória, e `Case` não tem
 * coluna de estabelecimento no banco. Então aqui o vínculo é procurado
 * pelos dados que existem de fato — o registro de NPS, que tem
 * `establishmentId`, e depois telefone, e-mail e nome do cadastro.
 *
 * Enquanto o cadastro de estabelecimentos estiver com os três exemplos
 * de partida, o normal é isto devolver nada. É o comportamento certo:
 * inventar um vínculo seria pior.
 */
function acharEstabelecimento(
  lista: Establishment[],
  alvo: Alvo,
  casos: Case[],
  porNps?: string | null
): Establishment | null {

  if (porNps) {
    const doNps = lista.find((item) => item.id === porNps);
    if (doNps) return doNps;
  }

  if (alvo.telefone) {
    const porTelefone = lista.find((item) =>
      compararTelefone(
        alvo.telefone,
        lerTelefone(item.phone)
      )
    );

    if (porTelefone) return porTelefone;
  }

  if (alvo.email) {
    const porEmail = lista.find((item) =>
      compararEmail(alvo.email, item.email)
    );

    if (porEmail) return porEmail;
  }

  const nomes = [
    alvo.nome,
    ...casos.map((item) => item.company),
  ].filter(Boolean);

  for (const nome of nomes) {

    const achado = lista.find(
      (item) => compararNome(nome, item.name) === "exata"
    );

    if (achado) return achado;
  }

  return null;
}

/* ============================================================
   NPS
============================================================ */

/**
 * Ciclo de NPS aberto do cliente.
 *
 * Consulta direto o Prisma em vez de reaproveitar `listNpsResponses`:
 * aquela action lê a sessão pelo cookie via `next/headers`, e a
 * extensão manda o token no cabeçalho. Reaproveitá-la obrigaria a ter
 * dois caminhos de autenticação vivos ao mesmo tempo.
 *
 * O telefone do NPS é digitado pela operação, então costuma estar
 * inteiro — este é o único lugar em que o casamento exato acontece de
 * verdade hoje.
 */
async function buscarNps(alvo: Alvo) {

  const prisma = getPrisma();

  if (!prisma) return null;

  const linhas = await prisma.npsResponse.findMany({
    select: {
      id: true,
      score: true,
      status: true,
      kind: true,
      customer: true,
      phone: true,
      email: true,
      establishmentId: true,
      respondedAt: true,
      firstContactDueAt: true,
      firstContactAt: true,
      _count: { select: { attempts: true } },
    },
    orderBy: { respondedAt: "desc" },
    take: 500,
  });

  const achado = linhas.find((linha) => {

    if (
      alvo.telefone &&
      compararTelefone(
        alvo.telefone,
        lerTelefone(linha.phone)
      )
    ) {
      return true;
    }

    if (
      alvo.email &&
      compararEmail(alvo.email, linha.email)
    ) {
      return true;
    }

    return Boolean(
      alvo.nome &&
        compararNome(alvo.nome, linha.customer) === "exata"
    );
  });

  if (!achado) return null;

  const dia = (valor: Date | null) =>
    valor ? valor.toISOString().slice(0, 10) : undefined;

  return {
    id: achado.id,
    nota: achado.score,
    status: achado.status,
    tipo: achado.kind ?? undefined,
    cliente: achado.customer,
    respondidoEm: dia(achado.respondedAt),
    prazoPrimeiroContato: dia(achado.firstContactDueAt),
    primeiroContatoEm: dia(achado.firstContactAt),
    tentativas: achado._count.attempts,
    establishmentId: achado.establishmentId,
    encerrado: achado.status.startsWith("[Encerrado]"),
  };
}

/* ============================================================
   O QUE FAZER AGORA
============================================================ */

/**
 * Sugestões derivadas dos dados, e não uma lista fixa.
 *
 * Cada linha aqui corresponde a uma tarefa da rotina mapeada em
 * `EXTENSAO.md` — pedir avaliação, FUP pós-finalização, retenção,
 * cobrar área interna, as três tentativas do NPS. É o que transforma o
 * painel de "consulta" em "próximo passo".
 */
function sugerir(
  casos: Case[],
  resumos: CasoResumo[],
  nps: Awaited<ReturnType<typeof buscarNps>>
): Sugestao[] {

  const lista: Sugestao[] = [];

  const semResposta = casos.filter(
    (item) => item.status === "Novo"
  );

  if (semResposta.length > 0) {

    const dias = diasEntre(
      [...semResposta].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt)
      )[0].createdAt,
      HOJE
    );

    lista.push({
      tom: dias > 5 ? "danger" : "warning",
      texto: `${semResposta.length} reclamação(ões) sem resposta pública — a mais antiga há ${dias} dia(s). É o indicador de maior peso na nota.`,
    });
  }

  const replicas = casos.filter(
    (item) => item.status === "Aguardando nossa réplica"
  );

  if (replicas.length > 0) {
    lista.push({
      tom: "danger",
      texto: `${replicas.length} réplica(s) aguardando retorno da empresa.`,
    });
  }

  const aguardandoAvaliacao = casos.filter(
    (item) => item.status === "Aguardando avaliação"
  );

  if (aguardandoAvaliacao.length > 0) {
    lista.push({
      tom: "info",
      texto: `${aguardandoAvaliacao.length} caso(s) respondido(s) esperando a avaliação do consumidor. É a hora de pedir a avaliação.`,
    });
  }

  const negativas = casos.filter(
    (item) =>
      item.status === "Não resolvido" &&
      diasEntre(item.createdAt, HOJE) <= 30
  );

  if (negativas.length > 0) {
    lista.push({
      tom: "warning",
      texto: `${negativas.length} avaliação(ões) negativa(s) no último mês — cabe FUP pós-finalização.`,
    });
  }

  if (casos.some((item) => item.churnRisk)) {
    lista.push({
      tom: "danger",
      texto:
        "Risco de cancelamento sinalizado neste cliente. Tratar como caso de retenção.",
    });
  }

  const atrasados = resumos.filter(
    (item) => item.sla.situacao === "estourado"
  );

  if (atrasados.length > 0) {
    lista.push({
      tom: "danger",
      texto: `${atrasados.length} caso(s) com prazo estourado (${atrasados[0].sla.rotulo}).`,
    });
  }

  const paradas = resumos.filter(
    (item) => item.movimentacao?.situacao === "estourado"
  );

  if (paradas.length > 0) {
    lista.push({
      tom: "danger",
      texto: `${paradas.length} caso(s) parado(s) aguardando retorno interno — ${paradas[0].movimentacao?.rotulo}.`,
    });
  }

  if (nps && !nps.encerrado) {

    if (nps.tentativas >= 3) {
      lista.push({
        tom: "warning",
        texto: `NPS aberto com ${nps.tentativas} tentativas registradas. Pela regra das três em 7 dias, já cabe encerrar como Sem Retorno.`,
      });
    } else {
      lista.push({
        tom: nps.nota <= 6 ? "danger" : "info",
        texto: `NPS ${nps.nota}/10 em aberto (${nps.status}), prazo de primeiro contato ${nps.prazoPrimeiroContato}. ${nps.tentativas} tentativa(s) até agora.`,
      });
    }
  }

  if (lista.length === 0 && casos.length > 0) {
    lista.push({
      tom: "info",
      texto:
        "Nada pendente neste cliente: todos os casos estão respondidos e dentro do prazo.",
    });
  }

  return lista;
}

/**
 * Textos aprovados da categoria mais frequente do cliente.
 *
 * Três, no máximo: o painel é uma coluna estreita ao lado do WhatsApp,
 * e a lista inteira de macros já tem tela própria.
 */
function macrosDe(
  casos: Case[],
  workspace: Workspace,
  origem: string
) {

  if (casos.length === 0) return [];

  const categorias = new Set(
    casos.map((item) => item.category)
  );

  return workspace.macros
    .filter((macro) => categorias.has(macro.category))
    .slice(0, 3)
    .map((macro) => ({
      id: macro.id,
      titulo: macro.title,
      categoria: macro.category,
      texto: macro.body,
      url: `${origem}/base-conhecimento`,
    }));
}
