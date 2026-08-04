interface Props {
  source: string;
}

export default function CaseSourceBadge({
  source,
}: Props) {
  return (
    <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
      {source}
    </span>
  );
}