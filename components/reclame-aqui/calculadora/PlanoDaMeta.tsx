"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CalendarRange, CheckCircle2, CircleAlert } from "lucide-react";

import { respondida, type Case } from "@/lib/models/case";
import type { CaminhoParaNota } from "@/lib/services/reputation.service";
import { hojeNaOperacao } from "@/lib/services/reputation.service";
import { pluralDe } from "@/lib/plural";

const br = (dia: string) => dia.split("-").reverse().join("/");

function fimDoMes(dia: string, mais: number) {
  const [a, m] = dia.split("-").map(Number);
  return new Date(Date.UTC(a, m + mais, 0)).toISOString().slice(0, 10);
}

function somarDias(dia: string, n: number) {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Dias úteis (segunda a sexta) depois de hoje, até o prazo inclusive. */
function diasUteis(de: string, ate: string) {
  let n = 0;
  for (let d = somarDias(de, 1); d <= ate; d = somarDias(d, 1)) {
    const semana = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (semana !== 0 && semana !== 6) n += 1;
  }
  return n;
}

/** Quantas avaliações chegaram por semana nas últimas 8 semanas — o ritmo de hoje. */
function ritmoDeAvaliacoes(todos: Case[], hoje: string) {
  const de = somarDias(hoje, -56);
  const n = todos.filter((c) => c.evaluated && c.evaluatedAt && c.evaluatedAt.slice(0, 10) > de && c.evaluatedAt.slice(0, 10) <= hoje).length;
  return n / 8;
}

/**
 * O plano da meta, com prazo (20/10/2026): "quando eu traçar uma meta,
 * você tem que me dar um plano de ação de avaliações que eu preciso,
 * coisas que preciso, e trace um período".
 *
 * O caminho (respostas e avaliações) vem de `caminhoParaNota`; aqui ele
 * vira o que fazer por dia útil e por semana até a data escolhida, quantas
 * reclamações já dá para pedir avaliação, e se o ritmo de avaliações das
 * últimas 8 semanas chega lá. A conta é sobre a janela de hoje: a janela
 * anda e reclamações novas chegam — o mês inteiro, com isso, é o Plano de
 * ação.
 */
export default function PlanoDaMeta({ caminho, casos, todos }: { caminho: CaminhoParaNota; casos: Case[]; todos: Case[] }) {
  const hoje = hojeNaOperacao();
  const opcoes = useMemo(
    () => [
      { id: "mes", nome: "Fim do mês", dia: fimDoMes(hoje, 0) },
      { id: "15", nome: "15 dias", dia: somarDias(hoje, 15) },
      { id: "30", nome: "30 dias", dia: somarDias(hoje, 30) },
      { id: "proximo", nome: "Fim do próximo mês", dia: fimDoMes(hoje, 1) },
    ],
    [hoje]
  );
  const [prazo, setPrazo] = useState(opcoes[0].dia);

  const corridos = Math.max(1, Math.round((Date.parse(`${prazo}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86_400_000));
  const uteis = Math.max(1, diasUteis(hoje, prazo));
  const semanas = Math.max(1, corridos / 7);

  const respostas = caminho.pendentes;
  const depois = caminho.avaliacoesDepoisDeResponder;
  const avaliacoes = caminho.respondendoBasta ? 0 : depois.needed;
  const alcancavel = caminho.respondendoBasta || depois.reachable;

  const candidatas = useMemo(() => casos.filter((c) => respondida(c) && !c.evaluated).length, [casos]);
  const ritmo = useMemo(() => ritmoDeAvaliacoes(todos, hoje), [todos, hoje]);
  const noRitmo = Math.floor(ritmo * semanas);
  const porSemana = Math.ceil(avaliacoes / semanas);

  return (
    <div className="mt-5 border-t border-zinc-100 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarRange size={15} className="text-violet-600" />
        <span className="text-sm font-semibold text-zinc-900">Plano até</span>
        <div className="flex flex-wrap gap-1.5">
          {opcoes.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setPrazo(o.dia)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${prazo === o.dia ? "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200" : "text-zinc-500 hover:bg-zinc-100"}`}
            >
              {o.nome}
            </button>
          ))}
        </div>
        <input
          type="date"
          aria-label="Prazo da meta"
          min={somarDias(hoje, 1)}
          value={prazo}
          onChange={(e) => e.target.value && setPrazo(e.target.value)}
          className="h-8 rounded-lg border border-zinc-200 px-2 text-xs tabular-nums text-zinc-700 outline-none focus:border-violet-400"
        />
        <span className="ml-auto text-xs text-zinc-500">
          {corridos} {pluralDe(corridos, "dia", "dias")} · {uteis} {pluralDe(uteis, "dia útil", "dias úteis")}
        </span>
      </div>

      {!alcancavel ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-100">
          <CircleAlert size={15} className="mt-0.5 shrink-0" />
          Com a janela de hoje a meta não fecha, nem com todas as avaliações nota 10. Até {br(prazo)} o caminho é responder tudo e trabalhar a moderação do que puxa a nota para baixo; o mês inteiro, com as reclamações que vão chegar, está no{" "}
          <Link href="/reclame-aqui/plano" className="font-medium underline">
            Plano de ação
          </Link>
          .
        </p>
      ) : (
        <ol className="mt-3 space-y-2">
          {respostas > 0 && (
            <li className="flex items-start gap-3 text-sm text-zinc-700">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[11px] font-semibold text-violet-700">1</span>
              <span>
                <b className="font-semibold text-zinc-900">
                  Responder {respostas} {pluralDe(respostas, "reclamação", "reclamações")}
                </b>{" "}
                até {br(prazo)} — {Math.ceil(respostas / uteis)} por dia útil. Faça primeiro: não depende do consumidor.
              </span>
            </li>
          )}
          {avaliacoes > 0 && (
            <li className="flex items-start gap-3 text-sm text-zinc-700">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[11px] font-semibold text-violet-700">{respostas > 0 ? 2 : 1}</span>
              <span>
                <b className="font-semibold text-zinc-900">
                  Conseguir {avaliacoes} {pluralDe(avaliacoes, "avaliação", "avaliações")} nota 10
                </b>
                , resolvidas e com “voltaria a fazer negócio” — {porSemana} por semana até {br(prazo)}.
              </span>
            </li>
          )}
          {avaliacoes > 0 && (
            <li className="flex items-start gap-3 text-sm text-zinc-700">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[11px] font-semibold text-violet-700">{respostas > 0 ? 3 : 2}</span>
              <span>
                <b className="font-semibold text-zinc-900">
                  Pedir avaliação: {candidatas} {pluralDe(candidatas, "reclamação respondida", "reclamações respondidas")} ainda sem avaliação
                </b>{" "}
                na janela.{" "}
                {candidatas < avaliacoes
                  ? `Não bastam: faltam ${avaliacoes - candidatas} — virão de reclamações novas, resolvidas e respondidas a tempo.`
                  : "Comece pelas resolvidas, com o cliente satisfeito."}{" "}
                <Link href="/reclame-aqui/avaliacoes" className="font-medium text-violet-700 hover:underline">
                  Abrir a fila de avaliações
                </Link>
              </span>
            </li>
          )}
          {avaliacoes > 0 && (
            <li
              className={`flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm ring-1 ring-inset ${
                noRitmo >= avaliacoes ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-amber-50 text-amber-900 ring-amber-100"
              }`}
            >
              {noRitmo >= avaliacoes ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <CircleAlert size={15} className="mt-0.5 shrink-0" />}
              <span>
                No ritmo das últimas 8 semanas ({ritmo.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} avaliações por semana, de qualquer nota) chegam cerca de {noRitmo} até {br(prazo)}.{" "}
                {noRitmo >= avaliacoes
                  ? "O volume dá — o que decide é elas virem nota 10, resolvidas e com “voltaria”."
                  : `É preciso ${porSemana} por semana — ${Math.max(1, Math.round(porSemana / Math.max(ritmo, 0.1)))}× o ritmo de hoje. Pedir avaliação a cada reclamação resolvida, no mesmo dia, é o que mais encurta.`}
              </span>
            </li>
          )}
          {avaliacoes === 0 && respostas > 0 && (
            <li className="text-sm text-emerald-800">Respondendo tudo até {br(prazo)}, a meta fecha — não precisa de avaliação nova.</li>
          )}
        </ol>
      )}

      <p className="mt-3 text-xs text-zinc-400">
        A conta é sobre a janela de hoje. A janela anda e reclamações novas chegam — o mês inteiro, com isso, está no{" "}
        <Link href="/reclame-aqui/plano" className="underline hover:text-zinc-600">
          Plano de ação
        </Link>
        .
      </p>
    </div>
  );
}
