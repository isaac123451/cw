import "./globals.css";

import { WorkflowProvider } from "@/lib/context/WorkflowContext";
import { CaseProvider } from "@/lib/context/CaseContext";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">

      <body>

        <WorkflowProvider>

          <CaseProvider>

            {children}

          </CaseProvider>

        </WorkflowProvider>

      </body>

    </html>
  );
}