import Card from "@/components/design-system/Card";

export default function RequestsCard() {
  return (
    <Card>

      <h2 className="text-xl font-semibold mb-6">
        Solicitações
      </h2>

      <table className="w-full">

        <thead>

          <tr className="border-b">

            <th className="py-3 text-left">Tipo</th>
            <th className="text-left">Status</th>
            <th className="text-left">Valor</th>

          </tr>

        </thead>

        <tbody>

          <tr>

            <td className="py-4">
              Desconto
            </td>

            <td>
              Em análise
            </td>

            <td>
              R$120,00
            </td>

          </tr>

        </tbody>

      </table>

    </Card>
  );
}