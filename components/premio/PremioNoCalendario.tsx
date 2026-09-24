"use client";

import Link from "next/link";

import { useMemo } from "react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import type { CampanhaView } from "@/lib/actions/premio";
import { useCases } from "@/lib/context/CaseContext";
import { useAgora } from "@/lib/hooks/useAgora";
import { premioNoCalendario } from "@/lib/models/premio";
import { paredeDe } from "@/lib/services/horasUteis";

const br = (dia: string) => dia.split("-").reverse().join("/");
const um = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * O prêmio no calendário (Fase 23): as datas, e a pergunta que importa —
 * a reputação chega onde precisa até a data de corte?
 */
export default function PremioNoCalendario({ campanha }: { campanha: CampanhaView }) {

  const { cases } = useCases();
  const agora = useAgora();
  const hoje = agora ? paredeDe(agora).dia : null;

  const conta = useMemo(
    () => (hoje && campanha.dataDeCorte && campanha.notaMeta !== undefined ? premioNoCalendario({ casos: cases, dataDeCorte: campanha.dataDeCorte, notaMeta: campanha.notaMeta, hoje }) : null),
    [cases, campanha.dataDeCorte, campanha.notaMeta, hoje]
  );

  if (!hoje) return null;

  const diasPara = (dia?: string) => (dia ? Math.round((Date.parse(`${dia}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86_400_000) : null);
  const abre = diasPara(campanha.votacaoInicio);
  const fecha = diasPara(campanha.votacaoFim);

  return (
    <SurfaceCard title="O prêmio no calendário" description={campanha.categoria ? `Categoria: ${campanha.categoria}.` : "As datas da campanha e a nota na data de corte."}>
      <dl className="grid gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200 text-sm sm:grid-cols-3">
        <div className="bg-white px-3 py-2">
          <dt className="text-xs text-zinc-500">Votação</dt>
          <dd className="font-medium text-zinc-900">
            {campanha.votacaoInicio || campanha.votacaoFim
              ? `${campanha.votacaoInicio ? br(campanha.votacaoInicio) : "—"} a ${campanha.votacaoFim ? br(campanha.votacaoFim) : "—"}`
              : "datas não cadastradas"}
          </dd>
          <dd className="text-xs text-zinc-500">
            {fecha !== null && fecha < 0 ? "encerrada" : abre !== null && abre > 0 ? `abre em ${abre} dia(s)` : fecha !== null ? `fecha em ${fecha} dia(s)` : ""}
          </dd>
        </div>
        <div className="bg-white px-3 py-2">
          <dt className="text-xs text-zinc-500">Data de corte</dt>
          <dd className="font-medium text-zinc-900">{campanha.dataDeCorte ? br(campanha.dataDeCorte) : "não cadastrada"}</dd>
          {conta && <dd className="text-xs text-zinc-500">{conta.diasAteOCorte >= 0 ? `em ${conta.diasAteOCorte} dia(s)` : "já passou"} · janela {br(conta.janela.inicio)} a {br(conta.janela.fim)}</dd>}
        </div>
        <div className="bg-white px-3 py-2">
          <dt className="text-xs text-zinc-500">Nota na janela do corte</dt>
          <dd className="font-medium tabular-nums text-zinc-900">
            {conta?.nota !== null && conta?.nota !== undefined ? um(conta.nota) : "—"}
            {campanha.notaMeta !== undefined && <span className="font-normal text-zinc-500"> · meta {um(campanha.notaMeta)}</span>}
          </dd>
          {conta && <dd className="text-xs text-zinc-500">{conta.reclamacoes} reclamação(ões) na janela, {conta.avaliaveis} ainda sem avaliação</dd>}
        </div>
      </dl>

      {conta && conta.reclamacoes === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">Nenhuma reclamação do Reclame Aqui na janela do corte ainda — a nota se forma com as que chegarem até lá.</p>
      ) : conta ? (
        <p className={`mt-3 text-sm ${conta.faltam === 0 ? "text-emerald-800" : conta.faltam === null ? "text-rose-700" : "text-zinc-800"}`}>
          {conta.faltam === 0
            ? "A nota da janela do corte já está na meta. Manter: cada avaliação ruim nessa janela pesa até a data de corte."
            : conta.faltam === null
              ? `Nem com as ${conta.avaliaveis} avaliações que faltam na janela, todas nota 10, a nota chega à meta. O que ainda mexe: responder as sem resposta e pedir moderação do que cabe.`
              : `Faltam ${conta.faltam} avaliação(ões) nota 10 entre as ${conta.avaliaveis} reclamações da janela ainda sem avaliação — é o teto do que o pedido pode render, pela conta da calculadora.`}{" "}
          {conta.faltam !== 0 && (
            <Link href="/reclame-aqui/avaliacoes" className="font-medium text-violet-700 hover:underline">
              Pedir avaliação
            </Link>
          )}
        </p>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">Cadastre a data de corte e a nota meta na campanha para ver quantas avaliações faltam.</p>
      )}
    </SurfaceCard>
  );
}
