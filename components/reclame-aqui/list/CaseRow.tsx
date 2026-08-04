"use client";

import {
  CheckCircle2,
  XCircle,
  Star,
} from "lucide-react";

import { Case } from "@/lib/models/case";

interface Props {
  data: Case;
  onClick: () => void;
}

export default function CaseRow({
  data,
  onClick,
}: Props) {
  return (
    <tr
      onClick={onClick}
      className="cursor-pointer border-b border-zinc-100 transition hover:bg-violet-50"
    >

      <td className="px-5 py-4 font-semibold">

        {data.protocol}

      </td>

      <td className="px-5">

        {data.company}

      </td>

      <td className="px-5">

        {data.customer}

      </td>

      <td className="px-5">

        {data.category}

      </td>

      <td className="px-5">

        <div className="flex items-center gap-1">

          <Star
            size={14}
            className="fill-yellow-400 text-yellow-400"
          />

          {data.score ?? "-"}

        </div>

      </td>

      <td className="px-5">

        {data.resolved ? (

          <CheckCircle2
            size={18}
            className="text-green-600"
          />

        ) : (

          <XCircle
            size={18}
            className="text-red-600"
          />

        )}

      </td>

      <td className="px-5">

        {data.wouldDoBusiness ? "Sim" : "Não"}

      </td>

      <td className="px-5">

        <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">

          {data.status}

        </span>

      </td>

      <td className="px-5">

        {data.sla}

      </td>

      <td className="px-5">

        {data.owner}

      </td>

    </tr>
  );
}