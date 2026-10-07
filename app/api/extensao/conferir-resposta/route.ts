import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { getPrisma } from "@/lib/prisma";
import { loadWorkspace } from "@/lib/actions/workspace";

import { fetchCaseByPortalCode, fetchCaseByProtocol } from "@/lib/services/case.repository";
import { dadosSensiveis, resumoDosAchados, semelhanca } from "@/lib/services/lgpd";
import { slaStatus } from "@/lib/services/sla.service";
import { INICIO_DA_TRILHA, trilhaDoCaso } from "@/lib/models/trilha";
import { analisarResposta } from "@/lib/models/analistaDeRespostas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Só o começo de cada trecho achado: o texto inteiro não precisa voltar. */
const TETO = 20_000;

/**
 * A nota do analista (0 a 100) e o que melhorar (1.112): "aquele score tem
 * que aparecer na hora que eu tiver criando a mensagem no Reclame Aqui".
 * Dado pessoal e texto repetido vão em campos próprios; a nota já os pesa.
 */
function doAnalista(texto: string, caso: { customer: string; createdAt: string; validadoEm?: string } | null) {
  const a = analisarResposta(texto, {
    nome: caso?.customer,
    validado: caso ? (caso.createdAt < INICIO_DA_TRILHA ? undefined : Boolean(caso.validadoEm)) : undefined,
  });
  return { nota: a.nota, analise: a.achados.filter((x) => x.tipo !== "dado-pessoal" && x.tipo !== "parece-macro") };
}

/**
 * A conferência da resposta pública, antes de publicar (Fase 8.3).
 *
 * É a mesma conferência da ficha, chamada de dentro do HugMe e do
 * Reclame Aqui: dado pessoal no texto (CPF com dígito verificador, CNPJ,
 * e-mail, telefone, valor e condição negociada) e o aviso de resposta
 * parecida com outra já publicada — a "regra de ouro" do documento, sem
 * macro pronta.
 *
 * As regras ficam **aqui**, e não dentro da extensão: são as mesmas da
 * tela, e duas cópias divergem no primeiro ajuste. O texto vai e volta;
 * nada é gravado.
 */
export async function POST(request: Request) {

  const { usuario, demonstracao } = await autenticar(request);
  if (!usuario && !demonstracao) return semSessao(request);

  const entrada = (await request.json().catch(() => ({}))) as {
    texto?: string;
    protocolo?: string;
    /** O código de 16 caracteres e o número do "ID:" — a extensão manda os dois desde out/2026. */
    cod?: string;
    numero?: string;
  };

  const texto = String(entrada.texto ?? "").slice(0, TETO);
  const protocolo = String(entrada.protocolo ?? "").trim();
  const cod = String(entrada.cod ?? "").trim();
  const numero = String(entrada.numero ?? "").trim();

  const achados = dadosSensiveis(texto).map((a) => ({
    tipo: a.tipo,
    trecho: a.trecho.slice(0, 60),
    motivo: a.motivo,
  }));

  const prisma = getPrisma();

  /* Sem nenhuma identidade (ou sem banco), a conferência é a do texto — com a nota do analista. */
  if (!prisma || (!protocolo && !cod && !numero)) {
    return responder(request, {
      achados,
      resumo: achados.length > 0 ? resumoDosAchados(dadosSensiveis(texto)) : "",
      repetida: null,
      caso: null,
      ...doAnalista(texto, null),
    });
  }

  /*
    O protocolo do CW é `RA-<COD>`. Até out/2026 a extensão mandava só
    `RA-<número do ID>`, que quase nunca casava: o caso vinha nulo, e a
    resposta já publicada da própria reclamação contava como "repetida".
  */
  const caso =
    (cod || numero ? await fetchCaseByPortalCode(prisma, cod, numero) : null) ??
    (protocolo ? await fetchCaseByProtocol(prisma, protocolo) : null);

  const proprio = caso?.protocol ?? protocolo;

  /* Texto curto não é parecido com nada: só ruído acima de 80 caracteres. */
  let repetida: { protocolo: string; titulo: string; percentual: number } | null = null;

  if (texto.trim().length >= 80) {
    const outras = await prisma.case.findMany({
      where: { ...(proprio ? { protocol: { not: proprio } } : {}), publicResponse: { not: null } },
      select: { protocol: true, title: true, publicResponse: true },
      orderBy: { publishedAt: "desc" },
      take: 400,
    });

    for (const o of outras) {
      const publicada = o.publicResponse ?? "";
      if (!publicada) continue;
      const percentual = semelhanca(texto, publicada);
      if (!repetida || percentual > repetida.percentual) {
        repetida = { protocolo: o.protocol, titulo: o.title, percentual };
      }
    }

    /* Abaixo de 60% é coincidência de vocabulário, não texto repetido. */
    if (repetida && repetida.percentual < 60) repetida = null;
  }

  const workspace = caso ? await loadWorkspace() : null;
  const sla = caso && workspace ? slaStatus(caso, workspace.slaRules, { expediente: workspace.expediente }) : null;
  const passo = caso ? trilhaDoCaso(caso, {}).find((p) => p.estado === "atual") ?? null : null;

  return responder(request, {
    achados,
    resumo: achados.length > 0 ? resumoDosAchados(dadosSensiveis(texto)) : "",
    repetida,

    /*
      O analista (1.94): o que o documento pede além de dado pessoal e texto
      repetido — nome, acolhimento, por onde o cliente segue, convite a
      avaliar, assinatura, tamanho, tom defensivo, "resolvido" sem o cliente
      confirmar. Os dois primeiros já vão acima; aqui vai o resto.
    */
    ...doAnalista(texto, caso ? { customer: caso.customer, createdAt: caso.createdAt, validadoEm: caso.validadoEm } : null),

    /** O passo e o prazo da reclamação aberta, para o aviso dizer onde ela está. */
    caso: caso
      ? {
          protocolo: caso.protocol,
          status: caso.status,
          prazo: sla ? { situacao: sla.situation, rotulo: sla.label } : null,
          passo: passo ? { numero: passo.numero, titulo: passo.titulo } : null,
        }
      : null,
  });
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
