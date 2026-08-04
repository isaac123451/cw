import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CaseHeader() {
  return (
    <div className="mb-8 flex items-center justify-between">

      <div>

        <Link
          href="/reclame-aqui"
          className="mb-3 flex items-center gap-2 text-zinc-500"
        >
          <ArrowLeft size={18} />

          Voltar
        </Link>

        <h1 className="text-3xl font-bold">
          Caso CW-1001
        </h1>

      </div>

    </div>
  );
}