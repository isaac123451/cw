"use client";

import { useState } from "react";

import {
  ChevronDown,
  Copy,
  FileText,
  Trash2,
} from "lucide-react";

import { Case } from "@/lib/models/case";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { limparDossie } from "@/lib/actions/cases";

/**
 * O dossiê que a extensão salvou, na ficha do caso.
 *
 * O Isaac pediu as duas metades: "quero que você salve o dossiê caso eu
 * clique em salvar pela extensão e assim apareça na ferramenta" e "o
 * resumo deve aparecer na reclamação".
 *
 * O dossiê é montado no WhatsApp, onde o atendimento acontece — mas
 * quem abre o caso pela aplicação no dia seguinte é outra pessoa, ou a
 * mesma sem o painel aberto. Sem isto, a leitura morria na aba do
 * navegador de quem a pediu, e o próximo montava de novo: outros quinze
 * segundos, outra chamada ao modelo, e uma leitura ligeiramente
 * diferente da anterior.
 *
 * **Some quando não há dossiê.** Um cartão vazio dizendo "nenhum dossiê
 * ainda" ocuparia espaço em 341 casos para avisar de uma ausência que
 * não é problema — a maioria dos casos não precisa de dossiê.
 *
 * **Recolhido por padrão.** São milhares de caracteres; aberto, empurra
 * o relato e a resposta pública para fora da tela, e eles é que são a
 * primeira leitura.
 */
export default function DossieCard({
  data,
}: {
  data: Case;
}) {

  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [apagado, setApagado] = useState(false);

  if (!data.dossier || apagado) return null;

  const quando = data.dossierAt
    ? new Date(data.dossierAt).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(
        data.dossier ?? ""
      );
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* Navegador sem permissão: o texto está na tela para copiar à mão. */
    }
  }

  return (
    <SurfaceCard
      title="Dossiê do atendimento"
      description={
        quando
          ? `Salvo pela extensão em ${quando}${data.dossierBy ? ` por ${data.dossierBy}` : ""}.`
          : "Salvo pela extensão."
      }
      action={
        <div className="flex shrink-0 items-center gap-1.5">

          <button
            type="button"
            onClick={copiar}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
          >
            <Copy size={13} />
            {copiado ? "Copiado" : "Copiar"}
          </button>

          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-50"
          >
            {aberto ? "Recolher" : "Ler"}
            <ChevronDown
              size={13}
              className={`transition-transform ${aberto ? "rotate-180" : ""}`}
            />
          </button>

        </div>
      }
    >

      {aberto ? (

        <>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
            {data.dossier}
          </p>

          {/*
            Apagar existe porque o dossiê envelhece.

            Ele é um retrato do caso no dia em que foi montado; depois de
            três movimentações ele descreve um caso que já não existe, e
            um texto desatualizado com cara de resumo oficial é pior do
            que nenhum. Quem apaga sabe que basta montar de novo pela
            extensão.
          */}
          <button
            type="button"
            disabled={apagando}
            onClick={async () => {

              setApagando(true);

              await limparDossie(data.protocol);

              /*
                Some da tela na hora, e a recarga confirma.

                A lista de casos vem de um cache com etiqueta; esperar
                a revalidação para o cartão sumir deixaria a pessoa
                clicando duas vezes.
              */
              setApagado(true);
              setApagando(false);
            }}
            className="mt-4 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
          >
            <Trash2 size={13} />
            {apagando ? "Apagando…" : "Apagar este dossiê"}
          </button>
        </>

      ) : (

        <p className="flex items-start gap-2 text-sm leading-relaxed text-zinc-500">

          <FileText
            size={15}
            className="mt-0.5 shrink-0 text-violet-500"
          />

          <span>
            {data.dossier.slice(0, 180)}
            {data.dossier.length > 180 && "…"}
          </span>

        </p>

      )}

    </SurfaceCard>
  );
}
