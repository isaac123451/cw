import type { PrismaClient } from "@prisma/client";

import { isEncerrado, STATUS_SEM_TRATATIVA } from "@/lib/models/nps";
import { textoDaNota } from "@/lib/models/notaDoWootric";
import { baseDoWootric, temWootric, tokenDeIntegracao } from "@/lib/services/wootric.service";

/**
 * O encerramento do ciclo, devolvido ao Wootric.
 *
 * O Isaac, em 13/09/2026: "quando um caso de nps é finalizado, concluído,
 * etc. ele precisa enviar como uma nota os detalhes do caso para a
 * wootric e também finalizar por lá". Duas escritas:
 *
 * 1. **A nota com os detalhes** — `POST /v1/notes`. A rota não está na
 *    documentação pública; foi achada sondando só com leitura em 13/09:
 *    `GET /v1/notes?response_ids[]=<id>` devolve `{ id, response_id,
 *    text, user_email, created_at }`. E a escrita responde, com a chave
 *    de integração (client credentials): **"Cannot create, update or
 *    delete notes when logged in with credentials"**. Nota só com login
 *    de usuário (grant `password`): `WOOTRIC_USUARIO` e `WOOTRIC_SENHA`,
 *    de preferência uma conta do time só para isto — a nota aparece lá
 *    com o e-mail dela.
 * 2. **Concluir** — `PUT /v1/responses/<id>` com `completed=true`, que é
 *    o "Mark Complete" do painel. Esta está na documentação.
 *
 * O que foi aceito fica gravado no ciclo (`wootricNotaEm`,
 * `wootricConcluidoEm`) e o que foi recusado também (`wootricErro`): a
 * ficha mostra, oferece reenviar, e o cron tenta de novo o que ficou
 * para trás. Nada é reenviado em dobro — cada metade só vai uma vez por
 * encerramento.
 */

/** Só encerramentos a partir daqui voltam ao Wootric — os antigos não viram enxurrada de notas. */
export const INICIO_DA_DEVOLUCAO = new Date("2026-09-14T03:00:00Z");

export function temLoginDeUsuario() {
  return (process.env.WOOTRIC_USUARIO ?? "").trim() !== "" && (process.env.WOOTRIC_SENHA ?? "").trim() !== "";
}

let cacheDoUsuario: { token: string; expira: number } | null = null;

async function tokenDeUsuario(): Promise<string> {
  if (cacheDoUsuario && Date.now() < cacheDoUsuario.expira - 5 * 60 * 1000) return cacheDoUsuario.token;

  const resposta = await fetch(`${baseDoWootric()}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      username: (process.env.WOOTRIC_USUARIO ?? "").trim(),
      password: (process.env.WOOTRIC_SENHA ?? "").trim(),
    }).toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!resposta.ok) {
    throw new Error(
      resposta.status === 401 || resposta.status === 400
        ? "o Wootric recusou o login de usuário (WOOTRIC_USUARIO e WOOTRIC_SENHA)"
        : `o Wootric respondeu ${resposta.status} ao login de usuário`
    );
  }

  const dados = (await resposta.json()) as { access_token?: string; expires_in?: number };
  if (!dados.access_token) throw new Error("o Wootric não devolveu token para o login de usuário");

  cacheDoUsuario = { token: dados.access_token, expira: Date.now() + (dados.expires_in ?? 7200) * 1000 };
  return cacheDoUsuario.token;
}

/** O que o Wootric disse, em uma linha — o texto dele, sem inventar tradução. */
async function motivoDa(resposta: Response) {
  const texto = (await resposta.text().catch(() => "")).trim();
  try {
    const json = JSON.parse(texto) as { errors?: { message?: string }[]; message?: string } | string;
    if (typeof json === "string") return `${resposta.status}: ${json}`;
    const msg = json.errors?.map((e) => e.message).filter(Boolean).join("; ") || json.message;
    if (msg) return `${resposta.status}: ${msg}`;
  } catch {
    /* não era JSON */
  }
  return `${resposta.status}${texto ? `: ${texto.slice(0, 160)}` : ""}`;
}

async function escrever(metodo: "POST" | "PUT", caminho: string, corpo: Record<string, string>, comUsuario: boolean) {
  const token = comUsuario ? await tokenDeUsuario() : await tokenDeIntegracao();
  const resposta = await fetch(`${baseDoWootric()}/v1${caminho}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(corpo).toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!resposta.ok) throw new Error(await motivoDa(resposta));
}

/* ============================================================
   DEVOLVER E REABRIR
============================================================ */

export interface ResultadoNoWootric {
  /** "fora" — não é do Wootric, ou é promotor calado; nada a fazer. */
  estado: "fora" | "sem-integracao" | "ok" | "pendente";
  nota: "enviada" | "ja-enviada" | "sem-login" | "falhou" | "nao-se-aplica";
  concluido: "feito" | "ja-feito" | "falhou" | "nao-se-aplica";
  erro?: string;
}

const SELECAO = {
  id: true,
  source: true,
  externalId: true,
  status: true,
  closedAt: true,
  outcome: true,
  kind: true,
  rootCause: true,
  churnRisk: true,
  firstContactAt: true,
  firstContactDueAt: true,
  postContactAt: true,
  postContactBy: true,
  postContactNote: true,
  moodAfter: true,
  resolvedAfter: true,
  confirmedAt: true,
  wootricNotaEm: true,
  wootricConcluidoEm: true,
  owner: { select: { name: true } },
  attempts: { select: { channel: true, createdAt: true }, orderBy: { createdAt: "asc" as const } },
} as const;

const FORA: ResultadoNoWootric = { estado: "fora", nota: "nao-se-aplica", concluido: "nao-se-aplica" };

/**
 * Manda a nota e conclui a resposta no Wootric — o que ainda não foi.
 *
 * Nunca lança: o encerramento aqui já foi gravado, e uma falha lá não
 * pode desfazê-lo. O que der errado volta no resultado e fica em
 * `wootricErro`, com o texto do Wootric.
 */
export async function devolverEncerramentoAoWootric(
  prisma: PrismaClient,
  id: string,
  quemEncerrou?: string
): Promise<ResultadoNoWootric> {

  /* Primeiro só o que decide se há o que fazer: ciclo manual nem lê o resto. */
  const origem = await prisma.npsResponse.findUnique({ where: { id }, select: { source: true, externalId: true } });
  if (!origem || origem.source !== "Wootric" || !origem.externalId) return FORA;

  const ciclo = await prisma.npsResponse.findUnique({ where: { id }, select: SELECAO });

  if (!ciclo || !ciclo.externalId) return FORA;
  if (!isEncerrado(ciclo.status) || ciclo.status === STATUS_SEM_TRATATIVA) return FORA;
  if (!temWootric()) return { estado: "sem-integracao", nota: "nao-se-aplica", concluido: "nao-se-aplica", erro: "Integração com o Wootric não configurada." };

  const erros: string[] = [];
  let nota: ResultadoNoWootric["nota"] = "ja-enviada";
  let concluido: ResultadoNoWootric["concluido"] = "ja-feito";
  let notaEm = ciclo.wootricNotaEm;
  let concluidoEm = ciclo.wootricConcluidoEm;

  if (!notaEm) {
    if (!temLoginDeUsuario()) {
      nota = "sem-login";
      erros.push("A nota precisa de um login de usuário do Wootric (WOOTRIC_USUARIO e WOOTRIC_SENHA): a chave de integração só lê notas.");
    } else {
      try {
        await escrever("POST", "/notes", { response_id: ciclo.externalId, text: textoDaNota(ciclo, quemEncerrou) }, true);
        nota = "enviada";
        notaEm = new Date();
      } catch (erro) {
        nota = "falhou";
        erros.push(`A nota não foi aceita — ${erro instanceof Error ? erro.message : "erro de rede"}.`);
      }
    }
  }

  if (!concluidoEm) {
    try {
      await escrever("PUT", `/responses/${ciclo.externalId}`, { completed: "true" }, temLoginDeUsuario());
      concluido = "feito";
      concluidoEm = new Date();
    } catch (erro) {
      concluido = "falhou";
      erros.push(`A conclusão não foi aceita — ${erro instanceof Error ? erro.message : "erro de rede"}.`);
    }
  }

  const erro = erros.join(" ") || undefined;

  await prisma.npsResponse
    .update({ where: { id }, data: { wootricNotaEm: notaEm, wootricConcluidoEm: concluidoEm, wootricErro: erro ?? null } })
    .catch((e) => console.error("[wootric] gravar o resultado da devolução", e));

  return { estado: erro ? "pendente" : "ok", nota, concluido, erro };
}

/**
 * O ciclo voltou a andar aqui: a resposta deixa de estar concluída lá, e
 * a nota é zerada para o próximo encerramento mandar os detalhes novos.
 * A nota antiga fica no Wootric — é histórico.
 */
export async function reabrirNoWootric(prisma: PrismaClient, id: string): Promise<string | undefined> {
  const ciclo = await prisma.npsResponse.findUnique({ where: { id }, select: { source: true, externalId: true, wootricConcluidoEm: true, wootricNotaEm: true } });
  if (!ciclo || ciclo.source !== "Wootric" || !ciclo.externalId) return;
  if (!ciclo.wootricConcluidoEm && !ciclo.wootricNotaEm) return;

  let erro: string | undefined;
  let concluidoEm = ciclo.wootricConcluidoEm;

  if (concluidoEm && temWootric()) {
    try {
      await escrever("PUT", `/responses/${ciclo.externalId}`, { completed: "false" }, temLoginDeUsuario());
      concluidoEm = null;
    } catch (e) {
      erro = `Não deu para reabrir no Wootric — ${e instanceof Error ? e.message : "erro de rede"}.`;
    }
  }

  await prisma.npsResponse
    .update({ where: { id }, data: { wootricNotaEm: null, wootricConcluidoEm: concluidoEm, wootricErro: erro ?? null } })
    .catch((e) => console.error("[wootric] gravar a reabertura", e));

  return erro;
}

/** Os encerramentos que ainda não chegaram inteiros ao Wootric — para o cron tentar de novo. */
export async function pendentesNoWootric(prisma: PrismaClient, limite = 20) {
  const linhas = await prisma.npsResponse.findMany({
    where: {
      source: "Wootric",
      externalId: { not: null },
      status: { startsWith: "[Encerrado]", not: STATUS_SEM_TRATATIVA },
      closedAt: { gte: INICIO_DA_DEVOLUCAO },
      /* Sem login de usuário a nota não tem como ir: o cron só insiste no que pode andar. */
      OR: temLoginDeUsuario() ? [{ wootricNotaEm: null }, { wootricConcluidoEm: null }] : [{ wootricConcluidoEm: null }],
    },
    select: { id: true },
    orderBy: { closedAt: "asc" },
    take: limite,
  });
  return linhas.map((l) => l.id);
}
