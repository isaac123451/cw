import { revalidateTag } from "next/cache";

import { autenticar, responder, responderPreVoo, semSessao } from "@/lib/api/extensao";
import { WORKSPACE_TAG } from "@/lib/actions/tags";
import type { MensagemDoSlack } from "@/lib/models/iaDoDia";
import { getPrisma } from "@/lib/prisma";
import { lembretesDoSlack } from "@/lib/services/iaDoDia.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * As mensagens do Slack que passaram na tela de quem está com o Slack
 * aberto (08/10/2026) — "me lembra de coisas importantes, seja do Slack".
 *
 * A extensão manda em lote o que viu (conversa direta ou menção); aqui a
 * IA do dia decide o que pede ação e cria o lembrete. Nada é respondido
 * no Slack: só a agenda de quem foi chamado muda.
 */

const TETO = 100;
const texto = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  const { usuario, demonstracao } = await autenticar(request);
  if (!usuario && !demonstracao) return semSessao(request);
  if (!usuario) return responder(request, { erro: "Entre na aplicação para receber os lembretes do Slack." }, 401);
  if (usuario.papel === "LEITURA") return responder(request, { ok: true, criados: 0 });

  const prisma = getPrisma();
  if (!prisma) return responder(request, { erro: "Sem banco configurado." }, 503);

  const corpo = (await request.json().catch(() => ({}))) as { mensagens?: unknown[] };
  const mensagens: MensagemDoSlack[] = (Array.isArray(corpo.mensagens) ? corpo.mensagens : [])
    .slice(0, TETO)
    .map((m) => m as Record<string, unknown>)
    .map((m) => ({
      canal: texto(m.canal, 40),
      ts: texto(m.ts, 40),
      texto: texto(m.texto, 4000),
      autor: texto(m.autor, 80) || undefined,
      mencoes: Array.isArray(m.mencoes) ? m.mencoes.slice(0, 10).map((x) => texto(x, 80)) : [],
      quando: texto(m.quando, 40),
      link: /^https:\/\/[a-z0-9-]+\.slack\.com\//i.test(texto(m.link, 300)) ? texto(m.link, 300) : undefined,
    }))
    .filter((m) => m.canal && /^\d{9,11}\.\d{6}$/.test(m.ts) && m.texto && !Number.isNaN(Date.parse(m.quando)));

  if (!mensagens.length) return responder(request, { ok: true, criados: 0 });

  try {
    const criados = await lembretesDoSlack(prisma, { id: usuario.id, nome: usuario.nome }, mensagens);
    if (criados) revalidateTag(WORKSPACE_TAG, "max");
    return responder(request, { ok: true, criados });
  } catch (erro) {
    console.error("[slack-avisos]", erro);
    return responder(request, { erro: "O servidor não conseguiu ler as mensagens agora." }, 500);
  }
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
