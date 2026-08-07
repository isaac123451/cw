"use client";

import { useMemo, useState } from "react";

import {
  Bot,
  FileSearch,
  Gauge,
  LucideIcon,
  Send,
  Sparkles,
  Tags,
  Wand2,
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import SurfaceCard from "@/components/shared/SurfaceCard";

import { useCases } from "@/lib/context/CaseContext";
import { getCriticalCases } from "@/lib/services/case.service";

interface Skill {
  title: string;
  description: string;
  icon: LucideIcon;
  prompt: string;
}

const skills: Skill[] = [
  {
    title: "Sugerir resposta",
    description:
      "Gera uma resposta pública a partir do histórico e do tom aprovado.",
    icon: Wand2,
    prompt:
      "Sugira uma resposta pública para a reclamação mais crítica em aberto.",
  },
  {
    title: "Resumir caso",
    description:
      "Condensa a tratativa completa em um parágrafo objetivo.",
    icon: FileSearch,
    prompt:
      "Resuma o caso RA-20260009 destacando causa raiz e ações tomadas.",
  },
  {
    title: "Classificar automaticamente",
    description:
      "Sugere categoria, subcategoria e prioridade a partir do texto.",
    icon: Tags,
    prompt:
      "Classifique as reclamações sem categoria definida.",
  },
  {
    title: "Analisar sentimento",
    description:
      "Identifica risco de churn e insatisfação na base ativa.",
    icon: Gauge,
    prompt:
      "Quais clientes demonstram maior risco de cancelamento hoje?",
  },
];

export default function AssistentePage() {

  const { cases } = useCases();

  const [message, setMessage] = useState("");

  const insights = useMemo(() => {

    const critical = getCriticalCases(cases);

    const unanswered = cases.filter(
      (item) =>
        (item.publicResponse ?? "").trim() === ""
    );

    const topCategory = [...cases]
      .reduce<Map<string, number>>((map, item) => {
        map.set(
          item.category,
          (map.get(item.category) ?? 0) + 1
        );
        return map;
      }, new Map())
      .entries();

    const ranked = [...topCategory].sort(
      (a, b) => b[1] - a[1]
    );

    return [
      {
        title: "Prioridade do dia",
        text:
          critical.length > 0
            ? `${critical.length} casos críticos ou com risco de churn em aberto. O mais urgente é "${critical[0].title}" (${critical[0].company}).`
            : "Nenhum caso crítico em aberto no momento.",
      },
      {
        title: "Impacto na nota",
        text: `${unanswered.length} reclamações ainda sem resposta pública. Responder é o fator de maior peso no índice de resposta.`,
      },
      {
        title: "Causa raiz recorrente",
        text: ranked[0]
          ? `"${ranked[0][0]}" concentra ${ranked[0][1]} ocorrências. Vale revisar o processo dessa área.`
          : "Sem volume suficiente para apontar causa raiz.",
      },
    ];

  }, [cases]);

  return (
    <MainLayout>

      <div className="space-y-6">

        <PageHeading
          eyebrow="Inteligência"
          title="Assistente Inteligente"
          description="Apoio de IA para resposta, classificação, resumo e diagnóstico da operação."
        />

        <div className="grid gap-6 lg:grid-cols-3">

          <div className="lg:col-span-2 space-y-6">

            <SurfaceCard
              title="Converse com o assistente"
              description="Descreva o que precisa ou escolha uma habilidade sugerida."
            >

              <div className="rounded-2xl bg-gradient-to-br from-violet-50 via-white to-sky-50/60 p-5 ring-1 ring-inset ring-violet-100">

                <div className="flex items-start gap-3">

                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
                    <Bot size={18} />
                  </span>

                  <div className="min-w-0">

                    <p className="text-sm font-semibold text-zinc-900">
                      Assistente CW
                    </p>

                    <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
                      Posso sugerir respostas públicas, resumir
                      tratativas, classificar reclamações e apontar
                      a causa raiz mais provável. Selecione uma
                      habilidade abaixo para começar.
                    </p>

                  </div>

                </div>

              </div>

              <div className="mt-4 flex items-end gap-2">

                <textarea
                  value={message}
                  onChange={(e) =>
                    setMessage(e.target.value)
                  }
                  rows={3}
                  placeholder="Ex.: escreva uma resposta pública para a reclamação de cobrança duplicada..."
                  className="flex-1 resize-none rounded-xl border border-zinc-200 p-3 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400"
                />

                <button
                  disabled={message.trim() === ""}
                  className="flex h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
                >
                  <Send size={15} />
                  Enviar
                </button>

              </div>

              <p className="mt-2 text-xs text-zinc-400">
                A geração por IA ainda não está conectada. A
                interface já está pronta para receber o modelo.
              </p>

            </SurfaceCard>

            <div className="grid gap-4 sm:grid-cols-2">

              {skills.map((skill) => {

                const Icon = skill.icon;

                return (
                  <button
                    key={skill.title}
                    onClick={() =>
                      setMessage(skill.prompt)
                    }
                    className="group rounded-2xl border border-zinc-200/80 bg-white p-5 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-[0_10px_24px_-14px_rgba(111,66,193,0.4)]"
                  >

                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600 ring-1 ring-inset ring-violet-100">
                      <Icon size={18} />
                    </span>

                    <h3 className="mt-3 text-sm font-semibold text-zinc-900">
                      {skill.title}
                    </h3>

                    <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
                      {skill.description}
                    </p>

                  </button>
                );
              })}

            </div>

          </div>

          <SurfaceCard
            title="Leitura da operação"
            description="Diagnóstico gerado a partir dos dados atuais."
          >

            <ul className="space-y-4">

              {insights.map((insight) => (

                <li
                  key={insight.title}
                  className="rounded-xl border border-zinc-100 p-4"
                >

                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-600">
                    <Sparkles size={12} />
                    {insight.title}
                  </p>

                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                    {insight.text}
                  </p>

                </li>

              ))}

            </ul>

          </SurfaceCard>

        </div>

      </div>

    </MainLayout>
  );
}
