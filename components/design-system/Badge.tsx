import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;

  variant?:
    | "primary"
    | "success"
    | "warning"
    | "danger"
    | "neutral";
}

export default function Badge({
  children,
  variant = "primary",
}: BadgeProps) {

  const variants = {
    primary:
      "bg-violet-100 text-violet-700",

    success:
      "bg-green-100 text-green-700",

    warning:
      "bg-amber-100 text-amber-700",

    danger:
      "bg-red-100 text-red-700",

    neutral:
      "bg-zinc-100 text-zinc-700",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        variants[variant]
      )}
    >
      {children}
    </span>
  );
}