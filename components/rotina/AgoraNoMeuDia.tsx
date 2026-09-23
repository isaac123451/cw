"use client";

import { useMemo } from "react";

import Link from "next/link";

import { ArrowRight, AppWindow, PartyPopper, TrendingUp, TriangleAlert } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { useCases } from "@/lib/context/CaseContext";
import { useJanelas } from "@/lib/context/JanelasContext";
import { useNps } from "@/lib/context/NpsContext";
import { useSla } from "@/lib/context/SlaContext";
import { useAgora } from "@/lib/hooks/useAgora";

import { avisosDeAbertura, prazosDeHoje } from "@/lib/models/aberturaDoAgente";
import { conquistasDaSemana, conquistasDoDia, oQueMoveANota } from "@/lib/models/motivacaoDoDia";
import { isOpen } from "@/lib/services/case.service";

/**
 * O topo do Meu dia: o que pede ação, o que move a nota e o que já deu
 * certo.
 *
 * **Por que no topo.** A rotina e o plano respondem "o que eu faço";
 * este bloco responde "por que vale a pena" e "o que já andou". Sem ele a
 * tela era uma lista de tarefas — e o Isaac disse que relaxa quando a
 * ferramenta não devolve nada.
 *
 * Cada item leva ao que resolve: a tela certa, ou o caso direto numa
 * mini-janela, sem sair do Meu dia.
 */

const TOM = {
  perigo: "text-rose-700",
  atencao: "text-amber-700",
  neutro: "text-violet-700",
} as const;

const um = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function AgoraNoMeuDia() {

  const { cases } = useCases();
  const { responses } = useNps();
  const { rules, expediente } = useSla();
  const { abrir } = useJanelas();
  const agora = useAgora();

  const calculado = useMemo(() => {
    if (!agora) return null;
    const avisos = avisosDeAbertura({ casos: cases, regras: rules, nps: responses, expediente, agora });
    const prazos = prazosDeHoje(cases.filter(isOpen), rules, responses, expediente, agora);
    return {
      avisos,
      acoes: oQueMoveANota(cases, agora),
      conquistas: conquistasDoDia({ casos: cases, nps: responses, prazosEstourados: prazos.estourados, agora }),
      semana: conquistasDaSemana({ casos: cases, nps: responses, agora }),
    };
  }, [cases, responses, rules, expediente, agora]);

  if (!calculado) return null;

  const { avisos, acoes, conquistas, semana } = calculado;

  return (
    <div className="grid gap-4 lg:grid-cols-3">

      <SurfaceCard
        title="Pede ação agora"
        description="O que vence, quem está sem notícia, de quem pedir avaliação e sinal de crise."
      >
        {avisos.length === 0 ? (
          <p className="text-sm text-emerald-700">Nada vencendo, ninguém parado e nenhum sinal de crise.</p>
        ) : (
          <ul className="space-y-2.5">
            {avisos.map((a) => (
              <li key={a.chave} className="flex items-start gap-2">
                <TriangleAlert size={14} className={`mt-0.5 shrink-0 ${TOM[a.tom]}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${TOM[a.tom]}`}>{a.titulo}</p>
                  <p className="text-xs text-zinc-500">{a.detalhe}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {a.href === "/meu-dia" ? (
                      <span className="text-xs text-zinc-500">estão na frente no plano abaixo</span>
                    ) : (
                      <Link href={a.href} className="flex items-center gap-1 text-xs font-medium text-violet-700 hover:underline">
                        Resolver <ArrowRight size={12} />
                      </Link>
                    )}
                    {a.janela && (
                      <button
                        type="button"
                        onClick={() => abrir(a.janela!)}
                        className="flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-violet-700"
                      >
                        <AppWindow size={12} /> abrir o caso em janela
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SurfaceCard>

      <SurfaceCard
        title="O que move a nota"
        description="Na janela de 6 meses que o portal mostra, pela mesma conta da calculadora."
      >
        {acoes.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Nada pendente que mova a nota hoje: nenhuma reclamação sem resposta e ninguém na vez de pedir avaliação.
          </p>
        ) : (
          <ul className="space-y-3">
            {acoes.map((a) => (
              <li key={a.chave}>
                <Link href={a.href} className="group block">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-zinc-800 group-hover:text-violet-700">
                    <TrendingUp size={14} className="shrink-0 text-emerald-600" />
                    {a.titulo}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    nota <span className="font-semibold text-zinc-700">{um(a.notaAntes)}</span> →{" "}
                    <span className="font-semibold text-emerald-700">{um(a.notaDepois)}</span> · {a.efeito}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SurfaceCard>

      <SurfaceCard
        title="Conquistas"
        description="Hoje e na semana — só o que o banco confirma."
      >
        {conquistas.length === 0 ? (
          <p className="text-sm text-zinc-500">
            A primeira do dia aparece aqui: uma avaliação positiva, um detrator que voltou satisfeito, o dia sem prazo estourado.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {conquistas.map((c) => {
              const conteudo = (
                <>
                  <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                    <PartyPopper size={14} className="shrink-0" />
                    {c.titulo}
                  </p>
                  <p className="text-xs text-zinc-500">{c.detalhe}</p>
                </>
              );
              return (
                <li key={c.chave}>
                  {c.href ? (
                    <Link href={c.href} className="block hover:opacity-80">
                      {conteudo}
                    </Link>
                  ) : (
                    conteudo
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* A semana: de segunda até hoje. Só aparece o que aconteceu — nenhuma linha de zero. */}
        <div className="mt-4 border-t border-zinc-100 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Na semana · desde {semana.desde.split("-").reverse().slice(0, 2).join("/")}
          </p>
          {semana.conquistas.length === 0 ? (
            <p className="mt-1.5 text-xs text-zinc-500">Ainda nada fechado nesta semana.</p>
          ) : (
            <ul className="mt-1.5 space-y-1.5">
              {semana.conquistas.map((c) => (
                <li key={c.chave}>
                  <Link href={c.href ?? "#"} className="block text-xs hover:opacity-80">
                    <span className="font-medium text-zinc-800">{c.titulo}</span>
                    <span className="text-zinc-500"> · {c.detalhe}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SurfaceCard>

    </div>
  );
}
