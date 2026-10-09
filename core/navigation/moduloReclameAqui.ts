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
 * Eram duas: a barra de abas do módulo e a cascata do menu lateral, com
 * itens diferentes. As duas leem daqui.
 *
 * **Seis entradas, e não treze (08/10/2026).** "Tem muita opção": o menu
 * listava as treze telas soltas. Agora cada entrada é um assunto, e as
 * telas do mesmo assunto viram abas dentro dela — o Índice, o Plano de
 * ação, a Calculadora e o Prêmio ficam em "Nota e metas"; os gráficos em
 * "Análise"; a Triagem ao lado do Quadro. Nenhuma tela sumiu: o endereço
 * de cada uma é o mesmo, e quem tinha um link guardado cai no lugar certo.
 */

export interface TelaDoRa {
  label: string;
  href: string;
  icon: LucideIcon;
  hint: string;
}

export interface SecaoDoRa {
  label: string;
  /** Para onde a entrada leva: a primeira tela dela. */
  href: string;
  icon: LucideIcon;
  hint: string;
  /** As telas da entrada; com mais de uma, viram abas no topo do módulo. */
  telas: TelaDoRa[];
}

const tela = (label: string, href: string, icon: LucideIcon, hint: string): TelaDoRa => ({ label, href, icon, hint });

export const SECOES_DO_RA: SecaoDoRa[] = [
  {
    label: "Quadro",
    href: "/reclame-aqui",
    icon: LayoutGrid,
    hint: "As reclamações em kanban e em lista, e a triagem das abertas",
    telas: [
      tela("Quadro", "/reclame-aqui", LayoutGrid, "Kanban e lista das reclamações"),
      tela("Triagem", "/reclame-aqui/triagem", ListFilter, "Todas as abertas: triar e classificar num passo só"),
    ],
  },
  {
    label: "Avaliações",
    href: "/reclame-aqui/avaliacoes",
    icon: Star,
    hint: "Quem pedir a avaliação hoje, na cadência da documentação",
    telas: [tela("Pedir avaliação", "/reclame-aqui/avaliacoes", Star, "Quem pedir a avaliação hoje, na cadência da documentação")],
  },
  {
    label: "Respostas",
    href: "/reclame-aqui/respostas",
    icon: MessageSquareText,
    hint: "O analista de respostas públicas: erros e o que melhorar",
    telas: [tela("Respostas", "/reclame-aqui/respostas", MessageSquareText, "O analista de respostas públicas: erros e o que melhorar")],
  },
  {
    label: "Nota e metas",
    href: "/reclame-aqui/indice",
    icon: Gauge,
    hint: "A nota, as metas do mês, a simulação e o Prêmio",
    telas: [
      tela("Índice", "/reclame-aqui/indice", Gauge, "Nota atual e prévia, a exata, a régua até o RA1000 e o dia a dia do mês"),
      tela("Plano de ação", "/reclame-aqui/plano", Target, "Metas por mês e ciclo, previsão de reclamações, o que fazer e o que mais está chegando"),
      tela("Calculadora", "/reclame-aqui/calculadora", Calculator, "Simule a reputação do período atual ou do próximo"),
      tela("Prêmio", "/reclame-aqui/premio", Trophy, "A campanha de votação do Prêmio Reclame Aqui"),
    ],
  },
  {
    label: "Análise",
    href: "/reclame-aqui/analytics",
    icon: BarChart3,
    hint: "Indicadores, gráficos e o tempo ideal",
    telas: [
      tela("Analytics", "/reclame-aqui/analytics", BarChart3, "Nota RA, indicadores e diagnóstico"),
      tela("Gráficos", "/reclame-aqui/graficos", LineChart, "Índices por mês, janela móvel e série diária"),
      tela("Tempo ideal", "/reclame-aqui/tempo-ideal", Timer, "O tempo ideal para finalizar, o teto e o prazo de resposta que segura 90%"),
    ],
  },
  {
    label: "Configurar",
    href: "/reclame-aqui/configuracoes",
    icon: Settings2,
    hint: "O fluxo do quadro e as categorias",
    telas: [
      tela("Fluxo", "/reclame-aqui/configuracoes", Settings2, "Status, times, tags e checklist"),
      tela("Categorias", "/reclame-aqui/categorias", Tags, "A lista oficial, a unificação e as propostas da IA para aprovar"),
    ],
  },
];

/** Todas as telas, na ordem das entradas. */
export const TELAS_DO_RA: TelaDoRa[] = SECOES_DO_RA.flatMap((s) => s.telas);

/** A tela está aberta? O Quadro só no endereço exato — por prefixo ele valeria para o módulo inteiro. */
export function telaAberta(href: string, pathname: string) {
  return href === "/reclame-aqui" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/** A entrada da tela aberta, se a tela for do módulo. */
export function secaoAberta(pathname: string) {
  return SECOES_DO_RA.find((s) => s.telas.some((t) => telaAberta(t.href, pathname)));
}
