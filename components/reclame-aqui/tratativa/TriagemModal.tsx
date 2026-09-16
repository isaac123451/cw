"use client";

import { useState } from "react";

import { Check, Loader2, Sparkles, TriangleAlert } from "lucide-react";

import Modal, { GhostButton } from "@/components/shared/Modal";

import {
  Case,
  CRITERIO_NORMAL,
  CRITERIOS,
  Prioridade,
  PRIORIDADES,
  prioridadePelosCriterios,
} from "@/lib/models/case";
import { descreverPrazo } from "@/lib/services/horasUteis";
import { resolveRule } from "@/lib/services/sla.service";

import { triarCaso } from "@/lib/actions/tratativa";
import { useUrgenciaPorDado } from "./useUrgenciaPorDado";
import { useSla } from "@/lib/context/SlaContext";
import { useToast } from "@/lib/context/ToastContext";

interface Props {
  item: Case;
  onClose: () => void;
  onSalvo: (patch: Partial<Case>) => void;
}

const TOM: Record<Prioridade, string> = {
  Urgente: "border-rose-300 bg-rose-50 text-rose-800",
  Alta: "border-orange-300 bg-orange-50 text-orange-800",
  Normal: "border-emerald-300 bg-emerald-50 text-emerald-800",
};

/**
 * A triagem do Passo 1, com a tabela de criticidade da documentação.
 *
 * Marcar os critérios sugere o nível — qualquer um de Urgente leva a
 * Urgente, e assim por diante —, e escolher o nível à mão passa na
 * frente da sugestão. Os prazos que o nível implica aparecem antes de
 * salvar: triar como Urgente é aceitar 4h úteis para o 1º contato, e
 * quem clica precisa saber disso.
 */
export default function TriagemModal({ item, onClose, onSalvo }: Props) {

  const { notify } = useToast();
  const { rules } = useSla();

  const [criterios, setCriterios] = useState<string[]>(item.criterios ?? []);

  /** Nível escolhido à mão; `null` segue os critérios. */
  const [escolhido, setEscolhido] = useState<Prioridade | null>(
    item.triadaEm ? item.priority : null
  );

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const porDado = useUrgenciaPorDado(item);
  const faltamMarcar = porDado.sinais.filter((s) => !criterios.includes(s.criterio));

  const sugerido = prioridadePelosCriterios(criterios);
  const nivel = escolhido ?? sugerido;

  const regra = resolveRule({ ...item, priority: nivel }, rules);

  function alternar(id: string) {
    setCriterios((atual) =>
      atual.includes(id) ? atual.filter((c) => c !== id) : [...atual, id]
    );
  }

  async function salvar() {

    setSalvando(true);
    setErro(null);

    try {
      const r = await triarCaso({
        protocol: item.protocol,
        prioridade: nivel,
        criterios,
      });

      if (!r.ok) {
        setErro(r.erro);
        return;
      }

      onSalvo({
        priority: r.priority,
        criterios: r.criterios,
        triadaEm: r.triadaEm,
        triadaPor: r.triadaPor,
      });

      notify({
        tone: "success",
        title: `Triagem salva: ${item.protocol} é ${r.priority}.`,
        detail: regra
          ? `1º contato em até ${descreverPrazo(regra.responseHours)}${regra.solutionHours > 0 ? ` · solução em até ${descreverPrazo(regra.solutionHours)}` : ""}.`
          : "Sem regra de prazo para este nível — cadastre em Processos e SLA.",
      });

      onClose();
    } catch {
      setErro("A triagem não foi gravada. Tente de novo; se repetir, atualize a página.");
    } finally {
      setSalvando(false);
    }
  }

  const grupo = (p: Exclude<Prioridade, "Normal">) =>
    CRITERIOS.filter((c) => c.prioridade === p);

  return (
    <Modal
      open
      porque="ra.criticidade"
      size="wide"
      title={`Triar ${item.protocol}`}
      description="Passo 1 da documentação: classificar a criticidade antes do 1º contato. Os critérios sugerem o nível; você decide."
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {salvando ? "Salvando…" : `Salvar como ${nivel}`}
          </button>
        </>
      }
    >

      <p className="line-clamp-2 text-sm font-medium text-zinc-800">{item.title}</p>

      {porDado.sinais.length > 0 && (
        <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/60 p-3.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-violet-900">
            <Sparkles size={13} /> Os dados sugerem {porDado.nivel}
          </p>
          <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-violet-900/90">
            {porDado.sinais.map((s) => (
              <li key={s.criterio}>
                <strong className="font-semibold">{CRITERIOS.find((c) => c.id === s.criterio)?.texto}:</strong> {s.motivo}.
              </li>
            ))}
          </ul>
          {faltamMarcar.length > 0 ? (
            <button
              type="button"
              onClick={() => setCriterios((atual) => [...atual, ...faltamMarcar.map((s) => s.criterio)])}
              className="mt-2 rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200 transition-colors hover:bg-violet-50"
            >
              Marcar {faltamMarcar.length === 1 ? "este critério" : `estes ${faltamMarcar.length} critérios`}
            </button>
          ) : (
            <p className="mt-2 text-[11px] text-violet-700">Já marcados abaixo.</p>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">

        {(["Urgente", "Alta"] as const).map((p) => (
          <fieldset key={p} className="rounded-2xl border border-zinc-200 p-3.5">
            <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Critérios de {p}
            </legend>

            <div className="space-y-1.5">
              {grupo(p).map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-start gap-2.5 rounded-lg px-1.5 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  <input
                    type="checkbox"
                    checked={criterios.includes(c.id)}
                    onChange={() => alternar(c.id)}
                    className="mt-0.5 h-4 w-4 accent-violet-700"
                  />
                  {c.texto}
                </label>
              ))}
            </div>
          </fieldset>
        ))}

      </div>

      <p className="mt-3 text-xs leading-relaxed text-zinc-500">
        <strong className="font-semibold text-zinc-600">Normal:</strong> {CRITERIO_NORMAL}
      </p>

      <div className="mt-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Nível {escolhido ? "escolhido" : `sugerido pelos critérios`}
        </p>

        <div className="mt-2 grid grid-cols-3 gap-2">
          {PRIORIDADES.map((p) => (
            <button
              key={p}
              type="button"
              /* Escolher o mesmo que os critérios sugerem volta a segui-los. */
              onClick={() => setEscolhido(p === sugerido ? null : p)}
              aria-pressed={nivel === p}
              className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                nivel === p ? TOM[p] : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {escolhido && escolhido !== sugerido && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700">
            <TriangleAlert size={13} className="mt-0.5 shrink-0" />
            Os critérios marcados sugerem {sugerido}. Você escolheu {escolhido} — vale registrar o
            motivo numa anotação do caso.
          </p>
        )}

        <p className="mt-3 rounded-xl bg-zinc-50 px-3.5 py-2.5 text-xs leading-relaxed text-zinc-600 ring-1 ring-inset ring-zinc-200">
          {regra ? (
            <>
              Como {nivel}: <strong>1º contato em até {descreverPrazo(regra.responseHours)}</strong>
              {regra.solutionHours > 0 && (
                <>
                  {" "}
                  e <strong>solução em até {descreverPrazo(regra.solutionHours)}</strong>
                </>
              )}
              , contados da publicação.
            </>
          ) : (
            <>Nenhuma regra de prazo cobre {nivel} ainda. Em Processos e SLA, &ldquo;Usar os prazos da documentação&rdquo; cadastra as três.</>
          )}
        </p>
      </div>

      {erro && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-100">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          {erro}
        </p>
      )}

    </Modal>
  );
}
