interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export default function PageHeader({
  title,
  description,
  children,
}: PageHeaderProps) {
  return (
    <div className="mb-8 flex items-start justify-between">

      <div>

        <h1 className="text-4xl font-bold tracking-tight text-zinc-900">
          {title}
        </h1>

        {description && (
          <p className="mt-2 text-zinc-500">
            {description}
          </p>
        )}

      </div>

      {children}

    </div>
  );
}