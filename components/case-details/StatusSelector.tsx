"use client";

import { useState } from "react";

const statusList = [
  "Novo",
  "Em Atendimento",
  "Aguardando Cliente",
  "Resolvido",
  "Encerrado",
];

interface Props {
  value: string;
}

export default function StatusSelector({ value }: Props) {
  const [status, setStatus] = useState(value);

  return (
    <div className="rounded-2xl border bg-white p-5">

      <h3 className="mb-4 font-semibold">
        Status
      </h3>

      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="w-full rounded-lg border p-3"
      >
        {statusList.map((item) => (
          <option key={item}>
            {item}
          </option>
        ))}
      </select>

    </div>
  );
}