/**
 * As quatro frentes da reputação, num lugar só.
 *
 * O documento de acompanhamento do agente lista quatro — Reclame Aqui,
 * Redes Sociais, NPS e Google Avaliações — e dá a ordem de prioridade
 * "em cenários de alto volume". A plataforma nasceu com o Reclame Aqui,
 * ganhou as redes, depois o NPS, e o Google só na Fase 4; cada tela
 * listava as que existiam quando foi feita. O Isaac: "as frentes precisam
 * estar todas unidas nos lugares se tiverem que aparecer".
 *
 * Toda tela que mostra frentes lê daqui: a mesma ordem, o mesmo nome, a
 * mesma cor, o mesmo caminho.
 */

export type FrenteId = "reclame-aqui" | "redes" | "nps" | "google";

export interface Frente {
  id: FrenteId;
  nome: string;
  /** Para chips e colunas estreitas. */
  curto: string;
  href: string;
  /** 1 é a primeira a ser atendida quando o volume aperta. */
  prioridade: number;
  /** O porquê da prioridade, nas palavras do documento. */
  dica: string;
  cor: string;
}

export const FRENTES_DA_OPERACAO: Frente[] = [
  {
    id: "reclame-aqui",
    nome: "Reclame Aqui",
    curto: "RA",
    href: "/reclame-aqui",
    prioridade: 1,
    dica: "Prioridade máxima: impacto direto nos índices de reputação, no selo RA1000 e alta visibilidade pública.",
    cor: "#7B3FBF",
  },
  {
    id: "redes",
    nome: "Redes Sociais",
    curto: "Redes",
    href: "/redes-sociais",
    prioridade: 2,
    dica: "Alta prioridade: risco de exposição da marca, potencial de viralização e velocidade de resposta exigida.",
    cor: "#0EA5E9",
  },
  {
    id: "nps",
    nome: "NPS",
    curto: "NPS",
    href: "/nps",
    prioridade: 3,
    dica: "Prioridade intermediária: retenção, reversão de detratores e os detratores críticos da base ativa primeiro.",
    cor: "#F59E0B",
  },
  {
    id: "google",
    nome: "Google Avaliações",
    curto: "Google",
    href: "/google",
    prioridade: 4,
    dica: "Acompanhamento contínuo: a nota local e a imagem da marca nas buscas.",
    cor: "#16A34A",
  },
];

export function frente(id: FrenteId): Frente {
  return FRENTES_DA_OPERACAO.find((f) => f.id === id)!;
}
