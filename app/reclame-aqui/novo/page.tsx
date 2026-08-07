import MainLayout from "@/components/layout/MainLayout";
import PageHeading from "@/components/shared/PageHeading";

import NewCaseForm from "@/components/forms/NewCaseForm";

export default function NovoCasoPage() {
  return (
    <MainLayout>

      <div className="space-y-6">

        <PageHeading
          eyebrow="Reclame Aqui"
          title="Nova reclamação"
          description="Cadastre manualmente um atendimento recebido."
        />

        <NewCaseForm />

      </div>

    </MainLayout>
  );
}
