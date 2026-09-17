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
  diaNaOperacao,
  displayBand,
  getRange,
  getReputation,
  getReputationTrend,
  hasRA1000,
  hojeNaOperacao,
  inRange,
} from "@/lib/services/reputation.service";

import { isOpen } from "@/lib/services/case.service";

import { getPrisma } from "@/lib/prisma";
import { conquistasDoDia, oQueMoveANota } from "@/lib/models/motivacaoDoDia";
import { NpsResponseView } from "@/lib/models/nps";
import { summarize } from "@/lib/services/nps.service";
import { provedorDeIA } from "@/lib/services/ia.service";
import { slaStatus } from "@/lib/services/sla.service";

/**
 * Os atalhos de Ferramentas e Acessos, para o popup.
 *
 * Só os ativos e com endereço — o que está "sem endereço" na página não
 * tem para onde levar. O caminho da própria plataforma ("/relatorio")
 * sai com o endereço dela na frente, porque o popup abre em aba nova.
 * Sem a tabela (servidor com o cliente do banco antigo), o popup só não
 * mostra o bloco.
 */
async function atalhosDoPopup(origem: string) {
  const prisma = getPrisma();
  if (!prisma) return [];
  try {
    const linhas = await prisma.atalho.findMany({
      where: { ativo: true, NOT: { url: "" } },
      orderBy: [{ ordem: "asc" }, { nome: "asc" }],
      select: { chave: true, nome: true, url: true, grupo: true },
    });
    return linhas
      .filter((a) => a.url.startsWith("/") || /^https?:\/\//i.test(a.url))
      .map((a) => ({ chave: a.chave, nome: a.nome, grupo: a.grupo, url: a.url.startsWith("/") ? `${origem}${a.url}` : a.url }));
  } catch (erro) {
    console.error("[extensao/resumo] atalhos", erro);
    return [];
  }
}

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
    desde: diaNaOperacao(desde),
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
/**
 * O "Meu dia" de bolso (Fase 8.4).
 *
 * As mesmas duas perguntas da tela de entrada, no tamanho do popup:
 * quanto da rotina de hoje já foi marcado (por esta pessoa, neste
 * dia) e quantos prazos vencem hoje ou já estouraram. O número do
 * ícone sai daqui — é o que está estourando, não um contador de
 * avisos.
 */
async function meuDiaDeBolso(
  casos: Awaited<ReturnType<typeof getApiCases>>,
  workspace: Awaited<ReturnType<typeof loadWorkspace>>,
  userId: string | null
) {
  const prisma = getPrisma();
  const hoje = hojeNaOperacao();

  /* A rotina do dia: as atividades de hoje e o que esta pessoa já marcou. */
  let rotina = { total: 0, feitas: 0 };

  if (prisma) {
    try {
      const diaDaSemana = new Date(`${hoje}T12:00:00Z`).getUTCDay();
      const atividades = await prisma.atividadeDaRotina.findMany({
        where: { ativa: true },
        select: { id: true, frequencia: true, diasDaSemana: true },
      });
      const doDia = atividades.filter(
        (a) =>
          a.frequencia === "diaria" ||
          (a.diasDaSemana ?? []).includes(diaDaSemana)
      );
      const feitas = userId
        ? await prisma.marcaDaRotina.count({
            where: { userId, dia: hoje, atividadeId: { in: doDia.map((a) => a.id) } },
          })
        : 0;
      rotina = { total: doDia.length, feitas };
    } catch {
      /* Sem rotina cadastrada o popup mostra os prazos do mesmo jeito. */
    }
  }

  /* Os prazos: o que já estourou e o que vence ainda hoje. */
  let estourados = 0;
  let vencemHoje = 0;

  for (const caso of casos) {
    if (!isOpen(caso)) continue;
    const sla = slaStatus(caso, workspace.slaRules, { expediente: workspace.expediente });
    if (sla.situation === "estourado") estourados += 1;
    else if (sla.prazo && diaNaOperacao(sla.prazo) === hoje) vencemHoje += 1;
  }

  /*
    O NPS entra na mesma conta: o ciclo tem prazo de 1º contato por
    segmento, e quem abre o popup quer saber o que está atrasado — não
    o que está atrasado em um canal só.
  */
  if (prisma) {
    try {
      const ciclos = await prisma.npsResponse.findMany({
        where: { firstContactAt: null, closedAt: null },
        select: { firstContactDueAt: true },
      });
      const agora = Date.now();
      for (const c of ciclos) {
        if (c.firstContactDueAt.getTime() < agora) estourados += 1;
        else if (diaNaOperacao(c.firstContactDueAt) === hoje) vencemHoje += 1;
      }
    } catch {
      /* Sem NPS, os prazos são só os dos casos. */
    }
  }

  /*
    O que move a nota e o que já deu certo — as mesmas contas do topo do
    Meu dia, para o popup devolver alguma coisa a quem o abre, e não só
    cobrar. Os detratores revertidos vêm do banco: aqui não há a lista de
    NPS da tela, só o que mudou hoje importa.
  */
  let revertidosHoje: NpsResponseView[] = [];
  if (prisma) {
    try {
      const linhas = await prisma.npsResponse.findMany({
        where: { score: { lte: 6 }, postContactAt: { gte: new Date(Date.now() - 36 * 3_600_000) } },
        select: { id: true, score: true, postContactAt: true, resolvedAfter: true, moodAfter: true },
      });
      revertidosHoje = linhas.map((l) => ({
        id: l.id,
        score: l.score,
        postContactAt: l.postContactAt?.toISOString(),
        resolvedAfter: l.resolvedAfter ?? undefined,
        moodAfter: l.moodAfter ?? undefined,
      })) as NpsResponseView[];
    } catch {
      /* Sem NPS, as conquistas são só as do Reclame Aqui. */
    }
  }

  const moveANota = oQueMoveANota(casos).map((a) => ({ titulo: a.titulo, efeito: a.efeito, notaAntes: a.notaAntes, notaDepois: a.notaDepois, href: a.href }));
  const conquistas = conquistasDoDia({ casos, nps: revertidosHoje, prazosEstourados: estourados }).map((c) => ({ titulo: c.titulo, detalhe: c.detalhe, href: c.href }));

  return { dia: hoje, rotina, prazos: { estourados, vencemHoje }, moveANota, conquistas };
}

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
    [],
    workspace.expediente
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

  const atalhos = await atalhosDoPopup(origem);

  const meuDia = await meuDiaDeBolso(casos, workspace, usuario?.id ?? null).catch((erro) => {
    console.error("[extensao/resumo] meu dia", erro);
    return null;
  });

  return responder(request, {
    usuario: usuario
      ? { nome: usuario.nome, papel: usuario.papel }
      : null,

    demonstracao,

    aplicacao: origem,

    /**
     * Qual IA está ligada **nesta** instalação.
     *
     * O popup e o painel mostram isso porque a resposta muda por
     * ambiente: a chave pode estar no `.env` local e faltar na Vercel,
     * e o sintoma disso era o botão de resumir não fazer nada em
     * produção enquanto funcionava na máquina de quem programou.
     */
    ia: {
      disponivel: Boolean(provedorDeIA()),
      provedor: provedorDeIA(),
    },

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

    /** Ferramentas e Acessos: os mesmos atalhos da página, só os com endereço. */
    atalhos,

    /** O "Meu dia" de bolso: rotina marcada e prazos de hoje (Fase 8.4). */
    meuDia,

    /**
     * Os quatro números que o painel mostra — e que agora abrem lista.
     *
     * Cada um tem um recorte de mesmo nome em `/api/extensao/fila`, e a
     * conta é a mesma dos dois lados: o número que se clica e a lista
     * que abre têm de ter o mesmo tamanho, senão o painel ensina a
     * desconfiar dele mesmo.
     *
     * `risco` passou a exigir o caso estar **aberto**. Contava também
     * os encerrados, e caso encerrado em risco de churn não é trabalho
     * de ninguém hoje — era um número que só crescia.
     */
    contagens: {
      abertos: casos.filter(isOpen).length,
      semResposta: casos.filter(
        (item) => item.status === "Novo"
      ).length,
      replicas: casos.filter(
        (item) =>
          item.status === "Aguardando nossa réplica"
      ).length,
      risco: casos.filter(
        (item) => item.churnRisk && isOpen(item)
      ).length,
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
