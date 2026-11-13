"use client";

import { useMemo } from "react";
import { rotuloDoCaso } from "@/lib/services/case.service";

import DispararEmLote from "@/components/disparos/DispararEmLote";

import { useCases } from "@/lib/context/CaseContext";
import { useSession } from "@/lib/context/SessionContext";
import { telefoneDoDisparo } from "@/lib/models/disparos";
import { mensagemDeAtualizacao } from "@/lib/models/mensagens";
import type { ItemDaRotina } from "@/lib/models/meuDia";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

/**
 * Atualização em lote para quem está sem notícia (05/11/2026) — uma das
 * novidades ★ do plano de novembro.
 *
 * Dentro de "Fazer os FUPs de quem está sem retorno": os casos da lista da
 * atividade (os seus, quando o dia está dividido) que estão sem notícia e
 * têm telefone viram uma lista de disparo com a mensagem de atualização do
 * guia, já com o nome. Você aperta Enter em cada uma no WhatsApp Web; cada
 * envio registra o contato de atualização e o caso sai de "sem notícia".
 */
export default function AtualizacaoEmLote({ itens }: { itens: ItemDaRotina[] }) {
  const { cases } = useCases();
  const sessao = useSession();

  const candidatos = useMemo(() => {
    const daLista = new Set(itens.filter((i) => /sem notícia/.test(i.detalhe ?? "")).map((i) => i.id));
    return cases
      .filter((c) => daLista.has(c.id) && telefoneDoDisparo(c.phone ?? ""))
      .map((c) => ({
        chave: c.protocol,
        nome: c.customer,
        telefone: telefoneDoDisparo(c.phone ?? "")!,
        mensagem: mensagemDeAtualizacao({ nome: c.customer }),
        ref: `caso:${rotuloDoCaso(c)}`,
        motivo: c.protocol,
      }));
  }, [cases, itens]);

  if (!candidatos.length) return null;
  return (
    <div className="mt-2 px-3 pb-3">
      <DispararEmLote nome={`Atualização · ${hojeNaOperacao().split("-").reverse().join("/")}${sessao?.name ? ` · ${sessao.name.split(" ")[0]}` : ""}`} origem="atualizacao" candidatos={candidatos} />
    </div>
  );
}
