/**
 * Tenta entrar de forma indevida, por cada porta.
 *
 *   npm run dev        (noutra janela)
 *   npm run check:acesso
 *
 * As outras varreduras de segurança **leem o código**: conferem que a
 * rota chama um guarda, que a action confere o papel. Esta faz o
 * contrário — bate na porta e vê se ela abre. É a diferença entre "o
 * cadeado está pendurado" e "o cadeado está trancado".
 *
 * Cada bloco é uma tentativa de invasão, com o resultado que precisa
 * acontecer. Um teste de segurança que só confirma o caminho feliz não
 * é teste de segurança.
 *
 * Nenhum dado real é alterado: todas as tentativas devem ser recusadas,
 * e a única que usa sessão válida só lê.
 */
import "dotenv/config";

import {
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { join, resolve } from "node:path";

import { SignJWT } from "jose";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const base = (
  process.env.CW_BASE ?? "http://localhost:3000"
).replace(/\/$/, "");

const segredo =
  process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

const url =
  process.env.DIRECT_URL || process.env.DATABASE_URL;

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
  tentativa: string,
  aconteceu: string,
  esperado: string
) {

  const ok = aconteceu === esperado;

  if (!ok) falhas += 1;

  console.log(
    `${ok ? "  ok  " : "FALHA "} ${tentativa.padEnd(52)} ${aconteceu}`
  );

  if (!ok) {
    console.log(
      `${" ".repeat(7)}${"deveria ser".padEnd(52)} ${esperado}`
    );
  }
}

/** O que aconteceu com a requisição, em uma palavra. */
async function bater(
  caminho: string,
  opcoes: {
    cookie?: string;
    token?: string;
    sessao?: string;
    metodo?: string;
    corpo?: unknown;
  } = {}
) {

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (opcoes.cookie) {
    headers.Cookie = `cw_session=${opcoes.cookie}`;
  }

  if (opcoes.token) {
    headers.Authorization = `Bearer ${opcoes.token}`;
  }

  if (opcoes.sessao) {
    headers["X-CW-Sessao"] = opcoes.sessao;
  }

  if (opcoes.corpo) {
    headers["Content-Type"] = "application/json";
  }

  let r: Response;

  try {
    r = await fetch(`${base}${caminho}`, {
      method: opcoes.metodo ?? "GET",
      headers,
      body: opcoes.corpo
        ? JSON.stringify(opcoes.corpo)
        : undefined,
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return "sem resposta";
  }

  const destino = r.headers.get("location") ?? "";

  if (
    r.status >= 300 &&
    r.status < 400 &&
    destino.includes("/login")
  ) {
    return "mandou para o login";
  }

  if (r.status === 401) return "401";
  if (r.status === 403) return "403";
  if (r.status === 503) return "503";
  if (r.status === 400) return "400";

  if (r.status === 200) {
    const texto = await r.text();
    return texto.length > 3000
      ? "200 com a tela inteira"
      : "200";
  }

  return `HTTP ${r.status}`;
}

/**
 * O que a sonda de estado diz sobre quem está chamando.
 *
 * Reduzido a duas palavras para a conferência ficar legível — o que
 * importa é se ela reconhece alguém, não o corpo inteiro da resposta.
 */
async function estadoDaSessao(sessao?: string) {

  try {

    const r = await fetch(
      `${base}/api/extensao/sessao`,
      {
        headers: sessao
          ? { "X-CW-Sessao": sessao }
          : {},
        cache: "no-store",
      }
    );

    const j = (await r.json()) as {
      conectado?: boolean;
      usuario?: unknown;
    };

    return `conectado:${Boolean(j.conectado)} usuario:${j.usuario ? "sim" : "null"}`;

  } catch {
    return "sem resposta";
  }
}

async function assinar(
  dados: Record<string, unknown>,
  {
    chave = segredo!,
    validade = "600s",
  }: { chave?: string; validade?: string } = {}
) {
  return new SignJWT(dados)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(validade)
    .sign(new TextEncoder().encode(chave));
}

async function main() {

  console.log(`\n  ACESSO — tentando entrar em ${base}\n`);

  /**
   * O servidor está no ar? Se não, pare aqui.
   *
   * Sem esta parada, cada rota respondia "sem resposta" e virava uma
   * FALHA — e o resumo final dizia **"35 portas abriram para quem não
   * devia"**. A frase é assustadora, precisa no formato e errada no
   * motivo: nenhuma porta abriu, o prédio é que estava fechado.
   *
   * Um verificador que grita sobre segurança quando o problema é
   * `npm run dev` desligado ensina a ignorar o vermelho dele. E o
   * vermelho deste aqui é o que ninguém pode aprender a ignorar.
   */
  try {

    await fetch(base, {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

  } catch {

    console.error(
      [
        `  Nada respondeu em ${base}.`,
        "",
        "  Isto não é uma falha de segurança — é o servidor fora do ar.",
        "  Suba com `npm run dev` e rode de novo, ou aponte para outro",
        "  endereço com CW_BASE=http://localhost:3200 npm run check:acesso",
        "",
      ].join("\n")
    );

    await prisma.$disconnect();
    process.exit(1);
  }

  /**
   * O banco responde? Se não, pare aqui também.
   *
   * Mesma armadilha do servidor desligado, por outro caminho. O pooler
   * do Supabase cai por alguns segundos de vez em quando; quando isso
   * acontece no meio da varredura, as rotas devolvem 500 e o script
   * anuncia **"13 porta(s) abriram para quem não devia"** — uma frase
   * de invasão para o que é uma queda de conexão.
   *
   * O número inclusive mudava a cada tentativa, conforme o momento da
   * queda. Um alarme de segurança que varia de tamanho sozinho é um
   * alarme que ninguém vai levar a sério na vez em que estiver certo.
   */
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (erro) {

    console.error(
      [
        "  O banco não respondeu.",
        "",
        "  Isto não é uma falha de segurança — é conexão. O pooler do",
        "  Supabase cai por alguns segundos de vez em quando; rode de",
        "  novo. Se insistir, confira DATABASE_URL e DIRECT_URL.",
        "",
        `  ${erro instanceof Error ? erro.message.split("\n")[0] : erro}`,
        "",
      ].join("\n")
    );

    await prisma.$disconnect();
    process.exit(1);
  }

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
    throw new Error("Nenhum ADMIN ativo na base.");
  }

  /* ==========================================================
     1. SEM CREDENCIAL NENHUMA
  ========================================================== */

  console.log("  Sem credencial\n");

  for (const rota of [
    "/dashboard",
    "/configuracoes",
    "/configuracoes/permissoes",
    "/reclame-aqui",
    "/nps",
  ]) {
    conferir(
      `abrir ${rota}`,
      await bater(rota),
      "mandou para o login"
    );
  }

  conferir(
    "API pública /api/casos",
    await bater("/api/casos"),
    "401"
  );

  conferir(
    "API pública /api/reputacao",
    await bater("/api/reputacao"),
    "401"
  );

  conferir(
    "rotina agendada /api/cron",
    await bater("/api/cron"),
    "401"
  );

  conferir(
    "assistente de IA /api/assistente",
    await bater("/api/assistente"),
    "401"
  );

  /**
   * Cada rota com o método que ela atende.
   *
   * `/nps` só aceita POST, e um GET nela devolve 405 — que é recusa,
   * mas de outra natureza: o método sequer chega à autenticação. Bater
   * com o método errado testaria o roteador, não o cadeado.
   */
  /**
   * A lista sai do disco, e não daqui.
   *
   * Era escrita à mão, e isso a deixou desatualizada no dia em que uma
   * rota nova apareceu: `resumo-caso` foi criada com a guarda errada —
   * `if (!sessao)` sobre um objeto que é sempre verdadeiro — e
   * respondeu **200 sem sessão**, devolvendo o relato do consumidor e
   * gastando chamada ao modelo. Nem este script nem o `check:seguranca`
   * apontaram: um não conhecia a rota, o outro só confere se a guarda
   * **existe** no arquivo, não se ela funciona.
   *
   * Lendo o diretório, toda rota nova entra na varredura sozinha. É a
   * diferença entre uma lista que envelhece e uma que não pode
   * envelhecer.
   */
  const pastaDaExtensao = resolve(
    __dirname,
    "../app/api/extensao"
  );

  const daExtensao: [string, string][] = readdirSync(
    pastaDaExtensao
  )
    .filter((nome) => {
      try {
        return statSync(
          join(pastaDaExtensao, nome, "route.ts")
        ).isFile();
      } catch {
        return false;
      }
    })
    /**
     * `/sessao` é a sonda de estado do painel e responde 200 de
     * propósito — ela tem conferência própria logo abaixo.
     */
    .filter((nome) => nome !== "sessao")
    .map((nome) => {

      const fonte = readFileSync(
        join(pastaDaExtensao, nome, "route.ts"),
        "utf8"
      );

      /**
       * O método vem do que a rota exporta.
       *
       * Bater com o método errado devolve 405 e testaria o roteador,
       * não o cadeado — e um 405 passaria por "não deixou entrar" sem
       * nunca ter chegado na autenticação.
       */
      const metodo = /export\s+(async\s+)?function\s+GET/.test(
        fonte
      )
        ? "GET"
        : "POST";

      return [`/api/extensao/${nome}`, metodo] as [
        string,
        string,
      ];
    })
    .sort((a, b) => a[0].localeCompare(b[0]));

  console.log(
    `\n  ${daExtensao.length} rotas de extensão achadas no disco — a lista não é escrita à mão.\n`
  );

  for (const [rota, metodo] of daExtensao) {
    conferir(
      `extensão ${metodo} ${rota.replace("/api/extensao", "")}`,
      await bater(rota, {
        metodo,
        corpo: metodo === "POST" ? {} : undefined,
      }),
      "401"
    );
  }

  /**
   * `/sessao` responde 200 de propósito, e a pergunta certa é outra.
   *
   * Ela é a **sonda de estado** do painel: precisa distinguir "não
   * estou logado" de "não alcancei o servidor", e um 401 se confunde
   * com falha de rede nesse fluxo. O que ela não pode é dizer
   * `conectado: true` — ou devolver quem é a pessoa — para quem não
   * apresentou sessão válida.
   */
  conferir(
    "extensão /sessao não reconhece quem não tem sessão",
    await estadoDaSessao(),
    "conectado:false usuario:null"
  );

  /* ==========================================================
     2. COM CREDENCIAL FALSIFICADA
  ========================================================== */

  console.log("\n  Com credencial falsificada\n");

  /**
   * Assinado com outro segredo — é o ataque óbvio.
   *
   * Quem conhece o formato do token monta um com os próprios dados e
   * papel ADMIN. Só a assinatura separa isso de uma sessão real.
   */
  const forjado = await assinar(
    { ...admin, role: "ADMIN" },
    { chave: "segredo-errado-de-atacante" }
  );

  conferir(
    "sessão assinada com outro segredo",
    await bater("/dashboard", { cookie: forjado }),
    "mandou para o login"
  );

  conferir(
    "a mesma, na sonda de estado da extensão",
    await estadoDaSessao(forjado),
    "conectado:false usuario:null"
  );

  /** Assinado com o segredo certo, mas vencido. */
  const vencido = await assinar(admin, {
    validade: "-10s",
  });

  conferir(
    "sessão vencida",
    await bater("/dashboard", { cookie: vencido }),
    "mandou para o login"
  );

  conferir(
    "token de API errado",
    await bater("/api/casos", {
      token: "token-de-atacante",
    }),
    "401"
  );

  conferir(
    "segredo do cron errado",
    await bater("/api/cron", {
      token: "segredo-de-atacante",
    }),
    "401"
  );

  /**
   * Cabeçalho vazio não pode virar passe livre.
   *
   * É o erro clássico de comparação: `""` contra `""` dá igual, e a
   * rota abre para quem manda o cabeçalho em branco.
   */
  conferir(
    "token de API em branco",
    await bater("/api/casos", { token: "" }),
    "401"
  );

  /* ==========================================================
     3. COM SESSÃO VÁLIDA DE QUEM NÃO DEVIA
  ========================================================== */

  console.log("\n  Com sessão válida, mas de quem não devia\n");

  /**
   * Conta que não existe mais.
   *
   * O token é legítimo — assinatura certa, dentro da validade. O que
   * separa isto de um acesso real é o servidor conferir, a cada ação,
   * se aquela pessoa ainda está no banco.
   */
  const fantasma = await assinar({
    id: "usuario-que-nao-existe",
    email: "fantasma@cardapioweb.com",
    name: "Fantasma",
    role: "ADMIN",
  });

  conferir(
    "sessão de conta inexistente, na extensão",
    await bater("/api/extensao/contexto", {
      sessao: fantasma,
    }),
    "401"
  );

  /**
   * Conta desativada.
   *
   * Cria uma, tenta entrar com ela, e apaga. Desativar alguém precisa
   * valer **agora** — esperar a sessão vencer é oito horas de acesso a
   * quem não devia mais ter.
   */
  const desativada = await prisma.user.create({
    data: {
      name: "ZZ Teste Desativado",
      email: `zz-desativado-${Date.now()}@sem-acesso.local`,
      passwordHash: "",
      role: "ADMIN",
      active: false,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });

  try {

    const tokenDesativado = await assinar(desativada);

    conferir(
      "sessão de conta desativada, na extensão",
      await bater("/api/extensao/contexto", {
        sessao: tokenDesativado,
      }),
      "401"
    );

  } finally {
    await prisma.user
      .delete({ where: { id: desativada.id } })
      .catch(() => {});
  }

  /* ==========================================================
     4. A PORTA DO CADASTRO
  ========================================================== */

  console.log("\n  A porta do cadastro\n");

  const cadastro = await bater("/cadastro");

  conferir(
    "a tela de cadastro é pública",
    cadastro,
    "200 com a tela inteira"
  );

  /**
   * O cadastro é a única porta que abre sem credencial, e por isso a
   * regra dele é dupla: domínio corporativo **e** lista de liberados.
   * As duas são conferidas no servidor, em `checkSignupAccess`.
   */
  const liberados = await prisma.allowedEmail.count();

  console.log(
    `  --   ${"lista de e-mails liberados".padEnd(52)} ${liberados} endereço(s)`
  );

  const semSenha = await prisma.user.count({
    where: {
      passwordHash: "",
      role: { in: ["ADMIN", "AGENTE"] },
      email: { endsWith: "@cardapioweb.com" },
    },
  });

  /**
   * Conta sem senha com papel alto é a porta dos fundos.
   *
   * O cadastro **adota** uma linha que existe sem senha, para preservar
   * o que já estava no nome da pessoa — e adota junto o papel dela. Uma
   * conta ADMIN sem senha, com e-mail corporativo, é uma conta que a
   * primeira pessoa da lista de liberados que souber o endereço assume.
   *
   * Zero é o número certo. As contas históricas criadas pela carga usam
   * `@sem-acesso.local`, que o cadastro recusa por domínio.
   */
  conferir(
    "contas ADMIN/AGENTE sem senha e com e-mail corporativo",
    String(semSenha),
    "0"
  );
}

main()
  .catch((erro) => {
    falhas += 1;
    console.error("\n  ERRO:", erro);
  })
  .finally(async () => {

    await prisma.$disconnect();

    console.log(
      falhas === 0
        ? "\n  Toda porta recusou quem não devia entrar.\n"
        : `\n  ${falhas} porta(s) abriram para quem não devia.\n`
    );

    process.exit(falhas === 0 ? 0 : 1);
  });
