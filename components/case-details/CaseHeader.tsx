interface Props {
  company: string;
  id: string;
}

export default function CaseHeader({ company, id }: Props) {
  return (
    <div className="rounded-2xl border bg-white p-8">

      <span className="text-sm font-medium text-violet-600">
        {id}
      </span>

      <h1 className="mt-2 text-3xl font-bold">
        {company}
      </h1>

      <p className="mt-2 text-zinc-500">
        Reclamação em acompanhamento
      </p>

    </div>
  );
}