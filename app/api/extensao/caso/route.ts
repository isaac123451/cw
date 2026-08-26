import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { getPrisma } from "@/lib/prisma";
import { Case } from "@/lib/models/case";
import { digitosDoDocumento } from "@/lib/models/establishment";

import { persistCase } from "@/lib/services/case.repository";
import {
  RECLAME_AQUI,
  SOCIAL_SOURCES,
} from "@/lib/services/case.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cria uma reclamação a partir do que a extensão leu no portal.
 *
 * **É a única rota da extensão que escreve**, e é o ponto em que a
 * decisão registrada no `EXTENSAO.md` mudou: o painel nasceu só
 * mostrando, e agora também alimenta o Kanban. Vale a mudança porque
 * este é o caminho por onde a reclamação entra na operação hoje — o
 * Reclame Aqui não tem API pública, e a alternativa é redigitar à mão o
 * que já está na tela.
 *
 * Três travas que a mantêm segura:
 *
 * 1. **Exige AGENTE.** Quem tem acesso de leitura vê o painel, mas não
 *    cria caso — mesma régua das server actions.
 * 2. **Nunca sobrescreve.** Protocolo que já existe volta como
 *    `jaExistia`, com o estado atual, sem tocar em nada. Sem isto,
 *    clicar duas vezes jogaria um caso "Em tratativa" de volta para
 *    "Novo" e apagaria o responsável.
 * 3. **Só o que veio da tela.** Nada de nota, avaliação ou resposta
 *    pública: uma reclamação recém-lida não tem nenhum desses, e
 *    inventá-los sujaria o indicador.
 */

interface Entrada {
  /** Número da reclamação no portal ("ID: 256949163"). */
  id?: string;

  /**
   * Código alfanumérico da reclamação ("COD: r72QQCpOtF-sFwCZ").
   *
   * É o que vira o protocolo `RA-<cod>`, porque é o identificador que o
   * **export do portal** também traz — o número não aparece lá. Com o
   * número, a mesma reclamação entraria duas vezes: uma pela extensão e
   * outra pela planilha.
   */
  cod?: string;
  protocolo?: string;
  cliente?: string;
  titulo?: string;
  texto?: string;
  /** AAAA-MM-DD, como o portal mostra. */
  criadoEm?: string;
  cidade?: string;
  estado?: string;
  /**
   * Categoria e subcategoria vêm da **lista cadastrada na ferramenta**,
   * não da página: o portal não classifica a reclamação, e campo aberto
   * aqui produziria "Financeiro", "financeiro" e "Finaceiro" na mesma
   * base. A prévia oferece as opções que `/api/extensao/contexto`
   * devolve em `cadastros`.
   */
  categoria?: string;
  subcategoria?: string;
  prioridade?: Case["priority"];
  url?: string;
  /**
   * Canal de origem. "Reclame Aqui" quando vem do portal; os demais
   * quando o caso nasce numa conversa (WhatsApp, ManyChat, Instagram).
   */
  origem?: string;
  telefone?: string;
  email?: string;
  /**
   * Documento do estabelecimento — **CPF ou CNPJ** —, lido do RA Forms.
   *
   * É o vínculo: o cadastro de estabelecimentos guarda o mesmo número, e
   * gravá-lo no caso faz a ligação se montar sem ninguém escolher na
   * tela. Casar por nome não funcionaria — o export do portal grava o
   * reclamante no lugar da empresa.
   *
   * Os dois tamanhos entram. A Cardápio Web cadastra restaurante por CPF
   * do proprietário com frequência, e recusar onze dígitos jogaria fora
   * quase todo o vínculo que existe.
   */
  documento?: string;
}

/** Canais aceitos. Fora desta lista o caso sumiria dos dois módulos. */
const ORIGENS = [RECLAME_AQUI, ...SOCIAL_SOURCES];

/**
 * Prefixo do protocolo por canal.
 *
 * O Reclame Aqui dá o número; nas conversas não existe um, então o
 * protocolo é gerado. Sem prefixo distinto, um caso de WhatsApp e um do
 * portal poderiam colidir no mesmo identificador.
 */
const SIGLA: Record<string, string> = {
  "Reclame Aqui": "RA",
  WhatsApp: "WA",
  ManyChat: "MC",
  Instagram: "IG",
  Facebook: "FB",
};

const PRIORIDADES: Case["priority"][] = [
  "Crítica",
  "Alta",
  "Média",
  "Baixa",
];

function limpo(valor?: string, teto = 300) {
  return (valor ?? "").replace(/\s+/g, " ").trim().slice(0, teto);
}

export async function POST(request: Request) {

  const { usuario, demonstracao } =
    await autenticar(request);

  if (!usuario && !demonstracao) {
    return semSessao(request);
  }

  if (usuario && usuario.papel === "LEITURA") {
    return responder(
      request,
      {
        erro: "Seu acesso é somente leitura — não dá para criar reclamação.",
      },
      403
    );
  }

  const prisma = getPrisma();

  if (!prisma) {
    return responder(
      request,
      {
        erro: "Sem banco configurado — não há onde gravar.",
      },
      503
    );
  }

  let entrada: Entrada;

  try {
    entrada = (await request.json()) as Entrada;
  } catch {
    return responder(
      request,
      { erro: "Corpo inválido." },
      400
    );
  }

  const origem = ORIGENS.includes(entrada.origem ?? "")
    ? (entrada.origem as string)
    : RECLAME_AQUI;

  const sigla = SIGLA[origem] ?? "CW";

  /**
   * O **COD** é a identidade, e o número é a reserva.
   *
   * O portal dá dois identificadores para a mesma reclamação: um número
   * ("ID: 256949163") e um código alfanumérico
   * ("COD: r72QQCpOtF-sFwCZ"), que é o que aparece no fim da URL
   * pública. **O export do portal traz o código, não o número** — então
   * usar o número aqui faria a reclamação capturada pela extensão e a
   * mesma reclamação vinda da planilha entrarem como dois casos, e
   * ninguém entenderia por quê.
   *
   * O número continua valendo para as páginas onde o COD não aparece.
   */
  const cod = limpo(entrada.cod, 40).replace(
    /[^A-Za-z0-9._-]/g,
    ""
  );

  let idPortal =
    cod ||
    limpo(
      entrada.id ??
        entrada.protocolo?.replace(/^[A-Z]{2}-?/i, ""),
      40
    ).replace(/\D/g, "");

  /**
   * Conversa não tem número de protocolo.
   *
   * Quando o caso nasce no WhatsApp o identificador é gerado a partir do
   * instante, em base 36: curto, ordenável e sem depender de um número
   * de portal que nunca vai existir para esse canal.
   */
  if (!idPortal && origem !== RECLAME_AQUI) {
    idPortal = Date.now().toString(36).toUpperCase();
  }

  if (!idPortal) {
    return responder(
      request,
      {
        erro: "Não achei o identificador da reclamação na página.",
      },
      400
    );
  }

  const cliente = limpo(entrada.cliente, 120);
  const titulo = limpo(entrada.titulo, 220);

  if (!cliente || !titulo) {
    return responder(
      request,
      {
        erro: "Faltou o nome do cliente ou o título do caso.",
      },
      400
    );
  }

  /**
   * Data de publicação. Sem ela vinda da tela, usa o dia real — e não a
   * `hojeNaOperacao()` da operação: uma reclamação que está sendo lida
   * agora é de agora, e datá-la no passado moveria a janela da nota.
   *
   * Vem antes das checagens de duplicata porque uma delas compara a
   * data para decidir se é a mesma reclamação com outro número.
   */
  const criadoEm = /^\d{4}-\d{2}-\d{2}$/.test(
    entrada.criadoEm ?? ""
  )
    ? (entrada.criadoEm as string)
    : new Date().toISOString().slice(0, 10);

  const protocolo = `${sigla}-${idPortal}`;

  /**
   * Já existe? Devolve o estado atual e sai.
   *
   * A checagem vem antes de qualquer gravação de propósito: `persistCase`
   * é um upsert, e um upsert aqui significaria sobrescrever a tratativa
   * em andamento com o retrato cru do portal.
   */
  const existente = await prisma.case.findUnique({
    where: { protocol: protocolo },
    select: {
      id: true,
      externalId: true,
      status: true,
      owner: { select: { name: true } },
    },
  });

  if (existente) {
    return responder(request, {
      jaExistia: true,
      protocolo,
      id: existente.externalId ?? existente.id,
      status: existente.status,
      responsavel: existente.owner?.name,
    });
  }

  /**
   * Segunda trava: mesma reclamação, protocolo diferente.
   *
   * O Reclame Aqui público e o Hugme numeram a **mesma** reclamação de
   * formas diferentes — a página pública mostra "ID: 256873207"
   * enquanto o export do Hugme traz `RA-101491955`. Medido: os ids da
   * base vão de 8 a 9 dígitos, até cerca de 101 milhões; o do portal
   * público passa de 256 milhões. São espaços de numeração distintos.
   *
   * Sem esta checagem, capturar do portal uma reclamação que já veio
   * pela planilha criaria um segundo caso do mesmo problema — e dois
   * cartões no quadro para uma reclamação só é pior do que não ter
   * capturado.
   */
  const mesmoTitulo = await prisma.case.findFirst({
    where: {
      title: { equals: titulo, mode: "insensitive" },
      publishedAt: {
        gte: new Date(
          Date.parse(`${criadoEm}T00:00:00Z`) - 2 * 86400000
        ),
        lte: new Date(
          Date.parse(`${criadoEm}T00:00:00Z`) + 2 * 86400000
        ),
      },
    },
    select: {
      protocol: true,
      externalId: true,
      id: true,
      status: true,
      owner: { select: { name: true } },
    },
  });

  if (mesmoTitulo) {
    return responder(request, {
      jaExistia: true,
      porConteudo: true,
      protocolo: mesmoTitulo.protocol,
      id: mesmoTitulo.externalId ?? mesmoTitulo.id,
      status: mesmoTitulo.status,
      responsavel: mesmoTitulo.owner?.name,
      aviso:
        "Mesmo título e mesma data já existem na base, com outro número. O Reclame Aqui público e o Hugme numeram a mesma reclamação de formas diferentes.",
    });
  }

  const prioridade = PRIORIDADES.includes(
    entrada.prioridade as Case["priority"]
  )
    ? (entrada.prioridade as Case["priority"])
    : "Alta";

  const novo: Case = {
    id: idPortal,
    protocol: protocolo,

    /**
     * O export do Reclame Aqui trata o reclamante como a empresa, por
     * não trazer estabelecimento. Repetir isso aqui mantém o caso novo
     * igual aos 334 já importados — divergir criaria duas formas do
     * mesmo registro na mesma lista.
     */
    company: cliente,
    customer: cliente,

    /**
     * Só com catorze dígitos, e sem inventar o estabelecimento.
     *
     * O `persistCase` procura o cadastro com este CNPJ e grava o
     * vínculo quando encontra; quando não encontra, o CNPJ fica guardado
     * e o vínculo se resolve sozinho no dia em que o estabelecimento for
     * cadastrado — pela varredura do cron.
     *
     * Criar o estabelecimento aqui seria o caminho fácil e o errado: o
     * cadastro tem plano, MRR e responsável, e nada disso está na página
     * de uma reclamação. Nasceriam fichas vazias que ninguém pediu.
     */
    document: digitosDoDocumento(entrada.documento),

    city: limpo(entrada.cidade, 80) || undefined,
    state: limpo(entrada.estado, 4) || undefined,

    source: origem,

    phone: limpo(entrada.telefone, 40) || undefined,
    email: limpo(entrada.email, 160) || undefined,

    category: limpo(entrada.categoria, 60) || "Não classificado",
    subcategory: limpo(entrada.subcategoria, 60) || undefined,

    priority: prioridade,

    // Entra pela primeira coluna do quadro, como qualquer reclamação nova.
    status: "Novo",

    title: titulo,
    description: (entrada.texto ?? "").trim().slice(0, 20000),

    publicResponse: "",

    evaluated: false,
    resolved: false,
    wouldDoBusiness: false,

    responseTime: "-",
    solutionTime: "-",
    sla: "48h",

    raUrl: limpo(entrada.url, 500) || undefined,

    createdAt: criadoEm,
    updatedAt: criadoEm,
    lastInteraction: criadoEm,

    tags: ["Capturada pela extensão"],
  };

  await persistCase(prisma, novo);

  const host = new URL(request.url).origin;

  return responder(
    request,
    {
      criado: true,
      protocolo,
      id: idPortal,
      origem,
      status: novo.status,
      /**
       * O caso abre no módulo do próprio canal: reclamação vai para
       * Reclame Aqui, conversa vai para Redes Sociais. Mandar todo
       * mundo para o mesmo lugar levaria a uma tela que filtra o caso
       * para fora e mostra "não encontrado".
       */
      url:
        origem === RECLAME_AQUI
          ? `${host}/reclame-aqui/${idPortal}`
          : `${host}/redes-sociais`,
    },
    201
  );
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
