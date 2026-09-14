"use client";

import Link from "next/link";

import { useEffect, useMemo, useState } from "react";

import { ArrowUpRight, Check, ChevronDown, ChevronRight, Flame, Loader2, Save, Settings2 } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";
import IconeDaFrente from "@/components/shared/IconeDaFrente";

import { salvarMarcas } from "@/lib/actions/rotina";
import { useToast } from "@/lib/context/ToastContext";

import { FRENTES_DA_OPERACAO, frente } from "@/lib/models/frentes";
import { DIAS_DA_SEMANA, type AtividadeDaRotina } from "@/lib/models/rotina";
import { minutosDaAtividade } from "@/lib/models/meuDia";
import { descreverMinutos } from "@/components/rotina/formato";

import type { useMeuDia } from "@/components/rotina/useMeuDia";

import PorQue from "@/components/shared/PorQue";
type MeuDia = ReturnType<typeof useMeuDia>;

interface Props {
  dia: MeuDia;
  /** Na Agenda: a lista enxuta, sem as contínuas, com o atalho para o Meu dia. */
  compacto?: boolean;
  onConfigurar?: () => void;
  /**
   * As marcas como estão na tela — vivem fora porque o plano do dia
   * também as lê. `null` em setRascunho volta ao que está salvo.
   */
  rascunho: Set<string>;
  setRascunho: (s: Set<string> | null) => void;
}

/**
 * A rotina de hoje, como checklist — o documento, com os números.
 *
 * Era o "Checklist do dia" da Agenda: a IA lia as frentes e inventava a
 * lista. O Isaac pediu que ele seguisse a gestão de rotina. Agora a lista
 * **é** a rotina — as onze diárias e as semanais do dia, na ordem do
 * documento —, e cada linha diz quantos itens tem em cada frente e leva
 * direto à lista certa.
 *
 * As marcas ficam no banco, por pessoa e por dia, com Salvar: é o que
 * dá a barra de progresso e a sequência de dias com a rotina completa.
 */
export default function RotinaDoDia({ dia, compacto = false, onConfigurar, rascunho, setRascunho }: Props) {

  const { notify } = useToast();
  const [aberta, setAberta] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const { doDia, contagens, feitasHoje, sequencia, hoje } = dia;

  const pendentes = useMemo(() => {
    const a = [...rascunho].filter((id) => !feitasHoje.has(id)).length;
    const b = [...feitasHoje].filter((id) => !rascunho.has(id)).length;
    return a + b;
  }, [rascunho, feitasHoje]);

  /* Sair com marca por salvar pede confirmação, como o resto da plataforma. */
  useEffect(() => {
    if (!pendentes) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [pendentes]);

  if (dia.carregando || !contagens || !hoje) {
    return (
      <SurfaceCard title="Rotina de hoje">
        <p className="py-8 text-center text-sm text-zinc-400">{dia.erro ?? "Lendo a rotina e as quatro frentes…"}</p>
      </SurfaceCard>
    );
  }

  const feitas = doDia.filter((a) => rascunho.has(a.id)).length;
  const pct = doDia.length ? Math.round((feitas / doDia.length) * 100) : 0;

  function alternar(id: string) {
    const novo = new Set(rascunho);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    setRascunho(novo);
  }

  async function salvar() {
    setSalvando(true);
    try {
      const r = await salvarMarcas({ dia: hoje!, feitas: doDia.filter((a) => rascunho.has(a.id)).map((a) => a.id) });
      if (!r.ok) {
        notify({ tone: "error", title: "As marcas não foram salvas.", detail: r.erro });
        return;
      }
      /* O que o servidor gravou vira o salvo — inclusive os ids novos das atividades do documento. */
      dia.aplicarMarcas(r.feitas, r.atividades);
      setRascunho(null);
      const completo = r.feitas.length === doDia.length && doDia.length > 0;
      notify({
        tone: "success",
        title: completo ? "Rotina de hoje completa." : `${r.feitas.length} de ${doDia.length} atividades feitas.`,
        detail: completo
          ? `Sequência de ${sequencia + (feitasHoje.size === doDia.length ? 0 : 1)} dia(s) útil(eis) com a rotina inteira.`
          : [r.marcadas ? `${r.marcadas} marcada(s)` : null, r.desmarcadas ? `${r.desmarcadas} desmarcada(s)` : null].filter(Boolean).join(" · ") || "Nada mudou.",
      });
    } catch {
      notify({ tone: "error", title: "As marcas não foram salvas.", detail: "Tente de novo em instantes." });
    } finally {
      setSalvando(false);
    }
  }

  const dow = (a: AtividadeDaRotina) => a.diasDaSemana.map((d) => DIAS_DA_SEMANA.find((x) => x.n === d)?.curto).join(", ");

  return (
    <SurfaceCard
      title="Rotina de hoje"
      description={
        doDia.length === 0
          ? "Hoje não é dia útil: a rotina diária descansa."
          : "A rotina do documento, na ordem dele — com o que cada atividade tem hoje em cada frente."
      }
      action={
        <div className="flex shrink-0 items-center gap-2">
          {sequencia > 0 && (
            <span
              title="Dias úteis seguidos com a rotina inteira marcada."
              className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-100"
            >
              <Flame size={13} /> {sequencia} dia(s)
            </span>
          )}
          {onConfigurar && (
            <button
              type="button"
              onClick={onConfigurar}
              className="flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:border-violet-300 hover:text-violet-700"
            >
              <Settings2 size={14} /> Configurar
            </button>
          )}
          {compacto && (
            <Link href="/meu-dia" className="flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium text-violet-700 hover:bg-violet-50">
              Meu dia <ArrowUpRight size={13} />
            </Link>
          )}
        </div>
      }
    >

      {doDia.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-zinc-600">
            <span>
              <strong className="tabular-nums text-zinc-900">{feitas}</strong> de {doDia.length} feitas
            </span>
            <span className="tabular-nums">{pct}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-emerald-500 transition-all motion-reduce:transition-none" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {doDia.map((a) => {
          const c = a.chave ? contagens[a.chave] : undefined;
          const marcada = rascunho.has(a.id);
          const expandida = aberta === a.id;
          const minutos = minutosDaAtividade(a, c);
          const temItens = Boolean(c && c.itens.length);

          return (
            <li key={a.id} className={`rounded-xl border transition-colors ${marcada ? "border-emerald-200 bg-emerald-50/40" : "border-zinc-200"}`}>
              <div className="flex items-start gap-3 p-3">

                <button
                  type="button"
                  onClick={() => alternar(a.id)}
                  aria-pressed={marcada}
                  aria-label={marcada ? `Desmarcar ${a.titulo}` : `Marcar ${a.titulo} como feita`}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${marcada ? "border-emerald-600 bg-emerald-600 text-white" : "border-zinc-300 hover:border-violet-400"}`}
                >
                  {marcada && <Check size={13} strokeWidth={3} />}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={`text-sm font-medium ${marcada ? "text-zinc-400 line-through" : "text-zinc-800"}`}>{a.titulo}</span>
                    {a.frequencia === "semanal" && (
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-100">semanal · {dow(a)}</span>
                    )}
                    {a.horario && <span className="text-[11px] tabular-nums text-zinc-400">{a.horario}</span>}
                  </div>

                  {c && (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {FRENTES_DA_OPERACAO.filter((f) => (c.porFrente[f.id] ?? 0) > 0).map((f) => (
                        <span key={f.id} title={`${c.porFrente[f.id]} em ${f.nome}`} className="flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700">
                          <IconeDaFrente frente={f.id} size={11} />
                          {c.porFrente[f.id]}
                        </span>
                      ))}
                      {c.atrasados > 0 && (
                        <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-100">
                          {c.atrasados} fora do prazo
                        </span>
                      )}
                      <span className="text-[11px] text-zinc-500">{c.resumo}</span>
                      {c.acumulado && (
                        <Link href={c.acumulado.href} className="text-[11px] font-medium text-violet-700 hover:underline">
                          {c.acumulado.texto}
                        </Link>
                      )}
                    </div>
                  )}
                  {!c && a.descricao && !compacto && <p className="mt-0.5 text-[11px] text-zinc-500">{a.descricao}</p>}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {minutos > 0 && !compacto && <span className="hidden text-[11px] tabular-nums text-zinc-400 sm:inline">~{descreverMinutos(minutos)}</span>}
                  {a.link && (
                    <Link href={a.link} title="Abrir a lista" className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-violet-50 hover:text-violet-700">
                      <ArrowUpRight size={15} />
                    </Link>
                  )}
                  {temItens && (
                    <button
                      type="button"
                      onClick={() => setAberta(expandida ? null : a.id)}
                      aria-expanded={expandida}
                      title={expandida ? "Fechar a lista" : "Ver os itens"}
                      className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                    >
                      {expandida ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>
                  )}
                </div>
              </div>

              {expandida && c && (
                <ul className="max-h-72 space-y-1 overflow-y-auto border-t border-zinc-100 px-3 py-2">
                  {c.itens.slice(0, 40).map((i) => (
                    <li key={`${i.frente ?? "g"}:${i.id}`} className="flex min-w-0 items-start gap-2 text-xs">
                      {i.frente ? <IconeDaFrente frente={i.frente} size={12} className="mt-0.5" /> : <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300" />}
                      <Link href={i.href} className="min-w-0 flex-1">
                        <span className={`block truncate font-medium ${i.atrasado ? "text-rose-700" : "text-zinc-700"} hover:underline`}>{i.titulo}</span>
                        {i.detalhe && <span className="block truncate text-[11px] text-zinc-500">{i.frente ? `${frente(i.frente).curto} · ` : ""}{i.detalhe}</span>}
                      </Link>
                    </li>
                  ))}
                  {c.itens.length > 40 && <li className="pt-1 text-[11px] text-zinc-400">e mais {c.itens.length - 40} — o atalho abre a lista inteira.</li>}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {!compacto && dia.continuas.length > 0 && (
        <div className="mt-5 border-t border-zinc-100 pt-4">
          <div className="flex items-center gap-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Contínuas — conforme a demanda</p>
            <PorQue chave="rotina.prioridade" rotulo="prioridade" />
          </div>
          <ul className="mt-2 flex flex-wrap gap-2">
            {dia.continuas.map((a) => (
              <li key={a.id}>
                <Link href={a.link ?? "#"} className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-700 hover:border-violet-300 hover:text-violet-700">
                  {a.titulo} <ArrowUpRight size={12} className="opacity-50" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pendentes > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-zinc-900 px-4 py-2.5 shadow-[0_16px_40px_-12px_rgba(16,24,40,0.45)] ring-1 ring-white/10">
            <p className="flex items-center gap-2.5 text-sm text-white/70">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-70 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
              </span>
              <span>
                <strong className="font-semibold text-white">{pendentes} marca(s)</strong> por salvar
              </span>
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setRascunho(null)} className="rounded-lg px-2.5 py-1.5 text-sm text-white/70 hover:bg-white/10 hover:text-white">
                Desfazer
              </button>
              <button
                type="button"
                onClick={salvar}
                disabled={salvando}
                className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 disabled:opacity-60"
              >
                {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

    </SurfaceCard>
  );
}
