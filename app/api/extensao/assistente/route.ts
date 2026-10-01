import { autenticar, responder, responderPreVoo, semSessao } from "@/lib/api/extensao";
import { descreverCasoAberto } from "@/lib/models/contextoDaTela";
import { getPrisma } from "@/lib/prisma";
import { ASSISTANT_SYSTEM } from "@/lib/services/assistant.context";
import { fetchCaseByProtocol } from "@/lib/services/case.repository";
import { conversar, type Turno } from "@/lib/services/ia.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Perguntar ao assistente sobre o cliente aberto na extensão (1.125, Fase
 * 28: "na extensão, perguntas sobre o cliente aberto").
 *
 * Até aqui o painel levava a pergunta para a página do assistente, numa
 * aba nova — saía da conversa para perguntar sobre ela. Agora a resposta
 * vem no próprio painel. O que o servidor sabe do cliente vai junto: os
 * casos dele por inteiro (relato, resposta, avaliação), pelo protocolo que
 * o painel já identificou, e o nome e o telefone do contato.
 *
 * Só leitura e só rascunho: nada é gravado e nada vai ao cliente.
 */
export async function OPTIONS(request: Request) {
  return responderPreVoo(request);
}

function historicoValido(bruto: unknown): Turno[] {
  if (!Array.isArray(bruto)) return [];
  return bruto
    .slice(-6)
    .map((t) => t as Record<string, unknown>)
    .filter((t) => (t?.role === "user" || t?.role === "assistant") && typeof t.content === "string" && t.content.trim())
    .map((t) => ({ role: t.role as Turno["role"], content: String(t.content).slice(0, 2000) }));
}

export async function POST(request: Request) {
  const { usuario, demonstracao } = await autenticar(request);
  if (!usuario && !demonstracao) return semSessao(request);

  const corpo = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const pergunta = String(corpo.pergunta ?? "").trim().slice(0, 800);
  if (!pergunta) return responder(request, { ok: false, erro: "Escreva a pergunta." }, 400);

  const protocolos = (Array.isArray(corpo.protocolos) ? corpo.protocolos : [])
    .map((p) => String(p ?? "").trim())
    .filter((p) => /^[\w-]{3,60}$/.test(p))
    .slice(0, 3);
  const nome = String(corpo.nome ?? "").trim().slice(0, 120);
  const telefone = String(corpo.telefone ?? "").replace(/[^\d+]/g, "").slice(0, 20);

  const prisma = getPrisma();
  const casos = prisma ? (await Promise.all(protocolos.map((p) => fetchCaseByProtocol(prisma, p).catch(() => null)))).filter((c) => c !== null) : [];

  const sobreOCliente = [
    "--- O CLIENTE ABERTO NA EXTENSÃO ---",
    `Quem atende está com a conversa deste contato aberta agora${nome ? `: ${nome}` : ""}${telefone ? ` (${telefone})` : ""}.`,
    "\"Este cliente\" e \"este caso\" são estes. Responda curto — cabe num painel lateral —, direto, e sem inventar o que não está aqui.",
    casos.length ? `Os casos dele, por inteiro:\n${casos.map(descreverCasoAberto).join("\n\n")}` : "Nenhum caso dele foi identificado na plataforma — diga isso se a pergunta depender de um caso.",
  ].join("\n");

  let resposta = "";
  let erro = "";
  try {
    for await (const pedaco of conversar({ sistema: `${ASSISTANT_SYSTEM}\n\n${sobreOCliente}`, turnos: [...historicoValido(corpo.historico), { role: "user", content: pergunta }] })) {
      if (pedaco.tipo === "delta") resposta += pedaco.texto;
      if (pedaco.tipo === "erro") erro = pedaco.mensagem;
    }
  } catch (falha) {
    console.error("[extensao/assistente]", falha);
    erro = "O assistente não respondeu agora. Tente de novo em instantes.";
  }

  if (!resposta.trim()) return responder(request, { ok: false, erro: erro || "O assistente não respondeu agora." });
  return responder(request, { ok: true, resposta: resposta.trim(), casos: casos.map((c) => c.protocol) });
}
