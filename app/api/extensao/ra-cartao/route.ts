import { autenticar, responder, responderPreVoo, semSessao } from "@/lib/api/extensao";
import { getPrisma } from "@/lib/prisma";
import { respondida } from "@/lib/models/case";
import { digitosDoDocumento } from "@/lib/models/establishment";
import { resumoDaReclamacao } from "@/lib/models/resumoDaReclamacao";
import { trilhaDoCaso } from "@/lib/models/trilha";
import { fetchCaseByPortalCode } from "@/lib/services/case.repository";
import { slaStatus } from "@/lib/services/sla.service";
import { lerExpediente, lerRegrasDePrazo } from "@/lib/services/operacao.service";
import { regrasQueValem } from "@/lib/models/meuDia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIA_MS = 86_400_000;

function limpo(valor: unknown, maximo: number) {
  return String(valor ?? "").trim().slice(0, maximo);
}

/**
 * O cartão da reclamação aberta na área da empresa do Reclame Aqui.
 *
 * O Isaac: "dentro da área da empresa, quero algumas iniciativas que a
 * extensão possa fazer — um popup resumindo a reclamação, fácil acesso
 * para a reclamação em nova guia". A extensão manda o que a página
 * mostra (código, título e relato); aqui volta:
 *
 * - o **resumo** do relato, sem IA (`resumoDaReclamacao`) — vale até para
 *   a reclamação que ainda não está no CW;
 * - o **caso no CW**, quando existe: prioridade, prazo, passo da vez,
 *   responsável, reincidência pelo CPF/CNPJ, se o cliente já validou e o
 *   rascunho da resposta — e os endereços para abrir em nova guia.
 *
 * Só leitura: nada é gravado, e o texto do relato não é guardado.
 */
export async function POST(request: Request) {
  const { usuario, demonstracao } = await autenticar(request);
  if (!usuario && !demonstracao) return semSessao(request);

  let corpo: Record<string, unknown> = {};
  try {
    corpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return responder(request, { erro: "Corpo inválido." }, 400);
  }

  const cod = limpo(corpo.cod, 16);
  const id = limpo(corpo.id, 12);
  const titulo = limpo(corpo.titulo, 300);
  const relato = limpo(corpo.relato, 12_000);

  const resumo = resumoDaReclamacao(titulo, relato);

  const prisma = getPrisma();
  if (!prisma || (!cod && !id)) return responder(request, { resumo, caso: null });

  try {
    const caso = await fetchCaseByPortalCode(prisma, cod, id);
    if (!caso) return responder(request, { resumo, caso: null });

    const origem = new URL(request.url).origin;

    /* Reincidência: outras reclamações do mesmo CPF/CNPJ nos 90 dias antes desta. */
    const documento = digitosDoDocumento(caso.document);
    const referencia = Date.parse(`${caso.createdAt.slice(0, 10)}T12:00:00Z`);

    /* Tudo o que falta de uma vez: regras e expediente têm um minuto de memória. */
    const [regras, expediente, reincidencia, conta] = await Promise.all([
      lerRegrasDePrazo(prisma),
      lerExpediente(prisma),
      documento
        ? prisma.case.count({
            where: {
              document: documento,
              protocol: { not: caso.protocol },
              publishedAt: { gte: new Date(referencia - 90 * DIA_MS), lte: new Date(referencia) },
            },
          })
        : Promise.resolve(0),
      caso.establishmentId
        ? prisma.establishment.findUnique({ where: { id: caso.establishmentId }, select: { name: true, plan: true, status: true } })
        : Promise.resolve(null),
    ]);

    /* Sem regra cadastrada, valem os prazos da documentação — como no Meu dia. */
    const sla = slaStatus(caso, regrasQueValem(regras), { expediente });
    const passo = trilhaDoCaso(caso, { agora: new Date() }).find((p) => p.estado === "atual") ?? null;

    const base = `${origem}/reclame-aqui/${caso.id}`;

    return responder(request, {
      resumo,
      caso: {
        protocolo: caso.protocol,
        url: base,
        urlDossie: `${base}/dossie`,
        urlPortal: caso.raUrl ?? null,
        status: caso.status,
        prioridade: caso.priority,
        triada: Boolean(caso.triadaEm),
        sla: {
          situacao: sla.situation,
          /* Sem regra cadastrada, o prazo é o da documentação — o cartão diz, porque a ficha mostra "Sem prazo" até as regras serem cadastradas. */
          rotulo: regras.some((r) => r.active) ? sla.label : `${sla.label} (prazo da documentação)`,
        },
        passo: passo ? { numero: passo.numero, titulo: passo.titulo, detalhe: passo.detalhe ?? "" } : null,
        responsavel: caso.owner ?? null,
        respondida: respondida(caso),
        validado: Boolean(caso.validadoEm),
        replica: /aguardando nossa r[ée]plica/i.test(caso.status),
        avaliado: Boolean(caso.evaluated),
        nota: caso.evaluated ? (caso.score ?? null) : null,
        reincidencia,
        estabelecimento: conta ? { nome: conta.name, plano: conta.plan || null, situacao: conta.status } : null,
        rascunho: (caso.draftResponse ?? "").trim() || null,
      },
    });
  } catch (erro) {
    console.error("[extensao/ra-cartao]", erro);
    return responder(request, { resumo, caso: null, erro: "Não deu para ler o caso no CW agora." });
  }
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
