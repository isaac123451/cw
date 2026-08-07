"use client";

import {
  CircleArrowRight,
  Folder,
  Layers,
  ListChecks,
  LucideIcon,
  Tag,
  Users,
} from "lucide-react";

export type SettingsTab =
  | "status"
  | "categorias"
  | "subcategorias"
  | "times"
  | "tags"
  | "checklist";

interface Tab {
  id: SettingsTab;
  label: string;
  icon: LucideIcon;
}

const tabs: Tab[] = [
  { id: "status", label: "Status", icon: CircleArrowRight },
  { id: "categorias", label: "Categorias", icon: Folder },
  { id: "subcategorias", label: "Subcategorias", icon: Layers },
  { id: "times", label: "Times", icon: Users },
  { id: "tags", label: "Etiquetas", icon: Tag },
  {
    id: "checklist",
    label: "Checklist de resolução",
    icon: ListChecks,
  },
];

interface Props {
  active: SettingsTab;
  onChange: (tab: SettingsTab) => void;
}

export default function SettingsTabs({
  active,
  onChange,
}: Props) {
  return (
    <div className="overflow-x-auto">

      <div className="flex min-w-max items-center gap-2">

        {tabs.map((tab) => {

          const Icon = tab.icon;

          const selected = active === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex items-center gap-2.5 rounded-2xl px-4 py-2.5 text-sm font-medium transition-colors ${
                selected
                  ? "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >

              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  selected
                    ? "bg-white text-violet-600"
                    : "bg-zinc-100 text-zinc-500"
                }`}
              >
                <Icon size={15} />
              </span>

              {tab.label}

            </button>
          );
        })}

      </div>

    </div>
  );
}
