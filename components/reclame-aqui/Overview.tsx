import StatsCards from "./StatsCards";
import CasesTable from "./CaseTable";

export default function Overview() {
  return (
    <div className="space-y-8">

      <StatsCards />

      <CasesTable />

    </div>
  );
}