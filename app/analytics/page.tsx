import MainLayout from "@/components/layout/MainLayout";

import AnalyticsOverview from "@/components/analytics/AnalyticsOverview";
import CausaRaizCruzada from "@/components/analytics/CausaRaizCruzada";
import MetricasDiariasCard from "@/components/analytics/MetricasDiariasCard";

export default function AnalyticsPage() {
  return (
    <MainLayout>
      <AnalyticsOverview />

      {/*
        A causa raiz somada vem logo depois do panorama: é a pergunta
        seguinte ("e por quê?"), e só existe aqui — cada frente tem a
        sua lista, esta é a única tela que soma as quatro.
      */}
      <div className="mt-4">
        <CausaRaizCruzada />
      </div>

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
