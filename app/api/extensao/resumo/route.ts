import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { getApiCases } from "@/lib/api/source";
import { loadWorkspace } from "@/lib/actions/workspace";

import {
  buildNotifications,
  defaultPrefs,
} from "@/lib/services/notifications.service";

import {
  displayBand,
  getRange,
  getReputation,
  getReputationTrend,
  hasRA1000,
  inRange,
} from "@/lib/services/reputation.service";

import { isOpen } from "@/lib/services/case.service";

import { getPrisma } from "@/lib/prisma";
import { NpsResponseView } from "@/lib/models/nps";
import { summarize } from "@/lib/services/nps.service";

/**
 * O NPS do mês corrido, para o popup.
 *
 * Consulta o Prisma direto pelo mesmo motivo de `contexto/route.ts`: a
 * server action lê a sessão por `next/headers`, e a extensão manda o
 * token no cabeçalho.
 *
 * **A conta não é refeita aqui.** `summarize` é a mesma função da tela
 * do `/nps`, e recebe só os campos de que precisa — nota, status e as
 * duas datas do SLA. Recalcular o NPS por fora seria a segunda conta em
 * paralelo, que é como duas telas passam a mostrar números diferentes.
 */
async function resumoDoNps(desde: Date) {

  const prisma = getPrisma();

  if (!prisma) return null;

  const linhas = await prisma.npsResponse.findMany({
    where: { respondedAt: { gte: desde } },
    select: {
      score: true,
      status: true,
      firstContactAt: true,
      firstContactDueAt: true,
    },
  });

  const vistas = linhas.map(
    (r) =>
      ({
        score: r.score,
        status: r.status,
        firstContactAt:
          r.firstContactAt?.toISOString(),
        firstContactDueAt:
          r.firstContactDueAt.toISOString(),
      }) as NpsResponseView
  );

  const s = summarize(vistas);

  return {
    nota: s.score,
    media: s.media,
    total: s.total,
    promotores: s.promotores,
    passivos: s.passivos,
    detratores: s.detratores,
    abertos: s.abertos,
    estourados: s.estourados,
    desde: desde.toISOString().slice(0, 10),
  };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O resumo que a extensão mostra no ícone e no popup.
 *
 * Reaproveita `buildNotifications()` inteiro — a mesma função que o
 * sino da aplicação usa. `EXTENSAO.md` registra que ela hoje só roda
 * quando alguém abre a tela; aqui ela passa a rodar quando o navegador
 * pergunta, de meia em meia hora, sem ninguém abrir nada.
 *
 * **Isto não substitui a Peça B.** O alarme da extensão só dispara com
 * o navegador aberto. O resumo que chega de manhã sem depender disso
 * continua precisando do cron da Vercel.
 */
export async function GET(request: Request) {

  const { usuario, demonstracao } =
    await autenticar(request);

  if (!usuario && !demonstracao) {
    return semSessao(request);
  }

  const [casos, workspace] = await Promise.all([
    getApiCases("all"),
    loadWorkspace(),
  ]);

  const alertas = buildNotifications(
    casos,
    workspace.agenda,
    defaultPrefs,
    // Sem dono: quem abre a extensão quer o retrato da operação, e o
    // nome da sessão nem sempre é igual ao nome usado em "responsável".
    undefined,
    workspace.movements,
    []
  );

  /** Nota vigente de 6 meses — o recorte que o portal publica. */
  const janela = getRange("6m", "vigente");

  const doPeriodo = casos.filter(
    (item) =>
      item.source === "Reclame Aqui" &&
      inRange(item, janela.start, janela.end)
  );

  const reputacao = getReputation(doPeriodo);
  const faixa = displayBand(reputacao);

  /**
   * Tendência: os doze meses fechados, do mais antigo ao mais recente.
   *
   * Vem de `getReputationTrend`, a mesma função do gráfico de
   * `/reclame-aqui/analytics`. Duas contas de tendência em paralelo já
   * divergiram uma vez nesta base — a do gráfico e a da nota — e o
   * sintoma foi um número plausível e errado.
   */
  const tendencia = getReputationTrend(
    casos.filter(
      (item) => item.source === "Reclame Aqui"
    )
  ).slice(-12);

  const nps = await resumoDoNps(
    new Date(Date.now() - 30 * 86400000)
  );

  const origem = new URL(request.url).origin;

  return responder(request, {
    usuario: usuario
      ? { nome: usuario.nome, papel: usuario.papel }
      : null,

    demonstracao,

    aplicacao: origem,

    reputacao: {
      nota: reputacao.raScore,
      faixa: faixa.label,
      ra1000: hasRA1000(reputacao),
      indisponivel: reputacao.scoreUnavailable,
      inicio: janela.start,
      fim: janela.end,
    },

    tendencia: tendencia.map((mes) => ({
      rotulo: mes.label,
      nota: mes.score,
      recebidas: mes.received,
    })),

    nps,

    contagens: {
      abertos: casos.filter(isOpen).length,
      semResposta: casos.filter(
        (item) => item.status === "Novo"
      ).length,
      replicas: casos.filter(
        (item) =>
          item.status === "Aguardando nossa réplica"
      ).length,
      risco: casos.filter((item) => item.churnRisk).length,
    },

    alertas: alertas.map((item) => ({
      id: item.id,
      tom: item.tone,
      titulo: item.title,
      detalhe: item.detail,
      quantidade: item.count,
      url: `${origem}${item.href}`,
    })),
  });
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
