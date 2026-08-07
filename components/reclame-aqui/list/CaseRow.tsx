"use client";

import {
  CheckCircle2,
  Star,
  XCircle,
} from "lucide-react";

import { Case } from "@/lib/models/case";
import { TagChips } from "@/components/shared/TagPicker";

interface Props {
  data: Case;
  onClick: () => void;
}

const statusTone: Record<string, string> = {
  Novo: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  "Em Atendimento": "bg-amber-50 text-amber-700 ring-amber-100",
  "Aguardando Cliente": "bg-sky-50 text-sky-700 ring-sky-100",
  Resolvido: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Fechado: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

export default function CaseRow({
  data,
  onClick,
}: Props) {
  return (
    <tr
      onClick={onClick}
      className="cursor-pointer border-b border-zinc-100 text-sm transition-colors last:border-0 hover:bg-violet-50/50"
    >

      <td className="px-5 py-3.5">

        <span className="font-mono text-xs font-semibold text-violet-700">
          {data.protocol}
        </span>

        <p className="mt-0.5 max-w-[220px] truncate text-xs text-zinc-500">
          {data.title}
        </p>

        {data.tags && data.tags.length > 0 && (
          <div className="mt-1.5">
            <TagChips tags={data.tags} limit={2} />
          </div>
        )}

      </td>

      <td className="px-5 text-zinc-700">
        {data.company}
      </td>

      <td className="px-5 text-zinc-700">
        {data.customer}
      </td>

      <td className="px-5 text-zinc-600">
        {data.category}
      </td>

      <td className="px-5">

        <div className="flex items-center gap-1 tabular-nums text-zinc-700">

          <Star
            size={13}
            className="fill-amber-400 text-amber-400"
          />

          {data.score ?? "-"}

        </div>

      </td>

      <td className="px-5">

        {data.resolved ? (
          <CheckCircle2
            size={17}
            className="text-emerald-600"
          />
        ) : (
          <XCircle
            size={17}
            className="text-zinc-300"
          />
        )}

      </td>

      <td className="px-5 text-zinc-600">
        {data.wouldDoBusiness ? "Sim" : "Não"}
      </td>

      <td className="px-5">

        <span
          className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${
            statusTone[data.status] ??
            "bg-zinc-100 text-zinc-600 ring-zinc-200"
          }`}
        >
          {data.status}
        </span>

      </td>

      <td className="px-5 text-zinc-600">
        {data.sla}
      </td>

      <td className="px-5 text-zinc-600">
        {data.owner ?? "—"}
      </td>

    </tr>
  );
}
