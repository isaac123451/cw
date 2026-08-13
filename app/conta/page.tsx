import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import AccountTabs from "@/components/conta/AccountTabs";

import { getSession } from "@/lib/auth/session";
import { getAccessData } from "@/lib/auth/account";
import { hasDatabase } from "@/lib/prisma";

export const metadata = {
  title: "Minha conta · CW Reputação",
};

const abas = [
  "perfil",
  "senha",
  "notificacoes",
  "acessos",
] as const;

type Aba = (typeof abas)[number];

interface Props {
  searchParams: Promise<{ aba?: string }>;
}

export default async function ContaPage({
  searchParams,
}: Props) {

  const { aba } = await searchParams;

  const [session, access] = await Promise.all([
    getSession(),
    getAccessData(),
  ]);

  // O sino manda para ?aba=notificacoes; valor inválido cai no perfil.
  const initialTab: Aba = abas.includes(aba as Aba)
    ? (aba as Aba)
    : "perfil";

  return (
    <MainLayout>

      <div className="space-y-6">

        <PageHeading
          eyebrow="Plataforma"
          title="Minha conta"
          description="Seus dados, senha, alertas e — para administradores — quem pode acessar a plataforma."
        />

        <AccountTabs
          session={session}
          hasDatabase={hasDatabase()}
          access={access}
          initialTab={initialTab}
        />

      </div>

    </MainLayout>
  );
}
