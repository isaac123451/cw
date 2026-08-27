import { revalidateTag } from "next/cache";

import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { WORKSPACE_TAG } from "@/lib/actions/tags";
import { getPrisma } from "@/lib/prisma";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Anotar sem sair da conversa.
 *
 * As duas coisas que se escreve no meio de um atendimento e que, sem
 * isto, dependiam de abrir a aplicação numa segunda aba:
 *
 * - **`caso`** — o que aconteceu, preso à reclamação. Vira `CaseComment`,
 *   a mesma linha do tempo que a gaveta do caso mostra.
 * - **`agenda`** — "cobrar isso amanhã". Vira `AgendaTask`, que é o que
 *   a extensão já cobra por notificação.
 *
 * **Anotação não é resposta ao consumidor.** Nada daqui vai para o
 * portal nem para o WhatsApp; é registro interno, e a extensão continua
 * sem mandar mensagem em site nenhum.
 *
 * O autor vem da sessão, nunca do corpo — o corpo é escrito pelo script
 * de conteúdo, que roda dentro da página alheia.
 */

/** Tipos que a agenda conhece. Fora disto a tarefa nasce sem coluna. */
const TIPOS_DE_TAREFA = [
  "Follow-up",
  "Cobrança interna",
  "Solicitação de avaliação",
  "Pendência",
  "Recorrente",
];

const PRIORIDADES = ["Alta", "Média", "Baixa"];

interface Entrada {
  /** "caso", "nps" ou "agenda". */
  tipo?: string;
  /** Para `caso`: o protocolo da reclamação. */
  protocolo?: string;
  /** Para `nps`: o id do ciclo da pesquisa. */
  npsId?: string;
  texto?: string;
  /** Para `agenda`. */
  titulo?: string;
  /** AAAA-MM-DD. Sem isso, hoje. */
  quando?: string;
  /**
   * HH:MM. Opcional.
   *
   * A agenda sempre teve a coluna (`AgendaTask.time`) e a tela sempre
   * soube mostrá-la — quem marcava pela extensão é que não tinha onde
   * digitar, e a tarefa nascia sem hora. "Ligar amanhã" e "ligar amanhã
   * às 9h" são compromissos diferentes.
   */
  hora?: string;
  tipoDeTarefa?: string;
  prioridade?: string;
}

function limpo(valor?: string, teto = 4000) {
  return (valor ?? "").trim().slice(0, teto);
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
        erro: "Seu acesso é somente leitura — não dá para anotar.",
      },
      403
    );
  }

  const prisma = getPrisma();

  if (!prisma) {
    return responder(
      request,
      { erro: "Sem banco configurado — não há onde gravar." },
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

  const texto = limpo(entrada.texto);

  if (entrada.tipo === "agenda") {
    return criarTarefa(request, prisma, entrada, usuario);
  }

  if (entrada.tipo === "nps") {
    return anotarNoNps(request, prisma, entrada, usuario);
  }

  /* ---- anotação de caso ---- */

  const protocolo = limpo(entrada.protocolo, 60);

  if (!protocolo || !texto) {
    return responder(
      request,
      {
        erro: "Faltou o protocolo do caso ou o texto da anotação.",
      },
      400
    );
  }

  const caso = await prisma.case.findUnique({
    where: { protocol: protocolo },
    select: { id: true },
  });

  if (!caso) {
    return responder(
      request,
      { erro: `Não achei o caso ${protocolo}.` },
      404
    );
  }

  const criada = await prisma.caseComment.create({
    data: {
      caseId: caso.id,
      authorId: usuario?.id ?? null,
      body: texto,
    },
    select: { id: true, createdAt: true },
  });

  revalidateTag(WORKSPACE_TAG, "max");

  return responder(
    request,
    {
      criada: true,
      tipo: "caso",
      id: criada.id,
      protocolo,
      quando: criada.createdAt.toISOString(),
    },
    201
  );
}

/**
 * Uma tarefa da agenda.
 *
 * `dueDate` sem data vira a **data de referência da operação**, e não a
 * do relógio: é a mesma regra do resto da aplicação, e usar `new Date()`
 * aqui faria a tarefa cair num dia que nenhuma outra tela reconhece.
 */
async function criarTarefa(
  request: Request,
  prisma: NonNullable<ReturnType<typeof getPrisma>>,
  entrada: Entrada,
  usuario: { id: string } | null
) {

  const titulo = limpo(entrada.titulo, 220);

  if (!titulo) {
    return responder(
      request,
      { erro: "A tarefa precisa de um título." },
      400
    );
  }

  const dia = /^\d{4}-\d{2}-\d{2}$/.test(
    entrada.quando ?? ""
  )
    ? (entrada.quando as string)
    : hojeNaOperacao();

  /**
   * A hora é validada, não confiada.
   *
   * O corpo é escrito pelo script de conteúdo, que roda dentro da
   * página alheia — e `AgendaTask.time` é texto livre no banco. Um
   * valor fora de HH:MM sujaria a agenda de todo mundo sem erro nenhum
   * aparecer.
   */
  const hora = /^([01]\d|2[0-3]):[0-5]\d$/.test(
    entrada.hora ?? ""
  )
    ? (entrada.hora as string)
    : null;

  /**
   * O caso é opcional: "ligar para o cliente amanhã" às vezes não tem
   * reclamação nenhuma atrás. Protocolo que não existe é ignorado em
   * vez de recusar a tarefa — a anotação vale mesmo sem o vínculo.
   */
  const protocolo = limpo(entrada.protocolo, 60);

  const caso = protocolo
    ? await prisma.case.findUnique({
        where: { protocol: protocolo },
        select: { id: true },
      })
    : null;

  const criada = await prisma.agendaTask.create({
    data: {
      title: titulo,
      type: TIPOS_DE_TAREFA.includes(
        entrada.tipoDeTarefa ?? ""
      )
        ? (entrada.tipoDeTarefa as string)
        : "Follow-up",
      priority: PRIORIDADES.includes(
        entrada.prioridade ?? ""
      )
        ? (entrada.prioridade as string)
        : "Média",
      /**
       * A data guarda o dia **e** a hora.
       *
       * A agenda ordena por `dueDate`, então uma tarefa das 9h que
       * ficasse com 00:00 apareceria junto das sem hora, na ordem de
       * criação. `time` guarda o rótulo, que é o que a tela mostra.
       */
      dueDate: new Date(
        `${dia}T${hora ?? "00:00"}:00Z`
      ),
      time: hora,
      ownerId: usuario?.id ?? null,
      caseId: caso?.id ?? null,
    },
    select: { id: true },
  });

  revalidateTag(WORKSPACE_TAG, "max");

  const host = new URL(request.url).origin;

  return responder(
    request,
    {
      criada: true,
      tipo: "agenda",
      id: criada.id,
      quando: dia,
      hora,
      vinculadaAoCaso: Boolean(caso),
      url: `${host}/agenda`,
    },
    201
  );
}

/**
 * Uma anotação num ciclo de NPS.
 *
 * O Isaac pediu paridade: "preciso que seja possível adicionar notas
 * assim nos casos de nps, também seja possível via extensão".
 *
 * **Anotação, e não tentativa de contato.** A extensão já sabia
 * registrar tentativa no NPS, e ela tem canal e significa "liguei" — é
 * a contagem dela que decide se o ciclo encerra por "sem retorno".
 * Escrever uma observação ali inflaria esse número, e ele passaria a
 * mentir sobre quantas vezes se tentou falar com a pessoa.
 */
async function anotarNoNps(
  request: Request,
  prisma: NonNullable<ReturnType<typeof getPrisma>>,
  entrada: Entrada,
  usuario: { id: string; nome?: string } | null
) {

  const id = limpo(entrada.npsId, 60);
  const texto = limpo(entrada.texto);

  if (!id || !texto) {
    return responder(
      request,
      {
        erro: "Faltou o ciclo do NPS ou o texto da anotação.",
      },
      400
    );
  }

  const ciclo = await prisma.npsResponse.findUnique({
    where: { id },
    select: { id: true, customer: true },
  });

  if (!ciclo) {
    return responder(
      request,
      { erro: "Esse ciclo de NPS não existe mais." },
      404
    );
  }

  const criada = await prisma.npsNote.create({
    data: {
      responseId: ciclo.id,
      body: texto,
      authorId: usuario?.id ?? null,
      actor: usuario?.nome ?? "",
    },
    select: { id: true, createdAt: true },
  });

  revalidateTag(WORKSPACE_TAG, "max");

  return responder(
    request,
    {
      criada: true,
      tipo: "nps",
      id: criada.id,
      cliente: ciclo.customer,
      quando: criada.createdAt.toISOString(),
    },
    201
  );
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
