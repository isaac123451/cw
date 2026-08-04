import MainLayout from "@/components/layout/MainLayout";
import PageHeader from "@/components/design-system/PageHeader";
import CompanyTable from "@/components/companies/CompanyTable";

export default function EmpresasPage() {
  return (
    <MainLayout>

      <PageHeader
        title="Empresas"
        description="Clientes cadastrados."
      />

      <CompanyTable />

    </MainLayout>
  );
}