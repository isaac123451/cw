"use client";

import { useEffect, useMemo, useState } from "react";

import { Loader2 } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { salvarMetasDoReclameAqui, type MetasGravadas } from "@/lib/actions/metasDoReclameAqui";
import { useToast } from "@/lib/context/ToastContext";
import type { MetaDoMes } from "@/lib/models/planoDeAcao";
import { nomeDoMes, type MesPrevisto } from "@/lib/models/previsaoDeReclamacoes";
import { RA1000_MINIMO_DE_AVALIACOES, RA1000_TARGETS } from "@/lib/services/reputation.service";

import { br } from "./formato";
import { pluralDe } from "@/lib/plural";

type Campo = "nota" | "resposta" | "consumidor" | "solucao" | "voltaria" | "avaliacoes" | "recebidasPrevistas";

const COLUNAS: { campo: Campo; rotulo: string; dica: string; inteiro?: boolean }[] = [
  { campo: "nota", rotulo: "Nota", dica: "ex.: 8,5" },
  { campo: "resposta", rotulo: "Respondidas %", dica: "ex.: 95" },
  { campo: "consumidor", rotulo: "Consumidor", dica: "ex.: 8" },
  { campo: "solucao", rotulo: "Solução %", dica: "ex.: 92" },
  { campo: "voltaria", rotulo: "Voltaria %", dica: "ex.: 80" },
  { campo: "avaliacoes", rotulo: "Avaliações", dica: "ex.: 60", inteiro: true },
  { campo: "recebidasPrevistas", rotulo: "Reclamações previstas", dica: "", inteiro: true },
];

type Rascunho = Record<string, Record<Campo | "observacao", string>>;

const texto = (v: number | null | undefined) => (v == null ? "" : String(v).replace(".", ","));

function paraRascunho(meses: string[], metas: Map<string, MetaDoMes>): Rascunho {
  return Object.fromEntries(
    meses.map((mes) => {
      const m = metas.get(mes);
      return [mes, { nota: texto(m?.nota), resposta: texto(m?.resposta), consumidor: texto(m?.consumidor), solucao: texto(m?.solucao), voltaria: texto(m?.voltaria), avaliacoes: texto(m?.avaliacoes), recebidasPrevistas: texto(m?.recebidasPrevistas), observacao: m?.observacao ?? "" }];
    })
  );
}

function numero(s: string, inteiro: boolean): number | null | "invalido" {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || (inteiro && !Number.isInteger(n))) return "invalido";
  return n;
}

/**
 * As metas por mês, editáveis na própria tabela (1.133). Nada grava sozinho:
 * o Salvar confirma e só avisa "gravado" quando o servidor respondeu.
 */
export default function MetasDoPlano({ meses, gravadas, previsoes, aoGravar }: { meses: string[]; gravadas: MetasGravadas | null; previsoes: MesPrevisto[]; aoGravar: (g: MetasGravadas) => void }) {
  const { notify } = useToast();
  const metas = useMemo(() => new Map((gravadas?.metas ?? []).map((m) => [m.mes, m])), [gravadas]);
  const original = useMemo(() => paraRascunho(meses, metas), [meses, metas]);
  const [rascunho, setRascunho] = useState<Rascunho>(original);
  const [confirmar, setConfirmar] = useState(false);
  const [gravando, setGravando] = useState(false);

  useEffect(() => setRascunho(original), [original]);

  const mudados = meses.filter((mes) => JSON.stringify(rascunho[mes]) !== JSON.stringify(original[mes]));
  const podeEditar = Boolean(gravadas?.podeEditar);

  const mudar = (mes: string, campo: Campo | "observacao", valor: string) => setRascunho((r) => ({ ...r, [mes]: { ...r[mes], [campo]: valor } }));

  /** O primeiro mês com alguma meta vira o padrão dos seguintes que estão vazios. */
  function repetir() {
    const fonte = meses.find((m) => COLUNAS.some((c) => c.campo !== "recebidasPrevistas" && rascunho[m]?.[c.campo]));
    if (!fonte) return;
    setRascunho((r) => {
      const novo = { ...r };
      for (const mes of meses) {
        if (mes <= fonte) continue;
        const vazio = COLUNAS.every((c) => c.campo === "recebidasPrevistas" || !r[mes][c.campo]);
        if (vazio) novo[mes] = { ...r[mes], nota: r[fonte].nota, resposta: r[fonte].resposta, consumidor: r[fonte].consumidor, solucao: r[fonte].solucao, voltaria: r[fonte].voltaria, avaliacoes: r[fonte].avaliacoes };
      }
      return novo;
    });
  }

  function regua() {
    setRascunho((r) => {
      const novo = { ...r };
      for (const mes of meses) {
        const x = r[mes];
        novo[mes] = {
          ...x,
          nota: x.nota || "8",
          resposta: x.resposta || String(RA1000_TARGETS.resposta),
          consumidor: x.consumidor || String(RA1000_TARGETS.consumidor),
          solucao: x.solucao || String(RA1000_TARGETS.solucao),
          voltaria: x.voltaria || String(RA1000_TARGETS["novos-negocios"]),
          avaliacoes: x.avaliacoes || String(RA1000_MINIMO_DE_AVALIACOES),
        };
      }
      return novo;
    });
  }

  async function salvar() {
    setConfirmar(false);
    const lista: MetaDoMes[] = [];
    for (const mes of mudados) {
      const r = rascunho[mes];
      const meta: MetaDoMes = { mes, observacao: r.observacao.trim() || null };
      for (const c of COLUNAS) {
        const v = numero(r[c.campo], Boolean(c.inteiro));
        if (v === "invalido") {
          notify({ tone: "error", title: "Nada foi gravado.", detail: `${c.rotulo} de ${nomeDoMes(mes)}: "${r[c.campo]}" não é um número${c.inteiro ? " inteiro" : ""}.` });
          return;
        }
        (meta as unknown as Record<string, number | null>)[c.campo] = v;
      }
      lista.push(meta);
    }
    setGravando(true);
    const res = await salvarMetasDoReclameAqui(lista);
    setGravando(false);
    if (!res.ok) {
      notify({ tone: "error", title: "Nada foi gravado.", detail: res.erro });
      return;
    }
    aoGravar(res);
    notify({ tone: "success", title: `Metas de ${mudados.length} ${pluralDe(mudados.length, "mês", "meses")} gravadas.` });
  }

  return (
    <SurfaceCard
      title="Metas por mês"
      description="A meta de cada mês vale para a nota que o portal mostra no mês seguinte. Deixe em branco o que não tem meta. Em reclamações previstas, um número digitado vence a previsão."
      action={
        podeEditar ? (
          <span className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={regua} className="rounded-lg px-2.5 py-1.5 text-sm text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50">
              Completar com a régua do selo
            </button>
            <button type="button" onClick={repetir} className="rounded-lg px-2.5 py-1.5 text-sm text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50">
              Repetir nos meses vazios
            </button>
          </span>
        ) : undefined
      }
    >
      {!podeEditar && gravadas && <p className="mb-3 text-sm text-zinc-500">Você vê as metas; quem define é administrador.</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400">
              <th className="py-2 pr-3 font-semibold">Mês</th>
              {COLUNAS.map((c) => (
                <th key={c.campo} className="px-1.5 py-2 font-semibold">
                  {c.rotulo}
                </th>
              ))}
              <th className="px-1.5 py-2 font-semibold">Observação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {meses.map((mes) => {
              const prev = previsoes.find((p) => p.mes === mes);
              const mudou = mudados.includes(mes);
              return (
                <tr key={mes} className={mudou ? "bg-amber-50/50" : ""}>
                  <td className="py-1.5 pr-3 font-medium capitalize text-zinc-800">{nomeDoMes(mes)}</td>
                  {COLUNAS.map((c) => (
                    <td key={c.campo} className="px-1.5 py-1.5">
                      <input
                        value={rascunho[mes]?.[c.campo] ?? ""}
                        onChange={(e) => mudar(mes, c.campo, e.target.value)}
                        disabled={!podeEditar}
                        inputMode="decimal"
                        placeholder={c.campo === "recebidasPrevistas" && prev ? `prev. ${prev.previsto}` : c.dica}
                        aria-label={`${c.rotulo} de ${nomeDoMes(mes)}`}
                        className="w-full min-w-[64px] rounded-lg border border-zinc-200 bg-white px-2 py-1 tabular-nums text-zinc-900 placeholder:text-zinc-300 focus:border-violet-400 focus:outline-none disabled:bg-zinc-50"
                      />
                    </td>
                  ))}
                  <td className="px-1.5 py-1.5">
                    <input
                      value={rascunho[mes]?.observacao ?? ""}
                      onChange={(e) => mudar(mes, "observacao", e.target.value)}
                      disabled={!podeEditar}
                      maxLength={300}
                      placeholder="campanha, mudança…"
                      aria-label={`Observação de ${nomeDoMes(mes)}`}
                      className="w-full min-w-[140px] rounded-lg border border-zinc-200 bg-white px-2 py-1 text-zinc-900 placeholder:text-zinc-300 focus:border-violet-400 focus:outline-none disabled:bg-zinc-50"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {gravadas?.atualizadas.length ? (
          <span className="text-xs text-zinc-500">
            Última gravação: {br(gravadas.atualizadas.reduce((a, b) => (a.em > b.em ? a : b)).em)}
            {gravadas.atualizadas.reduce((a, b) => (a.em > b.em ? a : b)).por ? ` por ${gravadas.atualizadas.reduce((a, b) => (a.em > b.em ? a : b)).por}` : ""}
          </span>
        ) : null}
        {podeEditar && mudados.length > 0 && (
          <span className="ml-auto flex items-center gap-2">
            {confirmar ? (
              <>
                <span className="text-zinc-700">Gravar as metas de {mudados.length} {pluralDe(mudados.length, "mês", "meses")}?</span>
                <button type="button" onClick={salvar} className="rounded-lg bg-violet-700 px-3 py-1.5 font-medium text-white hover:bg-violet-800">
                  Confirmar
                </button>
                <button type="button" onClick={() => setConfirmar(false)} className="rounded-lg px-3 py-1.5 text-zinc-600 hover:bg-zinc-100">
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setRascunho(original)} className="rounded-lg px-3 py-1.5 text-zinc-600 hover:bg-zinc-100">
                  Desfazer
                </button>
                <button type="button" disabled={gravando} onClick={() => setConfirmar(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-700 px-3 py-1.5 font-medium text-white hover:bg-violet-800 disabled:opacity-50">
                  {gravando && <Loader2 size={14} className="animate-spin" />}
                  Salvar
                </button>
              </>
            )}
          </span>
        )}
      </div>
    </SurfaceCard>
  );
}
