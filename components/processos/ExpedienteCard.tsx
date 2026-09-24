"use client";

import { useMemo, useState } from "react";

import { CalendarDays, Loader2, Save, TriangleAlert } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";
import { inputClass } from "@/components/shared/Modal";

import {
  Expediente,
  folgasDoAno,
  horaDoMinuto,
  minutoDaHora,
  paredeDe,
} from "@/lib/services/horasUteis";

import { salvarExpediente } from "@/lib/actions/tratativa";
import { useSession } from "@/lib/context/SessionContext";
import { useSla } from "@/lib/context/SlaContext";
import { useToast } from "@/lib/context/ToastContext";

const DIAS = [
  { id: 1, curto: "Seg" },
  { id: 2, curto: "Ter" },
  { id: 3, curto: "Qua" },
  { id: 4, curto: "Qui" },
  { id: 5, curto: "Sex" },
  { id: 6, curto: "Sáb" },
  { id: 0, curto: "Dom" },
];

function igual(a: Expediente, b: Expediente) {
  return (
    a.inicioMin === b.inicioMin &&
    a.fimMin === b.fimMin &&
    a.pularFacultativos === b.pularFacultativos &&
    [...a.dias].sort().join() === [...b.dias].sort().join()
  );
}

/**
 * O expediente que dá sentido a "hora útil".
 *
 * Todos os prazos da documentação dependem dele: "até 4h úteis" de uma
 * reclamação que chega às 17h vence às 11h do dia seguinte com o
 * expediente das 8h às 18h, e às 12h com o das 9h às 18h. Por isso ele
 * fica à vista na tela dos prazos, com os próximos feriados — para quem
 * olha poder conferir o calendário que o relógio está usando.
 */
export default function ExpedienteCard() {

  const { expediente, setExpediente } = useSla();
  const { notify } = useToast();
  const sessao = useSession();

  const podeEditar = sessao?.role === "ADMIN";

  const [rascunho, setRascunho] = useState<Expediente>(expediente);
  const [base, setBase] = useState<Expediente>(expediente);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  /* A carga do workspace chega depois da montagem: acompanha enquanto ninguém editou. */
  if (!igual(expediente, base)) {
    setBase(expediente);
    if (igual(rascunho, base)) setRascunho(expediente);
  }

  const sujo = !igual(rascunho, expediente);

  const proximas = useMemo(() => {
    const hoje = paredeDe(new Date()).dia;
    const ano = Number(hoje.slice(0, 4));
    return [...folgasDoAno(ano), ...folgasDoAno(ano + 1)]
      .filter((f) => f.dia >= hoje && (!f.facultativo || rascunho.pularFacultativos))
      .slice(0, 6);
  }, [rascunho.pularFacultativos]);

  function alternarDia(id: number) {
    setRascunho((r) => ({
      ...r,
      dias: r.dias.includes(id) ? r.dias.filter((d) => d !== id) : [...r.dias, id],
    }));
  }

  async function salvar() {

    setSalvando(true);
    setErro(null);

    try {
      const r = await salvarExpediente(rascunho);

      if (!r.ok) {
        setErro(r.erro);
        return;
      }

      setExpediente(r.expediente);
      setRascunho(r.expediente);

      notify({
        tone: "success",
        title: "Expediente salvo.",
        detail: `${horaDoMinuto(r.expediente.inicioMin)} às ${horaDoMinuto(r.expediente.fimMin)}, ${DIAS.filter((d) => r.expediente.dias.includes(d.id)).map((d) => d.curto.toLowerCase()).join(", ")}. Os relógios de todos os casos já contam assim.`,
      });
    } catch {
      setErro("O expediente não foi gravado. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <SurfaceCard
      title="Expediente"
      description="O que conta como hora útil em todos os prazos: Reclame Aqui, Redes Sociais, NPS e áreas internas."
      hint="24h úteis equivalem a um dia útil e caem na mesma hora do dia útil seguinte. Prazo menor que um dia conta só dentro do expediente. Fins de semana e feriados nacionais não contam."
    >

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">

        <div className="space-y-4">

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Abre às</span>
              <input
                type="time"
                value={horaDoMinuto(rascunho.inicioMin)}
                disabled={!podeEditar}
                onChange={(e) => setRascunho((r) => ({ ...r, inicioMin: minutoDaHora(e.target.value) }))}
                className={`mt-1.5 ${inputClass}`}
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Fecha às</span>
              <input
                type="time"
                value={horaDoMinuto(rascunho.fimMin)}
                disabled={!podeEditar}
                onChange={(e) => setRascunho((r) => ({ ...r, fimMin: minutoDaHora(e.target.value) }))}
                className={`mt-1.5 ${inputClass}`}
              />
            </label>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Dias úteis</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {DIAS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  disabled={!podeEditar}
                  onClick={() => alternarDia(d.id)}
                  aria-pressed={rascunho.dias.includes(d.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                    rascunho.dias.includes(d.id)
                      ? "border-violet-300 bg-violet-50 text-violet-800"
                      : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
                  }`}
                >
                  {d.curto}
                </button>
              ))}
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-3.5">
            <input
              type="checkbox"
              checked={rascunho.pularFacultativos}
              disabled={!podeEditar}
              onChange={(e) => setRascunho((r) => ({ ...r, pularFacultativos: e.target.checked }))}
              className="mt-0.5 h-4 w-4 accent-violet-700"
            />
            <span>
              <span className="block text-sm font-medium text-zinc-800">
                Carnaval e Corpus Christi não contam
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">
                São pontos facultativos, não feriados. Desmarque se a operação trabalha nesses dias.
              </span>
            </span>
          </label>

          {!podeEditar && (
            <p className="text-xs text-zinc-500">Só administradores mudam o expediente.</p>
          )}

          {erro && (
            <p className="flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-100">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              {erro}
            </p>
          )}

          {podeEditar && sujo && (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRascunho(expediente)}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
              >
                Descartar
              </button>
              <button
                type="button"
                onClick={salvar}
                disabled={salvando}
                className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
              >
                {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                {salvando ? "Salvando…" : "Salvar expediente"}
              </button>
            </div>
          )}

        </div>

        <div className="rounded-xl bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-200">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            <CalendarDays size={13} /> Próximas folgas
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {proximas.map((f) => {
              const [a, m, d] = f.dia.split("-");
              return (
                <li key={f.dia + f.nome} className="flex items-baseline justify-between gap-3">
                  <span className="text-zinc-700">{f.nome}</span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-zinc-500">
                    {d}/{m}/{a.slice(2)}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-zinc-400">
            Calculadas a partir da Páscoa de cada ano — ninguém precisa manter uma lista.
          </p>
        </div>

      </div>

    </SurfaceCard>
  );
}
