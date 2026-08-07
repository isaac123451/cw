import { redirect } from "next/navigation";

/**
 * "Empresas" virou duas coisas distintas:
 *
 * - Estabelecimentos: o restaurante que contrata a Cardápio Web
 * - Clientes: a pessoa por trás da reclamação
 *
 * A rota antiga fica de pé para não quebrar link já compartilhado.
 */
export default function EmpresasPage() {
  redirect("/estabelecimentos");
}
