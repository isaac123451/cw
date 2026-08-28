"use client";

import { useEffect } from "react";

import { Loader2, Save } from "lucide-react";

import { useToast } from "@/lib/context/ToastContext";
import type { Rascunho } from "@/lib/hooks/useRascunho";

/**
 * A barra que aparece quando há alteração não salva.
 *
 * Some quando não há nada pendente, diz **quanta coisa** está pendente —
 * "3 alterações" responde a pergunta que "alterações não salvas" deixa
 * no ar — e é o lugar do aviso de saída: sem ele, trocar de aba com
 * edição pendente perderia o trabalho em silêncio, que é exatamente o
 * defeito que o botão Salvar veio corrigir.
 *
 * **Desenho: uma ilha, e não uma faixa de alerta.** Era uma tira âmbar
 * na largura inteira, colada no rodapé do cartão. O Isaac: "melhore
 * também este aviso de salvar, ta meio feio". Três coisas estavam
 * erradas ali:
 *
 * 1. **A cor dizia "erro".** Âmbar com ícone de alerta é o vocabulário
 *    de problema. Ter trabalho por salvar não é problema — é o estado
 *    normal de quem está editando. O que a barra precisa é chamar
 *    atenção, não assustar.
 * 2. **A largura inteira competia com o conteúdo.** Uma faixa de ponta
 *    a ponta pesa como cabeçalho de página para dizer uma frase curta.
 * 3. **Ela ficava no fim do cartão.** Numa ficha longa, isso é abaixo
 *    da dobra: a pessoa editava, rolava, e não via mais que havia algo
 *    para salvar.
 *
 * Agora é uma ilha flutuante, centralizada na base da janela, escura
 * sobre o conteúdo claro. Acompanha a rolagem, ocupa o que precisa, e o
 * ponto âmbar pulsando carrega o "tem coisa pendente" sem precisar de
 * uma faixa inteira para dizê-lo.
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

  /**
   * O detalhe só aparece quando há os dois tipos.
   *
   * Com um tipo só, ele repetia o número da manchete: "1 alteração · 1
   * alterado". Duas vezes a mesma informação, e a segunda em jargão.
   * Misturando novos e editados, aí sim a separação diz algo que a
   * soma esconde.
   */
  const resumo =
    novos > 0 && alterados > 0
      ? `${contar(novos, "novo", "novos")} · ${contar(
          alterados,
          "editado",
          "editados"
        )}`
      : "";

  return (
    <div
      /*
        `pointer-events-none` no invólucro, e `auto` na ilha.

        O invólucro ocupa a largura da janela para centralizar; sem
        isto, ele engoliria os cliques na faixa vazia dos lados, e num
        formulário largo a pessoa não conseguiria clicar no que está
        embaixo dela.
      */
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
    >

      <div className="pointer-events-auto flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-zinc-900 px-4 py-2.5 shadow-[0_16px_40px_-12px_rgba(16,24,40,0.45)] ring-1 ring-white/10">

        <p className="flex min-w-0 items-center gap-2.5 text-sm text-white/70">

          {/*
            Um ponto que pulsa, no lugar do ícone de alerta.

            Diz "há algo pendente" sem o vocabulário de erro. Pára de
            piscar para quem pediu menos movimento na tela.
          */}
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-70 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
          </span>

          <span className="truncate">
            <strong className="font-semibold text-white">
              {contar(
                pendentes,
                "alteração",
                "alterações"
              )}
            </strong>
            <span className="text-white/55">
              {" "}
              {resumo ? `· ${resumo}` : "por salvar"}
            </span>
          </span>

        </p>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">

          <button
            onClick={rascunho.descartar}
            disabled={salvando}
            className="rounded-xl px-3 py-1.5 text-sm font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            Descartar
          </button>

          <button
            onClick={salvar}
            disabled={salvando}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-60"
          >
            {salvando ? (
              <Loader2
                size={15}
                className="animate-spin"
              />
            ) : (
              <Save size={15} />
            )}
            {salvando ? "Salvando…" : "Salvar"}
          </button>

        </div>

      </div>

    </div>
  );
}
