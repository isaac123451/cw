"use client";

import { useState } from "react";

import OverviewTab from "./OverviewTab";
import CommentsTab from "./CommentsTab";
import RequestsTab from "./RequestsTab";
import HistoryTab from "./HistoryTab";
import AttachmentsTab from "./AttachmentsTab";

import { Case } from "@/lib/models/case";

interface Props {
  data: Case;
}

const tabs = [
  "Resumo",
  "Comentários",
  "Solicitações",
  "Histórico",
  "Anexos",
];

export default function CaseTabs({ data }: Props) {
  const [active, setActive] = useState("Resumo");

  return (
    <div className="rounded-2xl border bg-white">

      <div className="flex border-b">

        {tabs.map((tab) => (

          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`px-6 py-4 text-sm font-medium transition

            ${
              active === tab
                ? "border-b-2 border-violet-600 text-violet-600"
                : "text-zinc-500"
            }`}
          >
            {tab}
          </button>

        ))}

      </div>

      <div className="p-6">

        {active === "Resumo" && <OverviewTab data={data} />}

        {active === "Comentários" && <CommentsTab />}

        {active === "Solicitações" && <RequestsTab />}

        {active === "Histórico" && <HistoryTab />}

        {active === "Anexos" && <AttachmentsTab />}

      </div>

    </div>
  );
}