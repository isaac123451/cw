"use client";

import Link from "next/link";

import { ArrowRight, Check, CircleDashed, Loader2, PartyPopper, Sparkles } from "lucide-react";

import PageHeading from "@/components/shared/PageHeading";
import PorQue from "@/components/shared/PorQue";
import { ErroDoServidor } from "@/components/shared/Rodape";

import { usePrimeiroAcesso } from "@/components/primeiroAcesso/usePrimeiroAcesso";

import { feitoNoGuia, PARTES, progressoDoGuia, ROTEIRO } from "@/lib/models/primeiroAcesso";
import { descreverRegistro } from "@/lib/services/horasUteis";

/**
 * Primeiro acesso: o roteiro inteiro, para quem entra no time.
 *
 * Cada passo diz o que é aquela tela ou documento em duas linhas, leva
 * até lá e se marca com um clique (gravado). O último é de verdade: se
 * marca sozinho quando o primeiro contato da pessoa aparece no registro.
 */
export default function RoteiroDoPrimeiroAcesso() {
  const { estado, erro, gravando, marcar, dispensar } = usePrimeiroAcesso();
  const progresso = estado ? progressoDoGuia(estado) : null;

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Conhecimento"
        title="Primeiro acesso"
        description="Um roteiro curto pela rotina e pelas telas, que termina com o seu primeiro caso tratado de verdade."
      />

      <ErroDoServidor erro={erro} />

      {!estado && !erro && (
        <p className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
          <Loader2 size={16} className="animate-spin" /> Carregando o seu roteiro…
        </p>
      )}

      {estado && progresso && (
        <>
          <section className={`rounded-3xl p-5 ring-1 ring-inset sm:p-6 ${progresso.concluido ? "bg-emerald-50/70 ring-emerald-100" : "bg-violet-50/60 ring-violet-100"}`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${progresso.concluido ? "bg-emerald-600 text-white" : "bg-white text-violet-700 ring-1 ring-inset ring-violet-100"}`}>
                  {progresso.concluido ? <PartyPopper size={21} /> : <Sparkles size={20} />}
                </span>
                <div>
                  <p className={`text-base font-semibold ${progresso.concluido ? "text-emerald-950" : "text-violet-950"}`}>
                    {progresso.concluido ? "Roteiro completo — boas-vindas ao time de Reputação." : `${progresso.feitos} de ${progresso.total} passos`}
                  </p>
                  <p className="mt-0.5 text-sm text-zinc-600">
                    {progresso.concluido
                      ? estado.primeiroCaso
                        ? `O seu primeiro contato foi em ${descreverRegistro(estado.primeiroCaso.quando)}, em ${estado.primeiroCaso.onde}.`
                        : "Tudo visto."
                      : progresso.proximo
                        ? `Próximo: ${progresso.proximo.titulo}.`
                        : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="h-2 w-40 overflow-hidden rounded-full bg-white ring-1 ring-inset ring-zinc-200" aria-hidden>
                  <span
                    className={`block h-full rounded-full transition-all ${progresso.concluido ? "bg-emerald-600" : "bg-violet-600"}`}
                    style={{ width: `${Math.round((progresso.feitos / progresso.total) * 100)}%` }}
                  />
                </span>
                {!progresso.concluido && (
                  <button
                    type="button"
                    onClick={() => dispensar(!estado.dispensadoEm)}
                    disabled={gravando === "dispensar"}
                    className="text-xs font-medium text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline disabled:opacity-50"
                  >
                    {estado.dispensadoEm ? "Mostrar no Meu dia" : "Esconder do Meu dia"}
                  </button>
                )}
              </div>
            </div>
          </section>

          {PARTES.map((parte, k) => (
            <section key={parte} aria-labelledby={`parte-${k}`}>
              <h2 id={`parte-${k}`} className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                {k + 1}. {parte}
              </h2>
              <ol className="mt-2 space-y-2">
                {ROTEIRO.filter((p) => p.parte === parte).map((p) => {
                  const feito = feitoNoGuia(p, estado);
                  const numero = ROTEIRO.indexOf(p) + 1;
                  const proximo = progresso.proximo?.id === p.id;
                  return (
                    <li
                      key={p.id}
                      className={`flex flex-wrap items-start gap-4 rounded-2xl border bg-white p-4 transition-colors sm:flex-nowrap ${
                        proximo ? "border-violet-300 shadow-[0_8px_24px_-16px_rgba(91,42,134,0.45)]" : feito ? "border-emerald-100" : "border-zinc-200/80"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          feito ? "bg-emerald-600 text-white" : proximo ? "bg-violet-700 text-white" : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {feito ? <Check size={15} strokeWidth={3} /> : numero}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className={`text-sm font-semibold ${feito ? "text-zinc-500" : "text-zinc-900"}`}>{p.titulo}</h3>
                          {p.porque && <PorQue chave={p.porque} />}
                        </div>
                        <p className="mt-0.5 text-sm leading-6 text-zinc-600">{p.texto}</p>
                        {p.automatico && estado.primeiroCaso && (
                          <p className="mt-1 text-xs font-medium text-emerald-700">
                            Registrado em {descreverRegistro(estado.primeiroCaso.quando)} ·{" "}
                            <Link href={estado.primeiroCaso.link} className="underline underline-offset-2">
                              {estado.primeiroCaso.onde}
                            </Link>
                          </p>
                        )}
                      </div>
                      <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                        <Link
                          href={p.link}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                            proximo ? "bg-violet-700 text-white hover:bg-violet-800" : "text-violet-700 ring-1 ring-inset ring-violet-200 hover:bg-violet-50"
                          }`}
                        >
                          {p.rotulo} <ArrowRight size={13} />
                        </Link>
                        {p.link2 && (
                          <Link href={p.link2.href} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-violet-700 ring-1 ring-inset ring-violet-200 transition-colors hover:bg-violet-50">
                            {p.link2.rotulo} <ArrowRight size={13} />
                          </Link>
                        )}
                        {p.automatico ? (
                          !feito && (
                            <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                              <CircleDashed size={13} /> marca sozinho
                            </span>
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={() => marcar(p.id, !feito)}
                            disabled={gravando === p.id}
                            aria-pressed={feito}
                            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium ring-1 ring-inset transition-colors disabled:opacity-50 ${
                              feito ? "bg-emerald-50 text-emerald-800 ring-emerald-200 hover:bg-emerald-100" : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50"
                            }`}
                          >
                            {gravando === p.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                            {feito ? "Feito" : "Marcar como feito"}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
