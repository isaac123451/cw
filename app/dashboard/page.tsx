"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import {
  ArrowRight,
  Inbox,
  MessageSquareWarning,
  Timer,
  TriangleAlert,
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import StatTile from "@/components/shared/StatTile";
import SurfaceCard from "@/components/shared/SurfaceCard";

import ReputationHero from "@/components/dashboard/ReputationHero";
import TodayAgenda from "@/components/dashboard/TodayAgenda";
import ImpactSummary from "@/components/dashboard/ImpactSummary";
import MonthlyEvolution from "@/components/dashboard/MonthlyEvolution";
import CriticalCases from "@/components/dashboard/CriticalCases";
import CategoryDistribution from "@/components/dashboard/CategoryDistribution";

import { useCases } from "@/lib/context/CaseContext";
import { useSession } from "@/lib/context/SessionContext";
import { useNps } from "@/lib/context/NpsContext";
import { useAgenda } from "@/lib/context/AgendaContext";

import { STATUS_SEM_TRATATIVA } from "@/lib/models/nps";

import {
  isOpen,
  isReclameAqui,
  isSocial,
  seteDiasAtras,
} from "@/lib/services/case.service";
import { hojeNaOperacao } from "@/lib/services/reputation.service";
import FrentesResumo from "@/components/dashboard/FrentesResumo";

/**
 * Atalhos para onde a operação realmente age.
 *
 * Eram três, todos do Reclame Aqui — o painel abria falando das três
 * frentes e o rodapé oferecia caminho para uma. Os de agora cobrem as
 * três, mais o que se faz depois de resolver: registrar impacto e
 * agendar retorno.
 *
 * `contar` é opcional e transforma o atalho num número com destino: um
 * link chamado "NPS" é uma navegação, um chamado "NPS · 23 sem
 * tratativa" é uma decisão.
 */
const atalhos: {
  label: string;
  href: string;
  hint: string;
  contar?: (dados: {
    semTratativaNps: number;
    socialAbertos: number;
    tarefasHoje: number;
  }) => number;
}[] = [
  {
    label: "Fila do Reclame Aqui",
    href: "/reclame-aqui",
    hint: "Quadro e lista das reclamações",
  },
  {
    label: "NPS sem tratativa",
    href: "/nps",
    hint: "Respostas da pesquisa que ninguém pegou",
    contar: (d) => d.semTratativaNps,
  },
  {
    label: "Redes sociais",
    href: "/redes-sociais",
    hint: "Instagram, WhatsApp e ManyChat",
    contar: (d) => d.socialAbertos,
  },
  {
    label: "Agenda de hoje",
    href: "/agenda",
    hint: "Retornos e lembretes do dia",
    contar: (d) => d.tarefasHoje,
  },
  {
    label: "Analytics de reputação",
    href: "/reclame-aqui/analytics",
    hint: "Nota, indicadores e diagnóstico",
  },
  {
    label: "Gráficos e dados",
    href: "/reclame-aqui/graficos",
    hint: "Tempo de resposta, causas e movimento",
  },
  {
    label: "Calculadora",
    href: "/reclame-aqui/calculadora",
    hint: "Simule o efeito de novas avaliações",
  },
  {
    label: "Impacto no negócio",
    href: "/impacto",
    hint: "Registrar o resultado de uma tratativa",
  },
];

export default function DashboardPage() {

  const { cases } = useCases();
  const session = useSession();
  const { responses } = useNps();
  const { tasks } = useAgenda();
  const router = useRouter();

  const metrics = useMemo(() => {

    const abertos = cases.filter(isOpen);

    const semResposta = cases.filter(
      (item) =>
        isReclameAqui(item) &&
        (item.publicResponse ?? "").trim() === ""
    );

    /*
      Sem resposta há mais de 7 dias — o que derruba a nota.

      O corte vem de `case.service` porque a lista filtrada usa o
      mesmo. Painel e fila que discordam sobre o que é "vencida" é
      exatamente o defeito que estes cartões clicáveis criariam se cada
      um tivesse a sua conta.
    */
    const corte = seteDiasAtras();

    return {
      abertos: abertos.length,
      semResposta: semResposta.length,
      vencidos: semResposta.filter(
        (item) => item.createdAt < corte
      ).length,
      churn: cases.filter((item) => item.churnRisk)
        .length,
    };

  }, [cases]);

  /**
   * O que cada atalho tem para mostrar.
   *
   * Uma conta só, memorizada junto: são três varreduras sobre listas
   * que a tela já tem em memória, e fazê-las dentro do `map` do rodapé
   * seria repeti-las a cada render do painel.
   */
  const contagens = useMemo(
    () => ({
      semTratativaNps: responses.filter(
        (item) => item.status === STATUS_SEM_TRATATIVA
      ).length,

      socialAbertos: cases.filter(
        (item) => isSocial(item) && isOpen(item)
      ).length,

      tarefasHoje: tasks.filter(
        (item) =>
          !item.done && item.dueDate <= hojeNaOperacao()
      ).length,
    }),
    [responses, cases, tasks]
  );

  const primeiroNome =
    session?.name?.split(" ")[0] ?? "";

  return (
    <MainLayout>

      <div className="space-y-6">

        <PageHeading
          eyebrow="Visão geral"
          title={
            primeiroNome
              ? `Bom trabalho, ${primeiroNome}`
              : "Dashboard executivo"
          }
          description="A reputação da Cardápio Web e o que a operação precisa resolver hoje."
        />

        <ReputationHero />

        {/*
          O aviso que faltava.

          O bloco acima é a janela oficial de 6 meses — é ela que define
          a nota pública. Os quatro cartões abaixo são a base inteira,
          porque uma reclamação de 2024 sem resposta continua sem
          resposta e continua sendo trabalho.

          Os dois estão certos e mediam coisas diferentes, mas nada na
          tela dizia isso: a nota mostrava 6 sem resposta e o cartão
          logo abaixo mostrava 13. Dois números para a mesma pergunta,
          um do lado do outro, é como alguém perde a confiança na tela
          inteira.
        */}
        <p className="-mb-1 text-xs text-zinc-500">
          Acima, a janela oficial de 6 meses — a que define
          a nota pública. Abaixo, <strong className="font-semibold text-zinc-700">toda a base</strong>:
          reclamação antiga sem resposta continua sendo
          trabalho, mesmo fora da janela.
        </p>

        {/*
          Os quatro números, agora com destino.

          Eram becos sem saída: a tela dizia "14 sem resposta pública" e
          não havia caminho da contagem para as catorze. Quem quisesse a
          lista atravessava a aplicação e remontava o filtro à mão — e
          como não havia filtro para "sem resposta", não remontava.

          Cada cartão leva à fila já recortada pela mesma regra que o
          contou (`naSituacao`, em `case.service`), e é isso que impede
          o defeito clássico dessas telas: o painel dizer 14 e a lista
          mostrar 11.
        */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <StatTile
            label="Sem resposta pública"
            description="Reclamações que ainda não foram respondidas no portal. É o que mais pesa na nota. Clique para ver a lista."
            value={metrics.semResposta}
            hint="em toda a base"
            icon={MessageSquareWarning}
            onClick={() =>
              router.push(
                "/reclame-aqui?situacao=sem-resposta"
              )
            }
            tone={
              metrics.semResposta > 0
                ? "danger"
                : "success"
            }
          />

          <StatTile
            label="Vencidas há +7 dias"
            description="Sem resposta há mais de uma semana — prioridade máxima. Clique para ver a lista."
            value={metrics.vencidos}
            hint="em toda a base"
            icon={Timer}
            onClick={() =>
              router.push(
                "/reclame-aqui?situacao=vencidas"
              )
            }
            tone={
              metrics.vencidos > 0 ? "warning" : "success"
            }
          />

          <StatTile
            label="Na fila da operação"
            description="Casos que dependem de alguma ação do time. Clique para ver a lista."
            value={metrics.abertos}
            hint="em toda a base"
            icon={Inbox}
            onClick={() =>
              router.push("/reclame-aqui?situacao=na-fila")
            }
            tone="info"
          />

          <StatTile
            label="Risco de cancelamento"
            description="Contas marcadas como caso de retenção — o cliente sinalizou que pode cancelar. Clique para ver a lista."
            onClick={() =>
              router.push("/reclame-aqui?situacao=risco")
            }
            value={metrics.churn}
            hint="em toda a base"
            icon={TriangleAlert}
            tone="primary"
          />

        </div>

        {/*
          As três frentes, antes de qualquer gráfico.

          O painel abria direto na nota do Reclame Aqui, e o resto da
          operação — NPS e redes sociais — não aparecia em lugar nenhum.
          Este cartão responde "onde está o trabalho hoje" antes de
          entrar no detalhe de uma frente só.
        */}
        <FrentesResumo />

        <div className="grid min-w-0 gap-5 sm:gap-6 xl:grid-cols-3">

          <div className="min-w-0 xl:col-span-2">
            <MonthlyEvolution />
          </div>

          <TodayAgenda />

        </div>

        <div className="grid min-w-0 gap-5 sm:gap-6 xl:grid-cols-3">

          <div className="min-w-0 xl:col-span-2">
            <CriticalCases />
          </div>

          <ImpactSummary />

        </div>

        <div className="grid min-w-0 gap-5 sm:gap-6 lg:grid-cols-3">

          <div className="min-w-0 lg:col-span-2">
            <CategoryDistribution />
          </div>

          <SurfaceCard
            title="Atalhos"
            description="Onde a operação age no dia a dia."
            bodyClassName="p-2"
          >

            <ul className="space-y-1">

              {atalhos.map((item) => (

                <li key={item.href}>

                  <Link
                    href={item.href}
                    className="group flex items-center gap-3 rounded-xl px-3.5 py-3 transition-colors hover:bg-violet-50/60"
                  >

                    <span className="min-w-0 flex-1">

                      <span className="block truncate text-sm font-medium text-zinc-800">
                        {item.label}
                      </span>

                      <span className="block truncate text-xs text-zinc-500">
                        {item.hint}
                      </span>

                    </span>

                    {/*
                      O número só aparece quando é maior que zero.

                      Uma etiqueta "0" em quatro atalhos é ruído com
                      cara de alerta; a ausência já diz que não há nada
                      esperando ali.
                    */}
                    {item.contar &&
                      item.contar(contagens) > 0 && (
                        <span className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                          {item.contar(contagens)}
                        </span>
                      )}

                    <ArrowRight
                      size={15}
                      className="shrink-0 text-zinc-300 transition-colors group-hover:text-violet-600"
                    />

                  </Link>

                </li>

              ))}

            </ul>

          </SurfaceCard>

        </div>

      </div>

    </MainLayout>
  );
}
