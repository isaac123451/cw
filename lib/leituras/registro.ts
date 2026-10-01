import "server-only";

import { lerAjustesDeMeta } from "@/lib/actions/ajusteDeMeta";
import { lerEsperaNoWhatsapp } from "@/lib/actions/esperaNoWhatsapp";
import { getGoogleStatus, getUpcomingEvents } from "@/lib/actions/google";
import { lerPainelDoPortal } from "@/lib/actions/painelDoPortal";
import { lerRadarDeIncidente } from "@/lib/actions/radar";
import { lerAjusteDaRecuperacao } from "@/lib/actions/recuperacao";
import { lerMeuDia, listarRotina } from "@/lib/actions/rotina";

/**
 * As leituras que a rota de lote pode fazer (1.116) — ver
 * `app/api/leitura/lote/route.ts` e `lib/lote.ts`.
 *
 * Só leitura, e só as que devolvem dado que atravessa JSON inteiro (texto,
 * número, lista — nenhuma data como objeto). Cada uma é a própria action,
 * com a própria checagem de acesso: a rota não decide nada sozinha.
 */
export const LEITURAS = {
  meuDia: lerMeuDia,
  rotina: listarRotina,
  radar: lerRadarDeIncidente,
  espera: lerEsperaNoWhatsapp,
  ajustesDeMeta: lerAjustesDeMeta,
  painelDoPortal: lerPainelDoPortal,
  googleStatus: getGoogleStatus,
  googleEventos: getUpcomingEvents,
  recuperacao: lerAjusteDaRecuperacao,
} as const;

export type Leituras = typeof LEITURAS;
export type NomeDaLeitura = keyof Leituras;
