import {
  CheckCircle2,
  Mail,
  MessageSquare,
  RefreshCw,
  Star,
} from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import {
  ptBR,
  ReputationSummary,
} from "@/lib/services/reputation.service";

interface Props {
  summary: ReputationSummary;
}

export default function ReputationFunnel({
  summary,
}: Props) {

  const steps = [
    {
      label: "Recebidas",
      value: summary.received,
      icon: Mail,
      tone: "bg-violet-50 text-violet-600",
      caption: "Base inicial do período",
      conversion: null as number | null,
    },
    {
      label: "Respondidas",
      value: summary.answered,
      icon: MessageSquare,
      tone: "bg-emerald-50 text-emerald-600",
      caption: "Conversão da etapa",
      conversion: summary.responseIndex,
    },
    {
      label: "Avaliadas",
      value: summary.evaluated,
      icon: Star,
      tone: "bg-sky-50 text-sky-600",
      caption: "Conversão da etapa",
      conversion: summary.evaluationRate,
    },
    {
      label: "Resolvidas",
      value: summary.resolved,
      icon: CheckCircle2,
      tone: "bg-amber-50 text-amber-600",
      caption: "Conversão da etapa",
      conversion: summary.solutionIndex,
    },
    {
      label: "Voltariam",
      value: summary.wouldReturn,
      icon: RefreshCw,
      tone: "bg-violet-50 text-violet-600",
      caption: "Conversão da etapa",
      conversion: summary.wouldReturnIndex,
    },
  ];

  return (
    <SurfaceCard
      title="Funil de reputação"
      description="Jornada do volume recebido até a percepção positiva do cliente."
    >

      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">

        {steps.map((step) => {

          const Icon = step.icon;

          return (
            <div
              key={step.label}
              className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4 text-center"
            >

              <span
                className={`mx-auto flex h-11 w-11 items-center justify-center rounded-2xl ${step.tone}`}
              >
                <Icon size={19} />
              </span>

              <p className="mt-3 text-2xl font-semibold tabular-nums text-zinc-900">
                {step.value}
              </p>

              <p className="text-sm font-medium text-zinc-700">
                {step.label}
              </p>

              <p className="mt-2 text-[11px] text-zinc-400">
                {step.caption}
              </p>

              <span className="mt-1.5 inline-block rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200">
                {step.conversion === null
                  ? "Base total"
                  : `${ptBR(step.conversion)}%`}
              </span>

            </div>
          );
        })}

      </div>

    </SurfaceCard>
  );
}
