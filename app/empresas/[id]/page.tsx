import { redirect } from "next/navigation";

interface Props {
  params: Promise<{
    id: string;
  }>;
}

/**
 * O que a tela antiga chamava de "empresa" era, na verdade, a pessoa que
 * reclamou — o import gravou company = customer. O slug é o mesmo, então
 * o link antigo cai direto no perfil do cliente correspondente.
 */
export default async function EmpresaPage({
  params,
}: Props) {

  const { id } = await params;

  redirect(`/clientes/${id}`);
}
