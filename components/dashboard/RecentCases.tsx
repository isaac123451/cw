import Link from "next/link";

import { mockCases } from "@/lib/data/mockCases";

export default function RecentCases() {
  return (
    <div className="rounded-2xl border bg-white p-6">

      <h2 className="mb-6 text-xl font-bold">
        Últimos Casos
      </h2>

      <div className="space-y-3">

        {mockCases.map((item) => (

          <Link
            key={item.id}
            href={`/reclame-aqui/${item.id}`}
            className="flex items-center justify-between rounded-lg border p-4 hover:bg-zinc-50"
          >
            <div>

              <p className="font-semibold">
                {item.company}
              </p>

              <p className="text-sm text-zinc-500">
                {item.category}
              </p>

            </div>

            <span className="text-sm font-semibold text-violet-600">
              {item.status}
            </span>

          </Link>

        ))}

      </div>

    </div>
  );
}