import { autenticar, responder, responderPreVoo, semSessao } from "@/lib/api/extensao";
import { unstable_cache } from "next/cache";

import { CASES_TAG } from "@/lib/actions/tags";
import { fetchCases } from "@/lib/services/case.repository";
import { regrasQueValem } from "@/lib/models/meuDia";
import { getPrisma } from "@/lib/prisma";
import { isSocial } from "@/lib/services/case.service";
import { lerExpediente, lerRegrasDePrazo } from "@/lib/services/operacao.service";
import { slaStatus } from "@/lib/services/sla.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
  A lista com o mesmo cache das telas: 60 s de vida, invalidada por
  etiqueta a cada gravação. A extensão pergunta a cada 5 minutos por
  pessoa; sem cache, cada pergunta era uma leitura inteira da base.
*/
const casosEmCache = unstable_cache(async () => {
  const prisma = getPrisma();
  return prisma ? fetchCases(prisma) : [];
}, ["casos-prazos"], { tags: [CASES_TAG], revalidate: 60 });

/**
 * Os prazos que pedem atenção, para o aviso da extensão (Fase 33, 1.80).
 *
 * "Notificação pela extensão quando um prazo da plataforma está para
 * estourar." A mesma conta do quadro (`slaStatus`, com as regras
 * cadastradas ou, sem elas, os prazos da documentação): volta só o que
 * está em **atenção** (vence hoje ou falta um quarto do prazo) ou já
 * **estourado**. A extensão avisa uma vez por caso a cada mudança — quem
 * decide o barulho é ela, não esta rota. `meu` diz se o caso é de quem
 * pergunta; sem responsável também interessa a todos.
 */
export async function GET(request: Request) {
  const { usuario, demonstracao } = await autenticar(request);
  if (!usuario && !demonstracao) return semSessao(request);

  const prisma = getPrisma();
  if (!prisma) return responder(request, { casos: [] });

  try {
    const [casos, regras, expediente] = await Promise.all([casosEmCache(), lerRegrasDePrazo(prisma), lerExpediente(prisma)]);
    const valem = regrasQueValem(regras);
    const agora = new Date();
    const origem = new URL(request.url).origin;
    const eu = usuario?.nome?.trim().toLowerCase() ?? "";

    const pedindo = casos
      .map((caso) => ({ caso, sla: slaStatus(caso, valem, { expediente, agora }) }))
      .filter(({ sla }) => sla.situation === "atencao" || sla.situation === "estourado")
      .map(({ caso, sla }) => ({
        protocolo: caso.protocol,
        cliente: caso.customer,
        titulo: caso.title,
        situacao: sla.situation,
        rotulo: sla.label,
        prioridade: caso.priority,
        responsavel: caso.owner ?? null,
        meu: Boolean(eu) && (caso.owner ?? "").trim().toLowerCase() === eu,
        url: `${origem}/${isSocial(caso) ? "redes-sociais" : "reclame-aqui"}/${caso.id}`,
      }))
      /* O estourado antes; dentro de cada um, o Urgente antes. */
      .sort((a, b) => (a.situacao === b.situacao ? (a.prioridade === "Urgente" ? -1 : 0) - (b.prioridade === "Urgente" ? -1 : 0) : a.situacao === "estourado" ? -1 : 1))
      .slice(0, 100);

    return responder(request, { casos: pedindo, quadro: `${origem}/reclame-aqui` });
  } catch (erro) {
    console.error("[extensao/prazos]", erro);
    return responder(request, { casos: [], erro: "Não deu para ler os prazos agora." });
  }
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
