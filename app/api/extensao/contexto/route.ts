import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { getApiCases } from "@/lib/api/source";
import { loadWorkspace } from "@/lib/actions/workspace";
import { Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/prisma";
import { fetchCandidateCases } from "@/lib/services/case.repository";

import { Case } from "@/lib/models/case";
import { Establishment } from "@/lib/models/establishment";

import {
  byChannel,
  isOpen,
} from "@/lib/services/case.service";
import { slaStatus } from "@/lib/services/sla.service";
import {
  movementStatus,
  openMovementOf,
} from "@/lib/services/movement.service";
import { slugify } from "@/lib/services/slug";
import { REFERENCE_DATE } from "@/lib/services/reputation.service";
import {
  retratoNps,
  SELECAO_NPS,
} from "@/lib/services/nps.repository";
import { emAndamento } from "@/lib/models/nps";

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

  /**
   * O canal do rodapé do painel.
   *
   * Existe porque os três não são a mesma fila. O NPS tem **WhatsApp
   * próprio**: o número por onde a pesquisa fala com o cliente não é o
   * do atendimento, então uma conversa aberta ali não casa com
   * reclamação nenhuma do Reclame Aqui — e o painel dizia "nada
   * encontrado" para um cliente que estava bem ali, num ciclo de NPS
   * aberto.
   */
  const canal = (() => {
    const pedido = params.get("canal") ?? "";
    return ["reclame-aqui", "social", "nps"].includes(
      pedido
    )
      ? pedido
      : "todos";
  })();

  /**
   * Só os candidatos, e não a base inteira.
   *
   * Medido antes: `getApiCases("all")` custava **1.448 ms e 233 KB** por
   * consulta — em toda conversa aberta. O banco agora estreita de forma
   * generosa (últimos quatro dígitos, pedaço do nome, domínio do
   * e-mail) e o casamento decide com a mesma precisão de antes.
   *
   * Sem banco cai no dataset de demonstração, que é pequeno e cabe em
   * memória — é o que mantém `npm run dev` útil sem infraestrutura.
   */
  const prismaBusca = getPrisma();

  const [todos, workspace] = await Promise.all([
    prismaBusca
      ? fetchCandidateCases(prismaBusca, {
          protocolo: alvo.protocolo,
          digitosDoTelefone: alvo.telefone?.digitos,
          email: alvo.email,
          nome: alvo.nome,
        })
      : getApiCases("all"),
    loadWorkspace(),
  ]);

  /**
   * A aba do NPS **não** filtra os casos.
   *
   * Ela filtra o destaque, não o histórico: quem está atendendo um
   * detrator ganha muito em ver que a mesma pessoa tem uma reclamação
   * pública aberta. Esconder isso por causa da aba seria esconder o
   * motivo da nota.
   */
  const casos =
    canal === "reclame-aqui" || canal === "social"
      ? byChannel(todos, canal)
      : todos;

  const encontro = casar(casos, alvo);

  const listaNps = await buscarNpsTodos(alvo);

  const nps = listaNps[0] ?? null;

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

    canal,

    /**
     * As etapas ativas, na ordem do quadro.
     *
     * A extensão precisa delas para **rotular** os botões de avançar e
     * voltar ("→ Em atendimento"), não para decidir: quem decide é
     * `/api/extensao/mover`, porque a ordem é cadastro e muda na tela de
     * configurações. Uma extensão instalada há três semanas teria uma
     * cópia velha.
     */
    etapas: workspace.workflow
      .filter((item) => item.active)
      .sort((a, b) => a.order - b.order)
      .map((item) => item.name),

    /**
     * A escada do NPS, pelo mesmo motivo e com a mesma ressalva.
     *
     * As etapas do NPS também viraram cadastro. A extensão tinha uma
     * cópia da lista antiga escrita no arquivo, e ela rotularia os
     * botões com nomes de etapas que a operação pode ter renomeado —
     * ou pior, não acharia o status atual na lista e sumiria com os
     * botões de avançar e voltar.
     */
    etapasNps: emAndamento(workspace.npsStages).map(
      (etapa) => etapa.name
    ),

    nps,

    /** Todos os ciclos do cliente — é o que a aba de NPS lista. */
    npsLista: listaNps,

    casos: resumos,

    totalCasos: encontro.casos.length,

    sugestoes: sugerir(encontro.casos, resumos, nps),

    macros: macrosDe(encontro.casos, workspace, origem),

    // `todos`, e não o recorte do canal: o mapa de UF por cidade fica
    // pobre se a aba filtrar as reclamações que o alimentam.
    cadastros: cadastrosDe(workspace, todos),
  });
}

/**
 * O que a prévia de captura oferece em lista, em vez de pedir digitado.
 *
 * A página do Reclame Aqui **não classifica** a reclamação — o que
 * parecia rótulo de categoria era pergunta de formulário, e ler dali só
 * produzia lixo. Quem tem a lista certa é a própria ferramenta, então a
 * extensão pergunta por ela.
 *
 * Isso não é só conveniência: categoria digitada à mão vira
 * "Financeiro", "financeiro" e "Finaceiro" na mesma base, e o ranking
 * por categoria — que é uma das telas do módulo — passa a contar três
 * problemas onde há um.
 */
function cadastrosDe(
  workspace: Workspace,
  casos: Case[]
) {

  const porOrdem = <T extends { order: number }>(
    a: T,
    b: T
  ) => a.order - b.order;

  return {
    ufPorCidade: ufPorCidade(casos),

    categorias: workspace.categories
      .filter((item) => item.active)
      .sort(porOrdem)
      .map((item) => item.name),

    /**
     * A subcategoria carrega a categoria a que pertence: a prévia
     * filtra a lista ao escolher a categoria, e sem esse par ela
     * ofereceria "Cobrança indevida" dentro de "Entrega".
     */
    subcategorias: workspace.subcategories
      .filter((item) => item.active)
      .sort(porOrdem)
      .map((item) => ({
        categoria: item.category,
        nome: item.name,
      })),
  };
}

/**
 * De que estado é cada cidade, segundo a própria base.
 *
 * **Por que existe.** A página da reclamação mostra só a cidade —
 * "Campo Bom", sem UF nenhuma. O campo chegava vazio na prévia e alguém
 * tinha de saber de cabeça, ou deixar em branco.
 *
 * **Por que não é um chute.** Não vem de tabela de municípios: vem das
 * 333 reclamações que já estão na base, que trazem cidade **e** estado.
 * Cidade que aparece com dois estados diferentes fica **de fora** — há
 * dezenas de "Bom Jesus" e "Santa Luzia" pelo país, e preencher a UF
 * errada é pior do que deixar em branco, porque ninguém confere um
 * campo que já veio preenchido.
 *
 * A prévia continua editável: isto sugere, não decide.
 */
function ufPorCidade(casos: Case[]) {

  const vistos = new Map<string, Set<string>>();

  for (const item of casos) {

    const cidade = (item.city ?? "").trim();
    const estado = (item.state ?? "").trim().toUpperCase();

    if (cidade === "" || !/^[A-Z]{2}$/.test(estado)) {
      continue;
    }

    const chave = cidade.toLowerCase();

    vistos.set(
      chave,
      (vistos.get(chave) ?? new Set()).add(estado)
    );
  }

  const mapa: Record<string, string> = {};

  for (const [cidade, estados] of vistos) {
    if (estados.size === 1) {
      mapa[cidade] = [...estados][0];
    }
  }

  return mapa;
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

  /**
   * **O nome não casa mais nada.**
   *
   * Havia um quarto degrau que achava por nome sozinho, em três
   * tentativas cada vez mais frouxas: nome idêntico, primeiro + último
   * nome, e por fim qualquer pedaço do nome contido no do cliente. O
   * Isaac pediu para tirar, e o motivo aguenta escrutínio:
   *
   * O nome que a extensão lê vem da **agenda do celular de quem
   * atende** — "João Pizzaria", "Maria RA", "Contato Novo". Não é o
   * nome do cadastro, e a última tentativa, por pedaço, casava
   * "Silva" com toda pessoa chamada Silva da base. O que a tela
   * mostrava era "reclamações deste cliente"; o que a pessoa via, às
   * vezes, era a reclamação de outra família.
   *
   * O prejuízo é assimétrico. Não achar custa uma busca à mão. Achar
   * errado faz alguém responder no WhatsApp sobre uma reclamação que
   * não é daquela pessoa — e isso é vazamento de dado de terceiro,
   * não inconveniência.
   *
   * O nome segue em uso, mas só para **confirmar**: no degrau do
   * telefone parcial, ele é o que transforma "provável" em "exata".
   * Confirmar um casamento que o número já fez é seguro; criar um do
   * nada não é.
   */
  return {
    casos: [],
    confianca: "nenhuma",
    porQue: alvo.nome
      ? "Nenhuma reclamação com este telefone. O nome do contato não é usado para localizar — só para confirmar."
      : "Nenhuma reclamação encontrada para este contato.",
    aviso: alvo.nome
      ? `Se souber que "${alvo.nome}" tem caso aberto, busque pelo telefone, documento ou protocolo na tela de reclamações.`
      : undefined,
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

  /**
   * O nome do contato saiu daqui; o da empresa ficou.
   *
   * São coisas diferentes. `alvo.nome` é o que está salvo na agenda do
   * celular de quem atende — um palpite. `item.company` vem das
   * reclamações que **já foram casadas** por telefone ou protocolo:
   * é fato derivado de um casamento confirmado, não um chute novo.
   */
  const nomes = casos
    .map((item) => item.company)
    .filter(Boolean);

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
/**
 * **Todos** os ciclos daquele cliente, não só o mais recente.
 *
 * A aba de NPS precisa da lista: o WhatsApp do NPS é outro número, os
 * casos do Reclame Aqui não aparecem por ele, e uma pessoa que
 * respondeu a pesquisa três vezes tem três ciclos — mostrar só o último
 * esconderia justamente o histórico que diz se ela já reclamou disso
 * antes.
 */
async function buscarNpsTodos(alvo: Alvo) {

  const prisma = getPrisma();

  if (!prisma) return [];

  /**
   * Estreita no banco, decide em JavaScript.
   *
   * Antes eram 500 linhas e **375 KB** por consulta, para achar no
   * máximo alguns ciclos. O filtro aqui é generoso de propósito — os
   * quatro últimos dígitos, o domínio do e-mail, um pedaço do nome —
   * porque quem decide continua sendo `compararTelefone`, que conhece
   * nono dígito e máscara.
   */
  const ou: Prisma.NpsResponseWhereInput[] = [];

  const digitos = alvo.telefone?.digitos ?? "";

  if (digitos.length >= 4) {
    ou.push({ phone: { contains: digitos.slice(-4) } });
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
    for (const parte of alvo.nome
      .trim()
      .split(/s+/)
      .filter((p) => p.length >= 3)) {
      ou.push({
        customer: { contains: parte, mode: "insensitive" },
      });
    }
  }

  if (ou.length === 0) return [];

  const linhas = await prisma.npsResponse.findMany({
    where: { OR: ou },
    select: SELECAO_NPS,
    orderBy: { respondedAt: "desc" },
    take: 60,
  });

  const achados = linhas.filter((linha) => {

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

  /**
   * Em aberto primeiro, e depois por data.
   *
   * Quem abre a aba de NPS está atendendo — o ciclo que precisa de ação
   * tem de estar no topo, mesmo que seja mais antigo que um promotor já
   * encerrado da semana passada.
   */
  return achados
    .map(retratoNps)
    .sort((a, b) => {
      if (a.encerrado !== b.encerrado) {
        return a.encerrado ? 1 : -1;
      }
      return (b.respondidoEm ?? "").localeCompare(
        a.respondidoEm ?? ""
      );
    })
    .slice(0, 8);
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
  /**
   * O ciclo mais recente daquele cliente, quando existe.
   *
   * O tipo sai de , que é a função de verdade — havia
   * um  aqui que ninguém chamava, vivo só para ser
   * apontado por este .
   */
  nps:
    | Awaited<
        ReturnType<typeof buscarNpsTodos>
      >[number]
    | null
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
