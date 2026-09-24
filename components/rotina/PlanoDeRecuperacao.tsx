"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";

import SurfaceCard from "@/components/shared/SurfaceCard";
import IconeDaFrente from "@/components/shared/IconeDaFrente";

import { filaDoDia } from "@/lib/models/guiaParaFechar";
import { frente as frenteInfo, type FrenteId } from "@/lib/models/frentes";
import { diaCurtoDaMarca } from "@/lib/models/meuDia";
import { ACUMULADO_MINIMO, cotaSugerida, cotasOferecidas, planoDeRecuperacao, ritmoDeHoje } from "@/lib/models/recuperacao";
import { useSla } from "@/lib/context/SlaContext";

import type { useMeuDia } from "@/components/rotina/useMeuDia";

type MeuDia = ReturnType<typeof useMeuDia>;

/*
  A cota escolhida e o número da primeira abertura do dia ficam no
  navegador de quem trabalha: são conveniência de quem olha, não dado da
  operação. Sem acesso ao armazenamento, vale a cota sugerida e o número
  de agora.
*/
const EVENTO = "cw:recuperacao";

function lerTexto(chave: string) {
  try {
    return window.localStorage.getItem(chave);
  } catch {
    return null;
  }
}
function gravar(chave: string, valor: unknown) {
  try {
    window.localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* sem armazenamento: segue com o que está na tela */
  }
  window.dispatchEvent(new Event(EVENTO));
}
function ouvir(avisar: () => void) {
  window.addEventListener(EVENTO, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(EVENTO, avisar);
    window.removeEventListener("storage", avisar);
  };
}

/* No servidor e na hidratação, nada guardado: o valor do navegador entra logo depois, sem divergir. */
function useGuardado<T>(chave: string): T | null {
  const texto = useSyncExternalStore(ouvir, () => lerTexto(chave), () => null);
  try {
    return texto ? (JSON.parse(texto) as T) : null;
  } catch {
    return null;
  }
}

const DIA_DA_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const nomeDoDia = (dia: string) => DIA_DA_SEMANA[new Date(`${dia}T12:00:00Z`).getUTCDay()];

/**
 * O plano de recuperação do acumulado, no Meu dia (Fase 24).
 *
 * Aparece só quando uma frente tem 10 ou mais itens fora do prazo. Diz a
 * cota que zera em uma semana útil ("30 por dia, zera na quarta"), deixa
 * escolher outra, e mostra quanto saiu hoje contra a cota.
 */
export default function PlanoDeRecuperacao({ dia }: { dia: MeuDia }) {

  const acumulados = useMemo(() => {
    if (!dia.contagens) return [];
    const vencidos = filaDoDia(dia.doDia, dia.contagens).filter((i) => i.atrasado && i.frente);
    const porFrente = new Map<FrenteId, number>();
    for (const i of vencidos) porFrente.set(i.frente!, (porFrente.get(i.frente!) ?? 0) + 1);
    return [...porFrente.entries()].filter(([, n]) => n >= ACUMULADO_MINIMO).sort((a, b) => b[1] - a[1]);
  }, [dia.doDia, dia.contagens]);

  if (dia.carregando || !dia.hoje || acumulados.length === 0) return null;

  return (
    <SurfaceCard className="p-0">
      <div className="border-b border-zinc-100 px-5 py-3">
        <h2 className="text-[13px] font-semibold text-zinc-900">Plano de recuperação do acumulado</h2>
        <p className="mt-0.5 text-xs text-zinc-500">O que está fora do prazo não cabe num dia. Uma cota por dia útil, e o dia em que zera.</p>
      </div>
      <ul className="divide-y divide-zinc-100">
        {acumulados.map(([f, n]) => (
          <LinhaDaFrente key={f} frente={f} acumulado={n} hoje={dia.hoje!} />
        ))}
      </ul>
    </SurfaceCard>
  );
}

function LinhaDaFrente({ frente, acumulado, hoje }: { frente: FrenteId; acumulado: number; hoje: string }) {

  const { expediente } = useSla();
  const chaveDaCota = `cw:recuperacao:cota:${frente}`;
  const chaveDoInicio = `cw:recuperacao:inicio:${frente}`;

  const cota = useGuardado<number>(chaveDaCota) ?? cotaSugerida(acumulado);
  const salvo = useGuardado<{ dia: string; n: number }>(chaveDoInicio);
  const inicio = salvo?.dia === hoje ? salvo.n : acumulado;

  /* A primeira abertura do dia fica guardada: é a régua do "saiu hoje". */
  useEffect(() => {
    let guardado: { dia?: string } | null = null;
    try {
      guardado = JSON.parse(lerTexto(chaveDoInicio) ?? "null");
    } catch {
      guardado = null;
    }
    if (guardado?.dia !== hoje) gravar(chaveDoInicio, { dia: hoje, n: acumulado });
  }, [chaveDoInicio, hoje, acumulado]);

  const plano = planoDeRecuperacao(acumulado, cota, hoje, expediente);
  const ritmo = ritmoDeHoje(inicio, acumulado, cota);
  const pct = cota > 0 ? Math.min(100, Math.round((ritmo.saiu / cota) * 100)) : 0;
  const info = frenteInfo(frente);

  return (
    <li className="grid gap-2 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm text-zinc-800">
          <IconeDaFrente frente={frente} size={13} />
          <strong className="font-semibold tabular-nums">{acumulado}</strong> {info.nome} fora do prazo
          {plano && (
            <span className="text-zinc-500">
              {" "}· {cota} por dia, zera {plano.dias === 1 ? "hoje" : `${plano.zeraEm === hoje ? "hoje" : `na ${nomeDoDia(plano.zeraEm)}`} (${diaCurtoDaMarca(plano.zeraEm)})`}
            </span>
          )}
        </p>
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          <span className="h-1.5 w-32 overflow-hidden rounded-full bg-zinc-100" role="img" aria-label={`${ritmo.saiu} de ${cota} hoje`}>
            <span className={`block h-full rounded-full ${ritmo.dandoConta ? "bg-emerald-500" : "bg-violet-500"}`} style={{ width: `${pct}%` }} />
          </span>
          <span className={`tabular-nums ${ritmo.dandoConta ? "font-medium text-emerald-700" : "text-zinc-500"}`}>
            {ritmo.dandoConta ? `cota de hoje batida: ${ritmo.saiu} saíram` : `hoje: ${ritmo.saiu} de ${cota} · faltam ${ritmo.falta}`}
          </span>
        </div>
      </div>
      <div role="group" aria-label={`Cota por dia de ${info.nome}`} className="flex items-center gap-0.5 text-xs">
        <span className="mr-1 text-zinc-400">por dia</span>
        {cotasOferecidas(acumulado).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={cota === c}
            onClick={() => gravar(chaveDaCota, c)}
            className={`rounded-md px-2 py-1 font-medium tabular-nums ${cota === c ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
          >
            {c}
          </button>
        ))}
      </div>
    </li>
  );
}
