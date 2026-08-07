import "./globals.css";

import type { Metadata } from "next";

import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import { WorkflowProvider } from "@/lib/context/WorkflowContext";
import { CaseProvider } from "@/lib/context/CaseContext";
import { SettingsProvider } from "@/lib/context/SettingsContext";
import { SessionProvider } from "@/lib/context/SessionContext";
import { JourneyProvider } from "@/lib/context/JourneyContext";
import { GoalsProvider } from "@/lib/context/GoalsContext";
import { ImpactProvider } from "@/lib/context/ImpactContext";
import { AgendaProvider } from "@/lib/context/AgendaContext";
import { ProjectsProvider } from "@/lib/context/ProjectsContext";
import { DocsProvider } from "@/lib/context/DocsContext";
import { TeamsProvider } from "@/lib/context/TeamsContext";
import { EstablishmentsProvider } from "@/lib/context/EstablishmentsContext";
import { ClientsProvider } from "@/lib/context/ClientsContext";

import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "CW Reputação",
  description:
    "Plataforma de Gestão da Experiência do Cliente da Cardápio Web.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  const session = await getSession();

  return (
    <html
      lang="pt-BR"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >

      <body>

        <SessionProvider value={session}>

          <WorkflowProvider>

            <SettingsProvider>

              <CaseProvider>

                <EstablishmentsProvider>

                <ClientsProvider>

                <JourneyProvider>

                  <GoalsProvider>

                    <ImpactProvider>

                      <AgendaProvider>

                        <ProjectsProvider>

                          <TeamsProvider>

                          <DocsProvider>

                            {children}

                          </DocsProvider>

                          </TeamsProvider>

                        </ProjectsProvider>

                      </AgendaProvider>

                    </ImpactProvider>

                  </GoalsProvider>

                </JourneyProvider>

                </ClientsProvider>

                </EstablishmentsProvider>

              </CaseProvider>

            </SettingsProvider>

          </WorkflowProvider>

        </SessionProvider>

      </body>

    </html>
  );
}
