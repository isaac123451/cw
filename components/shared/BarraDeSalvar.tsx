"use client";

import { useEffect } from "react";

import { CircleAlert, Loader2, Save } from "lucide-react";

import { useToast } from "@/lib/context/ToastContext";
import type { Rascunho } from "@/lib/hooks/useRascunho";

/**
 * A barra que aparece quando há alteração não salva.
 *
 * Fica colada no rodapé do cartão, some quando não há nada pendente, e
 * diz **quanta coisa** está pendente — "3 alterações" responde a
 * pergunta que "alterações não salvas" deixa no ar.
 *
 * Ela também é o lugar do aviso de saída: sem isso, trocar de aba com
 * edição pendente perderia o trabalho em silêncio, que é exatamente o
 * defeito que o botão Salvar veio corrigir.
 */

/**
 * Genérica no tipo do item.
 *
 * `Rascunho<T>` é invariante — `adicionar` recebe `T` —, então um
 * `Rascunho<{ id: string }>` no lugar do parâmetro recusaria
 * `Rascunho<TeamOption>`. A barra não olha para dentro do item, só
 * conta quantos são.
 */
interface Props<T extends { id: string }> {
  rascunho: Rascunho<T>;

  /** O que foi editado, no plural: "times", "categorias". */
  nome: string;

  /**
   * Feminino muda o artigo do aviso. Português não perdoa "3 alterações
   * em categorias salvos".
   */
  genero?: "m" | "f";
}

function contar(
  quantidade: number,
  singular: string,
  plural: string
) {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`;
}

export default function BarraDeSalvar<
  T extends { id: string },
>({ rascunho, nome, genero = "m" }: Props<T>) {

  const { notify } = useToast();

  const { sujo, salvando, pendentes, novos, alterados } =
    rascunho;

  /**
   * Fechar a aba com edição pendente pede confirmação do navegador.
   *
   * O texto é do navegador, não nosso — desde 2016 nenhum deles deixa
   * personalizar. O que importa é o aviso existir.
   */
  useEffect(() => {

    if (!sujo) return;

    const avisar = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();
    };

    window.addEventListener("beforeunload", avisar);

    return () =>
      window.removeEventListener(
        "beforeunload",
        avisar
      );
  }, [sujo]);

  if (!sujo) return null;

  async function salvar() {

    const r = await rascunho.salvar();

    if (r.falhas > 0) {

      /**
       * `sincronizar` já mostrou o motivo de cada falha. Este aviso diz
       * a outra metade: o que **não** foi gravado continua na tela,
       * para a pessoa poder tentar de novo em vez de redigitar.
       */
      notify({
        tone: "error",
        title: `${contar(r.falhas, "alteração não foi salva", "alterações não foram salvas")}.`,
        detail:
          "O que faltou continua na tela — corrija e salve de novo.",
      });

      return;
    }

    const partes = [
      r.novos > 0 &&
        contar(
          r.novos,
          genero === "f" ? "nova" : "novo",
          genero === "f" ? "novas" : "novos"
        ),
      r.alterados > 0 &&
        contar(
          r.alterados,
          genero === "f" ? "alterada" : "alterado",
          genero === "f" ? "alteradas" : "alterados"
        ),
    ].filter(Boolean);

    notify({
      tone: "success",
      title: `${nome[0].toUpperCase()}${nome.slice(1)} salvos no banco.`,
      detail: `${partes.join(" · ")}. Recarregar a página traz exatamente isto de volta.`,
    });
  }

  const resumo = [
    novos > 0 && contar(novos, "novo", "novos"),
    alterados > 0 &&
      contar(alterados, "alterado", "alterados"),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-amber-200 bg-amber-50/90 px-5 py-3 backdrop-blur">

      <p className="flex items-center gap-2 text-sm text-amber-900">

        <CircleAlert size={15} className="shrink-0" />

        <span>
          <strong className="font-semibold">
            {contar(
              pendentes,
              "alteração não salva",
              "alterações não salvas"
            )}
          </strong>
          {resumo && (
            <span className="text-amber-700">
              {" "}
              ({resumo})
            </span>
          )}
        </span>

      </p>

      <div className="flex items-center gap-2">

        <button
          onClick={rascunho.descartar}
          disabled={salvando}
          className="rounded-xl px-3.5 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-50"
        >
          Descartar
        </button>

        <button
          onClick={salvar}
          disabled={salvando}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-60"
        >
          {salvando ? (
            <Loader2
              size={15}
              className="animate-spin"
            />
          ) : (
            <Save size={15} />
          )}
          {salvando ? "Salvando..." : "Salvar"}
        </button>

      </div>

    </div>
  );
}
