import Link from "next/link";

import MainLayout from "@/components/layout/MainLayout";
import PageHeading from "@/components/shared/PageHeading";

import OndeFica from "@/components/primeiroAcesso/OndeFica";
import RoteiroDoPrimeiroAcesso from "@/components/primeiroAcesso/RoteiroDoPrimeiroAcesso";

export const metadata = {
  title: "Primeiro acesso · CW Reputação",
};

const ABAS = [
  { id: "roteiro", rotulo: "Roteiro" },
  { id: "onde-fica", rotulo: "Onde fica?" },
] as const;

/**
 * Primeiro acesso: o roteiro de quem entra no time e, desde 12/11/2026, o
 * mapa "Onde fica?" — o que cada função faz e o caminho até ela.
 */
export default async function PrimeiroAcessoPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const { aba } = await searchParams;
  const atual = aba === "onde-fica" ? "onde-fica" : "roteiro";

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeading
          eyebrow="Conhecimento"
          title="Primeiro acesso"
          description="O roteiro de quem entra no time, e onde fica cada coisa da plataforma."
        />

        <nav aria-label="Partes do primeiro acesso" className="flex gap-1 border-b border-zinc-200">
          {ABAS.map((a) => (
            <Link
              key={a.id}
              href={a.id === "roteiro" ? "/primeiro-acesso" : `/primeiro-acesso?aba=${a.id}`}
              aria-current={atual === a.id ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                atual === a.id ? "border-violet-600 text-violet-800" : "border-transparent text-zinc-500 hover:text-zinc-800"
              }`}
            >
              {a.rotulo}
            </Link>
          ))}
        </nav>

        {atual === "onde-fica" ? <OndeFica /> : <RoteiroDoPrimeiroAcesso />}
      </div>
    </MainLayout>
  );
}
