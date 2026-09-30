import { gzipSync } from "node:zlib";

import { Prisma, type PrismaClient } from "@prisma/client";

import { hojeNaOperacao } from "@/lib/services/reputation.service";

/**
 * O backup da base (Fase 31, 1.99).
 *
 * "Cópia da base todo dia, guardada fora do banco, com o botão de baixar
 * para quem administra." Todas as tabelas, linha a linha, num JSON
 * compactado — 71 tabelas e 6,2 MB de JSON em 30/09/2026, perto de 1 MB
 * compactado. Serve para desfazer um erro humano (um lote apagado, uma
 * importação errada), não para trocar de banco: voltar é por script, com
 * quem administra.
 *
 * Duas saídas:
 * - o **botão** em Configurações → Backup (só administrador), que baixa
 *   a cópia de agora;
 * - a **cópia diária** da rotina da madrugada no Supabase Storage (bucket
 *   `backups`, as 14 mais novas), quando \`SUPABASE_URL\` e
 *   \`SUPABASE_SERVICE_ROLE_KEY\` estão configuradas na Vercel. Sem elas, a
 *   rotina diz que está desligada — nunca finge que guardou.
 */

/** Campos que não saem da base nem em backup: segredo não se copia. */
const SEGREDOS = new Set(["passwordHash", "accessToken", "refreshToken", "secret", "codeHash"]);

function semSegredos(linha: Record<string, unknown>) {
  const saida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(linha)) saida[k] = SEGREDOS.has(k) ? "[fora do backup]" : v;
  return saida;
}

export async function montarBackup(prisma: PrismaClient) {
  const nomes = Object.values(Prisma.ModelName);
  const tabelas: Record<string, unknown[]> = {};
  /* Em lotes de 8: rápido sem esgotar as conexões do banco. */
  for (let i = 0; i < nomes.length; i += 8) {
    const lote = nomes.slice(i, i + 8);
    const lidas = await Promise.all(
      lote.map(async (nome) => {
        const delegate = (prisma as unknown as Record<string, { findMany: () => Promise<Record<string, unknown>[]> } | undefined>)[
          nome.charAt(0).toLowerCase() + nome.slice(1)
        ];
        return [nome, delegate ? (await delegate.findMany()).map(semSegredos) : []] as const;
      })
    );
    for (const [nome, linhas] of lidas) tabelas[nome] = linhas;
  }
  const conteudo = {
    geradoEm: new Date().toISOString(),
    dia: hojeNaOperacao(),
    tabelas,
    contagem: Object.fromEntries(Object.entries(tabelas).map(([n, l]) => [n, l.length])),
  };
  const json = JSON.stringify(conteudo, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  return { nome: `cw-reputacao-backup-${conteudo.dia}.json.gz`, gz: gzipSync(Buffer.from(json)), linhas: Object.values(conteudo.contagem).reduce((a, b) => a + b, 0), tabelas: Object.keys(tabelas).length };
}

function storage() {
  const url = (process.env.SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  const chave = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  return url && chave ? { url, chave } : null;
}

export function backupDiarioLigado() {
  return storage() !== null;
}

const BUCKET = "backups";
const GUARDAR = 14;

/** A cópia do dia no Supabase Storage, e só as 14 mais novas ficam. */
export async function guardarBackupDoDia(prisma: PrismaClient) {
  const s = storage();
  if (!s) return { ligado: false as const, motivo: "Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel para guardar a cópia diária." };

  const cab = { Authorization: `Bearer ${s.chave}`, apikey: s.chave };
  /* O bucket privado, criado na primeira vez (se já existe, o 409 é esperado). */
  await fetch(`${s.url}/storage/v1/bucket`, { method: "POST", headers: { ...cab, "Content-Type": "application/json" }, body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }) }).catch(() => null);

  const b = await montarBackup(prisma);
  const caminho = `diario/${b.nome}`;
  const r = await fetch(`${s.url}/storage/v1/object/${BUCKET}/${caminho}`, {
    method: "POST",
    headers: { ...cab, "Content-Type": "application/gzip", "x-upsert": "true" },
    body: new Uint8Array(b.gz),
  });
  if (!r.ok) return { ligado: true as const, ok: false, erro: `O Storage respondeu ${r.status}.` };

  /* A faxina: só as 14 mais novas. */
  const lista = await fetch(`${s.url}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: { ...cab, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: "diario", limit: 100, sortBy: { column: "name", order: "desc" } }),
  })
    .then((x) => (x.ok ? (x.json() as Promise<{ name: string }[]>) : []))
    .catch(() => []);
  const velhos = lista.map((o) => o.name).filter((n) => n.endsWith(".json.gz")).sort().reverse().slice(GUARDAR);
  if (velhos.length) {
    await fetch(`${s.url}/storage/v1/object/${BUCKET}`, {
      method: "DELETE",
      headers: { ...cab, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: velhos.map((n) => `diario/${n}`) }),
    }).catch(() => null);
  }

  return { ligado: true as const, ok: true, arquivo: caminho, bytes: b.gz.length, linhas: b.linhas, apagados: velhos.length };
}
