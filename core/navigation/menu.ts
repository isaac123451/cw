import {
  BarChart3,
  Bot,
  Building2,
  CalendarClock,
  FolderKanban,
  LayoutDashboard,
  BookOpenCheck,
  LibraryBig,
  MessageSquareWarning,
  MessagesSquare,
  Route,
  Settings,
  UserRound,
  UsersRound,
  Wallet,
  Workflow,
} from "lucide-react";

export interface MenuItem {
  title: string;
  href: string;
  icon: typeof LayoutDashboard;
  group: string;
}

export const menuItems: MenuItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    group: "Operação",
  },
  {
    title: "Reclame Aqui",
    href: "/reclame-aqui",
    icon: MessageSquareWarning,
    group: "Operação",
  },
  {
    title: "Redes Sociais",
    href: "/redes-sociais",
    icon: MessagesSquare,
    group: "Operação",
  },
  {
    title: "Agenda",
    href: "/agenda",
    icon: CalendarClock,
    group: "Operação",
  },
  {
    title: "Jornada do Cliente",
    href: "/jornada",
    icon: Route,
    group: "Clientes",
  },
  {
    title: "Estabelecimentos",
    href: "/estabelecimentos",
    icon: Building2,
    group: "Clientes",
  },
  {
    title: "Clientes",
    href: "/clientes",
    icon: UserRound,
    group: "Clientes",
  },
  {
    title: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    group: "Inteligência",
  },
  {
    title: "Impacto no Negócio",
    href: "/impacto",
    icon: Wallet,
    group: "Inteligência",
  },
  {
    title: "Assistente",
    href: "/assistente",
    icon: Bot,
    group: "Inteligência",
  },
  {
    title: "Documentação",
    href: "/documentacao",
    icon: BookOpenCheck,
    group: "Conhecimento",
  },
  {
    title: "Base de Conhecimento",
    href: "/base-conhecimento",
    icon: LibraryBig,
    group: "Conhecimento",
  },
  {
    title: "Gestão de Processos",
    href: "/processos",
    icon: Workflow,
    group: "Conhecimento",
  },
  {
    title: "Projetos e Melhorias",
    href: "/projetos",
    icon: FolderKanban,
    group: "Conhecimento",
  },
  {
    title: "Meu time",
    href: "/times",
    icon: UsersRound,
    group: "Pessoas",
  },
  {
    title: "Configurações",
    href: "/configuracoes",
    icon: Settings,
    group: "Plataforma",
  },
];
