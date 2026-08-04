import RequestList from "@/components/requests/RequestList";

export default function RequestsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">
          Solicitações
        </h2>

        <p className="mt-1 text-sm text-zinc-500">
          Solicitações concedidas ou em andamento para este caso.
        </p>
      </div>

      <RequestList />
    </div>
  );
}