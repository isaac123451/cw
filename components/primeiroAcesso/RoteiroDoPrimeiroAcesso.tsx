"use client";

import Link from "next/link";
import { useState } from "react";

import { ArrowRight, Check, ChevronDown, CircleDashed, Loader2, PartyPopper, Sparkles } from "lucide-react";

import PorQue from "@/components/shared/PorQue";
import { ErroDoServidor } from "@/components/shared/Rodape";

import { usePrimeiroAcesso } from "@/components/primeiroAcesso/usePrimeiroAcesso";

import { DIAS, feitoNoGuia, progressoDoGuia, ROTEIRO, type DiaDoGuia, type EstadoDoGuia, type PassoDoGuia } from "@/lib/models/primeiroAcesso";
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
  /* O dia aberto: o de agora; a pessoa pode abrir outro para rever. */
  const [aberto, setAberto] = useState<DiaDoGuia | 0 | null>(null);
  const diaAberto = aberto ?? progresso?.diaAtual ?? null;

  return (
    <div className="space-y-6">
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
                    {progresso.concluido ? "Roteiro completo — boas-vindas ao time de Reputação." : `Dia ${progresso.diaAtual} de ${DIAS.length} · ${DIAS.find((d) => d.dia === progresso.diaAtual)?.nome ?? ""}`}
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

          {DIAS.map(({ dia, nome, objetivo }) => {
            const passos = ROTEIRO.filter((p) => p.dia === dia);
            const feitos = passos.filter((p) => feitoNoGuia(p, estado)).length;
            const completo = feitos === passos.length;
            const abertoAqui = diaAberto === dia;
            return (
              <section key={dia} aria-labelledby={`dia-${dia}`} className="rounded-2xl border border-zinc-200/80 bg-white">
                <button
                  type="button"
                  id={`dia-${dia}`}
                  onClick={() => setAberto(abertoAqui ? 0 : dia)}
                  aria-expanded={abertoAqui}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      completo ? "bg-emerald-600 text-white" : progresso.diaAtual === dia ? "bg-violet-700 text-white" : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {completo ? <Check size={15} strokeWidth={3} /> : dia}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-semibold ${completo ? "text-zinc-500" : "text-zinc-900"}`}>
                      Dia {dia} · {nome}
                    </span>
                    <span className="block truncate text-xs text-zinc-500">{completo ? "Feito." : objetivo}</span>
                  </span>
                  {!completo && feitos > 0 && <span className="text-xs tabular-nums text-zinc-500">{feitos} de {passos.length}</span>}
                  <ChevronDown size={15} className={`shrink-0 text-zinc-400 transition-transform ${abertoAqui ? "rotate-180" : ""}`} aria-hidden />
                </button>
                {abertoAqui && (
                  <ol className="space-y-2 border-t border-zinc-100 p-3">
                    {passos.map((p) => (
                      <Passo key={p.id} passo={p} estado={estado} proximo={progresso.proximo?.id === p.id} gravando={gravando === p.id} marcar={marcar} />
                    ))}
                  </ol>
                )}
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

/** Um passo do dia: o que é, para onde leva e como se marca. */
function Passo({
  passo: p,
  estado,
  proximo,
  gravando,
  marcar,
}: {
  passo: PassoDoGuia;
  estado: EstadoDoGuia;
  proximo: boolean;
  gravando: boolean;
  marcar: (id: string, feito: boolean) => unknown;
}) {
  const feito = feitoNoGuia(p, estado);
  const numero = ROTEIRO.filter((q) => q.dia === p.dia).indexOf(p) + 1;
  const marca = p.id === "primeiro-caso" ? estado.primeiroCaso : estado.automaticos?.[p.id];
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
        {marca && (
          <p className="mt-1 text-xs font-medium text-emerald-700">
            {marca.quando ? <>Registrado em {descreverRegistro(marca.quando)}</> : "Feito"}
            {marca.onde && (
              <>
                {" · "}
                {marca.link ? (
                  <Link href={marca.link} className="underline underline-offset-2">
                    {marca.onde}
                  </Link>
                ) : (
                  marca.onde
                )}
              </>
            )}
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
            onClick={() => void marcar(p.id, !feito)}
            disabled={gravando}
            aria-pressed={feito}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium ring-1 ring-inset transition-colors disabled:opacity-50 ${
              feito ? "bg-emerald-50 text-emerald-800 ring-emerald-200 hover:bg-emerald-100" : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50"
            }`}
          >
            {gravando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {feito ? "Feito" : "Marcar como feito"}
          </button>
        )}
      </div>
    </li>
  );
}
