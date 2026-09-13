"use client";

import { useState } from "react";

import { Loader2, Save, TriangleAlert } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";
import { inputClass } from "@/components/shared/Modal";

import { PRAZOS_DE_AREA_PADRAO, type PrazosDeArea } from "@/lib/models/movement";
import { AREAS_INTERNAS } from "@/lib/models/mensagens";
import { descreverPrazo } from "@/lib/services/horasUteis";

import { salvarPrazosDeArea } from "@/lib/actions/tratativa";
import { useMovements } from "@/lib/context/MovementsContext";
import { useSession } from "@/lib/context/SessionContext";
import { useToast } from "@/lib/context/ToastContext";

const NIVEIS: { id: keyof PrazosDeArea; tom: string }[] = [
  { id: "Urgente", tom: "bg-rose-50 text-rose-700 ring-rose-200" },
  { id: "Alta", tom: "bg-orange-50 text-orange-700 ring-orange-200" },
  { id: "Normal", tom: "bg-zinc-100 text-zinc-600 ring-zinc-200" },
];

function igual(a: PrazosDeArea, b: PrazosDeArea) {
  return a.Urgente === b.Urgente && a.Alta === b.Alta && a.Normal === b.Normal;
}

/**
 * O prazo das áreas internas pela criticidade do caso.
 *
 * A documentação: "Urgente (4 horas), Alta (1 dia útil), Normal (2 dias
 * úteis)" — e o não cumprimento é escalonado ao gestor da área. O prazo
 * vale para as cinco áreas do modelo de acionamento; destino fora delas
 * (o próprio cliente, um parceiro) segue a regra cadastrada na tabela
 * abaixo.
 */
export default function PrazosDeAreaCard() {

  const { prazosDeArea, setPrazosDeArea } = useMovements();
  const { notify } = useToast();
  const sessao = useSession();

  const podeEditar = sessao?.role === "ADMIN";

  const [rascunho, setRascunho] = useState<PrazosDeArea>(prazosDeArea);
  const [base, setBase] = useState<PrazosDeArea>(prazosDeArea);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  /* A carga do workspace chega depois da montagem: acompanha enquanto ninguém editou. */
  if (!igual(prazosDeArea, base)) {
    setBase(prazosDeArea);
    if (igual(rascunho, base)) setRascunho(prazosDeArea);
  }

  const sujo = !igual(rascunho, prazosDeArea);
  const daDocumentacao = igual(rascunho, PRAZOS_DE_AREA_PADRAO);

  async function salvar() {

    setSalvando(true);
    setErro(null);

    try {
      const r = await salvarPrazosDeArea(rascunho);

      if (!r.ok) {
        setErro(r.erro);
        return;
      }

      setPrazosDeArea(r.prazos);
      setRascunho(r.prazos);

      notify({
        tone: "success",
        title: "Prazos das áreas salvos.",
        detail: `Urgente ${descreverPrazo(r.prazos.Urgente)}, Alta ${descreverPrazo(r.prazos.Alta)}, Normal ${descreverPrazo(r.prazos.Normal)}. Valem para os próximos acionamentos — os abertos mantêm o prazo com que foram feitos.`,
      });
    } catch {
      setErro("Os prazos não foram gravados. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <SurfaceCard
      title="Prazo de retorno das áreas"
      description={`Por criticidade do caso, em horas úteis. Vale para ${AREAS_INTERNAS.map((a) => a.nome).join(", ")}.`}
      hint="O prazo fica congelado no acionamento: mudar aqui não reescreve o compromisso de quem já está com um caso. Vencido, a plataforma monta a mensagem de escalonamento ao gestor da área."
    >

      <div className="grid gap-3 sm:grid-cols-3">
        {NIVEIS.map((n) => (
          <label key={n.id} className="block rounded-xl border border-zinc-200 p-3.5">
            <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${n.tom}`}>
              {n.id}
            </span>
            <span className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={720}
                step={1}
                value={rascunho[n.id]}
                disabled={!podeEditar}
                onChange={(e) => setRascunho((r) => ({ ...r, [n.id]: Math.round(Number(e.target.value) || 0) }))}
                className={`${inputClass} w-24 tabular-nums`}
              />
              <span className="text-sm text-zinc-500">horas úteis</span>
            </span>
            <span className="mt-1.5 block text-xs text-zinc-500">
              {rascunho[n.id] > 0 ? `= ${descreverPrazo(rascunho[n.id])}` : "—"}
            </span>
          </label>
        ))}
      </div>

      {!daDocumentacao && podeEditar && (
        <button
          type="button"
          onClick={() => setRascunho(PRAZOS_DE_AREA_PADRAO)}
          className="mt-3 text-xs font-medium text-violet-700 hover:underline"
        >
          Voltar aos prazos da documentação (4h, 1 dia útil, 2 dias úteis)
        </button>
      )}

      {!podeEditar && (
        <p className="mt-3 text-xs text-zinc-500">Só administradores mudam os prazos.</p>
      )}

      {erro && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-100">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          {erro}
        </p>
      )}

      {podeEditar && sujo && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setRascunho(prazosDeArea)}
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
            {salvando ? "Salvando…" : "Salvar prazos"}
          </button>
        </div>
      )}

    </SurfaceCard>
  );
}
