/**
 * Os atalhos de teclado da plataforma (roadmap 2.0, Fase 11).
 *
 * Dois tipos, no padrão das ferramentas de trabalho que as pessoas já
 * conhecem: **"g" e depois uma letra** para ir a uma tela ("g" de "go",
 * mas também de "guia") e **uma tecla só** para ações. Nenhum atalho
 * dispara enquanto se digita num campo — escrever "g" num comentário não
 * pode mudar de página.
 */

export interface AtalhoDeTela {
  teclas: string;
  segunda: string;
  href: string;
  titulo: string;
}

export const ATALHOS_DE_TELA: AtalhoDeTela[] = [
  { teclas: "g m", segunda: "m", href: "/meu-dia", titulo: "Meu dia" },
  { teclas: "g a", segunda: "a", href: "/agenda", titulo: "Agenda" },
  { teclas: "g d", segunda: "d", href: "/dashboard", titulo: "Dashboard" },
  { teclas: "g r", segunda: "r", href: "/reclame-aqui", titulo: "Reclame Aqui" },
  { teclas: "g s", segunda: "s", href: "/redes-sociais", titulo: "Redes Sociais" },
  { teclas: "g n", segunda: "n", href: "/nps", titulo: "NPS" },
  { teclas: "g o", segunda: "o", href: "/google", titulo: "Google" },
  { teclas: "g w", segunda: "w", href: "/conversas", titulo: "Conversas do WhatsApp" },
  { teclas: "g c", segunda: "c", href: "/clientes", titulo: "Clientes" },
  { teclas: "g e", segunda: "e", href: "/estabelecimentos", titulo: "Estabelecimentos" },
  { teclas: "g t", segunda: "t", href: "/relatorio", titulo: "Relatório do ciclo" },
  { teclas: "g i", segunda: "i", href: "/assistente", titulo: "Assistente" },
];

export interface AtalhoDeAcao {
  teclas: string;
  titulo: string;
}

export const ATALHOS_DE_ACAO: AtalhoDeAcao[] = [
  { teclas: "Ctrl K ou /", titulo: "Buscar na plataforma" },
  { teclas: "Shift Enter", titulo: "Na busca: abrir o caso numa mini-janela" },
  { teclas: "n", titulo: "Novo caso no Reclame Aqui" },
  { teclas: "?", titulo: "Mostrar os atalhos" },
  { teclas: "Esc", titulo: "Fechar a janela ou o painel aberto" },
];

/** Tempo para a segunda tecla depois do "g". */
export const JANELA_DO_G_MS = 1200;

/** O alvo do evento é um lugar de digitar? Então nenhum atalho vale. */
export function digitandoEm(alvo: EventTarget | null) {
  const el = alvo as HTMLElement | null;
  if (!el || typeof el.tagName !== "string") return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
}

/** Resolve a sequência: `g` seguido de uma letra devolve a tela, ou nada. */
export function telaDaSequencia(primeira: string | null, segunda: string): AtalhoDeTela | null {
  if (primeira !== "g") return null;
  return ATALHOS_DE_TELA.find((a) => a.segunda === segunda.toLowerCase()) ?? null;
}
