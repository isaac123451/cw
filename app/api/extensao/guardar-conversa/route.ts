import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { getPrisma } from "@/lib/prisma";

import { instanteDoCarimbo, type Lado, type MensagemRecebida } from "@/lib/models/conversa";
import { candidatas, gravarMensagens, MAXIMO_DE_MENSAGENS, somenteDigitosDoTelefone } from "@/lib/services/conversas.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Guardar a conversa", pela extensão.
 *
 * É a segunda rota da extensão que recebe texto de conversa (a outra é
 * o resumo), e pelo mesmo caminho: **só no clique**, depois de a pessoa
 * confirmar no painel quantas mensagens vão. O painel manda as mensagens
 * visíveis da conversa aberta, cada uma com o id que o WhatsApp dá a ela
 * — é por esse id que guardar de novo acrescenta só as novas.
 *
 * A conversa é a do telefone: se já existe uma com o mesmo número (os
 * oito últimos dígitos), as mensagens entram nela; senão, nasce uma. O
 * caso que o painel reconheceu entra como vínculo — só se a conversa
 * ainda não tiver um. Dados bancários saem antes de gravar
 * (`omitirDadosBancarios`).
 */

interface MensagemDoPainel {
  id?: string;
  de?: string;
  texto?: string;
  /** "10:32, 14/09/2026" — o carimbo do WhatsApp. */
  carimbo?: string;
  autor?: string;
}

/**
 * A chave de repetição da mensagem.
 *
 * O WhatsApp manda o id cru e ele vira `wa:<id>`. O Crisp já manda o
 * dele prefixado (`crisp:<id>`), porque a numeração dos dois não tem
 * nada a ver uma com a outra — prefixar de novo criaria `wa:crisp:…` e
 * diria, na tabela, que aquela mensagem veio do WhatsApp.
 */
function chaveDaMensagem(id?: string) {
  const bruto = String(id ?? "").trim();
  if (!bruto) return undefined;
  return (/^[a-z]+:/.test(bruto) ? bruto : `wa:${bruto}`).slice(0, 190);
}

export async function POST(request: Request) {
  const { usuario, demonstracao } = await autenticar(request);
  if (!usuario && !demonstracao) return semSessao(request);
  if (!usuario) return responder(request, { erro: "Entre na aplicação para guardar a conversa." }, 401);

  const prisma = getPrisma();
  if (!prisma) return responder(request, { erro: "Sem banco configurado." }, 503);

  /* O papel no módulo das conversas, com a exceção por pessoa se houver. */
  const excecao = await prisma.userModuleRole.findUnique({
    where: { userId_module: { userId: usuario.id, module: "conversas" } },
    select: { role: true },
  });
  if ((excecao?.role ?? usuario.papel) === "LEITURA") {
    return responder(request, { erro: "Seu acesso às conversas é somente leitura — não dá para guardar." }, 403);
  }

  const entrada = (await request.json().catch(() => ({}))) as {
    contato?: { nome?: string; telefone?: string };
    mensagens?: MensagemDoPainel[];
    protocolo?: string;
  };

  const telefone = somenteDigitosDoTelefone(entrada.contato?.telefone);
  const nome = String(entrada.contato?.nome ?? "").trim().slice(0, 120);
  if (!telefone && !nome) return responder(request, { erro: "Não sei de quem é esta conversa — abra a conversa no WhatsApp ou no Crisp e tente de novo." }, 400);

  const lados: Lado[] = ["cliente", "nos"];
  const mensagens: MensagemRecebida[] = (Array.isArray(entrada.mensagens) ? entrada.mensagens : [])
    .slice(-MAXIMO_DE_MENSAGENS)
    .filter((m) => typeof m?.texto === "string" && m.texto.trim() && lados.includes(m.de as Lado))
    .map((m) => ({
      chave: chaveDaMensagem(m.id),
      de: m.de as Lado,
      autor: m.autor ? String(m.autor).slice(0, 120) : null,
      texto: String(m.texto),
      em: instanteDoCarimbo(m.carimbo),
    }));
  if (mensagens.length === 0) return responder(request, { erro: "Nenhuma mensagem para guardar." }, 400);

  /* A conversa do mesmo telefone recebe as mensagens; o nome só decide quando não há número. */
  const existentes = await candidatas(prisma, telefone, telefone ? "" : nome);
  const destino = existentes[0]?.id ?? "nova";

  const protocolo = String(entrada.protocolo ?? "").trim();
  const caso = protocolo ? await prisma.case.findUnique({ where: { protocol: protocolo }, select: { id: true } }) : null;

  try {
    const r = await gravarMensagens(prisma, {
      destino,
      telefone,
      contatoNome: nome,
      origem: "extensao",
      mensagens,
      vinculo: { caseId: caso?.id ?? null },
      autor: usuario.nome,
    });
    const origem = new URL(request.url).origin;
    return responder(request, { ok: true, ...r, nova: destino === "nova", url: `${origem}/conversas?id=${encodeURIComponent(r.id)}` });
  } catch (erro) {
    console.error("[extensao/guardar-conversa]", erro);
    return responder(request, { erro: "O banco não aceitou a gravação agora. Tente de novo em instantes." }, 500);
  }
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
