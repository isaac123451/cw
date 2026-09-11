/**
 * A volta do vigia, com o service worker de verdade.
 *
 *   npm run check:vigia-volta                                (npm run dev no ar)
 *   CW_BASE=http://localhost:3200 npm run check:vigia-volta
 *
 * `check:vigia` prova o leitor e as travas do servidor, peça por peça.
 * Esta prova a **volta inteira**: o arquivo `fundo/service-worker.js`,
 * sem mudar uma linha, conversando com a aplicação no ar e com o banco
 * de verdade — a mesma pergunta ao servidor, a mesma leitura da lista,
 * a mesma fila, a mesma notificação.
 *
 * Duas coisas são de roteiro, e só elas:
 *
 * - **o Chrome** (`chrome.storage`, `chrome.cookies`…), que não existe
 *   no Node;
 * - **o portal**, que o Node não alcança — o Cloudflare barra quem não
 *   é navegador. As páginas servidas são as amostras de
 *   `scripts/amostras`, com a estrutura exata das reais e códigos
 *   descartáveis; é o que deixa a volta criar reclamações e apagá-las no
 *   fim sem tocar nas de verdade.
 *
 * O roteiro do portal também faz o que o de verdade faz de vez em quando:
 * pede a verificação de navegador, e muda de formato.
 */
import "dotenv/config";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

const BASE = (process.env.CW_BASE ?? "http://localhost:3000").replace(/\/$/, "");
const PORTAL = "https://www.reclameaqui.com.br";

const amostra = (nome: string) =>
  readFileSync(resolve(__dirname, "amostras", nome), "utf8");

const LISTA = amostra("ra-portal-lista.html");
const LISTA_VAZIA = LISTA.replace(/"LAST":\[[\s\S]*?\],"tab"/, '"LAST":[],"tab"');
const RECLAMACAO = amostra("ra-portal-reclamacao.html");
const DESAFIO = amostra("ra-portal-desafio.html");

/** Os cinco códigos da amostra da lista — todos descartáveis. */
const DA_AMOSTRA = [
  "ZzNovaAmostra001",
  "Zz-Nova_Amostra2",
  "ZzNovaAmostra003",
  "ZzRespondida0004",
  "ZzAvaliada000005",
];

/* A reclamação que o vigia traria sem o consumidor, para completar. */
const INCOMPLETA = "ZzCompletarVolta";

const PROTOCOLOS = [...DA_AMOSTRA, INCOMPLETA].map((c) => `RA-${c}`);

let falhas = 0;

function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(
    `${ok ? "  ok  " : "FALHA "} ${titulo.padEnd(62)} ${JSON.stringify(obtido)?.slice(0, 50)}`
  );
  if (!ok) {
    console.log(`${" ".repeat(7)}${"esperado".padEnd(62)} ${JSON.stringify(esperado)?.slice(0, 50)}`);
  }
}

/* ============================================================
   O PORTAL DE ROTEIRO
============================================================ */

let humorDoPortal: "normal" | "desafio" | "formato" = "normal";

const pedidosAoPortal: string[] = [];

function paginaDoPortal(url: string): Response {

  pedidosAoPortal.push(url);

  if (humorDoPortal === "desafio") {
    return new Response(DESAFIO, { status: 403 });
  }

  if (humorDoPortal === "formato") {
    return new Response("<html><body>layout novo, sem dados</body></html>", { status: 200 });
  }

  const endereco = new URL(url);

  if (endereco.pathname.startsWith("/empresa/")) {
    const pagina = Number(endereco.searchParams.get("pagina") ?? "1");
    return new Response(pagina === 1 ? LISTA : LISTA_VAZIA, { status: 200 });
  }

  const codigo = endereco.pathname.replace(/\/$/, "").slice(-16);

  /* A reclamação da amostra, com o código e o título de quem foi pedido. */
  if (DA_AMOSTRA.includes(codigo)) {
    return new Response(
      RECLAMACAO.replaceAll("Zz_Amostra-Rica1", codigo).replaceAll(
        "Cobrança após cancelamento &amp; sem retorno",
        `Reclamação descartável ${codigo}`
      ),
      { status: 200 }
    );
  }

  /* As pendentes de verdade não existem neste portal: 404, como uma que saiu do ar. */
  return new Response("<html><title>Página não encontrada</title></html>", { status: 404 });
}

/* ============================================================
   O CHROME DE ROTEIRO
============================================================ */

function area() {
  const guardado = new Map<string, unknown>();

  return {
    guardado,
    async get(chaves?: string | string[] | null) {
      if (chaves == null) return Object.fromEntries(guardado);
      const lista = Array.isArray(chaves) ? chaves : [chaves];
      return Object.fromEntries(
        lista.filter((k) => guardado.has(k)).map((k) => [k, structuredClone(guardado.get(k))])
      );
    },
    async set(itens: Record<string, unknown>) {
      for (const [k, v] of Object.entries(itens)) guardado.set(k, structuredClone(v));
    },
    async remove(chaves: string | string[]) {
      for (const k of Array.isArray(chaves) ? chaves : [chaves]) guardado.delete(k);
    },
  };
}

const local = area();
const sync = area();

let sessao = "";

type Ouvinte = (mensagem: unknown, remetente: unknown, responder: (r: unknown) => void) => void;

let ouvinteDeMensagem: Ouvinte | null = null;
let ouvinteDeInstalacao: (() => void) | null = null;

const alarmesApagados: string[] = [];
const alarmesCriados: string[] = [];
const scriptsRegistrados: { id: string; matches: string[]; js: string[] }[] = [];

const notificacoes: { id: string; title: string; message: string }[] = [];

(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: { local, sync, session: area(), onChanged: { addListener() {} } },
  cookies: { get: async () => (sessao ? { value: sessao } : null) },
  permissions: { contains: async () => true, onAdded: { addListener() {} } },
  notifications: {
    create: (id: string, opcoes: { title: string; message: string }) => {
      notificacoes.push({ id, ...opcoes });
    },
    onClicked: { addListener() {} },
  },
  alarms: {
    create: (nome: string) => alarmesCriados.push(nome),
    clear: async (nome: string) => {
      alarmesApagados.push(nome);
      return true;
    },
    onAlarm: { addListener() {} },
  },
  scripting: {
    unregisterContentScripts: async () => {
      scriptsRegistrados.length = 0;
    },
    registerContentScripts: async (lista: { id: string; matches: string[]; js: string[] }[]) => {
      scriptsRegistrados.push(...lista);
    },
    executeScript: async () => [],
  },
  runtime: {
    onMessage: { addListener: (f: Ouvinte) => (ouvinteDeMensagem = f) },
    onInstalled: { addListener: (f: () => void) => (ouvinteDeInstalacao = f) },
    onStartup: { addListener() {} },
    getURL: (caminho: string) => `chrome-extension://roteiro/${caminho}`,
    openOptionsPage() {},
  },
  action: {
    setBadgeText: async () => {},
    setBadgeBackgroundColor: async () => {},
    setTitle: async () => {},
  },
  tabs: { create() {}, query: async () => [] },
};

const fetchDeVerdade = globalThis.fetch;

globalThis.fetch = (async (entrada: RequestInfo | URL, opcoes?: RequestInit) => {
  const url = String(entrada instanceof Request ? entrada.url : entrada);
  if (url.startsWith(PORTAL)) return paginaDoPortal(url);
  return fetchDeVerdade(entrada, opcoes);
}) as typeof fetch;

type Estado = {
  em?: number;
  ok?: boolean;
  codigo?: string;
  erro?: string;
  criadas?: { protocolo: string; titulo: string }[];
  completadas?: number;
  ligado?: boolean;
  reaproveitada?: boolean;
  /* as respostas de completar */
  existe?: boolean;
  faltam?: string[];
  podeGravar?: boolean;
  completou?: string[];
};

function enviar(mensagem: unknown) {
  return new Promise<{ ok: boolean; dados?: Estado; erro?: string }>((responder) =>
    ouvinteDeMensagem!(mensagem, {}, responder as (r: unknown) => void)
  );
}

async function assinar(prisma: PrismaClient, papel: "ADMIN" | "LEITURA") {
  const usuario = await prisma.user.findFirst({
    where: { active: true, role: papel },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!usuario) return "";

  return new SignJWT({ ...usuario })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("900s")
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET ?? ""));
}

async function limpar(prisma: PrismaClient) {
  await prisma.caseTag.deleteMany({ where: { case: { protocol: { in: PROTOCOLOS } } } });
  await prisma.case.deleteMany({ where: { protocol: { in: PROTOCOLOS } } });
}

async function main() {

  console.log("\n  A VOLTA DO VIGIA — o service worker inteiro, contra a aplicação no ar\n");

  try {
    await fetchDeVerdade(`${BASE}/api/extensao/sessao`, { signal: AbortSignal.timeout(10_000) });
  } catch {
    console.log(`  Nada respondeu em ${BASE}. Suba com "npm run dev", ou use CW_BASE.\n`);
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL! }),
  });

  try {
    await limpar(prisma);

    sessao = await assinar(prisma, "ADMIN");

    await sync.set({ "cw-reputacao-config": { base: BASE, vigia: true } });

    await import(pathToFileURL(resolve(__dirname, "../extensao/fundo/service-worker.js")).href);

    /* As reclamações de verdade que o servidor vai pedir, e como estão agora. */
    const reaisAntes = await prisma.case.findMany({
      where: {
        protocol: { startsWith: "RA-" },
        publicResponseAt: { not: null },
        OR: [{ publicResponse: null }, { publicResponse: "" }],
      },
      select: { protocol: true, updatedAt: true },
    });

    /* --- instalar: a ponte com a plataforma e o fim do relógio --- */

    ouvinteDeInstalacao?.();
    await new Promise((r) => setTimeout(r, 300));

    conferir(
      "instalar registra a ponte no endereço da plataforma",
      scriptsRegistrados.map((s) => [s.id, s.matches, s.js]),
      [["cw-ponte", [`${BASE}/*`], ["conteudo/ponte.js"]]]
    );
    conferir("e apaga o alarme de 15 minutos da 0.46.0", alarmesApagados, ["cw-vigia-ra"]);
    conferir("sem criar outro relógio para o portal", alarmesCriados.includes("cw-vigia-ra"), false);

    const antes = await enviar({ tipo: "vigiaEstado" });

    conferir("antes da primeira volta: ligado, sem data", [antes.dados?.ligado, antes.dados?.em], [true, undefined]);

    /* --- a primeira volta --- */

    const primeira = await enviar({ tipo: "vigiaAgora", motivo: "manual" });

    conferir("a volta termina bem", [primeira.ok, primeira.dados?.ok, primeira.dados?.erro], [true, true, undefined]);
    const daLista = DA_AMOSTRA.map((c) => `RA-${c}`);

    /* Instalar também dispara o aviso diário da nota; aqui contam só as do vigia. */
    const doVigia = () => notificacoes.filter((n) => n.id.startsWith("cw-vigia-"));

    conferir(
      "as cinco da lista entram no quadro",
      (primeira.dados?.criadas ?? []).map((c) => c.protocolo).sort(),
      [...daLista].sort()
    );
    conferir("e estão no banco", await prisma.case.count({ where: { protocol: { in: daLista } } }), 5);
    conferir("uma notificação só, não uma por reclamação", doVigia().length, 1);
    conferir("dizendo quantas", doVigia()[0]?.title, "5 reclamações novas no Reclame Aqui");

    const tentadas = ((await local.get("vigiaTentadas")).vigiaTentadas ?? {}) as Record<string, number>;
    const pendentesReais = Object.keys(tentadas).length;

    conferir("as pendentes de verdade foram tentadas (e o portal disse 404)", pendentesReais > 0, true);

    const reaisDepois = await prisma.case.findMany({
      where: { protocol: { in: reaisAntes.map((c) => c.protocol) } },
      select: { protocol: true, updatedAt: true },
    });

    const mexidas = reaisDepois.filter(
      (depois) =>
        reaisAntes.find((a) => a.protocol === depois.protocol)?.updatedAt.getTime() !==
        depois.updatedAt.getTime()
    );

    conferir(
      `as ${reaisAntes.length} reais sem texto não foram tocadas (o portal disse 404)`,
      mexidas.map((c) => c.protocol),
      []
    );

    /* --- a segunda volta: nada novo, nada repetido --- */

    pedidosAoPortal.length = 0;

    const segunda = await enviar({ tipo: "vigiaAgora", motivo: "manual" });

    conferir("a segunda volta não cria nada", segunda.dados?.criadas?.length, 0);
    conferir("nem notifica de novo", doVigia().length, 1);
    conferir(
      "a pendente que falhou espera um dia, não volta a cada 15 min",
      pedidosAoPortal.filter((u) => !u.includes("/empresa/")).length,
      0
    );
    conferir(
      "e para na primeira página, porque achou conhecida",
      pedidosAoPortal.filter((u) => u.includes("/empresa/")).length,
      1
    );

    /* --- abrir a plataforma de novo não relê à toa --- */

    const emAntes = segunda.dados?.em;
    const plataforma = await enviar({ tipo: "vigiaAgora", motivo: "plataforma" });

    conferir(
      "abrir a plataforma logo depois reaproveita a última leitura",
      [plataforma.dados?.em, plataforma.dados?.reaproveitada],
      [emAntes, true]
    );

    /* --- a verificação de navegador --- */

    humorDoPortal = "desafio";

    const barrada = await enviar({ tipo: "vigiaAgora", motivo: "manual" });

    conferir("o portal pede verificação: a volta para", [barrada.dados?.ok, barrada.dados?.codigo], [false, "portal-desafio"]);
    conferir("e diz o que fazer", /Abra o portal numa aba/.test(barrada.dados?.erro ?? ""), true);

    humorDoPortal = "normal";

    const destravada = await enviar({ tipo: "vigiaAgora", motivo: "plataforma" });

    conferir("depois da verificação, abrir a plataforma lê de novo", destravada.dados?.ok, true);

    /* --- o portal mudou de formato --- */

    humorDoPortal = "formato";

    const contagem = await prisma.case.count();
    const formato = await enviar({ tipo: "vigiaAgora", motivo: "manual" });

    conferir("página que não é a lista: para e avisa", formato.dados?.codigo, "portal-formato");
    conferir("sem gravar nada", await prisma.case.count(), contagem);

    humorDoPortal = "normal";

    /* --- desligado nas opções --- */

    await sync.set({ "cw-reputacao-config": { base: BASE, vigia: false } });

    /* A última volta falhou por formato: sem a chave, abrir a plataforma leria. */
    const emDesligado = ((await local.get("vigia")).vigia as Estado).em;

    await enviar({ tipo: "vigiaAgora", motivo: "plataforma" });

    conferir(
      "desligado: abrir a plataforma não lê",
      ((await local.get("vigia")).vigia as Estado).em,
      emDesligado
    );

    const estadoDesligado = await enviar({ tipo: "vigiaEstado" });

    conferir("e o popup sabe que está desligado", estadoDesligado.dados?.ligado, false);

    const peloBotao = await enviar({ tipo: "vigiaAgora", motivo: "manual" });

    conferir("mas o botão lê mesmo desligado", peloBotao.dados?.ok, true);

    await sync.set({ "cw-reputacao-config": { base: BASE, vigia: true } });

    /* --- completar pela área da empresa --- */

    await prisma.case.create({
      data: {
        protocol: `RA-${INCOMPLETA}`,
        externalId: INCOMPLETA,
        companyName: "Não informado",
        customer: "Não informado",
        title: "Reclamação descartável sem o consumidor",
        status: "Novo",
        publishedAt: new Date("2026-09-11T00:00:00Z"),
      },
    });

    const pergunta = await enviar({ tipo: "completarPergunta", cod: INCOMPLETA });

    conferir(
      "a página pergunta o que falta no quadro",
      [pergunta.dados?.existe, pergunta.dados?.faltam, pergunta.dados?.podeGravar],
      [true, ["nome", "contato", "documento"], true]
    );

    /* Um documento de estabelecimento de verdade, para provar o vínculo. */
    const estabelecimento = await prisma.establishment.findFirst({
      where: { document: { not: null } },
      select: { id: true, document: true },
    });

    const documento = estabelecimento?.document?.replace(/\D/g, "") || "12345678909";

    const completou = await enviar({
      tipo: "completarNoQuadro",
      dados: {
        cod: INCOMPLETA,
        cliente: "Maria Lopes",
        telefone: "11 98765-4321",
        email: "",
        documento,
      },
    });

    conferir(
      "o clique completa o que estava vazio",
      completou.dados?.completou?.filter((c) => c !== "estabelecimento"),
      ["nome", "telefone", "documento"]
    );
    conferir("e o que falta passa a ser nada", completou.dados?.faltam, []);

    const gravada = await prisma.case.findUniqueOrThrow({
      where: { protocol: `RA-${INCOMPLETA}` },
      select: { customer: true, phone: true, document: true, establishmentId: true },
    });

    conferir(
      "no banco: nome, telefone e documento",
      [gravada.customer, gravada.phone, gravada.document],
      ["Maria Lopes", "11 98765-4321", documento]
    );

    if (estabelecimento) {
      conferir("o documento liga ao estabelecimento", gravada.establishmentId, estabelecimento.id);
    }

    const deNovo = await enviar({
      tipo: "completarNoQuadro",
      dados: { cod: INCOMPLETA, cliente: "Outra Pessoa", telefone: "21 90000-0000" },
    });

    conferir("clicar de novo não sobrescreve nada", deNovo.dados?.completou, []);

    /* --- quem só lê --- */

    const leitura = await assinar(prisma, "LEITURA");

    if (leitura) {
      sessao = leitura;

      const soLe = await enviar({ tipo: "vigiaAgora", motivo: "manual" });

      conferir("acesso de leitura: o vigia não grava", soLe.dados?.codigo, "leitura");

      const soLeCompleta = await enviar({
        tipo: "completarNoQuadro",
        dados: { cod: INCOMPLETA, cliente: "Alguém" },
      });

      conferir("nem completa", soLeCompleta.ok, false);
    } else {
      console.log("  --   sem usuário LEITURA ativo para provar a recusa");
    }
  } finally {
    await limpar(prisma);
    await prisma.$disconnect();
  }

  console.log(
    falhas === 0
      ? "\n  A volta do vigia lê, grava uma vez, avisa uma vez, e para quando o portal pede.\n"
      : `\n  ${falhas} ponto(s) em que a volta do vigia erraria.\n`
  );

  process.exitCode = falhas === 0 ? 0 : 1;
}

main().catch((erro) => {
  console.error("\n  Erro:", erro);
  process.exitCode = 1;
});
