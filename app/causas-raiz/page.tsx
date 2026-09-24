"use client";

import { useEffect, useState } from "react";

import MainLayout from "@/components/layout/MainLayout";
import PageHeading from "@/components/shared/PageHeading";
import SurfaceCard from "@/components/shared/SurfaceCard";
import PropostaDoCatalogo from "@/components/causas/PropostaDoCatalogo";

import { aprovarCausasDoCatalogo, lerPropostaDoCatalogo } from "@/lib/actions/catalogoDeCausas";
import { useNps } from "@/lib/context/NpsContext";
import type { CausaAprovada, PropostaDoCatalogo as Proposta } from "@/lib/models/catalogoDeCausas";

/**
 * Causas raiz que direcionam (Fase 27).
 *
 * "Crie causas raiz conforme os casos que já tiveram para direcionar
 * corretamente." A proposta é tirada dos registros de verdade, cada
 * causa com a área que resolve e o prazo; aprovada, vira a lista que as
 * quatro frentes usam para classificar.
 */
export default function CausasRaizPage() {

  const { recarregarCausas } = useNps();
  const [carga, setCarga] = useState<{ proposta?: Proposta; erro?: string } | null>(null);

  useEffect(() => {
    let ativo = true;
    lerPropostaDoCatalogo()
      .then((r) => {
        if (ativo) setCarga(r.ok ? { proposta: r.proposta } : { erro: r.erro });
      })
      .catch(() => {
        if (ativo) setCarga({ erro: "A proposta não carregou. Recarregue a página." });
      });
    return () => {
      ativo = false;
    };
  }, []);

  async function aprovar(itens: CausaAprovada[]) {
    const r = await aprovarCausasDoCatalogo(itens);
    if (r.ok) await recarregarCausas();
    return r;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeading
          eyebrow="Inteligência"
          title="Causas raiz"
          description="O catálogo que diz para quem ligar: tirado dos casos reais, cada causa com a área dona e o prazo."
        />
        {carga?.proposta ? (
          <PropostaDoCatalogo proposta={carga.proposta} aoAprovar={aprovar} />
        ) : (
          <SurfaceCard title="Catálogo tirado da base" description="A proposta sai dos relatos, comentários e avaliações já registrados.">
            <p className={`text-sm ${carga?.erro ? "text-rose-700" : "text-zinc-500"}`}>{carga?.erro ?? "Lendo os registros…"}</p>
          </SurfaceCard>
        )}
      </div>
    </MainLayout>
  );
}
