/**
 * Abre todas as telas e conta o que quebrou.
 *
 *   npm run dev        (noutra janela)
 *   npm run check:telas
 *
 * As varreduras de segurança e persistência olham o código; esta abre a
 * página. É a diferença entre "a action confere o papel" e "a tela
 * carrega sem estourar" — e as duas coisas falham de jeitos diferentes.
 *
 * Três defeitos que só aparecem assim:
 *
 * - **Erro de servidor na renderização.** Uma consulta que quebra num
 *   caso de dado real devolve 500, e nenhum `tsc` vê isso.
 * - **Rota que virou 404 sem ninguém notar.** Renomear uma pasta em
 *   `app/` some com a página; o link no menu continua lá.
 * - **HTML no lugar de conteúdo.** Página que responde 200 e devolve só
 *   o esqueleto é página vazia — e o número que denuncia isso é o
 *   tamanho do corpo.
 *
 * Roda contra a aplicação de verdade, com sessão. As rotas com
 * parâmetro (`[id]`) recebem um id que existe no banco: testar com um
 * id inventado provaria só a tela de "não encontrado".
 */
import "dotenv/config";

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

/**
 * O piso de tamanho separa página cheia de esqueleto.
 *
 * Uma tela desta aplicação renderiza menu, cabeçalho e conteúdo; o
 * menor documento observado passa de 20 kB. Abaixo de 4 kB é shell sem
 * conteúdo — que responde 200 e não serve para nada.
 */
const PISO = 4000;

async function abrir(
  caminho: string,
  sessao: string
) {

  const marca = Date.now();

  let resposta: Response;

  try {
    resposta = await fetch(`${base}${caminho}`, {
      headers: {
        Cookie: `cw_session=${sessao}`,
        Accept: "text/html",
      },
      redirect: "manual",
      cache: "no-store",
    });
  } catch (erro) {
    falhas += 1;
    console.log(
      `FALHA  ${caminho.padEnd(34)} não respondeu — ${(erro as Error).message}`
    );
    return;
  }

  const ms = Date.now() - marca;
  const corpo = await resposta.text();

  const destino = resposta.headers.get("location") ?? "";

  const redirecionou =
    resposta.status >= 300 && resposta.status < 400;

  /**
   * Nem todo redirecionamento é defeito — depende de para onde.
   *
   * Duas rotas desta aplicação redirecionam de propósito: `/` manda
   * para `/dashboard`, e `/empresas` manda para `/estabelecimentos`,
   * que é a URL nova do módulo renomeado. Contar isso como falha é o
   * que a primeira versão deste script fazia, e alarme falso repetido
   * é alarme desligado.
   *
   * O que **é** defeito é cair no login: significa que a sessão não foi
   * aceita, e o teste inteiro estaria medindo a tela de entrada.
   */
  const paraLogin =
    redirecionou && destino.includes("/login");

  const ok = paraLogin
    ? false
    : redirecionou
      ? true
      : resposta.status === 200 && corpo.length >= PISO;

  if (!ok) falhas += 1;

  const nota = paraLogin
    ? "mandou para o login — sessão recusada"
    : redirecionou
      ? `redireciona para ${destino}`
      : resposta.status !== 200
        ? `HTTP ${resposta.status}`
        : `corpo de ${corpo.length} bytes — esqueleto sem conteúdo`;

  console.log(
    `${ok ? "  ok  " : "FALHA "} ${caminho.padEnd(34)} ${String(ms).padStart(5)} ms  ${String(Math.round(corpo.length / 1024)).padStart(4)} kB${redirecionou || !ok ? `   ${nota}` : ""}`
  );
}

async function main() {

  /**
   * O servidor está no ar? Se não, pare aqui.
   *
   * Mesma correção de `check-acesso`: sem esta parada, todas as telas
   * respondiam "fetch failed" e o resumo dizia "35 tela(s) com
   * problema" — verdade no formato, mentira no motivo. As telas estão
   * bem; o servidor é que não subiu.
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
        `\n  Nada respondeu em ${base}.`,
        "",
        "  As telas não estão quebradas — o servidor não está no ar.",
        "  Suba com `npm run dev`, ou aponte para outro endereço com",
        "  CW_BASE=http://localhost:3200 npm run check:telas",
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
    throw new Error(
      "Nenhum ADMIN ativo — rode npm run db:seed."
    );
  }

  const sessao = await new SignJWT({ ...admin })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("900s")
    .sign(new TextEncoder().encode(segredo));

  /* ---------- os ids reais, para as rotas com parâmetro ---------- */

  const caso = await prisma.case.findFirst({
    select: { externalId: true, protocol: true },
    orderBy: { publishedAt: "desc" },
  });

  const estabelecimento =
    await prisma.establishment.findFirst({
      select: { slug: true },
    });

  const cliente = await prisma.clientProfile.findFirst({
    select: { slug: true },
  });

  const idDoCaso =
    caso?.externalId ?? caso?.protocol ?? "";

  const fixas = [
    "/",
    "/dashboard",
    "/reclame-aqui",
    "/reclame-aqui/analytics",
    "/reclame-aqui/calculadora",
    "/reclame-aqui/configuracoes",
    "/reclame-aqui/graficos",
    "/reclame-aqui/novo",
    "/redes-sociais",
    "/nps",
    "/nps/analise",
    "/agenda",
    "/analytics",
    "/impacto",
    "/assistente",
    "/jornada",
    "/estabelecimentos",
    "/clientes",
    "/empresas",
    "/documentacao",
    "/base-conhecimento",
    "/processos",
    "/projetos",
    "/times",
    "/conta",
    "/configuracoes",
    "/configuracoes/integracoes",
    "/configuracoes/permissoes",
  "/configuracoes/seguranca",
    "/configuracoes/planos",
  ];

  console.log(
    `\n  TELAS — contra ${base}, como ${admin.name}\n`
  );

  for (const caminho of fixas) {
    await abrir(caminho, sessao);
  }

  console.log("\n  com parâmetro, usando registro real\n");

  const comParametro: [string, string | undefined][] = [
    [`/reclame-aqui/${idDoCaso}`, idDoCaso],
    [
      `/estabelecimentos/${estabelecimento?.slug}`,
      estabelecimento?.slug,
    ],
    [`/clientes/${cliente?.slug}`, cliente?.slug],
  ];

  for (const [caminho, existe] of comParametro) {

    if (!existe) {
      console.log(
        `  --   ${caminho.padEnd(34)} sem registro na base para testar`
      );
      continue;
    }

    await abrir(caminho, sessao);
  }

  /* ---------- as públicas ---------- */

  console.log("\n  sem sessão\n");

  for (const caminho of ["/login", "/cadastro"]) {
    await abrir(caminho, "");
  }
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
        ? "\n  Todas as telas abrem com conteúdo.\n"
        : `\n  ${falhas} tela(s) com problema.\n`
    );

    process.exit(falhas === 0 ? 0 : 1);
  });
