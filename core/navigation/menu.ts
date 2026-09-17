import {
  BarChart3,
  Bot,
  Building2,
  CalendarClock,
  FolderKanban,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  BookOpenCheck,
  CalendarCheck2,
  FileBarChart,
  KeyRound,
  LibraryBig,
  MessageSquareWarning,
  MessageCircle,
  MessagesSquare,
  Route,
  Settings,
  Sparkles,
  Star,
  UserRound,
  Wallet,
  Workflow,
} from "lucide-react";

export interface MenuItem {
  title: string;
  href: string;
  icon: typeof LayoutDashboard;
  group: string;

  /**
   * As telas de dentro do módulo, quando ele tem mais de uma.
   *
   * Sem isto, chegar ao Analytics do Reclame Aqui exigia abrir o quadro
   * primeiro e achar a barra de cima — e essa barra nem estava em todas
   * as telas. O Isaac pediu o caminho direto: "quando eu for abrir o
   * reclame aqui e clicar, seja possível abrir uma cascata e ser
   * possível selecionar algo tipo kanban, analytics, fluxo".
   *
   * O item continua sendo um link: clicar no nome leva ao módulo, como
   * antes. A cascata abre pela setinha, que é o que separa "quero ir
   * para o módulo" de "quero ver o que tem dentro dele".
   */
  children?: { title: string; href: string }[];
}

/*
  A ordem e os grupos seguem o dia de trabalho (roadmap 2.0, Fase 11):
  primeiro o que é de hoje, depois as frentes, as pessoas e as contas, o
  que se analisa e o que se consulta. Configurações sai da lista e mora
  no rodapé do menu — é aberta de vez em quando, não todo dia.
*/
export const GRUPOS_DO_MENU = ["Hoje", "Frentes", "Pessoas e contas", "Inteligência", "Conhecimento"] as const;

export const menuItems: MenuItem[] = [
  { title: "Meu dia", href: "/meu-dia", icon: CalendarCheck2, group: "Hoje" },
  { title: "Agenda", href: "/agenda", icon: CalendarClock, group: "Hoje" },
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, group: "Hoje" },
  {
    title: "Reclame Aqui",
    href: "/reclame-aqui",
    icon: MessageSquareWarning,
    group: "Frentes",
    children: [
      { title: "Quadro", href: "/reclame-aqui" },
      { title: "Pedir avaliação", href: "/reclame-aqui/avaliacoes" },
      { title: "Analytics", href: "/reclame-aqui/analytics" },
      { title: "Gráficos", href: "/reclame-aqui/graficos" },
      { title: "Calculadora", href: "/reclame-aqui/calculadora" },
      { title: "Configurar fluxo", href: "/reclame-aqui/configuracoes" },
    ],
  },
  { title: "Redes Sociais", href: "/redes-sociais", icon: MessagesSquare, group: "Frentes" },
  {
    title: "NPS",
    href: "/nps",
    icon: Gauge,
    group: "Frentes",
    children: [
      { title: "Ciclos", href: "/nps" },
      { title: "Análise do NPS", href: "/nps/analise" },
    ],
  },
  { title: "Google", href: "/google", icon: Star, group: "Frentes" },
  { title: "Conversas do WhatsApp", href: "/conversas", icon: MessageCircle, group: "Frentes" },
  { title: "Clientes", href: "/clientes", icon: UserRound, group: "Pessoas e contas" },
  { title: "Estabelecimentos", href: "/estabelecimentos", icon: Building2, group: "Pessoas e contas" },
  { title: "Jornada do Cliente", href: "/jornada", icon: Route, group: "Pessoas e contas" },
  { title: "Relatório do ciclo", href: "/relatorio", icon: FileBarChart, group: "Inteligência" },
  { title: "Analytics", href: "/analytics", icon: BarChart3, group: "Inteligência" },
  { title: "Impacto no Negócio", href: "/impacto", icon: Wallet, group: "Inteligência" },
  { title: "Assistente", href: "/assistente", icon: Bot, group: "Inteligência" },
  { title: "Documentação", href: "/documentacao", icon: BookOpenCheck, group: "Conhecimento" },
  { title: "Respostas prontas", href: "/base-conhecimento", icon: LibraryBig, group: "Conhecimento" },
  { title: "Processos e SLA", href: "/processos", icon: Workflow, group: "Conhecimento" },
  { title: "Projetos e Melhorias", href: "/projetos", icon: FolderKanban, group: "Conhecimento" },
  { title: "Ferramentas e acessos", href: "/ferramentas", icon: KeyRound, group: "Conhecimento" },
  { title: "Primeiro acesso", href: "/primeiro-acesso", icon: GraduationCap, group: "Conhecimento" },
  { title: "Novidades", href: "/novidades", icon: Sparkles, group: "Conhecimento" },
];

/** Fora dos grupos: no rodapé do menu. */
export const itemDeConfiguracoes: MenuItem = { title: "Configurações", href: "/configuracoes", icon: Settings, group: "Ajustes" };
