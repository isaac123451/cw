"use client";

import {
  ExternalLink,
  MessageCircle,
  PhoneCall,
  Star,
} from "lucide-react";

import { Case } from "@/lib/models/case";
import { descreverRegistro } from "@/lib/services/horasUteis";

import SurfaceCard from "@/components/shared/SurfaceCard";
import { useTratativa } from "@/components/reclame-aqui/tratativa/TratativaProvider";
import MovementPanel from "./MovementPanel";

interface Props {
  data: Case;
}

export default function ServiceTab({ data }: Props) {

  const { abrirContato } = useTratativa();

  /*
    Só telefone de verdade vira link.

    A importação mascara os dígitos do meio ("11 9••••-4321"); montar o
    wa.me com o que sobra abria uma conversa com um número que não existe.
  */
  const digitos = (data.phone ?? "").replace(/\D/g, "");
  const whatsapp =
    digitos.length >= 10 && !(data.phone ?? "").includes("•")
      ? `https://wa.me/${digitos.length <= 11 ? `55${digitos}` : digitos}`
      : null;

  /*
    O botão do Reclame Aqui abre **esta** reclamação.

    Apontava para a página inicial do portal — quem clicava caía na busca
    e tinha de procurar o caso pelo protocolo.
  */
  const portal = data.raUrl || null;

  const contatos: [string, string][] = [
    [
      "1º contato",
      data.primeiroContatoEm
        ? `${descreverRegistro(data.primeiroContatoEm)}${data.primeiroContatoCanal ? ` · ${data.primeiroContatoCanal}` : ""}${data.primeiroContatoPor ? ` · ${data.primeiroContatoPor}` : ""}`
        : "Ainda não registrado",
    ],
    ["Último contato", data.ultimoContatoEm ? descreverRegistro(data.ultimoContatoEm) : "—"],
    ["Última resposta do cliente", data.ultimaRespostaEm ? descreverRegistro(data.ultimaRespostaEm) : "—"],
    [
      "Tentativas seguidas sem resposta",
      (data.tentativasSemResposta ?? 0) > 0 ? `${data.tentativasSemResposta} de 5` : "Nenhuma",
    ],
    ["Solução validada com o cliente", data.validadoEm ? descreverRegistro(data.validadoEm) : "—"],
    [
      "Pedidos de avaliação",
      (data.pedidosDeAvaliacao ?? 0) > 0
        ? `${data.pedidosDeAvaliacao} · o último em ${descreverRegistro(data.ultimoPedidoAvaliacaoEm)}`
        : "Nenhum",
    ],
  ];

  const canal =
    "rounded-xl border p-4 transition-colors";

  return (
    <div className="space-y-5">

      <MovementPanel data={data} />

      <SurfaceCard
        title="Canais de atendimento"
        description="Acesse rapidamente os canais vinculados a esta reclamação."
        action={
          <span className="flex shrink-0 items-center gap-1.5 rounded-xl bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600">
            <Star size={12} className="text-amber-400" />
            {data.evaluated
              ? `Avaliada com nota ${data.score ?? 0}`
              : "Sem avaliação"}
          </span>
        }
      >

        <div className="grid gap-3 sm:grid-cols-2">

          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className={`${canal} border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50`}
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                <MessageCircle size={15} />
                WhatsApp
              </p>
              <p className="mt-1 text-xs leading-relaxed text-emerald-700/80">
                Abrir a conversa com {data.customer}.
              </p>
            </a>
          ) : (
            <div className={`${canal} border-dashed border-zinc-200`}>
              <p className="flex items-center gap-2 text-sm font-semibold text-zinc-500">
                <MessageCircle size={15} />
                WhatsApp
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                Sem telefone completo no caso — complete os dados para o link aparecer.
              </p>
            </div>
          )}

          {portal ? (
            <a
              href={portal}
              target="_blank"
              rel="noopener noreferrer"
              className={`${canal} border-violet-200 bg-violet-50/60 hover:bg-violet-50`}
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-violet-800">
                <ExternalLink size={15} />
                Reclame Aqui
              </p>
              <p className="mt-1 text-xs leading-relaxed text-violet-700/80">
                Abrir esta reclamação no portal.
              </p>
            </a>
          ) : (
            <div className={`${canal} border-dashed border-zinc-200`}>
              <p className="flex items-center gap-2 text-sm font-semibold text-zinc-500">
                <ExternalLink size={15} />
                Reclame Aqui
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                O caso ainda não tem o link da reclamação — cole na lateral, em Reclame Aqui.
              </p>
            </div>
          )}

        </div>

      </SurfaceCard>

      <div className="grid gap-5 lg:grid-cols-2">

        <SurfaceCard title="Contexto operacional">

          <dl className="space-y-3.5">

            {[
              ["Cliente da reclamação", data.customer],
              ["Canal de origem", data.source],
              ["Time responsável", data.department ?? "—"],
              ["Responsável", data.owner ?? "—"],
              ["Tempo de resposta no portal", data.responseTime && data.responseTime !== "-" ? data.responseTime : "—"],
              ["Tempo de solução no portal", data.solutionTime && data.solutionTime !== "-" ? data.solutionTime : "—"],
            ].map(([k, v]) => (

              <div key={k}>

                <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  {k}
                </dt>

                <dd className="mt-0.5 text-sm text-zinc-800">
                  {v}
                </dd>

              </div>

            ))}

          </dl>

        </SurfaceCard>

        {/*
          Os contatos com o cliente, pelo que foi registrado.

          Era "Registros internos do atendimento": a data de abertura crua
          ("2026-09-13") e um "Primeiro retorno ao cliente" montado com o
          tempo de resposta do portal — que existia mesmo sem contato
          nenhum. Agora é o resumo dos contatos que a trilha registra; a
          lista completa, com quem fez cada um, fica na aba Histórico.
        */}
        <SurfaceCard
          title="Contatos com o cliente"
          description="O que foi registrado — a lista completa fica no Histórico."
          action={
            <button
              type="button"
              onClick={() => abrirContato(data, "contato")}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-violet-200 px-3 py-1.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-50"
            >
              <PhoneCall size={13} />
              Registrar contato
            </button>
          }
        >

          <dl className="space-y-3.5">
            {contatos.map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  {k}
                </dt>
                <dd className="mt-0.5 text-sm text-zinc-800">
                  {v}
                </dd>
              </div>
            ))}
          </dl>

        </SurfaceCard>

      </div>

    </div>
  );
}
