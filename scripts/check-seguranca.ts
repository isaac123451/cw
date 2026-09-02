/**
 * Varre a plataforma atrás de porta destrancada.
 *
 *   npm run check:seguranca
 *
 * Três perguntas, e todas já tiveram resposta errada neste projeto:
 *
 * 1. **Toda rota de `/api` confere quem está chamando?** O middleware
 *    deixa `/api` passar de propósito — a API pública tem token próprio
 *    e a extensão manda sessão no cabeçalho. Isso significa que uma
 *    rota nova nasce **aberta para a internet** se ninguém puser a
 *    checagem. Foi o que aconteceu com `/api/assistente`, que gastava
 *    a cota de IA da empresa sem login.
 * 2. **Toda server action confere o papel de quem chama?** Esconder o
 *    botão não impede ninguém de chamar a action direto — o navegador
 *    expõe o endpoint dela.
 * 3. **O que é segredo fica no servidor?** Variável com prefixo
 *    `NEXT_PUBLIC_` vai inteira para o navegador de quem abrir a
 *    página; uma chave de IA ali é uma chave publicada.
 *
 * A varredura é estática. Ela não prova que a checagem está *certa* —
 * prova que ela **existe**, que é o degrau que faltava. O comportamento
 * de cada uma é conferido em `check:extensao` e `check:cron`.
 */
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import {
  dirname,
  join,
  relative,
  resolve,
} from "node:path";

const RAIZ = resolve(__dirname, "..");

/**
 * Lê o arquivo e descarta o BOM.
 *
 * **O silêncio que isto conserta.** Quatro arquivos de `lib/actions`
 * começavam com BOM — os três bytes invisíveis que alguns editores do
 * Windows põem no início. Com eles, o teste da diretiva `use server`
 * falhava: a linha não começa pela aspa, começa pelo BOM.
 *
 * A consequência não era um erro. Era o `continue` da auditoria de
 * actions: os arquivos eram **pulados**, e `cases.ts`, `registry.ts`,
 * `transfer.ts` e `workspace.ts` nunca apareceram no relatório. O
 * verificador ficava verde porque não estava olhando.
 *
 * Os BOMs foram removidos daqueles arquivos, mas a leitura passa a
 * tolerá-los de qualquer jeito: o próximo editor que puser um de volta
 * não pode desligar a auditoria de novo.
 */
function ler(caminho: string) {
  return readFileSync(caminho, "utf8").replace(
    /^﻿/,
    ""
  );
}

let falhas = 0;

function reportar(
  ok: boolean,
  titulo: string,
  detalhe = ""
) {

  if (!ok) falhas += 1;

  console.log(
    `${ok ? "  ok  " : "FALHA "} ${titulo}${detalhe ? `  ${detalhe}` : ""}`
  );
}

/** Todos os arquivos abaixo de um diretório, recursivamente. */
function arquivos(dir: string, filtro: RegExp): string[] {

  const saida: string[] = [];

  for (const nome of readdirSync(dir)) {

    const caminho = join(dir, nome);

    if (statSync(caminho).isDirectory()) {
      saida.push(...arquivos(caminho, filtro));
      continue;
    }

    if (filtro.test(nome)) saida.push(caminho);
  }

  return saida;
}

/* ============================================================
   1. AS ROTAS DE API
============================================================ */

/**
 * Os quatro guardas que existem, e o que cada um protege.
 *
 * `checkToken` — API pública, consumida pelo CW Engine.
 * `checkCronToken` — rotina agendada.
 * `autenticar`/`semSessao` — extensão, que manda a sessão no cabeçalho.
 * `getSession` — telas, que mandam cookie.
 */
const GUARDAS =
  /checkToken|checkApiToken|checkCronToken|autenticar\s*\(|semSessao|getSession\s*\(|requireRole|tryRole|exigirSessao/;

/**
 * Rotas que **não** têm dono conhecido no momento da chamada.
 *
 * O callback do OAuth é o único caso legítimo: o Google chama a URL
 * sem cookie nenhum, e a autorização vem do `state` assinado que saiu
 * daqui — verificado com `jwtVerify`, com expiração. Sem essa
 * verificação, um link montado por terceiro conectaria a conta Google
 * do atacante à sessão da vítima.
 */
const SEM_DONO: Record<string, RegExp> = {
  "google/callback/route.ts": /readState\s*\(/,
};

console.log("\n  SEGURANÇA\n");
console.log("  Rotas de API — o middleware deixa /api passar\n");

const rotas = arquivos(
  resolve(RAIZ, "app/api"),
  /^route\.ts$/
);

for (const caminho of rotas) {

  const nome = relative(
    resolve(RAIZ, "app/api"),
    caminho
  ).replace(/\\/g, "/");

  const fonte = ler(caminho);

  const especial = SEM_DONO[nome];

  if (especial) {
    reportar(
      especial.test(fonte),
      `${nome.padEnd(40)} autorização própria`,
      especial.test(fonte) ? "" : "sem a verificação declarada"
    );
    continue;
  }

  reportar(
    GUARDAS.test(fonte),
    nome.padEnd(40),
    GUARDAS.test(fonte) ? "" : "ABERTA — qualquer um na internet chama"
  );
}

/* ============================================================
   2. AS SERVER ACTIONS
============================================================ */

console.log(
  "\n  Server actions — esconder o botão não fecha a porta\n"
);

/**
 * O que conta como guarda, chamado direto ou por um auxiliar.
 *
 * Metade dos arquivos de action centraliza a checagem numa função local
 * — `contexto()`, `autorizado()`, `can()` — e chama ela em cada
 * action. Uma varredura que só olhasse o corpo da função exportada
 * apontaria essas dezenas como buraco, e um relatório com dezenas de
 * falsos alarmes esconde o buraco de verdade no meio. Foi o que a
 * primeira versão deste script fez.
 */
const GUARDA_DIRETO =
  /requireRole\s*\(|tryRole\s*\(|getSession\s*\(|can\s*\(/;

/**
 * Auxiliares locais que garantem a checagem — **em cadeia**.
 *
 * Uma passada só não bastava: em `google.ts` a corrente tem dois elos —
 * `pushTaskToGoogle` chama `comToken`, que chama `contexto`, que chama
 * `requireRole`. Parar no primeiro elo apontava as três actions do
 * Google como desprotegidas, e um alarme falso repetido é como um
 * alarme desligado.
 *
 * Repete até o conjunto parar de crescer, que é o ponto em que todos os
 * elos alcançáveis já foram seguidos.
 */
function auxiliaresQueGuardam(fonte: string) {

  const funcoes: { nome: string; corpo: string }[] = [];

  for (const m of fonte.matchAll(
    /(?:async\s+)?function\s+([a-zA-Z][a-zA-Z0-9_]*)\s*(?:<[^>]*>)?\s*\(/g
  )) {

    const inicio = m.index ?? 0;

    const proxima = fonte.indexOf("\n}\n", inicio);

    funcoes.push({
      nome: m[1],
      corpo: fonte.slice(
        inicio,
        proxima === -1 ? fonte.length : proxima
      ),
    });
  }

  const guardam = new Set(
    funcoes
      .filter((f) => GUARDA_DIRETO.test(f.corpo))
      .map((f) => f.nome)
  );

  let mudou = true;

  while (mudou) {

    mudou = false;

    for (const f of funcoes) {

      if (guardam.has(f.nome)) continue;

      const chama = [...guardam].some((g) =>
        new RegExp(`\\b${g}\\s*\\(`).test(f.corpo)
      );

      if (chama) {
        guardam.add(f.nome);
        mudou = true;
      }
    }
  }

  return [...guardam];
}

const acoes = arquivos(
  resolve(RAIZ, "lib/actions"),
  /\.ts$/
);

for (const caminho of acoes) {

  const nome = relative(
    resolve(RAIZ, "lib/actions"),
    caminho
  );

  const fonte = ler(caminho);

  // Arquivo sem "use server" não expõe endpoint nenhum.
  if (!/^["']use server["']/m.test(fonte)) continue;

  const exportadas = [
    ...fonte.matchAll(
      /export\s+async\s+function\s+([a-zA-Z][a-zA-Z0-9_]*)/g
    ),
  ].map((m) => m[1]);

  const auxiliares = auxiliaresQueGuardam(fonte);

  const chamaAuxiliar = auxiliares.length
    ? new RegExp(
        `(?:await\\s+)?(?:${auxiliares.join("|")})\\s*\\(`
      )
    : null;

  const semGuarda = exportadas.filter((funcao) => {

    const i = fonte.indexOf(
      `export async function ${funcao}`
    );

    const proxima = fonte.indexOf(
      "\nexport async function ",
      i + 10
    );

    const corpo = fonte.slice(
      i,
      proxima === -1 ? fonte.length : proxima
    );

    return (
      !GUARDA_DIRETO.test(corpo) &&
      !(chamaAuxiliar?.test(corpo) ?? false)
    );
  });

  reportar(
    semGuarda.length === 0,
    `${nome.padEnd(24)} ${exportadas.length} action(s)`,
    semGuarda.length === 0
      ? ""
      : `sem checagem: ${semGuarda.join(", ")}`
  );
}

/* ============================================================
   3. O QUE VAZA PARA O NAVEGADOR
============================================================ */

console.log("\n  Segredos\n");

/**
 * `NEXT_PUBLIC_` vai inteiro para o navegador.
 *
 * Só uma variável tem esse prefixo aqui, e ela é uma URL. Qualquer
 * outra que apareça precisa de justificativa — chave de IA, senha de
 * banco ou token de API com esse prefixo é segredo publicado.
 */
const publicas = new Set<string>();

for (const caminho of [
  ...arquivos(resolve(RAIZ, "app"), /\.tsx?$/),
  ...arquivos(resolve(RAIZ, "lib"), /\.tsx?$/),
  ...arquivos(resolve(RAIZ, "components"), /\.tsx?$/),
]) {
  for (const m of ler(caminho).matchAll(
    /process\.env\.(NEXT_PUBLIC_[A-Z0-9_]+)/g
  )) {
    publicas.add(m[1]);
  }
}

const suspeitas = [...publicas].filter((v) =>
  /KEY|SECRET|TOKEN|PASSWORD|SENHA|DATABASE/.test(v)
);

reportar(
  suspeitas.length === 0,
  `variáveis NEXT_PUBLIC_: ${[...publicas].join(", ") || "nenhuma"}`,
  suspeitas.length === 0
    ? ""
    : `PUBLICADAS: ${suspeitas.join(", ")}`
);

/**
 * Chave de IA lida num componente de cliente seria chave publicada.
 *
 * `ia.service.ts` é lido no servidor e diz isso no próprio cabeçalho;
 * o que não pode é um arquivo com `"use client"` tocar nessas variáveis.
 */
const clientesComChave = [
  ...arquivos(resolve(RAIZ, "app"), /\.tsx?$/),
  ...arquivos(resolve(RAIZ, "components"), /\.tsx?$/),
  ...arquivos(resolve(RAIZ, "lib"), /\.tsx?$/),
]
  .filter((caminho) => {
    const fonte = ler(caminho);
    return (
      /^["']use client["']/m.test(fonte) &&
      /process\.env\.(?!NEXT_PUBLIC_)[A-Z0-9_]*(KEY|SECRET|TOKEN|URL|PASSWORD)/.test(
        fonte
      )
    );
  })
  .map((c) => relative(RAIZ, c));

reportar(
  clientesComChave.length === 0,
  "nenhum componente de cliente lê segredo",
  clientesComChave.length === 0
    ? ""
    : clientesComChave.join(", ")
);

/**
 * Nenhum componente de cliente pode alcançar o Prisma.
 *
 * **O acidente que motivou isto.** `assistant.service` passou a importar
 * `assistant.agent` para o assistente responder sem modelo. O agente
 * importava `ia.service` → `iaConfig.service` → `lib/prisma` → `pg`, e
 * como a tela do assistente é um componente de cliente, o `pg` foi parar
 * no pacote do navegador. Ele pede `dns`, `net`, `tls` e `fs`, que lá
 * não existem: **21 telas passaram a responder 500**.
 *
 * O que torna isso perigoso é como ele se esconde. `tsc` passa, o lint
 * passa, o arquivo importado parece inocente, e o import fatal está a
 * quatro saltos de distância. Só abrir a página revela — e só se alguém
 * abrir a página certa.
 *
 * Então a cadeia é percorrida a partir de cada arquivo com
 * `"use client"`, seguindo os imports relativos e os `@/`, até achar
 * `lib/prisma` ou um pacote de banco. O caminho inteiro é impresso na
 * falha, porque saber *qual* import puxou é metade do conserto.
 */
const PROIBIDOS =
  /(^|\/)lib\/prisma|@prisma\/(client|adapter-pg)|(^|['"])pg(['"]|\/)/;

/**
 * Os imports que **viram código** no pacote.
 *
 * `import type` é apagado na compilação e não arrasta nada; contá-lo
 * encheria o relatório de caminhos que não existem em tempo de
 * execução.
 */
function importesDe(fonte: string) {
  return [
    ...fonte.matchAll(
      /(?:^|\n)\s*import\s+(?!type\s)[^;]*?from\s+["']([^"']+)["']/g
    ),
  ].map((m) => m[1]);
}

function resolverImport(
  deArquivo: string,
  especificador: string
) {

  let base: string;

  if (especificador.startsWith("@/")) {
    base = resolve(RAIZ, especificador.slice(2));
  } else if (especificador.startsWith(".")) {
    base = resolve(dirname(deArquivo), especificador);
  } else {
    return null;
  }

  for (const sufixo of [
    ".ts",
    ".tsx",
    "/index.ts",
    "/index.tsx",
  ]) {
    if (existsSync(base + sufixo)) return base + sufixo;
  }

  return existsSync(base) ? base : null;
}

/** O caminho de imports até o Prisma, ou `null` se não houver. */
function caminhoAtePrisma(
  entrada: string,
  vistos = new Set<string>(),
  primeiro = entrada
): string[] | null {

  if (vistos.has(entrada)) return null;
  vistos.add(entrada);

  let fonte: string;

  try {
    fonte = ler(entrada);
  } catch {
    return null;
  }

  /**
   * `"use server"` é uma fronteira, e a travessia para aqui.
   *
   * Importar um módulo de server action de um componente de cliente não
   * traz o código dele para o navegador: o Next troca a importação por
   * uma chamada de rede. É por isso que `UserMenu` pode importar
   * `lib/auth/actions`, que fala com o Prisma, sem quebrar nada.
   *
   * Sem esta parada, a varredura acusava justamente esse caminho — um
   * alarme falso na primeira execução, no verificador que deveria ser
   * confiável. Alarme falso ensina a ignorar o próximo.
   */
  if (
    entrada !== primeiro &&
    /^["']use server["']/m.test(fonte)
  ) {
    return null;
  }

  for (const especificador of importesDe(fonte)) {

    if (PROIBIDOS.test(especificador)) {
      return [relative(RAIZ, entrada), especificador];
    }

    const alvo = resolverImport(entrada, especificador);

    if (!alvo) continue;

    const adiante = caminhoAtePrisma(
      alvo,
      vistos,
      primeiro
    );

    if (adiante) {
      return [relative(RAIZ, entrada), ...adiante];
    }
  }

  return null;
}

const clientesComBanco = [
  ...arquivos(resolve(RAIZ, "app"), /\.tsx?$/),
  ...arquivos(resolve(RAIZ, "components"), /\.tsx?$/),
]
  .filter((caminho) =>
    /^["']use client["']/m.test(
      ler(caminho)
    )
  )
  .map((caminho) => caminhoAtePrisma(caminho))
  .filter((c): c is string[] => c !== null);

reportar(
  clientesComBanco.length === 0,
  "nenhum componente de cliente alcança o Prisma",
  clientesComBanco.length === 0
    ? ""
    : clientesComBanco
        .map((c) => c.join("  →  "))
        .join("\n       ")
);

/* ============================================================
   4. A EXTENSÃO
============================================================ */

console.log("\n  Extensão\n");

const manifesto = JSON.parse(
  readFileSync(
    resolve(RAIZ, "extensao/manifest.json"),
    "utf8"
  )
) as {
  permissions?: string[];
  host_permissions?: string[];
  content_scripts?: { matches: string[] }[];
};

/**
 * Permissão larga na extensão é risco desproporcional.
 *
 * `<all_urls>` daria à extensão acesso ao conteúdo de qualquer página
 * que a pessoa abrir — inclusive banco e e-mail. Os sites que ela
 * precisa ler são três, e estão listados.
 */
const hosts = [
  ...(manifesto.host_permissions ?? []),
  ...(manifesto.content_scripts ?? []).flatMap(
    (c) => c.matches
  ),
];

const largos = hosts.filter((h) =>
  /<all_urls>|^\*:\/\/\*\/\*|^https?:\/\/\*\/\*/.test(h)
);

reportar(
  largos.length === 0,
  `${hosts.length} site(s) declarados`,
  largos.length === 0
    ? hosts.join(" ")
    : `PERMISSÃO LARGA: ${largos.join(", ")}`
);

/**
 * `cookies` é legítimo aqui, e o motivo tem de estar escrito.
 *
 * A extensão lê o `cw_session` do CW Reputação para provar quem é —
 * o cookie é `httpOnly`, então só a API `chrome.cookies` o alcança.
 * E o alcance é estreito por construção: o manifesto declara o curinga
 * apenas em `optional_host_permissions`, e `opcoes.js` pede
 * `permissions.request` com **a origem exata** que a pessoa
 * configurou — nunca o curinga. Chrome mostra o prompt daquele site, e
 * é só daquele site que ela consegue ler cookie.
 *
 * As outras da lista continuam proibidas: `webRequest` veria todo o
 * tráfego, `history` veria tudo que a pessoa visitou.
 */
const perigosas = (manifesto.permissions ?? []).filter(
  (p) =>
    ["<all_urls>", "webRequest", "history", "downloads"].includes(p)
);

const pedeOrigemExata = /permissions\.request\(\s*\{\s*\n?\s*origins:\s*\[origem\]/.test(
  readFileSync(
    resolve(RAIZ, "extensao/opcoes/opcoes.js"),
    "utf8"
  )
);

reportar(
  perigosas.length === 0,
  `permissões: ${(manifesto.permissions ?? []).join(", ")}`,
  perigosas.length === 0 ? "" : `revisar: ${perigosas.join(", ")}`
);

reportar(
  pedeOrigemExata,
  "pede acesso só à origem configurada, não ao curinga",
  pedeOrigemExata
    ? ""
    : "o curinga de optional_host_permissions seria concedido inteiro"
);

/* ============================================================
   FIM
============================================================ */

console.log(
  falhas === 0
    ? "\n  Nenhuma porta destrancada.\n"
    : `\n  ${falhas} ponto(s) para olhar.\n`
);

process.exit(falhas === 0 ? 0 : 1);
