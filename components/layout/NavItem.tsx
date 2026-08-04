"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItemProps {
  title: string;
  href: string;
  icon: React.ElementType;
}

export default function NavItem({
  title,
  href,
  icon: Icon,
}: NavItemProps) {
  const pathname = usePathname();

  const active = pathname === href;

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-all
      ${
        active
          ? "bg-blue-600 text-white"
          : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
      }`}
    >
      <Icon size={20} />
      <span>{title}</span>
    </Link>
  );
}