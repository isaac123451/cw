import Link from "next/link";

import {
  ArrowUpRight,
  Building2,
  GitBranch,
  LucideIcon,
  ShieldCheck,
  Tags,
  Users,
  Workflow,
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import SurfaceCard from "@/components/shared/SurfaceCard";

interface SettingLink {
  title: string;
  description: string;
  href?: string;
  icon: LucideIcon;
}

const settings: SettingLink[] = [
  {
    title: "Fluxo de atendimento",
    description:
      "Etapas do Kanban, cores, SLA, responsáveis e limite de cartões.",
    href: "/reclame-aqui/configuracoes",
    icon: Workflow,
  },
  {
    title: "Estabelecimentos",
    description:
      "Restaurantes que contratam a Cardápio Web, com plano e situação da conta.",
    href: "/estabelecimentos",
    icon: Building2,
  },
  {
    title: "Clientes",
    description:
      "Pessoas por trás das reclamações — consumidores, donos e operadores.",
    href: "/clientes",
    icon: Users,
  },
  {
    title: "Categorias e assuntos",
    description:
      "Taxonomia usada para classificar reclamações e causas raiz.",
    icon: Tags,
  },
  {
    title: "Usuários e times",
    description:
      "Agentes da operação, áreas responsáveis e distribuição de carga.",
    icon: Users,
  },
  {
    title: "Permissões",
    description:
      "Perfis de acesso por módulo para Suporte, Produto e Qualidade.",
    icon: ShieldCheck,
  },
  {
    title: "Integrações",
    description:
      "Importação de planilhas do Reclame Aqui e canais de rede social.",
    icon: GitBranch,
  },
];

export default function ConfiguracoesPage() {
  return (
    <MainLayout>

      <div className="space-y-6">

        <PageHeading
          eyebrow="Plataforma"
          title="Configurações"
          description="Parâmetros da operação de Experiência do Cliente."
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">

          {settings.map((item) => {

            const Icon = item.icon;

            const content = (
              <>
                <div className="flex items-start justify-between gap-3">

                  <span className="rounded-xl bg-violet-50 p-2.5 text-violet-600 ring-1 ring-inset ring-violet-100">
                    <Icon size={18} />
                  </span>

                  {item.href ? (
                    <ArrowUpRight
                      size={16}
                      className="text-zinc-300 transition-colors group-hover:text-violet-500"
                    />
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      Em breve
                    </span>
                  )}

                </div>

                <h3 className="mt-4 text-sm font-semibold text-zinc-900">
                  {item.title}
                </h3>

                <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
                  {item.description}
                </p>
              </>
            );

            const base =
              "block rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]";

            return item.href ? (
              <Link
                key={item.title}
                href={item.href}
                className={`group ${base} transition-colors hover:border-violet-200 hover:bg-violet-50/30`}
              >
                {content}
              </Link>
            ) : (
              <div
                key={item.title}
                className={`${base} opacity-80`}
              >
                {content}
              </div>
            );
          })}

        </div>

        <SurfaceCard
          title="Sobre a plataforma"
          description="CW Reputação — central operacional da área de Experiência do Cliente."
        >

          <dl className="grid gap-5 sm:grid-cols-3">

            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-400">
                Versão
              </dt>
              <dd className="mt-1 text-sm font-medium text-zinc-800">
                1.0.0
              </dd>
            </div>

            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-400">
                Origem dos dados
              </dt>
              <dd className="mt-1 text-sm font-medium text-zinc-800">
                Cadastro manual e importação de planilhas
              </dd>
            </div>

            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-400">
                Módulo ativo
              </dt>
              <dd className="mt-1 text-sm font-medium text-zinc-800">
                Reclame Aqui
              </dd>
            </div>

          </dl>

        </SurfaceCard>

      </div>

    </MainLayout>
  );
}
