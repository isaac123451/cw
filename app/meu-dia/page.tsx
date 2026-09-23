"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

import MainLayout from "@/components/layout/MainLayout";
import PageHeading from "@/components/shared/PageHeading";

import RotinaDoDia from "@/components/rotina/RotinaDoDia";
import PlanoDoDia from "@/components/rotina/PlanoDoDia";
import CheckpointDoDia from "@/components/rotina/CheckpointDoDia";
import ConfigurarRotina from "@/components/rotina/ConfigurarRotina";
import { useMeuDia } from "@/components/rotina/useMeuDia";
import CartaoDoPrimeiroAcesso from "@/components/primeiroAcesso/CartaoDoPrimeiroAcesso";
import AgoraNoMeuDia from "@/components/rotina/AgoraNoMeuDia";
import ModoProximo from "@/components/rotina/ModoProximo";

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

export default function MeuDiaPage() {

  const dia = useMeuDia();
  const [marcas, setMarcas] = useState<Set<string> | null>(null);
  const [configurando, setConfigurando] = useState(false);
  /* A Agenda chega aqui com ?um-por-vez: o modo já abre (no servidor, fechado). */
  const pedidoPeloEndereco = useSyncExternalStore(
    nadaParaOuvir,
    () => new URLSearchParams(window.location.search).has("um-por-vez"),
    () => false
  );
  const [escolha, setUmPorVez] = useState<boolean | null>(null);
  const umPorVez = escolha ?? pedidoPeloEndereco;

  /* O rascunho das marcas é o salvo até alguém mexer. */
  const efetivas = marcas ?? dia.feitasHoje;

  const { planejar } = dia;
  /* Enquanto os casos e o NPS chegam, o plano é "montando" — e não um dia vazio. */
  const carregando = dia.carregando;
  const plano = useMemo(() => (carregando ? null : planejar(efetivas)), [carregando, planejar, efetivas]);

  const dataPorExtenso = dia.agora
    ? dia.agora.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" })
    : "";

  return (
    <MainLayout>

      <div className="space-y-6">

        <PageHeading
          eyebrow="Operação"
          title="Meu dia"
          description={`${dataPorExtenso ? `${dataPorExtenso[0].toUpperCase()}${dataPorExtenso.slice(1)}. ` : ""}A rotina do documento com os números de hoje nas quatro frentes, o plano que cabe no expediente e o checkpoint com a gestão.`}
        />

        {umPorVez && <ModoProximo dia={dia} marcadas={efetivas} onFechar={() => setUmPorVez(false)} />}

        <CartaoDoPrimeiroAcesso />

        {/* O que pede ação, o que move a nota e o que já deu certo — antes da lista de tarefas. */}
        <AgoraNoMeuDia />

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">

          <RotinaDoDia dia={dia} rascunho={efetivas} setRascunho={setMarcas} onConfigurar={() => setConfigurando(true)} onUmPorVez={() => { setUmPorVez(true); window.scrollTo({ top: 0, behavior: "smooth" }); }} />

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
