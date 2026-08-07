import {
  bandOf,
  ptBR,
  scoreBands,
} from "@/lib/services/reputation.service";

interface Props {
  current: number;
  simulated?: number;
}

/** Régua de faixas com a nota atual e, quando houver, a simulada. */
export default function ScoreScale({
  current,
  simulated,
}: Props) {

  const band = bandOf(simulated ?? current);

  const pos = (value: number) =>
    Math.min(Math.max((value / 10) * 100, 4), 96);

  const mudou =
    simulated !== undefined &&
    Math.abs(simulated - current) > 0.05;

  return (
    <div>

      <div className="relative pt-9">

        {mudou && (

          <span
            className="absolute top-0 -translate-x-1/2 rounded-full border-2 border-zinc-300 bg-white px-2 py-0.5 text-[11px] font-medium tabular-nums text-zinc-500"
            style={{ left: `${pos(current)}%` }}
            title="Nota atual do período"
          >
            {ptBR(current)}
          </span>

        )}

        <span
          className="absolute top-0 -translate-x-1/2 rounded-full border-2 bg-white px-2.5 py-1 text-sm font-semibold tabular-nums"
          style={{
            left: `${pos(simulated ?? current)}%`,
            borderColor: band.color,
            color: band.color,
          }}
          title={
            mudou ? "Nota simulada" : "Nota atual"
          }
        >
          {ptBR(simulated ?? current)}
        </span>

        <div className="flex gap-1.5">

          {scoreBands.map((item) => (

            <div key={item.label} className="flex-1">

              <div
                className="flex h-12 items-center justify-center rounded-xl px-1 text-center text-[9px] font-bold uppercase leading-tight text-white"
                style={{ background: item.color }}
                title={`${item.label}: nota ${item.range}`}
              >
                {item.label}
              </div>

              <p className="mt-1 text-center text-[10px] text-zinc-400">
                {item.range}
              </p>

            </div>

          ))}

        </div>

      </div>

    </div>
  );
}
