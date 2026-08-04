import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export default function Card({
  children,
  className,
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-3xl",
        "border",
        "border-zinc-200",
        "bg-white",
        "shadow-sm",
        "transition-all",
        "duration-300",
        "hover:shadow-md",
        "p-6",
        className
      )}
    >
      {children}
    </div>
  );
}