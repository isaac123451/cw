"use client";

import Link from "next/link";
import { useState } from "react";

import { ChevronDown } from "lucide-react";

import type { PendenteDaConfianca } from "@/lib/services/okr.service";
import { faltamParaMeta, formatarValor, metricaDe, nomeDoMes, situacao, type KrCalculado } from "@/lib/models/okr";
import { cn } from "@/lib/utils";

const TOM = {
  "na-meta": { texto: "Na meta", classe: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
  perto: { texto: "Perto", classe: "bg-amber-50 text-amber-700 ring-amber-100" },
  abaixo: { texto: "Abaixo", classe: "bg-rose-50 text-rose-700 ring-rose-100" },
} as const;

const PASSOS: { id: PendenteDaConfianca["passo"]; titulo: string; dica: string }[] = [
  { id: "perguntar", titulo: "Mandar a pesquisa de confiança", dica: "Solução confirmada. Falta perguntar se a confiança foi recuperada." },
  { id: "aguardando", titulo: "Aguardando a resposta", dica: "Pesquisa enviada. Cobre a resposta, porque sem ela não conta." },
  { id: "confirmar", titulo: "Confirmar a solução", dica: "Já houve contato. Falta o cliente confirmar que resolveu." },
  { id: "contatar", titulo: "Fazer o primeiro contato", dica: "Ainda sem contato, mas segue no denominador." },
];

const diaCurto = (d: string) => d.slice(8, 10) + "/" + d.slice(5, 7);

/**
 * Um resultado-chave: o número de agora contra a meta do mês, a régua da
 * linha de base até a meta final, os meses e — no KR de confiança — o
 * que falta, pessoa por pessoa. Uma pergunta por bloco: "estamos onde?",
 * "falta quanto?", "o que eu faço agora?".
 */
export default function CartaoDoKr({ calc, indice, pendentes, mesAtual }: { calc: KrCalculado; indice: number; pendentes: PendenteDaConfianca[]; mesAtual: string }) {
  const { kr } = calc;
  const metrica = metricaDe(kr.metrica);
  const [regraAberta, setRegraAberta] = useState(false);
  const [passoAberto, setPassoAberto] = useState<PendenteDaConfianca["passo"] | null>(null);
  if (!metrica) return null;

  const tom = situacao(calc.atual, calc.metaDeAgora);
  const base = kr.linhaDeBase ?? (metrica.unidade === "%" ? 0 : metrica.minimo);
  const posicao = (v: number | null) => (v == null || kr.meta === base ? 0 : Math.max(0, Math.min(100, ((v - base) / (kr.meta - base)) * 100)));
  const c = calc.confianca;
  const faltam = c && kr.metrica === "nps-confianca" ? faltamParaMeta(c, calc.metaDeAgora) : null;

  return (
    <article className="rounded-xl border border-zinc-200/80 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            KR{indice + 1} · {metrica.frente}
          </p>
          <h3 className="mt-0.5 text-[15px] font-semibold text-zinc-900">{kr.titulo}</h3>
          <p className="mt-0.5 text-xs text-zinc-500">{metrica.nome}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums text-zinc-900">{formatarValor(calc.atual, metrica.unidade)}</p>
          <p className="text-xs text-zinc-500">
            {calc.metaDeAgora != null ? `meta de ${nomeDoMes(mesAtual)}: ${formatarValor(calc.metaDeAgora, metrica.unidade)}` : `meta: ${formatarValor(kr.meta, metrica.unidade)}`}
          </p>
          {tom && <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", TOM[tom].classe)}>{TOM[tom].texto}</span>}
        </div>
      </div>

      {/* A régua: da linha de base à meta final, com a meta do mês marcada. */}
      <div className="mt-4">
        <div className="relative h-2 rounded-full bg-zinc-100">
          <div className="absolute inset-y-0 left-0 rounded-full bg-violet-600 transition-[width] duration-500" style={{ width: `${posicao(calc.atual)}%` }} />
          {calc.metaDeAgora != null && calc.metaDeAgora !== kr.meta && (
            <span className="absolute -top-1 h-4 w-0.5 rounded bg-zinc-400" style={{ left: `${posicao(calc.metaDeAgora)}%` }} title={`Meta de ${nomeDoMes(mesAtual)}`} />
          )}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-zinc-400">
          <span>{kr.linhaDeBaseNota || (kr.linhaDeBase != null ? `base ${formatarValor(kr.linhaDeBase, metrica.unidade)}` : "sem linha de base")}</span>
          <span>meta final {formatarValor(kr.meta, metrica.unidade)}</span>
        </div>
      </div>

      {/* Os meses: meta e realizado lado a lado. */}
      <div className="mt-4 grid gap-2 text-center" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(calc.meses.length, 1), 4)}, minmax(0, 1fr))` }}>
        {calc.meses.map((m) => (
          <div key={m.mes} className={cn("rounded-lg px-2 py-2 ring-1 ring-inset", m.emCurso ? "bg-violet-50/60 ring-violet-100" : "bg-zinc-50 ring-zinc-100")}>
            <p className="text-[11px] font-medium capitalize text-zinc-500">{nomeDoMes(m.mes)}{m.emCurso ? " (até hoje)" : ""}</p>
            <p className={cn("text-sm font-semibold tabular-nums", m.futuro ? "text-zinc-300" : "text-zinc-900")}>{m.futuro ? "—" : formatarValor(m.realizado, metrica.unidade)}</p>
            <p className="text-[11px] text-zinc-400">meta {formatarValor(m.meta, metrica.unidade)}</p>
          </div>
        ))}
      </div>

      {calc.aviso && <p className="mt-3 text-xs text-amber-700">{calc.aviso}</p>}

      {/* KR de confiança: o funil e o que falta, por pessoa. */}
      {c && kr.metrica === "nps-confianca" && (
        <div className="mt-4 border-t border-zinc-100 pt-4">
          {faltam != null && faltam > 0 && (
            <p className="text-sm text-zinc-800">
              Faltam <strong className="tabular-nums">{faltam}</strong> {faltam === 1 ? "cliente" : "clientes"} com &ldquo;Sim&rdquo; para a meta de {nomeDoMes(mesAtual)}.
            </p>
          )}
          {faltam === 0 && <p className="text-sm text-emerald-700">A meta de {nomeDoMes(mesAtual)} já foi alcançada.</p>}

          <ol className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
            {[
              ["Elegíveis", c.elegiveis],
              ["Contatados", c.contatados],
              ["Pesquisa enviada", c.enviadas],
              ["Responderam", c.respondidas],
              ["Sucesso", c.sucesso],
            ].map(([rotulo, n]) => (
              <li key={rotulo} className="rounded-lg bg-zinc-50 px-2.5 py-2 ring-1 ring-inset ring-zinc-100">
                <p className="text-zinc-500">{rotulo}</p>
                <p className="text-base font-semibold tabular-nums text-zinc-900">{n}</p>
              </li>
            ))}
          </ol>

          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-600">
            <div>
              <dt className="inline">Contatados em até 2 dias úteis: </dt>
              <dd className="inline font-semibold tabular-nums text-zinc-900">{formatarValor(c.percentualNoPrazo, "%")}</dd>
            </div>
            <div>
              <dt className="inline">Taxa de resposta à pesquisa: </dt>
              <dd className="inline font-semibold tabular-nums text-zinc-900">{formatarValor(c.taxaDeResposta, "%")}</dd>
            </div>
            <div>
              <dt className="inline">Respostas: </dt>
              <dd className="inline font-semibold tabular-nums text-zinc-900">
                {c.sim} sim · {c.parcialmente} parcialmente · {c.nao} não
              </dd>
            </div>
          </dl>

          {pendentes.length > 0 && (
            <div className="mt-4 space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Próximo passo de cada um</p>
              {PASSOS.map((p) => {
                const deste = pendentes.filter((x) => x.passo === p.id);
                if (!deste.length) return null;
                const aberto = passoAberto === p.id;
                return (
                  <div key={p.id} className="rounded-lg ring-1 ring-inset ring-zinc-100">
                    <button
                      type="button"
                      onClick={() => setPassoAberto(aberto ? null : p.id)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-zinc-50"
                      aria-expanded={aberto}
                      title={p.dica}
                    >
                      <span className="text-zinc-800">{p.titulo}</span>
                      <span className="flex items-center gap-1.5 text-xs tabular-nums text-zinc-500">
                        {deste.length}
                        <ChevronDown size={14} className={cn("transition-transform", aberto && "rotate-180")} />
                      </span>
                    </button>
                    {aberto && (
                      <ul className="max-h-64 overflow-y-auto border-t border-zinc-100 px-1 py-1">
                        {deste.map((x) => (
                          <li key={x.id}>
                            <Link href={`/nps/${x.id}`} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-violet-50">
                              <span className="truncate text-zinc-800">{x.nome}</span>
                              <span className="shrink-0 text-xs text-zinc-400">nota {x.nota} · desde {diaCurto(x.desde)}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {kr.metrica === "nps-contato-2du" && c && (
        <p className="mt-3 text-xs text-zinc-600">
          {c.contatadosNoPrazo} de {c.elegiveis} detratores tiveram o primeiro contato até o 2º dia útil. {c.naoContatados} ainda sem contato.
        </p>
      )}

      <button type="button" onClick={() => setRegraAberta((v) => !v)} className="mt-3 flex items-center gap-1 text-xs text-zinc-500 hover:text-violet-700" aria-expanded={regraAberta}>
        Como se calcula
        <ChevronDown size={13} className={cn("transition-transform", regraAberta && "rotate-180")} />
      </button>
      {regraAberta && (
        <div className="mt-1.5 space-y-1 text-xs leading-relaxed text-zinc-600">
          <p>{metrica.leitura}</p>
          {kr.corte && <p>Entra na população quem chegou até {diaCurto(kr.corte)}.</p>}
          {kr.regra && <p>{kr.regra}</p>}
        </div>
      )}
    </article>
  );
}
