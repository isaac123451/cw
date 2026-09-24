import { autenticar, responder, responderPreVoo, semSessao } from "@/lib/api/extensao";
import { getPrisma } from "@/lib/prisma";
import { trilhaDoCaso } from "@/lib/models/trilha";
import { fetchCasesByProtocols } from "@/lib/services/case.repository";
import { slaStatus } from "@/lib/services/sla.service";
import { lerExpediente, lerRegrasDePrazo } from "@/lib/services/operacao.service";
import { regrasQueValem } from "@/lib/models/meuDia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CODIGO = /^[A-Za-z0-9_-]{16}$/;
const TETO = 200;

/**
 * O selo de cada reclamação na lista da área da empresa.
 *
 * A extensão manda os códigos que a lista mostra; volta, para cada um que
 * já está no CW, o que cabe num selo: prioridade, a situação do prazo e o
 * passo da vez — e o endereço da ficha, para abrir em nova guia. O que
 * não volta é reclamação que ainda não está no CW. Só leitura.
 */
export async function POST(request: Request) {
  const { usuario, demonstracao } = await autenticar(request);
  if (!usuario && !demonstracao) return semSessao(request);

  let corpo: { codigos?: unknown } = {};
  try {
    corpo = (await request.json()) as { codigos?: unknown };
  } catch {
    return responder(request, { erro: "Corpo inválido." }, 400);
  }

  const codigos = [
    ...new Set((Array.isArray(corpo.codigos) ? corpo.codigos : []).map((c) => String(c ?? "").trim()).filter((c) => CODIGO.test(c))),
  ].slice(0, TETO);

  const prisma = getPrisma();
  if (!prisma || codigos.length === 0) return responder(request, { casos: {} });

  try {
    const [casos, regras, expediente] = await Promise.all([
      fetchCasesByProtocols(prisma, codigos.map((c) => `RA-${c}`)),
      lerRegrasDePrazo(prisma),
      lerExpediente(prisma),
    ]);
    const agora = new Date();
    /* Sem regra cadastrada, valem os prazos da documentação — como no Meu dia. */
    const valem = regrasQueValem(regras);
    const origem = new URL(request.url).origin;

    const porCodigo: Record<string, unknown> = {};
    for (const caso of casos) {
      const sla = slaStatus(caso, valem, { expediente, agora });
      const passo = trilhaDoCaso(caso, { agora }).find((p) => p.estado === "atual") ?? null;
      porCodigo[caso.protocol.replace(/^RA-/, "")] = {
        protocolo: caso.protocol,
        url: `${origem}/reclame-aqui/${caso.id}`,
        prioridade: caso.priority,
        triada: Boolean(caso.triadaEm),
        sla: { situacao: sla.situation, rotulo: sla.label },
        passo: passo ? passo.curto : null,
      };
    }

    return responder(request, { casos: porCodigo });
  } catch (erro) {
    console.error("[extensao/ra-lista]", erro);
    return responder(request, { casos: {}, erro: "Não deu para conferir a lista no CW agora." });
  }
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
