import Card from "./Card";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;

  trend?: {
    value: string;
    positive?: boolean;
  };
}

export default function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
}: MetricCardProps) {
  return (
    <Card className="relative overflow-hidden">

      <div className="flex items-start justify-between">

        <div>

          <p className="text-sm font-medium text-zinc-500">
            {title}
          </p>

          <h2 className="mt-3 text-4xl font-bold tracking-tight text-zinc-900">
            {value}
          </h2>

          {subtitle && (
            <p className="mt-2 text-sm text-zinc-500">
              {subtitle}
            </p>
          )}

        </div>

        <div className="rounded-2xl bg-violet-100 p-3">
          <Icon className="h-6 w-6 text-violet-700" />
        </div>

      </div>

      {trend && (
        <div
          className={`mt-6 flex items-center gap-2 text-sm font-medium ${
            trend.positive
              ? "text-green-600"
              : "text-red-600"
          }`}
        >
          {trend.positive ? (
            <TrendingUp size={16} />
          ) : (
            <TrendingDown size={16} />
          )}

          {trend.value}
        </div>
      )}

    </Card>
  );
}