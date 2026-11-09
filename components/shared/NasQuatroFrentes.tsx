"use client";

import Link from "next/link";

import { useMemo } from "react";

import SurfaceCard from "@/components/shared/SurfaceCard";
import IconeDaFrente from "@/components/shared/IconeDaFrente";

import { useCases } from "@/lib/context/CaseContext";
import { useNps } from "@/lib/context/NpsContext";
import { useAvaliacoesGoogle } from "@/lib/context/useAvaliacoesGoogle";
import { useEstablishments } from "@/lib/context/EstablishmentsContext";

import { FRENTES_DA_OPERACAO, type FrenteId } from "@/lib/models/frentes";
import { isEncerrado, nomeDoCliente } from "@/lib/models/nps";
import { caseHref, isOpen, isSocial } from "@/lib/services/case.service";
import { descreverRegistro } from "@/lib/services/horasUteis";
import { pluralDe } from "@/lib/plural";

/** O que identifica o cliente em cada frente — quanto mais, mais o cruzamento acha. */
export interface AlvoNasFrentes {
  establishmentId?: string;
  /** O id da conta (`Establishment.externalId`), o mesmo que o Wootric manda no NPS. */
  contaExterna?: string;
  emails?: string[];
  nomes?: string[];
  /**
   * Os telefones (09/11/2026), comparados pelos 8 últimos dígitos — com ou
   * sem DDI e com ou sem o nono dígito. O NPS tem o telefone do portal em
   * quase toda resposta, e a reclamação, o do cliente: era a via que faltava.
   */
  telefones?: string[];
}

const oitoDigitos = (v?: string | null) => String(v ?? "").replace(/\D/g, "").slice(-8);

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
 * O cruzamento é o mesmo da imersão: o estabelecimento vinculado, o id
 * da conta (o que o NPS traz), o e-mail e, para o Google, o vínculo
 * feito à mão com um caso ou com o promotor do NPS.
 */
export default function NasQuatroFrentes({
  alvo,
  descricao = "Tudo o que esta conta tem em cada frente, na ordem de prioridade do documento.",
  atual,
}: {
  alvo: AlvoNasFrentes;
  descricao?: string;
  /**
   * O registro da ficha aberta (out/2026). Fica de fora da lista: a ficha
   * do NPS mostrava o próprio ciclo em "NPS · 1 em aberto", como se o
   * cliente tivesse outro ciclo esperando.
   */
  atual?: string;
}) {

  const { cases } = useCases();
  const { responses } = useNps();
  const { avaliacoes } = useAvaliacoesGoogle();
  const { establishments } = useEstablishments();

  const porFrente = useMemo(() => {

    const emails = new Set((alvo.emails ?? []).map(limpar).filter(Boolean));
    const nomes = new Set((alvo.nomes ?? []).map(limpar).filter(Boolean));
    const telefones = new Set((alvo.telefones ?? []).map(oitoDigitos).filter((t) => t.length === 8));

    /*
      A conta do Wootric leva ao estabelecimento (09/11/2026): o NPS quase
      nunca é ligado à mão, mas a conta dele é o `externalId` do cadastro — e
      é por esse estabelecimento que as reclamações dele aparecem. Medido:
      51 respostas do NPS cruzavam com outra frente; com conta e telefone, 76.
    */
    const daConta = !alvo.establishmentId && alvo.contaExterna ? establishments.find((e) => e.externalId === alvo.contaExterna)?.id : undefined;
    const estabelecimento = alvo.establishmentId ?? daConta;

    const casos = cases.filter(
      (c) =>
        (estabelecimento && c.establishmentId === estabelecimento) ||
        (c.email && emails.has(limpar(c.email))) ||
        (telefones.size > 0 && telefones.has(oitoDigitos(c.phone))) ||
        nomes.has(limpar(c.company)) ||
        nomes.has(limpar(c.customer))
    );

    const nps = responses.filter(
      (r) =>
        (estabelecimento && r.establishmentId === estabelecimento) ||
        (telefones.size > 0 && telefones.has(oitoDigitos(r.phone))) ||
        (alvo.contaExterna && r.externalCompanyId === alvo.contaExterna) ||
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
        href: `/nps/${r.id}`,
        aberto: !isEncerrado(r.status),
      })),
      google: google.map((a) => ({
        id: a.id,
        titulo: `${a.notaAtualizada ?? a.estrelas} ${pluralDe(a.notaAtualizada ?? a.estrelas, "estrela", "estrelas")}${a.texto ? ` — ${a.texto}` : ""} · ${a.autor}`,
        em: a.publicadaEm,
        href: `/google?avaliacao=${a.id}`,
        aberto: a.status === "aberta",
      })),
    };

    const soEste = new Set<FrenteId>();
    for (const [frente, lista] of Object.entries(mapa) as [FrenteId, Registro[]][]) {
      if (atual && lista.some((r) => r.id === atual)) {
        mapa[frente] = lista.filter((r) => r.id !== atual);
        soEste.add(frente);
      }
      mapa[frente].sort((a, b) => Date.parse(b.em) - Date.parse(a.em));
    }

    return { mapa, soEste };
  }, [alvo, cases, responses, avaliacoes, atual, establishments]);

  return (
    <SurfaceCard title="Nas quatro frentes" description={descricao}>
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        {FRENTES_DA_OPERACAO.map((f) => {
          const lista = porFrente.mapa[f.id];
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
                <p className="mt-2 text-xs text-zinc-400">
                  {porFrente.soEste.has(f.id) ? "Nenhum além deste." : "Nada ligado a esta conta."}
                </p>
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
