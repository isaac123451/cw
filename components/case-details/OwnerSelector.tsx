"use client";

import { useState } from "react";

const owners = [
  "Carlos Isaac",
  "João",
  "Maria",
  "Equipe Fiscal",
];

interface Props {
  value?: string;
}

export default function OwnerSelector({ value }: Props) {
  const [owner, setOwner] = useState(value ?? "");

  return (
    <div className="rounded-2xl border bg-white p-5">

      <h3 className="mb-4 font-semibold">
        Responsável
      </h3>

      <select
        value={owner}
        onChange={(e) => setOwner(e.target.value)}
        className="w-full rounded-lg border p-3"
      >
        {owners.map((item) => (
          <option key={item}>
            {item}
          </option>
        ))}
      </select>

    </div>
  );
}