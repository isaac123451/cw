import {
  BarChart3,
  Calculator,
  Gauge,
  LayoutGrid,
  LineChart,
  ListFilter,
  MessageSquareText,
  Settings2,
  Star,
  Tags,
  Target,
  Timer,
  Trophy,
  type LucideIcon,
} from "lucide-react";

/**
 * As telas do módulo Reclame Aqui, numa lista só (out/2026).
 *
 * Eram duas: a barra de abas do módulo (12 itens, em duas fileiras) e a
 * cascata do menu lateral (10), com itens diferentes — Categorias só no
 * menu; Triagem, Índice e Respostas só nas abas. Quem procurava uma tela
 * pelo lugar errado não a achava. As duas leem daqui.
 *
 * Os grupos dizem para que serve cada tela (out/2026, em quatro): o que se
 * faz **no dia a dia**, a **nota e as metas**, a **análise** e os **ajustes**
 * do módulo. Eram três, e "Acompanhar" juntava seis telas — a nota, o plano
 * e a calculadora misturados com os gráficos. O menu lateral mostra o nome
 * de cada grupo; a barra do módulo, um separador.
 */
export type GrupoDoRa = "dia" | "nota" | "analise" | "ajustes";

export interface TelaDoRa {
  label: string;
  href: string;
  icon: LucideIcon;
  hint: string;
  grupo: GrupoDoRa;
}

export const TELAS_DO_RA: TelaDoRa[] = [
  { label: "Quadro", href: "/reclame-aqui", icon: LayoutGrid, hint: "Kanban e lista das reclamações", grupo: "dia" },
  { label: "Triagem", href: "/reclame-aqui/triagem", icon: ListFilter, hint: "Todas as abertas: triar e classificar num passo só", grupo: "dia" },
  { label: "Pedir avaliação", href: "/reclame-aqui/avaliacoes", icon: Star, hint: "Quem pedir a avaliação hoje, na cadência da documentação", grupo: "dia" },
  { label: "Respostas", href: "/reclame-aqui/respostas", icon: MessageSquareText, hint: "O analista de respostas públicas: erros e o que melhorar", grupo: "dia" },
  { label: "Índice", href: "/reclame-aqui/indice", icon: Gauge, hint: "Nota atual e prévia, a exata, a régua até o RA1000 e o dia a dia do mês", grupo: "nota" },
  { label: "Plano de ação", href: "/reclame-aqui/plano", icon: Target, hint: "Metas por mês e ciclo, previsão de reclamações, o que fazer e o que mais está chegando", grupo: "nota" },
  { label: "Calculadora", href: "/reclame-aqui/calculadora", icon: Calculator, hint: "Simule a reputação do período atual ou do próximo", grupo: "nota" },
  { label: "Prêmio", href: "/reclame-aqui/premio", icon: Trophy, hint: "A campanha de votação do Prêmio Reclame Aqui", grupo: "nota" },
  { label: "Analytics", href: "/reclame-aqui/analytics", icon: BarChart3, hint: "Nota RA, indicadores e diagnóstico", grupo: "analise" },
  { label: "Gráficos", href: "/reclame-aqui/graficos", icon: LineChart, hint: "Índices por mês, janela móvel e série diária", grupo: "analise" },
  { label: "Tempo ideal", href: "/reclame-aqui/tempo-ideal", icon: Timer, hint: "O tempo ideal para finalizar, o teto e o prazo de resposta que segura 90%", grupo: "analise" },
  { label: "Categorias", href: "/reclame-aqui/categorias", icon: Tags, hint: "A lista oficial, a unificação e as propostas da IA para aprovar", grupo: "ajustes" },
  { label: "Configurar fluxo", href: "/reclame-aqui/configuracoes", icon: Settings2, hint: "Status, categorias, times, tags e checklist", grupo: "ajustes" },
];

export const ROTULO_DO_GRUPO: Record<GrupoDoRa, string> = {
  dia: "Dia a dia",
  nota: "Nota e metas",
  analise: "Análise",
  ajustes: "Ajustes",
};
