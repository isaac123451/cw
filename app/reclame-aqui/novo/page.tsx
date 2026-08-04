import MainLayout from "@/components/layout/MainLayout";
import PageHeader from "@/components/design-system/PageHeader";

import NewCaseForm from "@/components/forms/NewCaseForm";

export default function NovoCasoPage() {
  return (
    <MainLayout>

      <PageHeader
        title="Novo Caso"
        description="Cadastrar um novo atendimento."
      />

      <NewCaseForm />

    </MainLayout>
  );
}