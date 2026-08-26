"use client";

import { useCallback, useMemo, useState } from "react";

import { Gravacao } from "@/lib/context/sync";

/**
 * Editar agora, gravar quando mandar.
 *
 * Os cadastros gravavam a cada tecla digitada. Funciona, mas tem dois
 * problemas que a operação sentiu: **tudo** vira alteração — inclusive
 * o nome pela metade enquanto se digita — e nunca aparece a confirmação
 * de que foi salvo, porque não existe um momento em que salvar aconteça.
 *
 * Aqui a edição vive num rascunho, e só o clique em Salvar vai ao banco.
 * Exclusão continua imediata, de propósito: apagar já pergunta antes, e
 * uma remoção pendente de confirmação criaria a dúvida de se a linha
 * ainda existe ou não.
 *
 * **O que grava é só o que mudou.** Uma aba com doze categorias em que
 * se corrigiu uma letra manda uma gravação, não doze — e a confirmação
 * consegue dizer o que aconteceu de verdade.
 */

export interface Rascunho<T> {
  /** A lista como está na tela: original + edições + novos. */
  itens: T[];

  /** Altera um item do rascunho. Não vai ao banco. */
  alterar: (id: string, patch: Partial<T>) => void;

  /** Acrescenta um item novo ao rascunho. Não vai ao banco. */
  adicionar: (item: T) => void;

  /**
   * Tira um item do rascunho.
   *
   * Para item **novo**, é só desfazer — ele nunca existiu no banco.
   * Para item já gravado, quem chama continua responsável por apagar de
   * verdade: este gancho não conhece a action de remoção.
   */
  esquecer: (id: string) => void;

  /** Devolve o rascunho ao que está no banco. */
  descartar: () => void;

  /** Grava só o que mudou. Resolve com o que aconteceu. */
  salvar: () => Promise<ResultadoDoSalvar>;

  novos: number;
  alterados: number;
  pendentes: number;
  sujo: boolean;
  salvando: boolean;
}

export interface ResultadoDoSalvar {
  novos: number;
  alterados: number;
  falhas: number;
  /** Primeira mensagem de erro, quando houve alguma. */
  erro?: string;
}

export function useRascunho<T extends { id: string }>(
  original: T[],
  gravar: (item: T) => Promise<Gravacao>
): Rascunho<T> {

  const [base, setBase] = useState(original);
  const [edicoes, setEdicoes] = useState<
    Record<string, T>
  >({});
  const [novos, setNovos] = useState<T[]>([]);
  const [esquecidos, setEsquecidos] = useState<
    string[]
  >([]);
  const [salvando, setSalvando] = useState(false);

  const sujo =
    Object.keys(edicoes).length > 0 || novos.length > 0;

  /**
   * A carga chega depois da primeira renderização.
   *
   * `setState` durante a renderização, e não dentro de um efeito: é o
   * caminho documentado do React para estado derivado de props, e é o
   * que mantém esta tela fora da dívida de `setState` em efeito que o
   * `eslint.config.mjs` já acusa em treze formulários.
   *
   * A adoção só acontece com o rascunho limpo. Com edição pendente, uma
   * recarga do workspace jogaria fora o que a pessoa acabou de digitar.
   */
  if (original !== base && !sujo) {
    setBase(original);
    setEsquecidos([]);
  }

  const itens = useMemo(() => {

    const daBase = base
      .filter((item) => !esquecidos.includes(item.id))
      .map((item) => edicoes[item.id] ?? item);

    /**
     * O que acabou de ser criado vai para **cima**.
     *
     * Ia para o fim, e o Isaac descreveu o efeito: "quando for criar
     * apareça na tela para criar e não algo lá em baixo para ser visto
     * e adicionar, não faz sentido assim". Numa tabela de trinta
     * categorias, clicar em "Nova categoria" acrescentava uma linha na
     * trigésima primeira posição — fora da tela. O botão respondia, e
     * nada parecia ter acontecido; a reação natural é clicar de novo, e
     * aí nascem duas.
     *
     * Em cima, a linha nova aparece onde os olhos já estão, imediatamente
     * abaixo do botão que a criou.
     */
    return [...novos, ...daBase];
  }, [base, edicoes, novos, esquecidos]);

  const alterar = useCallback(
    (id: string, patch: Partial<T>) => {

      setNovos((prev) => {

        const eNovo = prev.some(
          (item) => item.id === id
        );

        // Item novo se edita no próprio lugar: ele ainda não tem par
        // no banco com que ser comparado.
        return eNovo
          ? prev.map((item) =>
              item.id === id
                ? { ...item, ...patch }
                : item
            )
          : prev;
      });

      setEdicoes((prev) => {

        const doBanco = base.find(
          (item) => item.id === id
        );

        if (!doBanco) return prev;

        return {
          ...prev,
          [id]: { ...doBanco, ...prev[id], ...patch },
        };
      });
    },
    [base]
  );

  const adicionar = useCallback((item: T) => {
    setNovos((prev) => [...prev, item]);
  }, []);

  const esquecer = useCallback((id: string) => {
    setNovos((prev) =>
      prev.filter((item) => item.id !== id)
    );

    setEdicoes((prev) => {
      const proximo = { ...prev };
      delete proximo[id];
      return proximo;
    });

    setEsquecidos((prev) =>
      prev.includes(id) ? prev : [...prev, id]
    );
  }, []);

  const descartar = useCallback(() => {
    setEdicoes({});
    setNovos([]);
    setEsquecidos([]);
  }, []);

  const salvar = useCallback(async () => {

    const paraGravar = [
      ...novos,
      ...Object.values(edicoes),
    ];

    if (paraGravar.length === 0) {
      return {
        novos: 0,
        alterados: 0,
        falhas: 0,
      };
    }

    setSalvando(true);

    /**
     * Sequencial, e não `Promise.all`.
     *
     * São server actions contra o pooler do Supabase no plano gratuito,
     * que já derrubou a conexão com paralelismo — o mesmo teto que
     * `case.repository.ts` respeita. Um cadastro tem dezenas de linhas,
     * não milhares: a diferença de tempo não é sentida.
     */
    const resultados: Gravacao[] = [];

    for (const item of paraGravar) {
      resultados.push(await gravar(item));
    }

    setSalvando(false);

    const falharam = resultados.filter((r) => !r.ok);

    /**
     * Falhou alguma? O rascunho **fica**.
     *
     * Limpar aqui apagaria da tela justamente a alteração que não foi
     * gravada, e a pessoa sairia achando que salvou. Só o sucesso
     * completo funde o rascunho na base.
     */
    if (falharam.length === 0) {

      setBase((prev) => {

        const editada = prev.map(
          (item) => edicoes[item.id] ?? item
        );

        return [...editada, ...novos];
      });

      setEdicoes({});
      setNovos([]);
    }

    return {
      novos: novos.length,
      alterados: Object.keys(edicoes).length,
      falhas: falharam.length,
      erro: falharam[0]?.erro,
    };
  }, [novos, edicoes, gravar]);

  return {
    itens,
    alterar,
    adicionar,
    esquecer,
    descartar,
    salvar,
    novos: novos.length,
    alterados: Object.keys(edicoes).length,
    pendentes:
      novos.length + Object.keys(edicoes).length,
    sujo,
    salvando,
  };
}
