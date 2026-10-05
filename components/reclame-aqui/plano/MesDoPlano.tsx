"use client";

import Link from "next/link";

import { CheckCircle2, CircleAlert, OctagonAlert } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import type { CicloDoPlano, PlanoDoMes, ResultadoDoMes } from "@/lib/models/planoDeAcao";
import { ROTULO_DA_META } from "@/lib/models/planoDeAcao";
import { nomeDoMes, somarMeses, ultimoDia } from "@/lib/models/previsaoDeReclamacoes";
import { RA1000_TARGETS } from "@/lib/services/reputation.service";

import { br, efeito, inteiro, nota, pct, plural } from "./formato";

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
        <Indicador rotulo="Nota" valor={nota(p.raScoreExato)} meta={m?.nota != null ? nota(m.nota) : undefined} ok={m?.nota != null ? p.raScoreExato >= m.nota : undefined} />
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
            {plano.consumidor.avaliacoesNota10AMais > 0 ? ` Mesmo com todas nota 10, faltam ${plano.consumidor.avaliacoesNota10AMais} avaliações a mais.` : ""}
          </Acao>
        )}

        {plano.solucao && (
          <Acao titulo={plano.solucao.resolvidasAMais > 0 ? `Faltam ${plural(plano.solucao.resolvidasAMais, "avaliação resolvida", "avaliações resolvidas")} além das previstas` : `Margem de não resolvidas: ${plano.solucao.margemDeNaoResolvidas}`} ok={plano.solucao.noCaminho}>
            {atual ? `Das ${plano.avaliacoesNoPlano} novas avaliações até o fim do mês` : `Das ${plano.avaliacoesNoPlano} novas avaliações de hoje até o fim de ${nomeDoMes(plano.mes)}`}, no máximo {plano.solucao.margemDeNaoResolvidas} podem vir como não resolvidas para a solução ficar em {pct(plano.solucao.meta)} — a janela já tem {plano.solucao.jaNaoResolvidas}.
          </Acao>
        )}

        {plano.voltaria && (
          <Acao titulo={plano.voltaria.voltariaAMais > 0 ? `Faltam ${plural(plano.voltaria.voltariaAMais, "avaliação com \"voltaria\"", "avaliações com \"voltaria\"")} além das previstas` : `Margem de "não voltaria": ${plano.voltaria.margemDeNaoVoltaria}`} ok={plano.voltaria.noCaminho}>
            {atual ? `Das ${plano.avaliacoesNoPlano} novas até o fim do mês` : `Das ${plano.avaliacoesNoPlano} novas de hoje até o fim de ${nomeDoMes(plano.mes)}`}, no máximo {plano.voltaria.margemDeNaoVoltaria} podem vir sem "voltaria a fazer negócio" para ficar em {pct(plano.voltaria.meta)} — a janela já tem {plano.voltaria.jaNaoVoltaria}.
          </Acao>
        )}

        {plano.reputacao.exigencia && (
          <Acao
            titulo={
              !plano.reputacao.exigencia.alcancavel
                ? `Nota ${nota(plano.reputacao.exigencia.meta)} fora de alcance neste mês`
                : plano.reputacao.exigencia.avaliacoesPerfeitasAMais + plano.reputacao.exigencia.respostasAMais === 0
                  ? `Cumprindo o plano, a nota fecha em ${nota(plano.reputacao.exigencia.comAsMetricas)}`
                  : `Para a nota ${nota(plano.reputacao.exigencia.meta)}: ${[
                      plano.reputacao.exigencia.respostasAMais ? plural(plano.reputacao.exigencia.respostasAMais, "resposta a mais", "respostas a mais") : "",
                      plano.reputacao.exigencia.avaliacoesPerfeitasAMais ? plural(plano.reputacao.exigencia.avaliacoesPerfeitasAMais, "avaliação perfeita a mais", "avaliações perfeitas a mais") : "",
                    ]
                      .filter(Boolean)
                      .join(" e ")}`
            }
            ok={plano.reputacao.exigencia.noCaminho}
          >
            A meta é {nota(plano.reputacao.exigencia.meta)}; se nada mudar, fecha em {nota(plano.reputacao.exigencia.projetado)}. Com as metas das métricas cumpridas, {nota(plano.reputacao.exigencia.comAsMetricas)}
            {plano.reputacao.exigencia.avaliacoesPerfeitasAMais ? "; o resto vem de avaliações nota 10, resolvidas e com \"voltaria\"" : ""}.
          </Acao>
        )}
      </ul>

      <p className="mt-4 rounded-xl bg-violet-50/60 px-3 py-2 text-sm text-zinc-700 ring-1 ring-inset ring-violet-100">
        <b className="font-medium">Quanto cada coisa move a nota desta janela:</b> uma resposta {efeito(v.resposta)} · uma avaliação nota 10, resolvida e com "voltaria" {efeito(v.avaliacaoPerfeita)} · uma avaliação ruim {efeito(v.avaliacaoRuim)}
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

function Par({ feito, meta, inverso = false, futuro }: { feito: number; meta: number | null; inverso?: boolean; futuro: boolean }) {
  if (meta === null) return <td className="px-3 py-2 text-right text-zinc-400">—</td>;
  const ok = inverso ? feito <= meta : feito >= meta;
  return (
    <td className="px-3 py-2 text-right tabular-nums">
      {futuro ? <span className="text-zinc-400">meta {meta}</span> : (
        <span className={ok ? "text-zinc-800" : "text-amber-700"}>
          {feito} <span className="text-zinc-400">/ {inverso ? `máx. ${meta}` : meta}</span>
        </span>
      )}
    </td>
  );
}

/** As metas de cada ciclo do mês contra o que aconteceu (para o mês corrente, as do plano do 1º dia). */
export function CiclosDoMes({ ciclos, temSolucao, hoje }: { ciclos: CicloDoPlano[]; temSolucao: boolean; hoje: string }) {
  if (ciclos.length === 0) return null;
  void hoje;
  return (
    <div className="mt-5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Por ciclo — feito / meta</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400">
              <th className="py-2 pr-3 font-semibold">Ciclo</th>
              <th className="px-3 py-2 text-right font-semibold">Chegaram</th>
              <th className="px-3 py-2 text-right font-semibold">Respostas</th>
              <th className="px-3 py-2 text-right font-semibold">Avaliações</th>
              {temSolucao && <th className="px-3 py-2 text-right font-semibold">Não resolvidas</th>}
              <th className="py-2 pl-3 font-semibold">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {ciclos.map((c) => {
              const s = situacao(c);
              const futuro = c.quando === "futuro";
              return (
                <tr key={c.ciclo.id} className={c.quando === "atual" ? "bg-violet-50/40" : ""}>
                  <td className="py-2 pr-3 text-zinc-800">{c.ciclo.rotulo}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{futuro ? <span className="text-zinc-400">previstas {c.meta.recebidas}</span> : <span>{c.feito.recebidas} <span className="text-zinc-400">/ prev. {c.meta.recebidas}</span></span>}</td>
                  <Par feito={c.feito.respostas} meta={c.meta.respostas} futuro={futuro} />
                  <Par feito={c.feito.avaliacoes} meta={c.meta.avaliacoes} futuro={futuro} />
                  {temSolucao && <Par feito={c.feito.naoResolvidas} meta={c.meta.naoResolvidas} inverso futuro={futuro} />}
                  <td className={`py-2 pl-3 text-xs font-medium ${s.classe}`}>{s.rotulo}</td>
                </tr>
              );
            })}
          </tbody>
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
        <Indicador rotulo="Nota" valor={nota(r.resumo.raScoreExato)} meta={r.meta?.nota != null ? nota(r.meta.nota) : undefined} ok={r.meta?.nota != null ? r.resumo.raScoreExato >= r.meta.nota : undefined} />
        <Indicador rotulo="Respondidas" valor={pct(r.resumo.responseIndex)} meta={r.meta?.resposta != null ? pct(r.meta.resposta) : undefined} ok={r.meta?.resposta != null ? r.resumo.responseIndex >= r.meta.resposta : undefined} />
        <Indicador rotulo="Consumidor" valor={nota(r.resumo.consumerScore)} meta={r.meta?.consumidor != null ? nota(r.meta.consumidor) : undefined} ok={r.meta?.consumidor != null ? r.resumo.consumerScore >= r.meta.consumidor : undefined} />
        <Indicador rotulo="Solução" valor={pct(r.resumo.solutionIndex)} meta={r.meta?.solucao != null ? pct(r.meta.solucao) : undefined} ok={r.meta?.solucao != null ? r.resumo.solutionIndex >= r.meta.solucao : undefined} />
        <Indicador rotulo="Voltaria" valor={pct(r.resumo.wouldReturnIndex)} meta={r.meta?.voltaria != null ? pct(r.meta.voltaria) : undefined} ok={r.meta?.voltaria != null ? r.resumo.wouldReturnIndex >= r.meta.voltaria : undefined} />
        <Indicador rotulo="Avaliações" valor={inteiro(r.resumo.evaluated)} meta={r.meta?.avaliacoes != null ? inteiro(r.meta.avaliacoes) : undefined} ok={r.meta?.avaliacoes != null ? r.resumo.evaluated >= r.meta.avaliacoes : undefined} />
      </div>
      {r.cumpridas.length > 0 && (
        <p className="mt-3 text-sm text-zinc-700">
          {r.cumpridas.filter((c) => c.ok).length} de {r.cumpridas.length} meta(s) cumprida(s)
          {r.cumpridas.some((c) => !c.ok) ? ` — ficou abaixo: ${r.cumpridas.filter((c) => !c.ok).map((c) => ROTULO_DA_META[c.chave].toLowerCase()).join(", ")}` : ""}.
        </p>
      )}
      <CiclosDoMes ciclos={ciclos} temSolucao={Boolean(r.meta?.solucao != null)} hoje="" />
    </SurfaceCard>
  );
}
