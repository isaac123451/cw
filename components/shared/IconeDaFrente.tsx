import { AtSign, Gauge, MessageSquareWarning, Star } from "lucide-react";

import { frente, type FrenteId } from "@/lib/models/frentes";

const ICONES = {
  "reclame-aqui": MessageSquareWarning,
  redes: AtSign,
  nps: Gauge,
  google: Star,
} as const;

/**
 * O ícone de uma frente, na cor dela — o mesmo em toda tela.
 *
 * `herdarCor` usa a cor do texto em volta — para quando o ícone fica
 * sobre um fundo colorido (a aba ativa), onde a cor da frente sumiria.
 */
export default function IconeDaFrente({
  frente: id,
  size = 14,
  className = "",
  herdarCor = false,
}: {
  frente: FrenteId;
  size?: number;
  className?: string;
  herdarCor?: boolean;
}) {
  const Icone = ICONES[id];
  return <Icone size={size} className={`shrink-0 ${className}`} style={herdarCor ? undefined : { color: frente(id).cor }} aria-hidden />;
}
