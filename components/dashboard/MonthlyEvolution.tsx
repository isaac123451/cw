"use client";

import { useMemo, useState } from "react";

import { useCases } from "@/lib/context/CaseContext";
import { getMonthlyTrend } from "@/lib/services/case.service";
import {
  hojeNaOperacao,
  inRange,
} from "@/lib/services/reputation.service";

import SurfaceCard from "@/components/shared/SurfaceCard";
import TrendChart from "@/components/shared/TrendChart";

/** As janelas que a tela oferece, em meses. Zero é tudo. */
const JANELAS = [
  { meses: 6, rotulo: "6 meses" },
  { meses: 12, rotulo: "12 meses" },
  { meses: 24, rotulo: "24 meses" },
  { meses: 0, rotulo: "Tudo" },
] as const;

/**
 * A evolução mensal do Dashboard.
 *
 * **Ganhou janela** porque não tinha, e a falta confundia: o bloco de
 * reputação logo acima é a janela oficial de 6 meses, e este gráfico
 * desenhava de fevereiro de 2024 a agosto de 2026 sem dizer. Duas
 * escalas de tempo empilhadas na mesma tela, cada uma respondendo uma
 * pergunta diferente, e nada apontando qual era qual.
 *
 * Doze meses por padrão: seis é curto demais para se ver tendência num
 * gráfico mensal — seriam seis pontos — e "tudo" começa em 2024, quando
 * o volume era outro e a comparação engana.
 */
export default function MonthlyEvolution() {

  const { cases } = useCases();

  const [meses, setMeses] = useState<number>(12);

  const data = useMemo(() => {

    if (meses === 0) return getMonthlyTrend(cases);

    /**
     * O corte é pelo mês, e não por "hoje menos N dias".
     *
     * Um recorte de dias corta o mês mais antigo pela metade, e o
     * gráfico abre com uma coluna baixa que parece queda de volume
     * quando é só o pedaço de mês que sobrou.
     */
    /*
      Conta de mês em UTC, a partir do dia da operação.

      Era `setMonth` e depois `setDate(1)`, e a ordem importa: num dia
      31, `setMonth` para um mês de 30 dias transborda para o seguinte
      — 31 de março menos um mês vira "31 de fevereiro", que o
      JavaScript resolve como 3 de março —, e o `setDate(1)` depois
      disso fecha a janela no mês errado. Nos dias 29 a 31 o gráfico
      abria um mês inteiro atrasado.
    */
    const [ano, mes] = hojeNaOperacao()
      .split("-")
      .map(Number);

    const inicio = new Date(
      Date.UTC(ano, mes - 1 - (meses - 1), 1)
    )
      .toISOString()
      .slice(0, 10);

    return getMonthlyTrend(
      cases.filter((item) =>
        inRange(item, inicio, "2100-01-01")
      )
    );

  }, [cases, meses]);

  return (
    <SurfaceCard
      title="Evolução mensal"
      description="Reclamações recebidas x resolvidas ao longo do tempo."
      action={
        <div className="flex shrink-0 gap-0.5 rounded-xl bg-zinc-100 p-0.5">
          {JANELAS.map((j) => (
            <button
              key={j.meses}
              type="button"
              onClick={() => setMeses(j.meses)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                meses === j.meses
                  ? "bg-white text-violet-700 shadow-sm"
                  : "text-zinc-600 hover:text-zinc-800"
              }`}
            >
              {j.rotulo}
            </button>
          ))}
        </div>
      }
    >
      <TrendChart data={data} />
    </SurfaceCard>
  );
}
