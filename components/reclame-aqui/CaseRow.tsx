"use client";

import Link from "next/link";

import { ExternalLink } from "lucide-react";

import { Case } from "@/lib/models/case";

import CasePriorityBadge from "./CasePriorityBadge";
import CaseStatusBadge from "./CaseStatusBadge";

interface Props {
  data: Case;
}

export default function CaseRow({
  data,
}: Props) {
  return (
    <tr className="border-b transition hover:bg-zinc-50">

      <td className="px-5 py-5">

        <Link
          href={`/reclame-aqui/${data.id}`}
          className="flex items-center gap-2 font-semibold text-violet-700"
        >
          {data.protocol}

          <ExternalLink size={16} />

        </Link>

      </td>

      <td>{data.company}</td>

      <td>{data.customer}</td>

      <td>{data.city}</td>

      <td>{data.state}</td>

      <td>{data.category}</td>

      <td>

        <CaseStatusBadge status={data.status} />

      </td>

      <td>

        <CasePriorityBadge priority={data.priority} />

      </td>

      <td>

        ⭐ {data.score ?? 0}

      </td>

      <td>

        {data.resolved ? "Sim" : "Não"}

      </td>

      <td>

        {data.wouldDoBusiness ? "Sim" : "Não"}

      </td>

      <td>{data.owner}</td>

      <td>{data.sla}</td>

      <td>{data.updatedAt}</td>

    </tr>
  );
}