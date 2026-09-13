"use client";

import Link from "next/link";

import { useMemo, useState } from "react";

import { FolderPlus, Loader2, Repeat } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { frente as frenteDaOperacao } from "@/lib/models/frentes";
import {
  FRENTES,
  reincidenciasCruzadas,
  REINCIDENCIA_DIAS,
  tendenciaCruzada,
  type Frente,
  type RegistroDeCausa,
} from "@/lib/models/causaRaiz";
import { isSocial } from "@/lib/services/case.service";
import { nomeDoCliente } from "@/lib/models/nps";

import { abrirProjetoDeReincidencia } from "@/lib/actions/causaRaiz";
import { useAvaliacoesGoogle } from "@/lib/context/useAvaliacoesGoogle";
import { useCases } from "@/lib/context/CaseContext";
import { useNps } from "@/lib/context/NpsContext";
import { useToast } from "@/lib/context/ToastContext";
import { useProjects } from "@/lib/context/ProjectsContext";
import { useAgora } from "@/lib/hooks/useAgora";

const JANELAS = [30, 90, 180];

/**
 * A causa raiz somando as quatro frentes.
 *
 * Uma barra por causa, dividida pela frente de onde veio — é a leitura
 * que a lista única tornou possível. Embaixo, o que passou de três
 * registros em 30 dias: a reincidência que o documento de reputação
 * manda transformar em melhoria, com o botão que abre o item em Projetos.
 */
export default function CausaRaizCruzada() {

  const { cases } = useCases();
  const { responses } = useNps();
  const { notify } = useToast();
  const { recarregar: recarregarProjetos } = useProjects();
  const agora = useAgora();

  const [dias, setDias] = useState(90);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [abertos, setAbertos] = useState<Record<string, { id: string; title: string }>>({});

  const { avaliacoes: google } = useAvaliacoesGoogle();

  /* Todo registro das quatro frentes, com ou sem causa — a cobertura precisa dos dois. */
  const todos = useMemo(() => {
    const lista: (Omit<RegistroDeCausa, "causa"> & { causa?: string })[] = [];
    for (const c of cases) {
      const frente: Frente = isSocial(c) ? "redes" : "reclame-aqui";
      lista.push({ frente, causa: c.causaRaiz, em: c.recebidaEm ?? `${c.createdAt}T12:00:00Z`, rotulo: `${c.id} — ${c.title}` });
    }
    for (const r of responses) {
      /* O promotor calado não tem o que classificar; contá-lo esconderia a cobertura real. */
      if (!r.rootCause && !r.comment.trim()) continue;
      lista.push({ frente: "nps", causa: r.rootCause, em: r.respondedAt, rotulo: `NPS — ${nomeDoCliente(r)}, nota ${r.score}` });
    }
    for (const g of google) {
      if (g.status === "denunciada") continue;
      lista.push({ frente: "google", causa: g.causaRaiz, em: g.publicadaEm, rotulo: `Google — ${g.autor}, ${g.estrelas} estrela(s)` });
    }
    return lista;
  }, [cases, responses, google]);

  const comCausa = useMemo(() => todos.filter((r): r is RegistroDeCausa => Boolean(r.causa?.trim())), [todos]);

  const linhas = useMemo(() => (agora ? tendenciaCruzada(comCausa, { agora, dias }) : []), [comCausa, agora, dias]);
  const reincidencias = useMemo(() => (agora ? reincidenciasCruzadas(comCausa, agora) : []), [comCausa, agora]);

  const cobertura = useMemo(() => {
    const desde = (agora?.getTime() ?? 0) - dias * 86_400_000;
    return FRENTES.map((f) => {
      const daFrente = todos.filter((r) => r.frente === f && Date.parse(r.em) >= desde);
      return { frente: f, total: daFrente.length, comCausa: daFrente.filter((r) => r.causa?.trim()).length };
    });
  }, [todos, agora, dias]);

  const maior = Math.max(1, ...linhas.map((l) => l.total));

  async function abrir(causa: string) {
    setConfirmando(null);
    setAbrindo(causa);
    try {
      const r = await abrirProjetoDeReincidencia({ causa });
      if (!r.ok) {
        notify({ tone: "error", title: "O item não foi aberto.", detail: r.erro });
        return;
      }
      setAbertos((atual) => ({ ...atual, [causa.toLowerCase()]: r.projeto }));
      if (!r.jaExistia) await recarregarProjetos();
      notify({
        tone: r.jaExistia ? "info" : "success",
        title: r.jaExistia ? "Já existe o item deste mês." : "Item aberto em Projetos e Melhorias.",
        detail: `${r.projeto.title} — com os ${r.registros} registros listados.`,
      });
    } catch {
      notify({ tone: "error", title: "O item não foi aberto.", detail: "Tente de novo em instantes." });
    } finally {
      setAbrindo(null);
    }
  }

  return (
    <SurfaceCard
      title="Causa raiz nas quatro frentes"
      description="A mesma lista no Reclame Aqui, nas redes, no NPS e no Google — somada, é o que mais faz o cliente reclamar."
      action={
        <div className="flex shrink-0 items-center gap-0.5 rounded-lg bg-zinc-100 p-0.5">
          {JANELAS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDias(d)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${dias === d ? "bg-white text-violet-700 shadow-sm" : "text-zinc-600 hover:text-zinc-800"}`}
            >
              {d} dias
            </button>
          ))}
        </div>
      }
    >

      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-zinc-600">
        {FRENTES.map((f) => (
          <span key={f} className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: frenteDaOperacao(f).cor }} />
            {frenteDaOperacao(f).nome}
          </span>
        ))}
      </div>

      {linhas.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm font-medium text-zinc-700">Nenhuma causa raiz marcada nos últimos {dias} dias.</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-zinc-500">
            A causa se marca no caso (aba Investigação), no encerramento das redes, na ficha do NPS e na tratativa do Google.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {linhas.slice(0, 10).map((l) => (
            <li key={l.causa}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                <span className="font-medium text-zinc-800">{l.causa}</span>
                <span className="tabular-nums text-zinc-500">
                  {l.total} · {l.ultimos30} nos últimos 30 dias
                </span>
              </div>
              <div
                className="flex h-2.5 overflow-hidden rounded-full bg-zinc-100"
                role="img"
                aria-label={FRENTES.filter((f) => l.porFrente[f]).map((f) => `${frenteDaOperacao(f).nome}: ${l.porFrente[f]}`).join(", ")}
              >
                {FRENTES.map((f) =>
                  l.porFrente[f] ? (
                    <span
                      key={f}
                      title={`${frenteDaOperacao(f).nome}: ${l.porFrente[f]}`}
                      style={{ width: `${(l.porFrente[f] / maior) * 100}%`, background: frenteDaOperacao(f).cor }}
                    />
                  ) : null
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Cobertura: sem causa marcada, o registro não entra em lugar nenhum. */}
      <p className="mt-4 text-xs leading-relaxed text-zinc-500">
        Com causa marcada nos últimos {dias} dias:{" "}
        {cobertura.map((c, i) => (
          <span key={c.frente}>
            {i > 0 && " · "}
            {frenteDaOperacao(c.frente).curto} <strong className="tabular-nums text-zinc-700">{c.comCausa}</strong> de {c.total}
          </span>
        ))}
        . O que fica sem causa não aparece no gráfico.
      </p>

      {reincidencias.length > 0 && (
        <div className="mt-5 border-t border-zinc-100 pt-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-rose-700">
            <Repeat size={13} /> Reincidência — {REINCIDENCIA_DIAS} dias, somando as frentes
          </p>
          <ul className="mt-2 space-y-2">
            {reincidencias.map((r) => {
              const aberto = abertos[r.causa.toLowerCase()];
              return (
                <li key={r.causa} className="rounded-xl bg-rose-50/60 px-3.5 py-2.5 ring-1 ring-inset ring-rose-100">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm text-rose-950">
                      <strong className="font-semibold">{r.causa}</strong>: {r.registros.length} registros ({r.frentes.map((f) => frenteDaOperacao(f).nome).join(", ")})
                    </span>
                    {aberto ? (
                      <Link href="/projetos" className="text-xs font-medium text-violet-700 hover:underline">
                        Ver em Projetos
                      </Link>
                    ) : confirmando === r.causa ? (
                      <span className="flex items-center gap-1.5 text-xs text-rose-900">
                        Abrir o item com os {r.registros.length} registros?
                        <button type="button" onClick={() => setConfirmando(null)} className="rounded-md px-2 py-1 font-medium hover:bg-rose-100">
                          Cancelar
                        </button>
                        <button type="button" onClick={() => abrir(r.causa)} className="rounded-md bg-violet-700 px-2.5 py-1 font-semibold text-white hover:bg-violet-800">
                          Confirmar
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={abrindo !== null}
                        onClick={() => setConfirmando(r.causa)}
                        className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200 hover:bg-violet-50 disabled:opacity-50"
                      >
                        {abrindo === r.causa ? <Loader2 size={12} className="animate-spin" /> : <FolderPlus size={12} />}
                        Abrir item em Projetos
                      </button>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-rose-900/70">{r.registros.slice(0, 3).map((x) => x.rotulo).join(" · ")}</p>
                </li>
              );
            })}
          </ul>
        </div>
      )}

    </SurfaceCard>
  );
}
