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
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">

      <div>

        {eyebrow && (
          <p className="text-xs font-medium text-zinc-500">
            {eyebrow}
          </p>
        )}

        <h1 className="mt-0.5 text-[22px] font-semibold leading-tight tracking-tight text-zinc-900">
          {title}
        </h1>

        {description && (
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-zinc-500">
            {description}
          </p>
        )}

      </div>

      {children && (
        <div className="flex flex-wrap items-center gap-2">
          {children}
        </div>
      )}

    </div>
  );
}
