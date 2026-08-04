import {
  LayoutDashboard,
  Building2,
  MessageSquareWarning,
  BarChart3,
  Settings,
} from "lucide-react";

export const navigation = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Reclame Aqui",
    href: "/reclame-aqui",
    icon: MessageSquareWarning,
  },
  {
    label: "Empresas",
    href: "/empresas",
    icon: Building2,
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: BarChart3,
  },
  {
    label: "Configurações",
    href: "/configuracoes",
    icon: Settings,
  },
];