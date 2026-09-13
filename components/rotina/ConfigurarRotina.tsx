"use client";

import { useState } from "react";

import { ArrowDown, ArrowUp, Loader2, Plus, Save, TriangleAlert } from "lucide-react";

import Modal, { GhostButton, inputClass } from "@/components/shared/Modal";

import { salvarRotina } from "@/lib/actions/rotina";
import { useToast } from "@/lib/context/ToastContext";

import {
  DIAS_DA_SEMANA,
  ROTULO_DA_FREQUENCIA,
  type AtividadeDaRotina,
  type CategoriaDaRotina,
  type Frequencia,
} from "@/lib/models/rotina";

const CATEGORIAS: CategoriaDaRotina[] = ["Operacional", "Organização", "Demandas Internas", "Gestão"];
const FREQUENCIAS: Frequencia[] = ["diaria", "semanal", "continua"];

interface Props {
  atividades: AtividadeDaRotina[];
  onClose: () => void;
  onSalvo: (atividades: AtividadeDaRotina[]) => void;
}

/**
 * Configurar a rotina: o que entra no checklist, em que dia e em que hora.
 *
 * "Tem que ser possível configurar atividades semanais para esse
 * checklist sair direitinho." A semanal escolhe os dias da semana; a
 * diária pode ter horário (a planilha às 8h, o checkpoint às 17h30) e
 * uma duração-base, que é o que o plano do dia usa para caber no
 * expediente. Tirar da lista desativa — as marcas antigas ficam.
 */
export default function ConfigurarRotina({ atividades, onClose, onSalvo }: Props) {

  const { notify } = useToast();

  const [lista, setLista] = useState<AtividadeDaRotina[]>(() => atividades.map((a) => ({ ...a })));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const alterada = JSON.stringify(lista) !== JSON.stringify(atividades);

  function mudar(i: number, patch: Partial<AtividadeDaRotina>) {
    setLista((atual) => atual.map((a, j) => (j === i ? { ...a, ...patch } : a)));
    setErro(null);
  }

  function mover(i: number, delta: number) {
    setLista((atual) => {
      const j = i + delta;
      if (j < 0 || j >= atual.length) return atual;
      const nova = [...atual];
      [nova[i], nova[j]] = [nova[j], nova[i]];
      return nova;
    });
  }

  function nova() {
    setLista((atual) => [
      ...atual,
      {
        id: `nova-${Date.now()}`,
        titulo: "",
        frequencia: "semanal",
        diasDaSemana: [1],
        duracaoMin: 30,
        categoria: "Operacional",
        ordem: atual.length,
        ativa: true,
      },
    ]);
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const r = await salvarRotina(lista.map((a, i) => ({ ...a, ordem: i })));
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      onSalvo(r.atividades);
      notify({
        tone: "success",
        title: "Rotina salva.",
        detail: [
          r.criadas ? `${r.criadas} nova(s)` : null,
          r.alteradas ? `${r.alteradas} alterada(s)` : null,
          r.desativadas ? `${r.desativadas} desativada(s)` : null,
        ]
          .filter(Boolean)
          .join(" · ") || "Nada mudou.",
      });
      onClose();
    } catch {
      setErro("A rotina não foi salva. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  const campo = "text-[11px] font-semibold uppercase tracking-wide text-zinc-500";

  return (
    <Modal
      open
      size="wide"
      title="Configurar a rotina"
      description="As atividades do documento Gestão de Rotinas são o ponto de partida. Ajuste dias, horários e durações — e crie as semanais que o time tem."
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={nova} className="mr-auto flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium text-violet-700 hover:bg-violet-50">
            <Plus size={15} /> Nova atividade
          </button>
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <button
            type="button"
            onClick={salvar}
            disabled={!alterada || salvando}
            className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Salvar
          </button>
        </>
      }
    >

      <ul className="space-y-2.5">
        {lista.map((a, i) => (
          <li key={a.id} className={`rounded-xl border p-3 ${a.ativa ? "border-zinc-200" : "border-dashed border-zinc-200 opacity-60"}`}>

            <div className="flex items-start gap-2">
              <div className="flex shrink-0 flex-col">
                <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir" className="rounded p-0.5 text-zinc-400 hover:text-zinc-700 disabled:opacity-30">
                  <ArrowUp size={14} />
                </button>
                <button type="button" onClick={() => mover(i, 1)} disabled={i === lista.length - 1} aria-label="Descer" className="rounded p-0.5 text-zinc-400 hover:text-zinc-700 disabled:opacity-30">
                  <ArrowDown size={14} />
                </button>
              </div>

              <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <label className="block">
                  <span className={campo}>Atividade</span>
                  <input value={a.titulo} onChange={(e) => mudar(i, { titulo: e.target.value })} placeholder="O que fazer" className={`mt-1 ${inputClass}`} />
                </label>
                <label className="block">
                  <span className={campo}>Frequência</span>
                  <select
                    value={a.frequencia}
                    onChange={(e) => {
                      const f = e.target.value as Frequencia;
                      mudar(i, { frequencia: f, diasDaSemana: f === "semanal" && a.diasDaSemana.length === 0 ? [1] : a.diasDaSemana });
                    }}
                    className={`mt-1 ${inputClass}`}
                  >
                    {FREQUENCIAS.map((f) => (
                      <option key={f} value={f}>{ROTULO_DA_FREQUENCIA[f]}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={campo}>Categoria</span>
                  <select value={a.categoria} onChange={(e) => mudar(i, { categoria: e.target.value as CategoriaDaRotina })} className={`mt-1 ${inputClass}`}>
                    {CATEGORIAS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-end gap-3 pl-7">
              {a.frequencia === "semanal" && (
                <div>
                  <span className={campo}>Dias</span>
                  <div className="mt-1 flex gap-1">
                    {DIAS_DA_SEMANA.map((d) => {
                      const on = a.diasDaSemana.includes(d.n);
                      return (
                        <button
                          key={d.n}
                          type="button"
                          onClick={() => mudar(i, { diasDaSemana: on ? a.diasDaSemana.filter((x) => x !== d.n) : [...a.diasDaSemana, d.n] })}
                          aria-pressed={on}
                          title={d.nome}
                          className={`h-8 w-9 rounded-lg text-xs font-medium ring-1 ring-inset transition-colors ${on ? "bg-violet-50 text-violet-800 ring-violet-300" : "text-zinc-500 ring-zinc-200 hover:bg-zinc-50"}`}
                        >
                          {d.curto}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {a.frequencia !== "continua" && (
                <label className="block w-28">
                  <span className={campo}>Horário</span>
                  <input type="time" value={a.horario ?? ""} onChange={(e) => mudar(i, { horario: e.target.value || undefined })} className={`mt-1 ${inputClass}`} />
                </label>
              )}
              <label className="block w-28">
                <span className={campo}>Duração (min)</span>
                <input
                  inputMode="numeric"
                  value={String(a.duracaoMin)}
                  onChange={(e) => mudar(i, { duracaoMin: Math.min(480, Number(e.target.value.replace(/\D/g, "") || 0)) })}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <label className="flex cursor-pointer items-center gap-2 pb-2.5 text-sm text-zinc-700">
                <input type="checkbox" checked={a.ativa} onChange={(e) => mudar(i, { ativa: e.target.checked })} className="h-4 w-4 accent-violet-700" />
                Ativa
              </label>
              {a.chave && <span className="pb-3 text-[11px] text-zinc-400">conta sozinha: {a.chave}</span>}
            </div>

          </li>
        ))}
      </ul>

      {erro && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-100">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          {erro}
        </p>
      )}

    </Modal>
  );
}
