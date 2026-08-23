"use client";

import Link from "next/link";

import { ArrowLeft } from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";
import PageHeading from "@/components/shared/PageHeading";
import SurfaceCard from "@/components/shared/SurfaceCard";

import PlanosCard from "@/components/configuracoes/PlanosCard";

import { usePlans } from "@/lib/hooks/usePlans";
import { invalidarWorkspace } from "@/lib/context/useWorkspace";

import { tabelaDePlanos } from "@/lib/models/plan";

/**
 * Planos e módulos, com o preço vigente.
 *
 * Existe por causa das macros. O texto pronto que explica preço tinha o
 * valor **digitado dentro dele**, e preço digitado em texto envelhece
 * calado: ninguém revisa uma resposta pronta quando a tabela muda, e o
 * consumidor recebe um número que não existe mais.
 *
 * Com o cadastro, a macro escreve `{{planos}}` e a tabela é montada na
 * hora da inserção — o valor errado deixa de ser possível por
 * construção. A prévia embaixo mostra exatamente o texto que vai sair.
 */
export default function PlanosPage() {

  const [planos, , carregando] = usePlans();

  async function recarregar() {
    invalidarWorkspace();
  }

  return (
    <MainLayout>

      <div className="space-y-6">

        <Link
          href="/configuracoes"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-violet-600"
        >
          <ArrowLeft size={16} />
          Voltar para Configurações
        </Link>

        <PageHeading
          eyebrow="Plataforma"
          title="Planos e módulos"
          description="A tabela de preços que a resposta pronta usa. Editar aqui muda o que sai na próxima resposta — sem passar por deploy."
        />

        {carregando ? (

          <SurfaceCard
            title="Planos"
            description="Carregando..."
          >
            <p className="text-sm text-zinc-400">
              Carregando...
            </p>
          </SurfaceCard>

        ) : (

          <>

            <PlanosCard
              itens={planos}
              kind="plano"
              titulo="Planos"
              descricao="O que se contrata. Os valores vieram da central de ajuda e ficam aqui para serem corrigidos quando mudarem."
              dica="Desativar um plano o tira da tabela que a macro monta, mas não apaga o registro — serve para plano que saiu de venda e ainda tem cliente."
              onSaved={recarregar}
            />

            <PlanosCard
              itens={planos}
              kind="modulo"
              titulo="Módulos adicionais"
              descricao="O que se soma a qualquer plano."
              dica="Módulo não tem lista de recursos: a descrição de uma linha já diz o que ele faz."
              onSaved={recarregar}
            />

            <SurfaceCard
              title="Como isso entra na resposta"
              description="A prévia do que a macro escreve — montada agora, com o que está gravado."
              hint="Escreva {{planos}} ou {{modulos}} no corpo de uma resposta pronta. A tabela é montada na hora da inserção, e não no momento em que o texto foi escrito."
            >

              <div className="grid gap-4 sm:grid-cols-2">

                {(
                  [
                    ["{{planos}}", "plano"],
                    ["{{modulos}}", "modulo"],
                  ] as const
                ).map(([token, kind]) => (

                  <div key={token}>

                    <p className="mb-1.5 font-mono text-[11px] text-violet-700">
                      {token}
                    </p>

                    <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl bg-zinc-50 px-3.5 py-3 text-xs leading-relaxed text-zinc-700">
                      {tabelaDePlanos(planos, kind) ||
                        "(nenhum ativo)"}
                    </pre>

                  </div>

                ))}

              </div>

              <p className="mt-4 text-xs leading-relaxed text-zinc-500">
                É a diferença entre uma resposta que
                envelhece e uma que não pode envelhecer: o
                preço nunca chega a ser digitado dentro do
                texto.{" "}
                <Link
                  href="/base-conhecimento"
                  className="font-medium text-violet-700 underline underline-offset-2"
                >
                  Ver as respostas prontas
                </Link>
                .
              </p>

            </SurfaceCard>

          </>

        )}

      </div>

    </MainLayout>
  );
}
