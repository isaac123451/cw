/**
 * As telas respondem dentro da meta?
 *
 *   CW_BASE=http://localhost:3200 npm run check:tempo-das-telas
 *
 * Fase 34, "desempenho medido: páginas lentas medidas e cortadas, com meta
 * de tempo". O `check:desempenho` mede as consultas no banco; este mede o
 * que a tela espera, contra a aplicação no ar — as leituras de que ela
 * depende e a resposta das páginas principais —, cada uma com meta de tempo
 * e de tamanho (a página, menos de 1,5 s — a meta da Fase 21). Mediana de cinco idas, depois de uma de aquecimento (no
 * dev, a primeira compila a rota).
 *
 * O que foi cortado para chegar aqui (1.116, medido em 01/10/2026):
 *
 *   Meu dia pronto       9,6 s → 6,2 s (dev) — as leituras saíram da fila
 *                        das server actions e vão juntas, por rota
 *   NPS na recarga       2,3 MB / 1,3 s → até 26 kB / 0,14 s — só o que mudou
 *   Reclamações          400 kB → ~11 kB na recarga
 *
 * As metas são de dev (tudo num processo só, sem cache de CDN) e folgadas:
 * existem para pegar regressão de ordem de grandeza — a recarga voltando a
 * baixar a lista inteira, uma leitura caindo de volta na fila —, não para
 * reprovar variação de rede. Em produção os números são menores.
 *
 * Só leitura. Sem servidor no ar, diz como subir.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

const BASE = (process.env.CW_BASE ?? "http://localhost:3000").replace(/\/$/, "");
const IDAS = 5;

interface Meta {
  nome: string;
  /** Tempo máximo da mediana, em ms. */
  ms: number;
  /** Tamanho máximo da resposta, em kB. */
  kb: number;
  ir: (sessao: string, contexto: Contexto) => Promise<Response>;
}

interface Contexto {
  agora: string;
}

const comSessao = (sessao: string, extra: RequestInit = {}): RequestInit => ({
  ...extra,
  headers: { Cookie: `cw_session=${sessao}`, ...(extra.headers ?? {}) },
  redirect: "manual",
  cache: "no-store",
});

const METAS: Meta[] = [
  {
    nome: "NPS inteiro (abertura e a cada 30 min)",
    ms: 4000,
    kb: 4000,
    ir: (s) => fetch(`${BASE}/api/leitura/nps`, comSessao(s)),
  },
  {
    nome: "NPS só do que mudou (a recarga de 3 em 3 min)",
    ms: 1500,
    kb: 100,
    ir: (s, c) => fetch(`${BASE}/api/leitura/nps?desde=${encodeURIComponent(c.agora)}`, comSessao(s)),
  },
  {
    nome: "Leituras do Meu dia, em lote",
    ms: 4000,
    kb: 300,
    ir: (s) =>
      fetch(
        `${BASE}/api/leitura/lote`,
        comSessao(s, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pedidos: ["meuDia", "rotina", "radar", "espera", "ajustesDeMeta", "painelDoPortal", "googleStatus"].map((nome) => ({ nome, args: [] })),
          }),
        })
      ),
  },
  ...["/meu-dia", "/dashboard", "/reclame-aqui", "/reclame-aqui/indice", "/nps", "/agenda"].map(
    (rota): Meta => ({
      nome: `Página ${rota}`,
      ms: 1500,
      kb: 600,
      ir: (s) => fetch(`${BASE}${rota}`, comSessao(s)),
    })
  ),
];

function mediana(lista: number[]) {
  const ordenada = [...lista].sort((a, b) => a - b);
  return ordenada[Math.floor(ordenada.length / 2)];
}

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const segredo = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!url || !segredo) {
    console.error("\n  DATABASE_URL e AUTH_SECRET são necessários (o .env local).\n");
    process.exit(1);
  }

  try {
    await fetch(`${BASE}/login`, { redirect: "manual" });
  } catch {
    console.error(`\n  A aplicação não respondeu em ${BASE}. Suba com "npm run dev" e rode de novo:\n\n  CW_BASE=${BASE} npm run check:tempo-das-telas\n`);
    process.exit(1);
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const admin = await prisma.user.findFirst({ where: { active: true, role: "ADMIN" }, select: { id: true, email: true, name: true, role: true } });
  await prisma.$disconnect();
  if (!admin) throw new Error("Nenhum ADMIN ativo.");

  const sessao = await new SignJWT({ ...admin }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("900s").sign(new TextEncoder().encode(segredo));
  const contexto: Contexto = { agora: new Date(Date.now() - 3 * 60_000).toISOString() };

  console.log(`\n  TEMPO DAS TELAS — ${BASE}, mediana de ${IDAS} idas\n`);
  let falhas = 0;

  for (const meta of METAS) {
    /* Aquecimento: no dev, a primeira ida compila a rota. */
    await meta.ir(sessao, contexto).then((r) => r.arrayBuffer()).catch(() => null);

    const tempos: number[] = [];
    let kb = 0;
    let status = 0;
    for (let i = 0; i < IDAS; i += 1) {
      const inicio = performance.now();
      const resposta = await meta.ir(sessao, contexto);
      const corpo = await resposta.arrayBuffer();
      tempos.push(performance.now() - inicio);
      kb = Math.round(corpo.byteLength / 1024);
      status = resposta.status;
    }
    const ms = Math.round(mediana(tempos));
    const ok = status === 200 && ms <= meta.ms && kb <= meta.kb;
    if (!ok) falhas += 1;
    console.log(
      `  ${ok ? "ok   " : "FALHA"} ${meta.nome.padEnd(48)} ${String(ms).padStart(5)} ms (meta ${meta.ms})  ${String(kb).padStart(5)} kB (meta ${meta.kb})${status === 200 ? "" : `  status ${status}`}`
    );
  }

  console.log(falhas === 0 ? "\n  Tudo dentro da meta.\n" : `\n  ${falhas} acima da meta.\n`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
