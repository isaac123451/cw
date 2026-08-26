"use client";

import { useState } from "react";

import { ChevronDown, Tag } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";
import PlanosCard from "@/components/configuracoes/PlanosCard";

import { usePlans } from "@/lib/hooks/usePlans";
import { invalidarWorkspace } from "@/lib/context/useWorkspace";

import { precoEmReais } from "@/lib/models/plan";

/**
 * Planos e módulos, na tela onde o dinheiro é contado.
 *
 * O cadastro já existia, em Configurações → Planos, e era ali que ele
 * fazia sentido enquanto servia só às macros. Só que quem lança impacto
 * precisa dele o tempo todo: o valor de um cancelamento evitado é o
 * preço do plano da conta, e ir até Configurações para conferir custa
 * uma navegação inteira no meio de um lançamento — então ninguém vai, e
 * o número é digitado de memória.
 *
 * É a **mesma** tabela e as mesmas ações; nada é duplicado. Editar aqui
 * muda o preço que a macro escreve, e vice-versa.
 *
 * **Fechado por padrão.** A tela de impacto é para lançar e ler
 * resultado; a tabela de preços é consulta ocasional, e aberta ocuparia
 * meia tela para quem não veio por ela.
 */
export default function PlanosDoImpacto() {

  const [planos, , carregando] = usePlans();
  const [aberto, setAberto] = useState(false);

  async function recarregar() {
    invalidarWorkspace();
  }

  const ativos = planos.filter((item) => item.active);

  const contagem = (kind: string) =>
    ativos.filter((item) => item.kind === kind).length;

  /**
   * A faixa de preço, no resumo fechado.
   *
   * Fechado, o cartão precisa dizer algo verdadeiro sobre o que
   * esconde. "8 itens" não ajuda ninguém; a menor e a maior mensalidade
   * já dão a ordem de grandeza de um cancelamento evitado.
   */
  const mensalidades = ativos
    .filter((item) => item.kind === "plano")
    .map((item) => item.priceCents)
    .sort((a, b) => a - b);

  return (
    <SurfaceCard
      title="Planos e módulos"
      description={
        carregando
          ? "Carregando a tabela de preços…"
          : mensalidades.length > 0
            ? `${contagem("plano")} plano(s) de ${precoEmReais(mensalidades[0])} a ${precoEmReais(mensalidades[mensalidades.length - 1])} por mês, e ${contagem("modulo")} módulo(s). É desta tabela que sai o valor de um cancelamento evitado.`
            : "Nenhum plano cadastrado ainda."
      }
      action={
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-50"
        >
          {aberto ? "Recolher" : "Ver e alterar"}
          <ChevronDown
            size={13}
            className={`transition-transform ${aberto ? "rotate-180" : ""}`}
          />
        </button>
      }
    >

      {!aberto ? (

        <div className="flex flex-wrap gap-1.5">

          {ativos.slice(0, 12).map((item) => (

            <span
              key={item.id}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-50 px-2 py-1 text-xs text-zinc-600 ring-1 ring-zinc-100"
            >

              <Tag
                size={11}
                className={
                  item.kind === "plano"
                    ? "text-violet-500"
                    : "text-sky-500"
                }
              />

              {item.name}

              <span className="font-medium text-zinc-900">
                {precoEmReais(item.priceCents)}
              </span>

            </span>

          ))}

          {ativos.length === 0 && !carregando && (
            <p className="text-sm text-zinc-400">
              Sem planos cadastrados — abra para criar o
              primeiro.
            </p>
          )}

        </div>

      ) : (

        <div className="space-y-4">

          <PlanosCard
            itens={planos}
            kind="plano"
            titulo="Planos"
            descricao="O que a conta paga por mês. É este valor que o lançamento de impacto usa."
            dica="Salvar aqui muda também o que a resposta pronta escreve."
            onSaved={recarregar}
          />

          <PlanosCard
            itens={planos}
            kind="modulo"
            titulo="Módulos"
            descricao="Vendidos por cima do plano. Um módulo contratado depois de uma tratativa é impacto."
            dica="Salvar aqui muda também o que a resposta pronta escreve."
            onSaved={recarregar}
          />

        </div>

      )}

    </SurfaceCard>
  );
}
