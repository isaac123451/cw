"use server";

import * as XLSX from "xlsx";

import type { PrismaClient } from "@prisma/client";

import { requireRole, SemPermissao, tryRole } from "@/lib/auth/guard";
import type { Modulo } from "@/lib/auth/modules";

import { listNpsResponses } from "@/lib/actions/nps";
import { lerMetricas } from "@/lib/actions/metricas";
import { cicloDe, cicloPorId, ciclosAte, type Ciclo } from "@/lib/models/ciclo";
import { fetchCases } from "@/lib/services/case.repository";
import { slaRuleDoBanco } from "@/lib/models/sla";
import { lerExpediente } from "@/lib/services/operacao.service";
import { formatElapsed, hojeNaOperacao, ptBR, RA1000_TARGETS } from "@/lib/services/reputation.service";
import { montarRelatorio, textoDoRelatorio, type DadosDoRelatorio, type GoogleDoRelatorio } from "@/lib/services/relatorio.service";

/**
 * O Relatório de Reputação do ciclo: ler, salvar o que foi enviado e
 * exportar em .xlsx.
 *
 * Os números são sempre montados aqui, no servidor, a partir da base — o
 * que chega da tela ao salvar é só o texto final. Assim o relatório
 * guardado não carrega número que alguém tenha digitado.
 */

/** A reputação que o relatório consolida é a do Reclame Aqui. */
const MODULO: Modulo = "reclame-aqui";

type Falha = { ok: false; erro: string };

export interface CicloNaLista {
  id: string;
  rotulo: string;
  corrente: boolean;
  salvo: boolean;
}

export interface RelatorioLido {
  ok: true;
  dados: DadosDoRelatorio;
  textoGerado: string;
  salvo?: { texto: string; salvoPor: string | null; atualizadoEm: string };
  ciclos: CicloNaLista[];
}

async function montar(prisma: PrismaClient, ciclo: Ciclo) {
  const [cases, nps, google, regras, expediente] = await Promise.all([
    fetchCases(prisma),
    listNpsResponses(),
    prisma.avaliacaoGoogle.findMany({
      select: { id: true, estrelas: true, classificacao: true, publicadaEm: true, respondidaEm: true, notaAtualizada: true, status: true },
    }),
    /* As regras e o expediente: é com eles que o 1º contato vira "no prazo". */
    prisma.slaRule.findMany().then((linhas) => linhas.map(slaRuleDoBanco)),
    lerExpediente(prisma),
  ]);

  const doGoogle: GoogleDoRelatorio[] = google.map((g) => ({
    id: g.id,
    estrelas: g.estrelas,
    classificacao: g.classificacao as GoogleDoRelatorio["classificacao"],
    publicadaEm: g.publicadaEm.toISOString(),
    respondidaEm: g.respondidaEm?.toISOString(),
    notaAtualizada: g.notaAtualizada ?? undefined,
    status: g.status as GoogleDoRelatorio["status"],
  }));

  return montarRelatorio({ cases, nps, google: doGoogle, ciclo, hoje: hojeNaOperacao(), regras, expediente });
}

/** O relatório de um ciclo — o corrente, quando nenhum é pedido. */
export async function lerRelatorio(cicloId?: string): Promise<RelatorioLido | Falha> {

  const ctx = await tryRole("LEITURA", MODULO);
  if (!ctx) return { ok: false, erro: "Sem banco configurado." };

  const hoje = hojeNaOperacao();
  const ciclo = cicloId ? cicloPorId(cicloId) : cicloDe(hoje);
  if (!ciclo) return { ok: false, erro: "Ciclo inválido." };
  if (ciclo.inicio > hoje) return { ok: false, erro: "Esse ciclo ainda não começou." };

  try {
    const [dados, salvos] = await Promise.all([
      montar(ctx.prisma, ciclo),
      ctx.prisma.relatorioDoCiclo.findMany({ select: { ciclo: true, texto: true, salvoPor: true, atualizadoEm: true } }),
    ]);

    const salvo = salvos.find((s) => s.ciclo === ciclo.id);
    const ids = new Set(salvos.map((s) => s.ciclo));

    return {
      ok: true,
      dados,
      textoGerado: textoDoRelatorio(dados),
      salvo: salvo ? { texto: salvo.texto, salvoPor: salvo.salvoPor, atualizadoEm: salvo.atualizadoEm.toISOString() } : undefined,
      ciclos: ciclosAte(hoje, 8).map((c) => ({ id: c.id, rotulo: c.rotulo, corrente: c.id === cicloDe(hoje).id, salvo: ids.has(c.id) })),
    };
  } catch (erro) {
    console.error("[relatorio] ler", erro);
    return { ok: false, erro: "Não deu para montar o relatório agora. Tente de novo em instantes." };
  }
}

/**
 * Guarda o relatório enviado: o texto final e os números daquele dia,
 * montados de novo aqui. Salvar outra vez o mesmo ciclo atualiza.
 */
export async function salvarRelatorio(entrada: { ciclo: string; texto: string }): Promise<{ ok: true; atualizadoEm: string } | Falha> {

  const texto = entrada.texto.trim();
  if (!texto) return { ok: false, erro: "O relatório está vazio." };
  if (texto.length > 20000) return { ok: false, erro: "O texto passou de 20 mil caracteres." };

  const ciclo = cicloPorId(entrada.ciclo);
  if (!ciclo) return { ok: false, erro: "Ciclo inválido." };

  let ctx;
  try {
    ctx = await requireRole("AGENTE", MODULO);
  } catch (erro) {
    return { ok: false, erro: erro instanceof SemPermissao ? erro.message : "Não foi possível confirmar sua sessão. Entre de novo." };
  }
  if (!ctx) return { ok: false, erro: "Sem banco configurado — nada é gravado no modo demonstração." };

  try {
    const dados = await montar(ctx.prisma, ciclo);
    const quem = await ctx.prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } });
    const r = await ctx.prisma.relatorioDoCiclo.upsert({
      where: { ciclo: ciclo.id },
      update: { texto, dados: JSON.parse(JSON.stringify(dados)), salvoPor: quem?.name ?? null },
      create: { ciclo: ciclo.id, texto, dados: JSON.parse(JSON.stringify(dados)), salvoPor: quem?.name ?? null },
      select: { atualizadoEm: true },
    });
    return { ok: true, atualizadoEm: r.atualizadoEm.toISOString() };
  } catch (erro) {
    console.error("[relatorio] salvar", erro);
    return { ok: false, erro: "O banco não aceitou a gravação agora. Tente de novo em instantes." };
  }
}

/** O relatório em .xlsx: os indicadores, os pontos de atenção e as métricas diárias do ciclo. */
export async function exportarRelatorio(cicloId: string): Promise<{ ok: true; arquivo: string; nome: string } | Falha> {

  const lido = await lerRelatorio(cicloId);
  if (!lido.ok) return lido;

  const d = lido.dados;
  const [seis, doze] = d.ra.abas;

  const indicadores = [
    ["Nota de reputação", seis.resumo.raScore, doze.resumo.raScore, "8 (faixa Ótimo)", d.ra.anterior.nota],
    ["Índice de resposta (%)", seis.resumo.responseIndex, doze.resumo.responseIndex, RA1000_TARGETS.resposta, d.ra.anterior.resposta],
    ["Índice de solução (%)", seis.resumo.solutionIndex, doze.resumo.solutionIndex, RA1000_TARGETS.solucao, d.ra.anterior.solucao],
    ["Nota média dos consumidores", seis.resumo.consumerScore, doze.resumo.consumerScore, RA1000_TARGETS.consumidor, d.ra.anterior.consumidor],
    ["Voltariam a fazer negócio (%)", seis.resumo.wouldReturnIndex, doze.resumo.wouldReturnIndex, RA1000_TARGETS["novos-negocios"], d.ra.anterior.voltaria],
    ["Avaliações no período", seis.resumo.evaluated, doze.resumo.evaluated, 50, ""],
    ["Tempo médio de primeira resposta", formatElapsed(seis.resumo.responseMinutes), formatElapsed(doze.resumo.responseMinutes), "", ""],
    ["Selo RA1000", seis.selo ? "sim" : "não", doze.selo ? "sim" : "não", "", d.ra.anterior.selo ? "sim" : "não"],
  ].map(([indicador, a6, a12, meta, antes]) => ({
    Indicador: indicador,
    "6 meses": typeof a6 === "number" ? Number(ptBR(a6, 2).replace(",", ".")) : a6,
    "12 meses": typeof a12 === "number" ? Number(ptBR(a12, 2).replace(",", ".")) : a12,
    "Meta RA1000": meta,
    "6 meses no ciclo anterior": antes,
  }));

  const noCiclo = [
    { Frente: "Reclame Aqui", Número: "Novas", Valor: d.ra.noCiclo.entrantes },
    { Frente: "Reclame Aqui", Número: "Respondidas", Valor: d.ra.noCiclo.respondidas },
    { Frente: "Reclame Aqui", Número: "Avaliadas", Valor: d.ra.noCiclo.avaliadas },
    { Frente: "Reclame Aqui", Número: "Resolvidas", Valor: d.ra.noCiclo.resolvidas },
    { Frente: "Reclame Aqui", Número: "Sem resposta (agora)", Valor: d.ra.abertas.semResposta },
    { Frente: "Reclame Aqui", Número: "Ciclos seguidos com selo (6 meses)", Valor: d.ra.ciclosComSelo },
    { Frente: "NPS", Número: "Respostas", Valor: d.nps.respostas },
    { Frente: "NPS", Número: "NPS", Valor: d.nps.nps ?? "" },
    { Frente: "NPS", Número: "Detratores", Valor: d.nps.detratores },
    { Frente: "NPS", Número: "% detratores contatados", Valor: d.nps.percentualContatados ?? "" },
    { Frente: "NPS", Número: "Ciclos fechados", Valor: d.nps.fechadosNoCiclo },
    { Frente: "Redes Sociais", Número: "Atendimentos", Valor: d.redes.entrantes },
    { Frente: "Redes Sociais", Número: "Resolvidos", Valor: d.redes.resolvidos },
    { Frente: "Google", Número: "Avaliações", Valor: d.google.total },
    { Frente: "Google", Número: "Nota média", Valor: d.google.notaMedia ?? "" },
    { Frente: "Google", Número: "% respondidas", Valor: d.google.percentualRespondidas ?? "" },
    ...([["Reclame Aqui", d.primeiroContato.ra], ["Redes Sociais", d.primeiroContato.redes], ["NPS", d.primeiroContato.nps]] as const).flatMap(([frente, ind]) => [
      { Frente: frente, Número: "1º contato: mediana (horas úteis)", Valor: ind.medianaMin !== null ? Math.round((ind.medianaMin / 60) * 10) / 10 : "" },
      { Frente: frente, Número: "1º contato: % no prazo", Valor: ind.percentualNoPrazo ?? "" },
      { Frente: frente, Número: "1º contato: contatados / medidos", Valor: `${ind.contatados}/${ind.total}` },
    ]),
  ];

  const metricas = (await lerMetricas(d.ciclo.inicio, d.ateDia)).map((l) => ({
    Dia: l.dia.split("-").reverse().join("/"),
    Nota: l.notaReputacao,
    Respondidas: l.respondidas,
    "Não respondidas": l.naoRespondidas,
    Consumidor: l.notaConsumidor,
    "Voltariam (%)": l.voltariam,
    "Resolvidas (%)": l.resolvidasPct,
    "Tempo médio (h)": l.tempoMedioHoras,
    "Resolvidas no ciclo": l.resolvidasCiclo ?? "",
    "Ciclos com selo": l.ciclosComSelo ?? "",
  }));

  const book = XLSX.utils.book_new();
  const folha = (linhas: Record<string, unknown>[], nome: string) => {
    const s = XLSX.utils.json_to_sheet(linhas.length ? linhas : [{ Vazio: "" }]);
    s["!cols"] = Object.keys(linhas[0] ?? { Vazio: "" }).map((k) => ({ wch: Math.max(k.length + 2, 14) }));
    XLSX.utils.book_append_sheet(book, s, nome);
  };
  folha(indicadores, "Indicadores");
  folha(noCiclo, "No ciclo");
  folha(d.pontos.map((p) => ({ "Ponto de atenção": p.texto })), "Pontos de atenção");
  folha(metricas, "Métricas diárias");
  folha([{ Relatório: lido.salvo?.texto ?? lido.textoGerado }], "Texto");

  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return { ok: true, arquivo: buffer.toString("base64"), nome: `relatorio-reputacao-${d.ciclo.id}.xlsx` };
}
