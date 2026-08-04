import { Case } from "@/lib/models/case";

interface Props {
  caseData: Case;
}

export default function CaseHeader({
  caseData,
}: Props) {
  return (
    <div className="rounded-2xl border bg-white p-6">

      <div className="flex items-center justify-between">

        <div>

          <h1 className="text-3xl font-bold">

            {caseData.protocol}

          </h1>

          <p className="mt-2 text-zinc-500">

            {caseData.company}

          </p>

        </div>

        <div>

          <span className="rounded-full bg-violet-100 px-5 py-2 text-violet-700">

            {caseData.status}

          </span>

        </div>

      </div>

    </div>
  );
}