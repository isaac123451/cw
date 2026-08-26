"use client";

import Link from "next/link";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { FileQuestion } from "lucide-react";

import { useCases } from "@/lib/context/CaseContext";
import { isSocial } from "@/lib/services/case.service";

import CaseDetail from "./CaseDetail";

interface Props {
  id: string;

  /**
   * De qual módulo esta tela foi aberta.
   *
   * O caso não muda — a tela é a mesma — mas o **endereço** importa: um
   * atendimento do Instagram aberto em `/reclame-aqui/…` diz, na barra
   * do navegador e em qualquer link copiado dali, que ele é uma
   * reclamação. Não é, e era assim que a confusão entre as frentes
   * começava.
   */
  modulo?: "reclame-aqui" | "social";
}

/**
 * Lê o caso do contexto (e não do mock direto) para que edições feitas
 * aqui e movimentações no Kanban fiquem em sincronia.
 */
export default function CaseDetailView({
  id,
  modulo = "reclame-aqui",
}: Props) {

  const { cases, loading } = useCases();
  const router = useRouter();

  const data = cases.find((item) => item.id === id);

  /**
   * Endereço errado para a frente do caso corrige sozinho.
   *
   * Vale para os dois lados, e os dois acontecem: links antigos de
   * casos sociais apontam para `/reclame-aqui/…`, e alguém pode chegar
   * a uma reclamação por `/redes-sociais/…` trocando a URL. Em vez de
   * mostrar o caso no módulo errado — que é o defeito que se está
   * consertando — a tela leva para o lugar certo, preservando o link.
   */
  const moduloDoCaso = data
    ? isSocial(data)
      ? "social"
      : "reclame-aqui"
    : null;

  const precisaTrocar =
    moduloDoCaso !== null && moduloDoCaso !== modulo;

  useEffect(() => {

    if (!precisaTrocar || !data) return;

    router.replace(
      moduloDoCaso === "social"
        ? `/redes-sociais/${data.id}`
        : `/reclame-aqui/${data.id}`
    );

  }, [precisaTrocar, moduloDoCaso, data, router]);

  if (precisaTrocar) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-zinc-500">
        Este caso é de{" "}
        {moduloDoCaso === "social"
          ? "Redes Sociais"
          : "Reclame Aqui"}
        . Levando você para lá…
      </div>
    );
  }

  if (!data) {

    /*
      Carga em andamento não é caso inexistente.

      Antes as duas situações mostravam "Reclamação não encontrada", e
      abrir um link direto num navegador frio acusava um caso apagado
      que estava ali — bastava esperar.
    */
    if (loading) {
      return (
        <div className="flex items-center justify-center py-20 text-sm text-zinc-500">
          Carregando o caso…
        </div>
      );
    }

    const volta =
      modulo === "social"
        ? { href: "/redes-sociais", nome: "Redes Sociais" }
        : { href: "/reclame-aqui", nome: "Reclame Aqui" };

    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white py-20 text-center">

        <FileQuestion size={28} className="text-zinc-300" />

        <p className="mt-3 text-sm font-medium text-zinc-700">
          Caso não encontrado.
        </p>

        <p className="mt-1 text-sm text-zinc-500">
          Ele pode ter sido removido da base.
        </p>

        <Link
          href={volta.href}
          className="mt-5 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800"
        >
          Voltar para {volta.nome}
        </Link>

      </div>
    );
  }

  return <CaseDetail data={data} />;
}
