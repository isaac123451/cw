"use client";

import { useMemo, useState } from "react";

import {
  ArrowRight,
  CircleAlert,
  MessageSquareReply,
  Star,
  Target,
} from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import {
  caminhoParaNota,
  ptBR,
  ReputationRaw,
} from "@/lib/services/reputation.service";

/**
 * "Quantas avaliações preciso para chegar a 9,0?"
 *
 * A pergunta é do Isaac, quase nessas palavras: "preciso verificar
 * também o que preciso fazer para alcançar tal nota, por exemplo:
 * quantas avaliações ou respostas de reclamações preciso para alcançar
 * nota de reputação 9.0".
 *
 * A calculadora já respondia por **faixa** — "Ótimo", "RA1000" — e faixa
 * é intervalo: escolher "Ótimo" responde 8,0, e quem quer 9,0 fica sem
 * resposta. Aqui a nota é digitada.
 *
 * **São duas alavancas, e a ordem entre elas importa.** Responder as
 * pendentes é o que dá para fazer hoje, sozinho, sem depender de
 * ninguém — e o índice de resposta tem peso 2 na fórmula. Avaliações
 * dependem de o consumidor voltar ao portal, mas mexem em três
 * indicadores de uma vez (nota, solução, novo negócio), com peso 8
 * somado. Mostrar as duas separadas é o que deixa decidir por onde
 * começar; mostrar só o total esconde que metade do caminho não custa
 * nada além de trabalho.
 */

/** As notas que se pede na prática. Digitar também vale. */
const ATALHOS = [8, 8.5, 9, 9.5];

export default function CaminhoParaNota({
  base,
}: {
  base: ReputationRaw;
}) {

  const [alvo, setAlvo] = useState(9);

  const caminho = useMemo(
    () => caminhoParaNota(base, alvo),
    [base, alvo]
  );

  const depois = caminho.avaliacoesDepoisDeResponder;
  const sem = caminho.avaliacoesSemResponder;

  return (
    <SurfaceCard
      title="O que falta para uma nota"
      description="Digite a nota que você quer e veja o caminho até ela, separado em respostas e avaliações."
    >

      <div className="flex flex-wrap items-center gap-2">

        <label
          htmlFor="nota-alvo"
          className="text-sm text-zinc-600"
        >
          Quero chegar a
        </label>

        <input
          id="nota-alvo"
          type="number"
          min={0}
          max={10}
          step={0.1}
          value={alvo}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) {
              setAlvo(Math.min(Math.max(v, 0), 10));
            }
          }}
          className="h-10 w-24 rounded-xl border border-zinc-200 px-3 text-sm font-semibold tabular-nums text-zinc-900 outline-none transition-colors focus:border-violet-400"
        />

        <div className="flex flex-wrap gap-1.5">
          {ATALHOS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setAlvo(n)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                alvo === n
                  ? "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200"
                  : "text-zinc-500 hover:bg-zinc-100"
              }`}
            >
              {ptBR(n)}
            </button>
          ))}
        </div>

        <span className="ml-auto text-sm text-zinc-500">
          Hoje:{" "}
          <strong className="font-semibold tabular-nums text-zinc-900">
            {ptBR(caminho.atual, 2)}
          </strong>
        </span>

      </div>

      {caminho.jaAlcancada ? (

        <p className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-100">
          <Target size={15} className="mt-0.5 shrink-0" />
          <span>
            A nota já está em {ptBR(caminho.atual, 2)} —
            acima de {ptBR(alvo)}. O trabalho aqui é
            manter, não alcançar.
          </span>
        </p>

      ) : (

        <div className="mt-4 space-y-2.5">

          {/* Passo 1 — o que não depende de ninguém. */}
          <div
            className={`flex items-start gap-3 rounded-xl px-4 py-3.5 ring-1 ring-inset ${
              caminho.pendentes > 0
                ? "bg-violet-50/60 ring-violet-100"
                : "bg-zinc-50 ring-zinc-200"
            }`}
          >

            <MessageSquareReply
              size={17}
              className="mt-0.5 shrink-0 text-violet-600"
            />

            <div className="min-w-0 flex-1">

              <p className="text-sm font-semibold text-zinc-900">
                {caminho.pendentes === 0
                  ? "Nada pendente de resposta"
                  : `Responda as ${caminho.pendentes} sem resposta`}
              </p>

              <p className="mt-0.5 text-sm text-zinc-600">
                {caminho.pendentes === 0 ? (
                  "O índice de resposta já está em 100% — esta alavanca está no fim."
                ) : (
                  <>
                    Leva a nota para{" "}
                    <strong className="font-semibold tabular-nums text-zinc-900">
                      {ptBR(caminho.soRespondendo, 2)}
                    </strong>
                    . É o que dá para fazer hoje, sem
                    depender de o consumidor voltar.
                  </>
                )}
              </p>

            </div>

            {caminho.respondendoBasta && (
              <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                já basta
              </span>
            )}

          </div>

          {/* Passo 2 — o que depende do consumidor. */}
          {!caminho.respondendoBasta && (

            <div
              className={`flex items-start gap-3 rounded-xl px-4 py-3.5 ring-1 ring-inset ${
                depois.reachable
                  ? "bg-violet-50/60 ring-violet-100"
                  : "bg-amber-50/70 ring-amber-100"
              }`}
            >

              {depois.reachable ? (
                <Star
                  size={17}
                  className="mt-0.5 shrink-0 text-violet-600"
                />
              ) : (
                <CircleAlert
                  size={17}
                  className="mt-0.5 shrink-0 text-amber-600"
                />
              )}

              <div className="min-w-0 flex-1">

                {depois.reachable ? (

                  <>
                    <p className="text-sm font-semibold text-zinc-900">
                      Depois disso, {depois.needed}{" "}
                      avaliação(ões) nota 10
                    </p>

                    <p className="mt-0.5 text-sm text-zinc-600">
                      Resolvidas e com &ldquo;voltaria a
                      fazer negócio&rdquo;. Chega a{" "}
                      <strong className="font-semibold tabular-nums text-zinc-900">
                        {ptBR(depois.projected, 2)}
                      </strong>
                      .
                    </p>
                  </>

                ) : (

                  <>
                    <p className="text-sm font-semibold text-amber-900">
                      {ptBR(alvo)} não é alcançável neste
                      período
                    </p>

                    <p className="mt-0.5 text-sm leading-relaxed text-amber-800">
                      {depois.reason === "sem-avaliacoes" ? (
                        <>
                          Só existem {depois.ceiling}{" "}
                          reclamação(ões) sem avaliação no
                          período, e não dá para pedir
                          avaliação de quem já avaliou.
                          Mesmo todas nota 10, a nota para
                          em{" "}
                          <strong className="font-semibold tabular-nums">
                            {ptBR(depois.projected, 2)}
                          </strong>
                          . O resto vem com o tempo — ou
                          com moderação do que puxa para
                          baixo.
                        </>
                      ) : (
                        <>
                          Mesmo com tudo nota 10 a nota não
                          chega lá: o peso que falta está no
                          índice de resposta, não na
                          avaliação.
                        </>
                      )}
                    </p>
                  </>

                )}

              </div>

            </div>

          )}

          {/*
            O preço de não responder.

            Só aparece quando muda alguma coisa: se responder não altera
            o número de avaliações necessárias, a linha seria ruído.
          */}
          {!caminho.respondendoBasta &&
            depois.reachable &&
            sem.reachable &&
            sem.needed > depois.needed && (

              <p className="flex items-center gap-2 px-1 text-xs text-zinc-500">
                <ArrowRight size={13} className="shrink-0" />
                Sem responder as pendentes seriam{" "}
                <strong className="font-semibold text-zinc-700">
                  {sem.needed}
                </strong>{" "}
                avaliações —{" "}
                {sem.needed - depois.needed} a mais pelo
                mesmo resultado.
              </p>

            )}

        </div>

      )}

    </SurfaceCard>
  );
}
