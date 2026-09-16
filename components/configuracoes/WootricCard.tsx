"use client";

import { useEffect, useState } from "react";

import { CircleAlert, CircleCheck, Download, FileText, SquareCheck } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import {
  retratoDoWootric,
  type RetratoDoWootric,
} from "@/lib/actions/wootricStatus";

/**
 * Wootric: o que funciona e o que falta, separado.
 *
 * "O Wootric não funciona" eram três coisas com o mesmo nome — trazer as
 * respostas, marcar como concluída lá e mandar a nota com os detalhes do
 * caso. Medido no banco, as duas primeiras funcionavam; a nota era
 * recusada porque exige um login de usuário do Wootric, que é
 * configuração da conta e não do código. Este cartão diz qual é qual,
 * com números, e o passo exato que falta.
 */

function quando(iso: string | null) {
  if (!iso) return "nunca";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Linha({
  ok,
  icone: Icone,
  titulo,
  detalhe,
}: {
  ok: boolean;
  icone: typeof Download;
  titulo: string;
  detalhe: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-zinc-200/80 px-4 py-3">
      <Icone size={17} className={`mt-0.5 shrink-0 ${ok ? "text-emerald-600" : "text-amber-600"}`} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-medium text-zinc-900">
          {titulo}
          {ok ? (
            <CircleCheck size={14} className="text-emerald-600" />
          ) : (
            <CircleAlert size={14} className="text-amber-600" />
          )}
        </p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-zinc-600">{detalhe}</p>
      </div>
    </div>
  );
}

export default function WootricCard() {

  const [retrato, setRetrato] = useState<RetratoDoWootric | null | undefined>(undefined);

  useEffect(() => {
    let ativo = true;
    retratoDoWootric()
      .then((r) => ativo && setRetrato(r))
      .catch(() => ativo && setRetrato(null));
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <SurfaceCard
      title="Wootric"
      description="As três coisas que a plataforma faz com o Wootric, cada uma com o seu estado — medido pelo que ficou gravado das tentativas."
    >
      {retrato === undefined ? (
        <p className="text-sm text-zinc-400">Carregando…</p>
      ) : retrato === null ? (
        <p className="text-sm text-zinc-500">Sem acesso ao NPS nesta conta, ou sem banco configurado.</p>
      ) : (
        <div className="space-y-2.5">

          <Linha
            ok={retrato.importacao.configurada && Boolean(retrato.importacao.ultimaEm)}
            icone={Download}
            titulo="Trazer as respostas"
            detalhe={
              retrato.importacao.configurada
                ? `Funcionando. Resposta mais recente trazida em ${quando(retrato.importacao.ultimaEm)} · ${retrato.importacao.respostasHoje} hoje. Na tela do NPS, "Buscar novas" traz o que chegou depois.`
                : "Falta a chave de integração: WOOTRIC_CLIENT_ID e WOOTRIC_CLIENT_SECRET nas variáveis de ambiente da Vercel."
            }
          />

          <Linha
            ok={retrato.conclusao.concluidas > 0}
            icone={SquareCheck}
            titulo="Concluir a resposta lá ao encerrar aqui"
            detalhe={
              retrato.conclusao.concluidas > 0
                ? `Funcionando. ${retrato.conclusao.concluidas} resposta(s) marcadas como concluídas no Wootric; a última em ${quando(retrato.conclusao.ultimaEm)}.`
                : "Ainda nenhuma. Acontece ao encerrar um ciclo de NPS que veio do Wootric."
            }
          />

          <Linha
            ok={retrato.nota.loginConfigurado && retrato.nota.recusadas === 0}
            icone={FileText}
            titulo="Mandar a nota com os detalhes do caso"
            detalhe={
              retrato.nota.loginConfigurado
                ? retrato.nota.recusadas > 0
                  ? `Login configurado, mas ${retrato.nota.recusadas} nota(s) foram recusadas. Última resposta: "${retrato.nota.ultimoErro}". Conferir usuário e senha.`
                  : `Funcionando. ${retrato.nota.enviadas} nota(s) enviadas.`
                : `Parada por configuração: ${retrato.nota.recusadas} nota(s) esperando. O Wootric só aceita criar nota com login de usuário — a chave de integração só lê. Cadastre WOOTRIC_USUARIO e WOOTRIC_SENHA (de um usuário da conta Wootric) nas variáveis de ambiente da Vercel e faça um novo deploy; o reenvio automático manda as que ficaram para trás.`
            }
          />

        </div>
      )}
    </SurfaceCard>
  );
}
