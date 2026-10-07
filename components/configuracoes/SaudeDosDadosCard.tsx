"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ArrowUpRight, CheckCircle2, RefreshCw, TriangleAlert } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";
import LinhasCarregando from "@/components/shared/LinhasCarregando";

import { lerSaudeDosDados } from "@/lib/actions/saudeDosDados";
import type { AchadoDaBase } from "@/lib/models/saudeDosDados";

/**
 * Saúde dos dados (out/2026): o que na base parece errado e distorce as
 * contas, com o porquê e o caminho para corrigir. Só aponta — a regra está
 * em `lib/models/saudeDosDados.ts`.
 */
export default function SaudeDosDadosCard() {
  const [estado, setEstado] = useState<{ admin: boolean; achados: AchadoDaBase[] } | { erro: string } | null>(null);
  const [rodada, setRodada] = useState(0);

  useEffect(() => {
    let vivo = true;
    lerSaudeDosDados()
      .then((r) => vivo && setEstado(r.ok ? { admin: r.admin, achados: r.achados } : { erro: r.erro }))
      .catch(() => vivo && setEstado({ erro: "Não deu para conferir agora." }));
    return () => {
      vivo = false;
    };
  }, [rodada]);

  if (estado && "admin" in estado && !estado.admin) return null;

  return (
    <SurfaceCard
      title="Saúde dos dados"
      description="O que na base parece errado e mexe em algum número — conferido agora, a cada abertura. Nada é corrigido sozinho: cada achado leva ao registro."
      action={
        <button
          type="button"
          onClick={() => {
            setEstado(null);
            setRodada((n) => n + 1);
          }}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-50"
        >
          <RefreshCw size={13} /> Conferir de novo
        </button>
      }
    >
      {estado === null ? (
        <LinhasCarregando linhas={3} />
      ) : "erro" in estado ? (
        <p className="text-sm text-rose-700">{estado.erro}</p>
      ) : estado.achados.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-emerald-800">
          <CheckCircle2 size={16} /> Nada fora do lugar: mensalidades, planos, responsáveis, respostas, etapas, causas e agenda conferidos.
        </p>
      ) : (
        <ul className="space-y-3">
          {estado.achados.map((a) => (
            <li key={a.chave} className="rounded-xl px-4 py-3 ring-1 ring-inset ring-amber-200/70 bg-amber-50/50">
              <p className="flex items-start gap-2 text-sm font-semibold text-amber-950">
                <TriangleAlert size={15} className="mt-0.5 shrink-0 text-amber-600" />
                {a.titulo}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-zinc-700">{a.porque}</p>
              <p className="mt-1 text-[13px] font-medium text-zinc-800">{a.acao}</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {a.itens.map((i) => (
                  <li key={i.rotulo}>
                    <Link
                      href={i.href}
                      className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs text-zinc-700 ring-1 ring-inset ring-zinc-200 transition-colors hover:text-violet-700 hover:ring-violet-200"
                    >
                      {i.rotulo} <ArrowUpRight size={11} />
                    </Link>
                  </li>
                ))}
                {a.restantes > 0 && <li className="self-center text-xs text-zinc-500">e mais {a.restantes}</li>}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </SurfaceCard>
  );
}
