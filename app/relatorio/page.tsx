import MainLayout from "@/components/layout/MainLayout";

import RelatorioDoCiclo from "@/components/relatorio/RelatorioDoCiclo";

/**
 * O Relatório de Reputação do ciclo — a atividade semanal da rotina
 * ("Enviar o Relatório de Reputação do ciclo", sexta às 16h) aponta
 * para cá.
 */
export default function RelatorioPage() {
  return (
    <MainLayout>
      <RelatorioDoCiclo />
    </MainLayout>
  );
}
