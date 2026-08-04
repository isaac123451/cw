import Card from "@/components/design-system/Card";

export default function WelcomeCard() {
  return (
    <Card className="relative overflow-hidden">

      <div className="flex items-center justify-between">

        <div>

          <span className="text-sm text-zinc-500">
            Bem-vindo ao
          </span>

          <h1 className="mt-2 text-4xl font-bold">
            CW Reputação
          </h1>

          <p className="mt-4 max-w-xl text-zinc-500 leading-7">

            Central de gestão da reputação da Cardápio Web.

            Acompanhe casos do Reclame Aqui, Redes Sociais,
            indicadores, clientes críticos e insights inteligentes.

          </p>

        </div>

        <div className="hidden lg:block">

          <div className="h-40 w-40 rounded-full bg-violet-100 flex items-center justify-center">

            🤖

          </div>

        </div>

      </div>

    </Card>
  );
}