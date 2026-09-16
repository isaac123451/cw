import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { getPrisma } from "@/lib/prisma";

import { gravarContato, problemaDoContato } from "@/lib/services/tratativa.service";
import { tipoDeContato } from "@/lib/models/tratativa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Registrar a tratativa pela extensão — os passos do documento.
 *
 * "Fiz o 1º contato", "tentei e não atendeu", "mandei uma atualização",
 * "pedi a avaliação", "o cliente confirmou". São os mesmos cinco tipos
 * da ficha, gravados pelo mesmo caminho (`gravarContato`), então o
 * relógio do caso, a trilha e a cadência de tentativas mudam junto — não
 * há uma segunda contabilidade dentro da extensão.
 *
 * **Só no clique, e com o caso na frente.** O painel manda o protocolo
 * que está mostrando; nada é registrado por abrir conversa.
 */
export async function POST(request: Request) {

  const { usuario, demonstracao } = await autenticar(request);

  if (!usuario && !demonstracao) return semSessao(request);

  if (!usuario) {
    return responder(request, { erro: "Entre na aplicação para registrar a tratativa." }, 401);
  }

  if (usuario.papel === "LEITURA") {
    return responder(request, { erro: "Seu acesso é somente leitura — não dá para registrar." }, 403);
  }

  const prisma = getPrisma();
  if (!prisma) return responder(request, { erro: "Sem banco configurado." }, 503);

  const entrada = (await request.json().catch(() => ({}))) as {
    protocolo?: string;
    tipo?: string;
    canal?: string;
    nota?: string;
  };

  const protocolo = String(entrada.protocolo ?? "").trim();
  if (!protocolo) return responder(request, { erro: "Faltou o protocolo." }, 400);

  const tipo = tipoDeContato(entrada.tipo);
  if (!tipo) return responder(request, { erro: "Não sei que passo é esse." }, 400);

  const contato = {
    tipo: tipo.id,
    canal: String(entrada.canal ?? "WhatsApp").trim().slice(0, 40) || "WhatsApp",
    resultado: tipo.resultadoPadrao,
    nota: String(entrada.nota ?? "").slice(0, 2000) || undefined,
  };

  const problema = problemaDoContato(contato);
  if (problema) return responder(request, { erro: problema }, 400);

  const caso = await prisma.case.findUnique({ where: { protocol: protocolo }, select: { id: true } });
  if (!caso) return responder(request, { erro: `Não achei o caso ${protocolo}.` }, 404);

  try {
    const feito = await gravarContato(prisma, {
      caseId: caso.id,
      entrada: contato,
      autorId: usuario.id,
      autorNome: usuario.nome,
    });

    return responder(request, {
      ok: true,
      protocolo,
      tipo: tipo.id,
      rotulo: tipo.rotulo,
      resumo: feito.resumo,
    });
  } catch (erro) {
    console.error("[extensao/tratativa]", erro);
    return responder(request, { erro: "O banco não aceitou o registro agora. Tente de novo em instantes." }, 500);
  }
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
