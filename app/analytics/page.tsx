import MainLayout from "@/components/layout/MainLayout";

import AnalyticsOverview from "@/components/analytics/AnalyticsOverview";
import MetricasDiariasCard from "@/components/analytics/MetricasDiariasCard";

export default function AnalyticsPage() {
  return (
    <MainLayout>
      <AnalyticsOverview />

      {/*
        O histórico diário fica depois do panorama, e não antes.

        O panorama responde "como estamos"; a tabela responde "como
        chegamos aqui". Quem abre Analytics quase sempre quer a
        primeira, e quem quer a segunda desce atrás dela.
      */}
      <div className="mt-4">
        <MetricasDiariasCard />
      </div>
    </MainLayout>
  );
}
