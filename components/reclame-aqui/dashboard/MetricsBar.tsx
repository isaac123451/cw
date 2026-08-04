"use client";

import {
  CircleAlert,
  Clock3,
  CheckCircle2,
  Star,
  Building2,
} from "lucide-react";

const metrics = [
  {
    title: "Reclamações",
    value: "134",
    icon: CircleAlert,
    color: "bg-red-100 text-red-600",
  },
  {
    title: "Dentro do SLA",
    value: "119",
    icon: Clock3,
    color: "bg-blue-100 text-blue-600",
  },
  {
    title: "Resolvidas",
    value: "92%",
    icon: CheckCircle2,
    color: "bg-green-100 text-green-600",
  },
  {
    title: "Nota Média",
    value: "8.4",
    icon: Star,
    color: "bg-yellow-100 text-yellow-600",
  },
  {
    title: "Empresas",
    value: "18",
    icon: Building2,
    color: "bg-violet-100 text-violet-600",
  },
];

export default function MetricsBar() {
  return (
    <div className="grid grid-cols-5 gap-4">

      {metrics.map((metric) => {

        const Icon = metric.icon;

        return (
          <div
            key={metric.title}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
          >

            <div className="flex items-center justify-between">

              <div>

                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  {metric.title}
                </p>

                <h2 className="mt-2 text-3xl font-bold">
                  {metric.value}
                </h2>

              </div>

              <div className={`rounded-xl p-3 ${metric.color}`}>

                <Icon size={22} />

              </div>

            </div>

          </div>
        );
      })}

    </div>
  );
}