"use client";

import { useMemo, useState, useSyncExternalStore, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import MainLayout from "@/components/layout/MainLayout";
import PageHeading from "@/components/shared/PageHeading";

import RotinaDoDia from "@/components/rotina/RotinaDoDia";
import PlanoDoDia from "@/components/rotina/PlanoDoDia";
import CheckpointDoDia from "@/components/rotina/CheckpointDoDia";
import FimDoDia from "@/components/rotina/FimDoDia";
import ConfigurarRotina from "@/components/rotina/ConfigurarRotina";
import { useMeuDia } from "@/components/rotina/useMeuDia";
import CartaoDoPrimeiroAcesso from "@/components/primeiroAcesso/CartaoDoPrimeiroAcesso";
import AgoraNoMeuDia from "@/components/rotina/AgoraNoMeuDia";
import ModoProximo from "@/components/rotina/ModoProximo";
import PlacarDaSemana from "@/components/rotina/PlacarDaSemana";
import MetasDoDia from "@/components/rotina/MetasDoDia";
import MetasDoCiclo from "@/components/rotina/MetasDoCiclo";
import RadarDeIncidente from "@/components/rotina/RadarDeIncidente";
import PlanoDeRecuperacao from "@/components/rotina/PlanoDeRecuperacao";
import ProximoPasso from "@/components/rotina/ProximoPasso";

/**
 * Meu dia — a primeira tela do dia.
 *
 * "A rotina documentada vira a primeira tela do dia", do roadmap. As
 * atividades da Gestão de Rotinas na ordem do documento, cada uma com o
 * número de hoje nas quatro frentes; o plano que encaixa o que falta no
 * expediente; e o checkpoint com a gestão pronto para colar.
 *
 * Tudo é contado, e nada é enviado: a tela aponta, você faz, marca e
 * salva.
 */
const nadaParaOuvir = () => () => {};

/*
  ?configurar=rotina (1.115): o atalho da central de Configurações abre a
  configuração da rotina direto; ?configurar=recuperacao (1.122), o ajuste
  do plano de recuperação. O parâmetro é lido dentro de Suspense e
  entra no `useState` inicial — sem efeito que acerta o estado depois.
*/
function ComParametro() {
  const parametros = useSearchParams();
  return <MeuDiaPagina configurarInicial={parametros.get("configurar") === "rotina"} ajustarRecuperacao={parametros.get("configurar") === "recuperacao"} />;
}

export default function MeuDiaPage() {
  return (
    <Suspense fallback={null}>
      <ComParametro />
    </Suspense>
  );
}

function MeuDiaPagina({ configurarInicial = false, ajustarRecuperacao = false }: { configurarInicial?: boolean; ajustarRecuperacao?: boolean }) {

  const dia = useMeuDia();
  const [marcas, setMarcas] = useState<Set<string> | null>(null);
  const [configurando, setConfigurando] = useState(configurarInicial);
  /* A Agenda chega aqui com ?um-por-vez: o modo já abre (no servidor, fechado). */
  const pedidoPeloEndereco = useSyncExternalStore(
    nadaParaOuvir,
    () => new URLSearchParams(window.location.search).has("um-por-vez"),
    () => false
  );
  const [escolha, setUmPorVez] = useState<boolean | null>(null);
  const umPorVez = escolha ?? pedidoPeloEndereco;
  /* O "Começar" de uma atividade da rotina abre o Um por vez só com ela (1.124). */
  const [atividadeDoFoco, setAtividadeDoFoco] = useState<{ chave: string; titulo: string } | null>(null);

  /* O rascunho das marcas é o salvo até alguém mexer. */
  const efetivas = marcas ?? dia.feitasHoje;

  const { planejar } = dia;
  /* Enquanto os casos e o NPS chegam, o plano é "montando" — e não um dia vazio. */
  const carregando = dia.carregando;
  const plano = useMemo(() => (carregando ? null : planejar(efetivas)), [carregando, planejar, efetivas]);

  const rotinaDoDia = useMemo(
    () => (dia.carregando ? undefined : { feitas: dia.doDia.filter((a) => efetivas.has(a.id)).length, total: dia.doDia.length }),
    [dia.carregando, dia.doDia, efetivas]
  );

  const dataPorExtenso = dia.agora
    ? dia.agora.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" })
    : "";

  return (
    <MainLayout>

      <div className="space-y-6">

        <PageHeading
          eyebrow="Hoje"
          title="Meu dia"
          description={`${dataPorExtenso ? `${dataPorExtenso[0].toUpperCase()}${dataPorExtenso.slice(1)}. ` : ""}A rotina do documento com os números de hoje nas quatro frentes, o plano que cabe no expediente e o checkpoint com a gestão.`}
        />

        {/* O radar de incidente (1.102): só aparece quando há um, e vem antes de tudo. */}
        <RadarDeIncidente />

        {/* O próximo passo (1.123): uma coisa só, antes de placar e listas — o primeiro da fila do Um por vez. */}
        {!umPorVez && (
          <ProximoPasso
            dia={dia}
            marcadas={efetivas}
            onUmPorVez={() => {
              setUmPorVez(true);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        )}

        {/* O placar da semana vem antes de tudo: é o que diz se o trabalho está andando. */}
        <PlacarDaSemana dia={dia} />

        {/* As mini conquistas (1.96): metas do tamanho do dia, com aviso quando fecham. */}
        <MetasDoDia rotina={rotinaDoDia} />

        <MetasDoCiclo />

        {umPorVez && (
          <ModoProximo
            dia={dia}
            marcadas={efetivas}
            atividade={atividadeDoFoco}
            onLimparAtividade={() => setAtividadeDoFoco(null)}
            onFechar={() => {
              setUmPorVez(false);
              setAtividadeDoFoco(null);
            }}
          />
        )}

        <CartaoDoPrimeiroAcesso />

        {/* O que pede ação, o que move a nota e o que já deu certo — antes da lista de tarefas. */}
        <AgoraNoMeuDia />

        {/* Só aparece com acumulado (o mínimo de cada frente, 1.122) — ou aberto pelo ?configurar=recuperacao. */}
        <PlanoDeRecuperacao dia={dia} ajustarInicial={ajustarRecuperacao} />

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">

          <RotinaDoDia dia={dia} rascunho={efetivas} setRascunho={setMarcas} onConfigurar={() => setConfigurando(true)} onUmPorVez={() => { setUmPorVez(true); window.scrollTo({ top: 0, behavior: "smooth" }); }} onComecar={(a) => { setAtividadeDoFoco(a); setUmPorVez(true); window.scrollTo({ top: 0, behavior: "smooth" }); }} />

          <div className="space-y-6">
            <PlanoDoDia plano={plano} atividades={dia.doDia} contagens={dia.contagens} hoje={dia.hoje} />
            {dia.hoje && (
              <CheckpointDoDia
                hoje={dia.hoje}
                ontem={dia.ontem}
                plano={plano}
                contagens={dia.contagens}
                feitas={dia.doDia.filter((a) => efetivas.has(a.id)).length}
                total={dia.doDia.length}
              />
            )}
            {dia.hoje && !dia.carregando && (
              <FimDoDia
                hoje={dia.hoje}
                feito={dia.hojeAteAgora}
                marcas={dia.marcasDeItens}
                atividades={dia.doDia}
                contagens={dia.contagens}
                plano={plano}
                feitas={dia.doDia.filter((a) => efetivas.has(a.id)).length}
                total={dia.doDia.length}
              />
            )}
          </div>

        </div>

      </div>

      {configurando && (
        <ConfigurarRotina
          atividades={dia.atividades}
          onClose={() => setConfigurando(false)}
          onSalvo={(lista) => {
            dia.setAtividades(lista);
            setMarcas(null);
          }}
        />
      )}

    </MainLayout>
  );
}
