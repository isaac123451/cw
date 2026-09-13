"use client";

import Link from "next/link";

import { useMemo } from "react";

import SurfaceCard from "@/components/shared/SurfaceCard";
import IconeDaFrente from "@/components/shared/IconeDaFrente";

import { useCases } from "@/lib/context/CaseContext";
import { useNps } from "@/lib/context/NpsContext";
import { useAvaliacoesGoogle } from "@/lib/context/useAvaliacoesGoogle";

import { FRENTES_DA_OPERACAO, type FrenteId } from "@/lib/models/frentes";
import { isEncerrado, nomeDoCliente } from "@/lib/models/nps";
import { caseHref, isOpen, isSocial } from "@/lib/services/case.service";
import { descreverRegistro } from "@/lib/services/horasUteis";

/** O que identifica o cliente em cada frente — quanto mais, mais o cruzamento acha. */
export interface AlvoNasFrentes {
  establishmentId?: string;
  /** O id da conta no CW Engine (`Establishment.externalId`), que o Wootric manda. */
  contaCwEngine?: string;
  emails?: string[];
  nomes?: string[];
}

interface Registro {
  id: string;
  titulo: string;
  em: string;
  href: string;
  aberto: boolean;
}

const limpar = (s?: string | null) =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim();

/**
 * O cliente nas quatro frentes, lado a lado.
 *
 * A ficha do estabelecimento e a do cliente contavam só reclamações. O
 * restaurante que respondeu o NPS com nota 2 e deixou uma estrela no
 * Google parecia um cliente tranquilo com uma reclamação antiga. Aqui
 * as quatro aparecem sempre — o zero numa frente também é informação.
 *
 * O cruzamento é o mesmo da imersão: o estabelecimento vinculado, a
 * conta do CW Engine (o que o NPS traz), o e-mail e, para o Google, o
 * vínculo feito à mão com um caso ou com o promotor do NPS.
 */
export default function NasQuatroFrentes({
  alvo,
  descricao = "Tudo o que esta conta tem em cada frente, na ordem de prioridade do documento.",
}: {
  alvo: AlvoNasFrentes;
  descricao?: string;
}) {

  const { cases } = useCases();
  const { responses } = useNps();
  const { avaliacoes } = useAvaliacoesGoogle();

  const porFrente = useMemo(() => {

    const emails = new Set((alvo.emails ?? []).map(limpar).filter(Boolean));
    const nomes = new Set((alvo.nomes ?? []).map(limpar).filter(Boolean));

    const casos = cases.filter(
      (c) =>
        (alvo.establishmentId && c.establishmentId === alvo.establishmentId) ||
        (c.email && emails.has(limpar(c.email))) ||
        nomes.has(limpar(c.company)) ||
        nomes.has(limpar(c.customer))
    );

    const nps = responses.filter(
      (r) =>
        (alvo.establishmentId && r.establishmentId === alvo.establishmentId) ||
        (alvo.contaCwEngine && r.externalCompanyId === alvo.contaCwEngine) ||
        (r.email && emails.has(limpar(r.email))) ||
        (r.customerName && nomes.has(limpar(r.customerName)))
    );

    const protocolos = new Set(casos.flatMap((c) => [c.protocol, c.id]));
    const idsNps = new Set(nps.map((r) => r.id));

    const google = avaliacoes.filter(
      (a) =>
        (a.caso && (protocolos.has(a.caso.protocolo) || protocolos.has(a.caso.id))) ||
        (a.promotorNps && idsNps.has(a.promotorNps.id)) ||
        nomes.has(limpar(a.autor))
    );

    const mapa: Record<FrenteId, Registro[]> = {
      "reclame-aqui": casos.filter((c) => !isSocial(c)).map((c) => ({
        id: c.id,
        titulo: c.title,
        em: c.recebidaEm ?? c.createdAt,
        href: caseHref(c),
        aberto: isOpen(c),
      })),
      redes: casos.filter(isSocial).map((c) => ({
        id: c.id,
        titulo: `${c.source}: ${c.title}`,
        em: c.recebidaEm ?? c.createdAt,
        href: caseHref(c),
        aberto: isOpen(c),
      })),
      nps: nps.map((r) => ({
        id: r.id,
        titulo: `Nota ${r.score}${r.comment.trim() ? ` — ${r.comment.trim()}` : ""} · ${nomeDoCliente(r)}`,
        em: r.respondedAt,
        href: `/nps?resposta=${r.id}`,
        aberto: !isEncerrado(r.status),
      })),
      google: google.map((a) => ({
        id: a.id,
        titulo: `${a.notaAtualizada ?? a.estrelas} estrela(s)${a.texto ? ` — ${a.texto}` : ""} · ${a.autor}`,
        em: a.publicadaEm,
        href: `/google?avaliacao=${a.id}`,
        aberto: a.status === "aberta",
      })),
    };

    for (const lista of Object.values(mapa)) lista.sort((a, b) => Date.parse(b.em) - Date.parse(a.em));

    return mapa;
  }, [alvo, cases, responses, avaliacoes]);

  return (
    <SurfaceCard title="Nas quatro frentes" description={descricao}>
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        {FRENTES_DA_OPERACAO.map((f) => {
          const lista = porFrente[f.id];
          const abertos = lista.filter((r) => r.aberto).length;
          return (
            <div key={f.id} className="flex min-w-0 flex-col rounded-xl border border-zinc-200/80 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <IconeDaFrente frente={f.id} size={13} />
                  <span className="truncate">{f.nome}</span>
                </span>
                <span className="text-lg font-semibold tabular-nums text-zinc-900">{lista.length}</span>
              </div>
              {abertos > 0 && <p className="mt-0.5 text-[11px] font-medium text-amber-700">{abertos} em aberto</p>}
              {lista.length === 0 ? (
                <p className="mt-2 text-xs text-zinc-400">Nada ligado a esta conta.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {lista.slice(0, 3).map((r) => (
                    <li key={r.id} className="min-w-0 text-xs">
                      <Link href={r.href} className="block truncate text-zinc-700 hover:text-violet-700 hover:underline" title={r.titulo}>
                        {r.titulo}
                      </Link>
                      <span className="text-[11px] text-zinc-400">{descreverRegistro(r.em)}</span>
                    </li>
                  ))}
                  {lista.length > 3 && <li className="text-[11px] text-zinc-400">e mais {lista.length - 3}</li>}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </SurfaceCard>
  );
}
