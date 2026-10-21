"use client";

import Link from "next/link";

import { CheckCircle2, CircleAlert, OctagonAlert } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";
import { abrirJanelaDeCasos } from "@/components/shared/JanelaDeCasos";

import type { Case } from "@/lib/models/case";
import type { CicloDoPlano, PlanoDoMes, ResultadoDoMes } from "@/lib/models/planoDeAcao";
import { ROTULO_DA_META } from "@/lib/models/planoDeAcao";
import { nomeDoMes, somarMeses, ultimoDia } from "@/lib/models/previsaoDeReclamacoes";
import { notaExata } from "@/lib/models/indiceRA";
import { RA1000_TARGETS } from "@/lib/services/reputation.service";

import { br, efeito, inteiro, nota, pct, plural } from "./formato";
import { pluralDe } from "@/lib/plural";

export const STATUS = {
  "sem-meta": { rotulo: "sem meta", classe: "bg-zinc-100 text-zinc-600 ring-zinc-200", Icone: CircleAlert },
  "no-caminho": { rotulo: "no caminho", classe: "bg-emerald-50 text-emerald-700 ring-emerald-200", Icone: CheckCircle2 },
  "precisa-de-acao": { rotulo: "precisa de ação", classe: "bg-amber-50 text-amber-800 ring-amber-200", Icone: CircleAlert },
  "fora-de-alcance": { rotulo: "fora de alcance", classe: "bg-rose-50 text-rose-700 ring-rose-200", Icone: OctagonAlert },
} as const;

function Indicador({ rotulo, valor, meta, ok }: { rotulo: string; valor: string; meta?: string; ok?: boolean }) {
  return (
    <div className="rounded-xl bg-zinc-50 px-3 py-2 ring-1 ring-inset ring-zinc-200">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{rotulo}</p>
      <p className="mt-0.5 flex items-center gap-1 text-lg font-semibold tabular-nums text-zinc-900">
        {valor}
        {ok === true && <CheckCircle2 size={14} className="text-emerald-600" aria-label="bate a meta" />}
        {ok === false && <CircleAlert size={14} className="text-amber-600" aria-label="abaixo da meta" />}
      </p>
      {meta && <p className="text-xs tabular-nums text-zinc-500">meta {meta}</p>}
    </div>
  );
}

function Acao({ titulo, children, ok }: { titulo: string; children: React.ReactNode; ok?: boolean }) {
  return (
    <li className="flex gap-2.5">
      {ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" /> : <CircleAlert size={16} className="mt-0.5 shrink-0 text-amber-600" />}
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-900">{titulo}</p>
        <p className="text-sm text-zinc-600">{children}</p>
      </div>
    </li>
  );
}

/** O mês do plano: a projeção, o que fazer e os ciclos. */
export default function MesDoPlano({ plano, erroDaProjecao, hoje }: { plano: PlanoDoMes; erroDaProjecao: number | null; hoje: string }) {
  const p = plano.projecao.resumo;
  const m = plano.meta;
  const fim = br(ultimoDia(plano.mes));
  const s = STATUS[plano.status];
  const atual = hoje.slice(0, 7) === plano.mes;
  const v = plano.reputacao.valor;

  return (
    <SurfaceCard
      title={`${nomeDoMes(plano.mes, true).replace(/^./, (c) => c.toUpperCase())}`}
      description={`A nota que o portal mostra em ${nomeDoMes(somarMeses(plano.mes, 1))}: a janela de ${br(plano.janela.inicio)} a ${br(plano.janela.fim)}, no último dia do mês.`}
      action={
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${s.classe}`}>
          <s.Icone size={13} /> {s.rotulo}
        </span>
      }
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Se continuar como está{erroDaProjecao !== null ? ` · a projeção errou ${nota(erroDaProjecao)} em média nos últimos 6 meses` : ""}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Indicador rotulo="Nota" valor={notaExata(p.raScoreExato)} meta={m?.nota != null ? nota(m.nota) : undefined} ok={m?.nota != null ? p.raScoreExato >= m.nota : undefined} />
        <Indicador rotulo="Respondidas" valor={pct(p.responseIndex)} meta={m?.resposta != null ? pct(m.resposta) : undefined} ok={m?.resposta != null ? p.responseIndex >= m.resposta : undefined} />
        <Indicador rotulo="Consumidor" valor={nota(p.consumerScore)} meta={m?.consumidor != null ? nota(m.consumidor) : undefined} ok={m?.consumidor != null ? p.consumerScore >= m.consumidor : undefined} />
        <Indicador rotulo="Solução" valor={pct(p.solutionIndex)} meta={m?.solucao != null ? pct(m.solucao) : undefined} ok={m?.solucao != null ? p.solutionIndex >= m.solucao : undefined} />
        <Indicador rotulo="Voltaria" valor={pct(p.wouldReturnIndex)} meta={m?.voltaria != null ? pct(m.voltaria) : undefined} ok={m?.voltaria != null ? p.wouldReturnIndex >= m.voltaria : undefined} />
        <Indicador rotulo="Avaliações" valor={inteiro(plano.projecao.raw.evaluated)} meta={m?.avaliacoes != null ? inteiro(m.avaliacoes) : undefined} ok={m?.avaliacoes != null ? Math.round(plano.projecao.raw.evaluated) >= m.avaliacoes : undefined} />
      </div>

      <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-400">{atual ? `O que fazer de hoje até ${fim}` : `O que fazer até ${fim}`}</p>
      <ul className="space-y-3">
        <Acao titulo={`Responder ${plural(plano.noMes.respostas, "reclamação", "reclamações")}${atual ? "" : ` em ${nomeDoMes(plano.mes)}`}`} ok={plano.noMes.respostas === 0 && plano.respostas.semRespostaAgora === 0}>
          {atual ? (
            <>
              {plano.respostas.semRespostaAgora === 0 ? "Nenhuma da janela sem resposta hoje" : plano.respostas.semRespostaAgora === 1 ? "A 1 da janela sem resposta hoje" : `As ${plano.respostas.semRespostaAgora} da janela sem resposta hoje`}
              {plano.respostas.novasPrevistas > 0 ? ` e as novas que chegarem (previstas ${plano.respostas.novasPrevistas})` : ""}.
            </>
          ) : (
            <>As {plano.noMes.chegam} que devem chegar no mês{plano.noMes.respostas > plano.noMes.chegam ? `, mais ${plano.noMes.respostas - plano.noMes.chegam} que a meta pede além do ritmo de costume` : ""}.</>
          )}{" "}
          No fim do mês, podem ficar sem resposta na janela no máximo <b className="font-medium text-zinc-800">{plano.respostas.podemFicarSem}</b> para fechar em {pct(m?.resposta ?? RA1000_TARGETS.resposta)}
          {m?.resposta == null ? " (a régua do selo, sem meta própria)" : ""}.{" "}
          {atual && (
            <Link href="/reclame-aqui?situacao=sem-resposta" className="font-medium text-violet-700 hover:underline">
              Ver as sem resposta
            </Link>
          )}
        </Acao>

        <Acao titulo={`Conseguir ${plural(plano.noMes.avaliacoes, "avaliação", "avaliações")}${atual ? "" : ` em ${nomeDoMes(plano.mes)}`}`} ok={plano.avaliacoes.exigencia?.noCaminho ?? undefined}>
          {atual ? `No ritmo de costume chegam ${plano.avaliacoes.previstas} até o fim do mês` : "É o ritmo de costume para o mês"}
          {plano.avaliacoes.necessarias > plano.avaliacoes.previstas ? `; a meta de ${m?.avaliacoes} avaliações na janela pede ${plano.avaliacoes.necessarias} novas` : ""}.
          {atual && (
            <>
              {" "}Há {plural(plano.avaliacoes.pedirDe, "respondida", "respondidas")} sem avaliação na janela para pedir.{" "}
              <Link href="/reclame-aqui/avaliacoes" className="font-medium text-violet-700 hover:underline">
                Pedir avaliação
              </Link>
            </>
          )}
        </Acao>

        {plano.consumidor && (
          <Acao titulo={plano.consumidor.alcancavel ? `Nota média das novas avaliações: pelo menos ${plano.consumidor.notaMinimaDasNovas !== null ? nota(plano.consumidor.notaMinimaDasNovas) : "—"}` : "Nota do consumidor fora de alcance neste mês"} ok={plano.consumidor.noCaminho}>
            Para a nota do consumidor chegar a {nota(plano.consumidor.meta)} (hoje vai a {nota(plano.consumidor.projetado)}).
            {plano.consumidor.avaliacoesNota10AMais > 0 ? ` Mesmo com todas nota 10, ${pluralDe(plano.consumidor.avaliacoesNota10AMais, "falta", "faltam")} ${plano.consumidor.avaliacoesNota10AMais} ${pluralDe(plano.consumidor.avaliacoesNota10AMais, "avaliação", "avaliações")} a mais.` : ""}
          </Acao>
        )}

        {plano.solucao && (
          <Acao titulo={plano.solucao.resolvidasAMais > 0 ? `${Math.round(plano.solucao.resolvidasAMais) === 1 ? "Falta" : "Faltam"} ${plural(plano.solucao.resolvidasAMais, "avaliação resolvida", "avaliações resolvidas")} além das previstas` : `Margem de não resolvidas: ${plano.solucao.margemDeNaoResolvidas}`} ok={plano.solucao.noCaminho}>
            {atual ? `Das ${plano.avaliacoesNoPlano} novas avaliações até o fim do mês` : `Das ${plano.avaliacoesNoPlano} novas avaliações de hoje até o fim de ${nomeDoMes(plano.mes)}`}, no máximo {plano.solucao.margemDeNaoResolvidas} podem vir como não resolvidas para a solução ficar em {pct(plano.solucao.meta)} — a janela já tem {plano.solucao.jaNaoResolvidas}.
          </Acao>
        )}

        {plano.voltaria && (
          <Acao titulo={plano.voltaria.voltariaAMais > 0 ? `${Math.round(plano.voltaria.voltariaAMais) === 1 ? "Falta" : "Faltam"} ${plural(plano.voltaria.voltariaAMais, "avaliação com \"voltaria\"", "avaliações com \"voltaria\"")} além das previstas` : `Margem de "não voltaria": ${plano.voltaria.margemDeNaoVoltaria}`} ok={plano.voltaria.noCaminho}>
            {atual ? `Das ${plano.avaliacoesNoPlano} novas até o fim do mês` : `Das ${plano.avaliacoesNoPlano} novas de hoje até o fim de ${nomeDoMes(plano.mes)}`}, no máximo {plano.voltaria.margemDeNaoVoltaria} podem vir sem “voltaria a fazer negócio” para ficar em {pct(plano.voltaria.meta)} — a janela já tem {plano.voltaria.jaNaoVoltaria}.
          </Acao>
        )}

        {plano.reputacao.exigencia && (
          <Acao
            titulo={
              !plano.reputacao.exigencia.alcancavel
                ? `Nota ${nota(plano.reputacao.exigencia.meta)} fora de alcance neste mês`
                : plano.reputacao.exigencia.avaliacoesPerfeitasAMais + plano.reputacao.exigencia.respostasAMais === 0
                  ? `Cumprindo o plano, a nota fecha em ${notaExata(plano.reputacao.exigencia.comAsMetricas)}`
                  : `Para a nota ${nota(plano.reputacao.exigencia.meta)}: ${[
                      plano.reputacao.exigencia.respostasAMais ? plural(plano.reputacao.exigencia.respostasAMais, "resposta a mais", "respostas a mais") : "",
                      plano.reputacao.exigencia.avaliacoesPerfeitasAMais ? plural(plano.reputacao.exigencia.avaliacoesPerfeitasAMais, "avaliação perfeita a mais", "avaliações perfeitas a mais") : "",
                    ]
                      .filter(Boolean)
                      .join(" e ")}`
            }
            ok={plano.reputacao.exigencia.noCaminho}
          >
            A meta é {nota(plano.reputacao.exigencia.meta)}; se nada mudar, fecha em {notaExata(plano.reputacao.exigencia.projetado)}. Com as metas das métricas cumpridas, {notaExata(plano.reputacao.exigencia.comAsMetricas)}
            {plano.reputacao.exigencia.avaliacoesPerfeitasAMais ? "; o resto vem de avaliações nota 10, resolvidas e com \"voltaria\"" : ""}.
          </Acao>
        )}
      </ul>

      <p className="mt-4 rounded-xl bg-violet-50/60 px-3 py-2 text-sm text-zinc-700 ring-1 ring-inset ring-violet-100">
        <b className="font-medium">Quanto cada coisa move a nota desta janela:</b> uma resposta {efeito(v.resposta)} · uma avaliação nota 10, resolvida e com “voltaria” {efeito(v.avaliacaoPerfeita)} · uma avaliação ruim {efeito(v.avaliacaoRuim)}
        {v.avaliacaoPerfeita > 0 && v.avaliacaoRuim < 0 ? ` — uma ruim desfaz ${Math.round(-v.avaliacaoRuim / v.avaliacaoPerfeita)} boas` : ""}.
      </p>

      <CiclosDoMes ciclos={plano.ciclos} temSolucao={Boolean(plano.solucao)} hoje={hoje} />
      {m?.observacao && <p className="mt-3 text-sm text-zinc-600">Observação: {m.observacao}</p>}
    </SurfaceCard>
  );
}

function situacao(c: CicloDoPlano) {
  if (c.quando === "futuro") return { rotulo: "a começar", classe: "text-zinc-400" };
  const atras = c.feito.respostas < c.meta.respostas || c.feito.avaliacoes < c.meta.avaliacoes || (c.meta.naoResolvidas !== null && c.feito.naoResolvidas > c.meta.naoResolvidas);
  if (c.quando === "atual") return atras ? { rotulo: "em andamento, atrás", classe: "text-amber-700" } : { rotulo: "em andamento, em dia", classe: "text-emerald-700" };
  return atras ? { rotulo: "abaixo da meta", classe: "text-rose-700" } : { rotulo: "meta cumprida", classe: "text-emerald-700" };
}

function Par({
  feito,
  meta,
  inverso = false,
  futuro,
  casos,
  titulo,
  descricao,
}: {
  feito: number;
  meta: number | null;
  inverso?: boolean;
  futuro: boolean;
  casos: Case[];
  titulo: string;
  descricao: string;
}) {
  if (meta === null) return <td className="px-3 py-2 text-right text-zinc-400">—</td>;
  const ok = inverso ? feito <= meta : feito >= meta;
  return (
    <td className="px-3 py-2 text-right tabular-nums">
      {futuro ? (
        <span className="text-zinc-400">meta {meta}</span>
      ) : (
        <span className={ok ? "text-zinc-800" : "text-amber-700"}>
          {feito > 0 ? (
            <button
              type="button"
              onClick={() => abrirJanelaDeCasos({ titulo, descricao, casos })}
              className="rounded px-1 font-medium hover:bg-violet-50 hover:text-violet-700"
              title="Ver os casos"
            >
              {feito}
            </button>
          ) : (
            <span className="px-1">{feito}</span>
          )}
          <span className="text-zinc-400">/ {inverso ? `máx. ${meta}` : meta}</span>
        </span>
      )}
    </td>
  );
}

const ROTULO_DO_FEITO = {
  recebidas: ["Reclamações que chegaram", "Reclamações abertas no ciclo."],
  respostas: ["Respostas publicadas", "Respostas publicadas no ciclo, de qualquer reclamação da janela."],
  avaliacoes: ["Avaliações conseguidas", "Avaliações que chegaram no ciclo, de qualquer reclamação da janela — é o que a meta do plano pede."],
  naoResolvidas: ["Avaliadas como não resolvidas", "Avaliações do ciclo em que o consumidor marcou \"não resolvida\"."],
} as const;

/**
 * As metas de cada ciclo do mês contra o que aconteceu (para o mês corrente,
 * as do plano do 1º dia). Reorganizado em 21/10/2026: a regra do "feito"
 * escrita em cima, o total do mês embaixo e cada número abre os casos.
 */
export function CiclosDoMes({ ciclos, temSolucao, hoje }: { ciclos: CicloDoPlano[]; temSolucao: boolean; hoje: string }) {
  if (ciclos.length === 0) return null;
  void hoje;
  const iniciados = ciclos.filter((c) => c.quando !== "futuro");
  const soma = (k: "recebidas" | "respostas" | "avaliacoes" | "naoResolvidas", lado: "feito" | "meta") =>
    (lado === "feito" ? iniciados : ciclos).reduce((s, c) => s + (lado === "feito" ? c.feito[k] : (c.meta[k] ?? 0)), 0);
  const todos = (k: "recebidas" | "respostas" | "avaliacoes" | "naoResolvidas") => iniciados.flatMap((c) => c.casos[k]);
  const mes = ciclos[0].ciclo.inicio.slice(0, 7);
  const nomeDoMesCurto = nomeDoMes(mes as `${number}-${number}`, true);

  return (
    <div className="mt-5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Por ciclo — feito / meta</p>
        <p className="text-xs text-zinc-500">
          Feito = o que se conseguiu no ciclo: respostas publicadas e avaliações que chegaram nele. A nota do mês é outra conta, pela reclamação. Clique num número para ver os casos.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl ring-1 ring-inset ring-zinc-200">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-zinc-50">
            <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400">
              <th className="py-2 pl-3 pr-3 font-semibold">Ciclo</th>
              <th className="px-3 py-2 text-right font-semibold" title="Reclamações abertas no ciclo, contra a previsão">Chegaram</th>
              <th className="px-3 py-2 text-right font-semibold" title="Respostas publicadas no ciclo, contra a meta">Respostas</th>
              <th className="px-3 py-2 text-right font-semibold" title="Avaliações que chegaram no ciclo, contra a meta do plano">Avaliações</th>
              {temSolucao && <th className="px-3 py-2 text-right font-semibold" title="Avaliações do ciclo marcadas como não resolvidas — quanto menos, melhor">Não resolvidas</th>}
              <th className="py-2 pl-3 pr-3 font-semibold">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {ciclos.map((c) => {
              const s = situacao(c);
              const futuro = c.quando === "futuro";
              const par = (k: "respostas" | "avaliacoes" | "naoResolvidas", inverso = false) => (
                <Par
                  feito={c.feito[k]}
                  meta={c.meta[k]}
                  inverso={inverso}
                  futuro={futuro}
                  casos={c.casos[k]}
                  titulo={`${ROTULO_DO_FEITO[k][0]} · ${c.ciclo.rotulo}`}
                  descricao={ROTULO_DO_FEITO[k][1]}
                />
              );
              return (
                <tr key={c.ciclo.id} className={c.quando === "atual" ? "bg-violet-50/40" : ""}>
                  <td className="py-2 pl-3 pr-3 text-zinc-800">
                    {c.ciclo.rotulo}
                    {c.quando === "atual" && <span className="ml-1.5 text-[11px] text-violet-700">em curso</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {futuro ? (
                      <span className="text-zinc-400">previstas {c.meta.recebidas}</span>
                    ) : (
                      <span>
                        {c.feito.recebidas > 0 ? (
                          <button
                            type="button"
                            onClick={() => abrirJanelaDeCasos({ titulo: `${ROTULO_DO_FEITO.recebidas[0]} · ${c.ciclo.rotulo}`, descricao: ROTULO_DO_FEITO.recebidas[1], casos: c.casos.recebidas })}
                            className="rounded px-1 font-medium hover:bg-violet-50 hover:text-violet-700"
                            title="Ver os casos"
                          >
                            {c.feito.recebidas}
                          </button>
                        ) : (
                          <span className="px-1">0</span>
                        )}
                        <span className="text-zinc-400">/ prev. {c.meta.recebidas}</span>
                      </span>
                    )}
                  </td>
                  {par("respostas")}
                  {par("avaliacoes")}
                  {temSolucao && par("naoResolvidas", true)}
                  <td className={`py-2 pl-3 pr-3 text-xs font-medium ${s.classe}`}>{s.rotulo}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-zinc-200 bg-zinc-50/70 font-medium">
            <tr>
              <td className="py-2 pl-3 pr-3 text-zinc-700">Total de {nomeDoMesCurto}</td>
              {(
                [
                  ["recebidas", false],
                  ["respostas", false],
                  ["avaliacoes", false],
                  ...(temSolucao ? ([["naoResolvidas", true]] as const) : []),
                ] as const
              ).map(([k, inverso]) => (
                <Par
                  key={k}
                  feito={soma(k, "feito")}
                  meta={k === "naoResolvidas" && ciclos.every((c) => c.meta.naoResolvidas === null) ? null : soma(k, "meta")}
                  inverso={inverso}
                  futuro={iniciados.length === 0}
                  casos={todos(k)}
                  titulo={`${ROTULO_DO_FEITO[k][0]} · ${nomeDoMesCurto}`}
                  descricao={ROTULO_DO_FEITO[k][1]}
                />
              ))}
              <td className="py-2 pl-3 pr-3 text-xs text-zinc-500">{iniciados.length < ciclos.length ? "até o ciclo em curso" : ""}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/** Um mês que já fechou: a nota como ficou, contra a meta. */
export function ResultadoDoMesFechado({ r, ciclos }: { r: ResultadoDoMes; ciclos: CicloDoPlano[] }) {
  return (
    <SurfaceCard title={`${nomeDoMes(r.mes, true).replace(/^./, (c) => c.toUpperCase())} — fechado`} description={`Como a janela ficou no último dia do mês${r.meta ? ", contra a meta" : ""}.`}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Indicador rotulo="Nota" valor={notaExata(r.resumo.raScoreExato)} meta={r.meta?.nota != null ? nota(r.meta.nota) : undefined} ok={r.meta?.nota != null ? r.resumo.raScoreExato >= r.meta.nota : undefined} />
        <Indicador rotulo="Respondidas" valor={pct(r.resumo.responseIndex)} meta={r.meta?.resposta != null ? pct(r.meta.resposta) : undefined} ok={r.meta?.resposta != null ? r.resumo.responseIndex >= r.meta.resposta : undefined} />
        <Indicador rotulo="Consumidor" valor={nota(r.resumo.consumerScore)} meta={r.meta?.consumidor != null ? nota(r.meta.consumidor) : undefined} ok={r.meta?.consumidor != null ? r.resumo.consumerScore >= r.meta.consumidor : undefined} />
        <Indicador rotulo="Solução" valor={pct(r.resumo.solutionIndex)} meta={r.meta?.solucao != null ? pct(r.meta.solucao) : undefined} ok={r.meta?.solucao != null ? r.resumo.solutionIndex >= r.meta.solucao : undefined} />
        <Indicador rotulo="Voltaria" valor={pct(r.resumo.wouldReturnIndex)} meta={r.meta?.voltaria != null ? pct(r.meta.voltaria) : undefined} ok={r.meta?.voltaria != null ? r.resumo.wouldReturnIndex >= r.meta.voltaria : undefined} />
        <Indicador rotulo="Avaliações" valor={inteiro(r.resumo.evaluated)} meta={r.meta?.avaliacoes != null ? inteiro(r.meta.avaliacoes) : undefined} ok={r.meta?.avaliacoes != null ? r.resumo.evaluated >= r.meta.avaliacoes : undefined} />
      </div>
      {r.cumpridas.length > 0 && (
        <p className="mt-3 text-sm text-zinc-700">
          {r.cumpridas.filter((c) => c.ok).length} de {r.cumpridas.length} {pluralDe(r.cumpridas.length, "meta", "metas")} {pluralDe(r.cumpridas.length, "cumprida", "cumpridas")}
          {r.cumpridas.some((c) => !c.ok) ? ` — ficou abaixo: ${r.cumpridas.filter((c) => !c.ok).map((c) => ROTULO_DA_META[c.chave].toLowerCase()).join(", ")}` : ""}.
        </p>
      )}
      <CiclosDoMes ciclos={ciclos} temSolucao={Boolean(r.meta?.solucao != null)} hoje="" />
    </SurfaceCard>
  );
}
