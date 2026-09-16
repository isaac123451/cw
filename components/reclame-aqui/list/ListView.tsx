"use client";

import { useState } from "react";

import { useScopedCases } from "@/lib/context/useScopedCases";

import CasesTable from "./CasesTable";
import VazioComSaida from "@/components/shared/VazioComSaida";
import CaseDrawer from "../drawer/CaseDrawer";

/** Mesmo lote do Kanban: cobre a rolagem inicial sem montar a base toda. */
const LOTE = 50;

export default function ListView() {
  const { cases, filteredCases, clearFilters } = useScopedCases("reclame-aqui");

  /**
   * Guarda o id, não o objeto: guardando o objeto o painel congelava
   * numa cópia e não refletia as edições feitas dentro dele.
   */
  const [selectedId, setSelectedId] = useState<
    string | null
  >(null);

  const [visiveis, setVisiveis] = useState(LOTE);

  const mostrados = filteredCases.slice(0, visiveis);

  const restantes =
    filteredCases.length - mostrados.length;

  return (
    <>
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">

        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">

          <div>

            <h2 className="text-base font-semibold tracking-tight text-zinc-900">

              Lista de Reclamações

            </h2>

            <p className="mt-0.5 text-sm text-zinc-500">

              {filteredCases.length}{" "}
              {filteredCases.length === 1
                ? "reclamação encontrada"
                : "reclamações encontradas"}

            </p>

          </div>

        </div>

        {filteredCases.length === 0 ? (

          <VazioComSaida
            titulo={cases.length === 0 ? "Nenhuma reclamação na base ainda." : "Nenhuma reclamação corresponde aos filtros aplicados."}
            porque={
              cases.length === 0
                ? "As reclamações chegam pelo vigia da extensão, quando alguém abre o Reclame Aqui no navegador, ou pelo botão de nova reclamação."
                : "A busca, a etapa, a prioridade ou o período deixaram a lista vazia."
            }
            saidas={cases.length === 0 ? [{ rotulo: "Ferramentas e acessos", href: "/ferramentas" }] : [{ rotulo: "Limpar os filtros", onClick: clearFilters }]}
          />

        ) : (

          <>
            <CasesTable
              cases={mostrados}
              onSelect={(item) => setSelectedId(item.id)}
            />

            {restantes > 0 && (

              <div className="border-t border-zinc-100 p-3">

                <button
                  onClick={() =>
                    setVisiveis((valor) => valor + LOTE)
                  }
                  className="w-full rounded-xl border border-dashed border-zinc-300 py-2.5 text-xs font-medium text-zinc-500 transition-colors hover:border-violet-300 hover:bg-violet-50/40 hover:text-violet-700"
                >
                  Mostrar mais {Math.min(restantes, LOTE)}{" "}
                  de {restantes}
                </button>

              </div>

            )}
          </>

        )}

      </div>

      <CaseDrawer
        open={selectedId !== null}
        caseId={selectedId ?? undefined}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}