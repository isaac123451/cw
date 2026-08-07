import { ReactNode } from "react";

interface Props {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}

export default function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: Props) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">

      <div>

        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-600">
            {eyebrow}
          </p>
        )}

        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
          {title}
        </h1>

        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-zinc-500">
            {description}
          </p>
        )}

      </div>

      {children && (
        <div className="flex items-center gap-2">
          {children}
        </div>
      )}

    </div>
  );
}
