"use client";

import Link from "next/link";

import {
  AppWindow,
  ArrowRight,
  CalendarClock,
  MessageSquareOff,
  Siren,
  Star,
} from "lucide-react";

import type { AvisoDeAbertura } from "@/lib/models/aberturaDoAgente";
import { useJanelas } from "@/lib/context/JanelasContext";

/**
 * O que o agente diz antes de alguém perguntar (Fase 9.2).
 *
 * **Um assistente que só responde é um campo de busca com boas
 * maneiras.** Quem abre a tela precisa já saber o que perguntar, e a
 * plataforma sabe responder sozinha às quatro perguntas de toda manhã:
 * o que vence hoje, quem está sem notícia, de quem pedir avaliação e se
 * há sinal de crise.
 *
 * Cada aviso tem **duas saídas**, e as duas resolvem: o cartão inteiro
 * leva à tela (ou direto ao caso mais urgente) e o botão de perguntar
 * joga a pergunta no chat, para o agente explicar com os números.
 *
 * Silêncio também é resposta: sem nada pendente, aparece a linha que diz
 * isso — não um espaço em branco que faz duvidar se carregou.
 */

const ICONE = {
  prazo: CalendarClock,
  "sem-noticia": MessageSquareOff,
  avaliacao: Star,
  crise: Siren,
} as const;

const CORES = {
  perigo: "border-rose-200/80 bg-rose-50/60 text-rose-900",
  atencao: "border-amber-200/80 bg-amber-50/60 text-amber-900",
  neutro: "border-violet-200/70 bg-violet-50/50 text-violet-900",
} as const;

const ICONE_COR = {
  perigo: "text-rose-600",
  atencao: "text-amber-600",
  neutro: "text-violet-600",
} as const;

export default function AberturaDoAgente({
  avisos,
  onPerguntar,
}: {
  avisos: AvisoDeAbertura[];
  onPerguntar: (pergunta: string) => void;
}) {

  const { abrir } = useJanelas();

  if (avisos.length === 0) {
    return (
      <p className="rounded-2xl border border-emerald-200/70 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-900">
        Nada vencendo agora, ninguém sem notícia há mais de 2 dias úteis,
        nenhuma avaliação atrasada para pedir e nenhum sinal de crise.
      </p>
    );
  }

  return (
    <div className="space-y-2">

      {avisos.map((aviso) => {

        const Icone = ICONE[aviso.chave];

        return (
          <div
            key={aviso.chave}
            className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${CORES[aviso.tom]}`}
          >

            <Icone
              size={17}
              className={`shrink-0 ${ICONE_COR[aviso.tom]}`}
            />

            <div className="min-w-0 flex-1">

              <p className="text-sm font-semibold">
                {aviso.titulo}
              </p>

              <p className="text-[13px] leading-relaxed opacity-80">
                {aviso.detalhe}
              </p>

            </div>

            <button
              type="button"
              onClick={() => onPerguntar(aviso.pergunta)}
              className="rounded-xl border border-current/20 bg-white/70 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white"
            >
              Perguntar
            </button>

            {aviso.janela && (
              <button
                type="button"
                onClick={() => abrir(aviso.janela!)}
                title="Abrir o caso numa mini-janela"
                className="flex items-center gap-1 rounded-xl border border-current/20 bg-white/70 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white"
              >
                <AppWindow size={13} />
                Janela
              </button>
            )}

            <Link
              href={aviso.href}
              className="flex items-center gap-1 rounded-xl bg-white/70 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white"
            >
              Resolver
              <ArrowRight size={13} />
            </Link>

          </div>
        );
      })}

    </div>
  );
}
