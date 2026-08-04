interface Props {
  time: string;
  title: string;
  description: string;
}

export default function TimelineItem({
  time,
  title,
  description,
}: Props) {
  return (
    <div className="flex gap-4">

      <div className="flex flex-col items-center">

        <div className="h-3 w-3 rounded-full bg-violet-600" />

        <div className="mt-1 h-full w-px bg-zinc-200" />

      </div>

      <div className="pb-8">

        <span className="text-xs text-zinc-400">
          {time}
        </span>

        <h4 className="font-semibold mt-1">
          {title}
        </h4>

        <p className="text-zinc-500 mt-1">
          {description}
        </p>

      </div>

    </div>
  );
}