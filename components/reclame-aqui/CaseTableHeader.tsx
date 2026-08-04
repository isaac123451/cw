export default function CaseTableHeader() {
  return (
    <thead>

      <tr className="border-b bg-zinc-50">

        <th className="px-6 py-4 text-left">ID</th>

        <th>Empresa</th>

        <th>Origem</th>

        <th>Categoria</th>

        <th>Prioridade</th>

        <th>Status</th>

        <th>Responsável</th>

        <th>SLA</th>

      </tr>

    </thead>
  );
}