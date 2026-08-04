interface Props {
  title: string;
  status: string;
}

export default function RequestCard({
  title,
  status,
}: Props) {
  return (
    <div className="rounded-xl border p-5">

      <h3 className="font-semibold">
        {title}
      </h3>

      <p className="mt-2 text-sm text-zinc-500">
        {status}
      </p>

    </div>
  );
}