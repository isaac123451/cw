"use client";

import { useEffect, useState } from "react";

import { daCargaInicial, descartarDaCargaInicial } from "@/lib/context/cargaInicial";
import { comNovaTentativa } from "@/lib/context/novaTentativa";

import {
  loadWorkspace,
  type Workspace,
} from "@/lib/actions/workspace";

/**
 * Uma requisição para todos os contextos.
 *
 * A promessa é memoizada no módulo: os treze providers montam juntos e
 * chamam isto ao mesmo tempo, mas só o primeiro dispara a busca — os
 * demais aguardam a mesma resposta. Sem isso seriam treze conexões
 * simultâneas ao Supabase, que o plano gratuito não sustenta.
 *
 * **Falha passageira não vira aviso.** A primeira leitura depois de a
 * função da Vercel acordar, ou com a conexão lenta, às vezes volta
 * "banco-recusou". Antes, isso acendia a faixa "Os números abaixo não
 * são a sua operação — Recarregar" em quase toda abertura. Agora tenta
 * de novo sozinho, duas vezes, antes de alguém ver qualquer coisa.
 */
let pendente: Promise<Workspace> | null = null;

/** Quem mostra um pedaço do cadastro e precisa reler quando ele volta. */
const ouvintes = new Set<() => void>();

const passageira = (w: Workspace) => w.indisponivel === "banco-recusou";

export function carregarWorkspace() {

  if (!pendente) {
    pendente = comNovaTentativa(
      /* A primeira carga vem na ida única da abertura; as seguintes, direto. */
      (tentativa) => (tentativa === 0 ? daCargaInicial("workspace", loadWorkspace) : loadWorkspace()),
      passageira
    ).catch((error) => {
      // Falha não pode ficar em cache: a próxima montagem tenta de novo.
      pendente = null;
      throw error;
    });
  }

  return pendente;
}

/** Descarta o cache — usado depois de importar ou de gravar em lote. */
export function invalidarWorkspace() {
  pendente = null;
  /* Senão, nos primeiros segundos, a recarga devolveria a cópia da abertura. */
  descartarDaCargaInicial("workspace");
}

/**
 * Relê o cadastro e avisa todos os pedaços que já estão na tela.
 *
 * É o "Tentar de novo" do aviso de falha: sem ele, cada provider tinha
 * lido o cadastro vazio uma vez na montagem e só um F5 trazia de volta.
 */
export async function recarregarWorkspace() {
  invalidarWorkspace();
  const w = await carregarWorkspace();
  for (const ouvir of ouvintes) ouvir();
  return w;
}

/**
 * Recorta um pedaço da carga para um contexto.
 *
 * Devolve o estado e o `setState`, para o contexto seguir fazendo as
 * atualizações otimistas que já fazia.
 */
export function useWorkspaceSlice<T>(
  selecionar: (dados: Workspace) => T,
  inicial: T
) {

  const [dados, setDados] = useState<T>(inicial);
  const [loading, setLoading] = useState(true);

  useEffect(() => {

    let ativo = true;

    function ler() {
      carregarWorkspace()
        .then((workspace) => {
          /* Cadastro que não veio não apaga o que já estava na tela. */
          if (ativo && !workspace.indisponivel) setDados(selecionar(workspace));
        })
        .catch((error: unknown) => {
          console.error(
            "[workspace] carga falhou",
            error
          );
        })
        .finally(() => {
          if (ativo) setLoading(false);
        });
    }

    ler();
    ouvintes.add(ler);

    return () => {
      ativo = false;
      ouvintes.delete(ler);
    };

    // Só na montagem: `selecionar` é uma função inline em cada contexto
    // e mudaria de identidade a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [dados, setDados, loading] as const;
}
