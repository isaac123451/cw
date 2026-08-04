import Card from "@/components/design-system/Card";

export default function ClientInfo() {
  return (
    <Card>

      <h2 className="text-xl font-semibold mb-6">
        Cliente
      </h2>

      <div className="grid grid-cols-2 gap-6">

        <div>

          <span className="text-sm text-zinc-500">
            Empresa
          </span>

          <p className="font-semibold">
            Pizzaria Itália
          </p>

        </div>

        <div>

          <span className="text-sm text-zinc-500">
            Plano
          </span>

          <p className="font-semibold">
            Profissional
          </p>

        </div>

        <div>

          <span className="text-sm text-zinc-500">
            Responsável
          </span>

          <p className="font-semibold">
            Carlos Isaac
          </p>

        </div>

        <div>

          <span className="text-sm text-zinc-500">
            Categoria
          </span>

          <p className="font-semibold">
            Fiscal
          </p>

        </div>

      </div>

    </Card>
  );
}