"use client";

import { daCargaInicial } from "@/lib/context/cargaInicial";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";

import { usePathname } from "next/navigation";

import { Case } from "@/lib/models/case";


import {
  deleteCase as removeCase,
  listCases,
  saveCase,
} from "@/lib/actions/cases";

import { hojeNaOperacao } from "@/lib/services/reputation.service";
import {
  casaComTermo,
  moverPara,
  naSituacao,
  seteDiasAtras,
  SituacaoDoCaso,
} from "@/lib/services/case.service";
import {
  motivoDaFalha,
  type Gravacao,
} from "@/lib/context/sync";
import { carregarWorkspace, recarregarWorkspace } from "@/lib/context/useWorkspace";
import { comNovaTentativa } from "@/lib/context/novaTentativa";
import { RECADO } from "@/lib/models/leitura";

import {
  fraseDoConflito,
  type ConflitoDeEdicao,
} from "@/lib/models/edicaoSimultanea";

const STORAGE_KEY = "cw:casos";

interface CaseDiff {
  /** Casos cadastrados na tela, que não existem na base importada. */
  criados: Case[];

  /** Casos da base que foram editados, pelo id. */
  alterados: Record<string, Case>;

  /** Ids da base que foram excluídos. */
  removidos: string[];
}

/**
 * Guarda só a diferença em relação à base importada.
 *
 * Salvar a base inteira seria meio megabyte a cada clique e, pior,
 * congelaria os dados: uma reimportação do Reclame Aqui seria
 * sobrescrita pela cópia velha do navegador. Com o diff, o que vem do
 * portal continua mandando e por cima fica o trabalho da operação.
 *
 * A comparação é por referência de objeto — as mutações abaixo sempre
 * criam objeto novo para o que muda, então não é preciso serializar
 * nada para descobrir a diferença.
 */
function derivarDiff(
  base: Case[],
  atual: Case[]
): CaseDiff {

  const indice = new Map(
    base.map((item) => [item.id, item])
  );

  const criados: Case[] = [];
  const alterados: Record<string, Case> = {};
  const presentes = new Set<string>();

  for (const item of atual) {

    presentes.add(item.id);

    const original = indice.get(item.id);

    if (!original) {
      criados.push(item);
      continue;
    }

    if (original !== item) {
      alterados[item.id] = item;
    }
  }

  const removidos = base
    .filter((item) => !presentes.has(item.id))
    .map((item) => item.id);

  return { criados, alterados, removidos };
}

/** Aplica o diff salvo sobre a base carregada. */
function aplicarDiff(
  base: Case[],
  diff: CaseDiff
): Case[] {

  const removidos = new Set(diff.removidos ?? []);

  const restante = base
    .filter((item) => !removidos.has(item.id))
    .map((item) => diff.alterados?.[item.id] ?? item);

  return [...(diff.criados ?? []), ...restante];
}

export interface CaseFilters {
  search: string;
  company: string;
  status: string;
  category: string;
  tag: string;
  /** Responsável atribuído — vem do cadastro de Times. */
  owner: string;
  /** Id do estabelecimento vinculado. */
  establishment: string;

  /**
   * Recorte por data de abertura, em `AAAA-MM-DD`.
   *
   * Guardados como texto e comparados como texto: `createdAt` já é
   * `AAAA-MM-DD`, e nesse formato a ordem alfabética **é** a ordem
   * cronológica. Converter para `Date` só para comparar traria de volta
   * o problema de fuso que a plataforma acabou de resolver — um caso
   * aberto dia 1º às 22h vira dia 2 em UTC, e sumiria de um filtro que
   * começa no dia 2.
   *
   * Qualquer um dos dois pode vir sozinho: só `de` é "a partir de", só
   * `ate` é "até".
   */
  de: string;
  ate: string;

  /**
   * Recorte por situação, que não é um campo do caso.
   *
   * Os outros filtros comparam um valor com uma coluna. Estes são
   * perguntas da operação que atravessam colunas: "sem resposta
   * pública" olha `publicResponse`, "vencida" cruza isso com a data,
   * "risco" olha `churnRisk`, "na fila" olha o status.
   *
   * Existem porque os números do painel eram becos sem saída: a tela
   * dizia "14 sem resposta pública" e não havia caminho da contagem
   * para as catorze. Quem quisesse a lista remontava o filtro à mão, e
   * como não havia filtro para isso, não remontava — lia o número e
   * seguia em frente.
   */
  situacao: SituacaoDoCaso | "";
}

export const emptyFilters: CaseFilters = {
  search: "",
  company: "",
  status: "",
  category: "",
  tag: "",
  owner: "",
  establishment: "",
  de: "",
  ate: "",
  situacao: "",
};

interface CaseContextType {
  cases: Case[];

  /** Casos após aplicar busca e filtros da Toolbar. */
  filteredCases: Case[];

  filters: CaseFilters;

  setFilter: (
    field: keyof CaseFilters,
    value: string
  ) => void;

  /** Aplica um conjunto inteiro de uma vez — usado pelos filtros salvos. */
  applyFilters: (value: CaseFilters) => void;

  clearFilters: () => void;

  setCases: React.Dispatch<
    React.SetStateAction<Case[]>
  >;

  /** Devolve o resultado: a tela só diz "criada" depois do servidor. */
  createCase: (data: Case) => Promise<Gravacao>;

  /**
   * Devolve o resultado da gravação.
   *
   * A tela do caso passou a gravar por botão, e o rascunho precisa
   * saber se o servidor aceitou antes de dizer "salvo" — confirmar
   * antes da resposta confirma o clique, não a gravação.
   */
  updateCase: (data: Case) => Promise<Gravacao>;

  deleteCase: (id: string) => void;

  moveCase: (
    id: string,
    status: string
  ) => void;

  toggleTag: (id: string, tag: string) => void;

  /** Carga inicial ainda em andamento. */
  loading: boolean;

  /** Relê do banco — usado depois de importar uma planilha. */
  recarregar: () => Promise<void>;

  /** Os dados vêm do banco (e não da demonstração em memória). */
  hasDatabase: boolean;

  /** Última falha de leitura/gravação no banco, se houve. */
  syncError: string | null;

  /**
   * Quando os dados que estão na tela chegaram do banco.
   *
   * Existe porque a pergunta que ninguém conseguia responder era
   * "isto que estou vendo é de agora?". Sem a hora, uma tela
   * carregada às 8h e esquecida aberta até as 18h parece tão atual
   * quanto uma recém-aberta — e as decisões saem de cima dela.
   */
  carregadoEm: Date | null;
}

const CaseContext =
  createContext<CaseContextType | null>(
    null
  );

export function CaseProvider({
  children,
  hasDatabase = false,
}: {
  children: ReactNode;
  /**
   * Com banco, a fonte é o Postgres e cada mudança vai para lá. Sem
   * banco a aplicação segue em demonstração, e o navegador guarda o
   * diff — é o que mantém o `npm run dev` útil sem infraestrutura.
   */
  hasDatabase?: boolean;
}) {
  /**
   * Começa vazio de propósito.
   *
   * Antes o dataset era importado aqui para servir de estado inicial —
   * e, sendo isto um client component, as 334 reclamações com o texto
   * completo iam junto no pacote do navegador, mesmo com o banco
   * ligado. A carga agora vem de `listCases`, que roda no servidor e
   * decide entre Postgres e demonstração.
   */
  const [cases, setCases] = useState<Case[]>([]);

  /** Base carregada, para o diff do modo demonstração comparar contra. */
  const baseRef = useRef<Case[]>([]);

  const [loading, setLoading] = useState(true);

  const [filters, setFilters] =
    useState<CaseFilters>(emptyFilters);

  /**
   * Só depois de carregar é que se pode gravar — senão o primeiro
   * render (ainda com a base pura) apagaria o trabalho salvo.
   */
  const [restaurado, setRestaurado] = useState(false);

  /** Última falha de **gravação**, para a tela poder avisar. */
  const [syncError, setSyncError] = useState<
    string | null
  >(null);

  /**
   * Última falha de **leitura**. Estado próprio, e não o mesmo.
   *
   * As duas falhas parecem a mesma coisa e têm regras opostas. A de
   * gravação é sobre algo que a pessoa acabou de fazer: tem de
   * aparecer sempre, mesmo com a tela cheia, porque o que ela
   * escreveu não foi salvo. A de leitura só importa quando deixou a
   * tela **sem nada** — uma recarga que falhou com os dados
   * anteriores ainda na tela não muda o que se está olhando.
   *
   * Estavam na mesma variável, e o resultado foi a faixa aparecendo
   * na tela de login: ali não existe sessão por definição, a leitura
   * recusa por "sem-sessao", e o aviso anunciava uma expiração que
   * nunca houve.
   */
  const [falhaDeLeitura, setFalhaDeLeitura] = useState<
    string | null
  >(null);

  const [carregadoEm, setCarregadoEm] =
    useState<Date | null>(null);

  const pathname = usePathname();

  /**
   * O cadastro também pode não ter vindo — e isso também era mudo.
   *
   * `loadWorkspace` passou a devolver `indisponivel` com o motivo, e
   * na primeira versão **ninguém lia o campo**: o mesmo defeito do
   * `syncError`, repetido no dia em que ele foi corrigido. O quadro
   * podia mostrar 353 reclamações e nenhuma coluna para elas, sem uma
   * palavra.
   *
   * A carga é a mesma promessa memoizada que os treze providers já
   * compartilham — ler daqui não abre conexão nova.
   */
  const [falhaDoCadastro, setFalhaDoCadastro] = useState<
    string | null
  >(null);

  useEffect(() => {
    let ativo = true;

    carregarWorkspace()
      .then((workspace) => {
        if (!ativo) return;

        setFalhaDoCadastro(
          workspace.indisponivel
            ? RECADO[workspace.indisponivel]
            : null
        );
      })
      .catch(() => {
        /*
          A chamada inteira caiu — rede, função encerrada no meio.

          `useWorkspaceSlice` só registra isso no console, e cada
          pedaço do cadastro fica no valor inicial, vazio. Sem este
          aviso, é tela em branco sem explicação de novo.
        */
        if (ativo) {
          setFalhaDoCadastro(RECADO["banco-recusou"]);
        }
      });

    return () => {
      ativo = false;
    };
  }, []);

  /** Relê do banco. Chamado depois de importar uma planilha. */
  async function recarregar() {

    if (!hasDatabase) return;

    try {
      const leitura = await listCases();

      /*
        Falha não vira lista vazia.

        Antes, qualquer motivo — sessão expirada, conta sem acesso,
        banco fora do ar — chegava como `[]` e a tela zerava sem dizer
        nada. Agora o motivo vem junto e some da tela só quando a
        leitura der certo.
      */
      if (!leitura.ok) {
        setFalhaDeLeitura(leitura.recado);
        return;
      }

      baseRef.current = leitura.dados;
      setCases(leitura.dados);
      setFalhaDeLeitura(null);
      setCarregadoEm(new Date());
    } catch (error) {
      console.error("[casos] recarga falhou", error);
      setFalhaDeLeitura(
        "Não foi possível recarregar as reclamações."
      );
    }
  }

  /**
   * Dispara a gravação sem travar a interface, e registra a falha.
   *
   * **Devolve o resultado, e nunca rejeita.** A tela do caso passou a
   * gravar por botão, e o rascunho só limpa o que foi de fato aceito
   * pelo servidor — o que falhou continua na tela para dar para tentar
   * de novo em vez de redigitar.
   *
   * Sem banco (modo demonstração) conta como sucesso: a edição já está
   * no estado local, que é onde ela vive ali.
   */
  function sincronizar(
    executar: () => Promise<void | { ok: boolean; conflito?: ConflitoDeEdicao }>
  ): Promise<Gravacao> {

    if (!hasDatabase) {
      return Promise.resolve({ ok: true });
    }

    return executar().then(
      (resposta): Gravacao => {

        /**
         * Recusa por edição simultânea não é falha de banco (Fase 10.1).
         *
         * A gravação se recusou a apagar o trabalho de outra pessoa, e
         * quem está na tela precisa ler **isso**, e não "não foi
         * possível salvar" — que manda tentar de novo e, tentando de
         * novo, apagaria de novo.
         */
        if (resposta && resposta.ok === false) {
          const aviso = resposta.conflito
            ? fraseDoConflito(resposta.conflito)
            : (resposta as { erro?: string }).erro ?? "A gravação não foi aceita.";

          setSyncError(aviso);

          return { ok: false, erro: aviso, conflito: resposta.conflito };
        }

        setSyncError(null);
        return { ok: true };
      },
      (error: unknown): Gravacao => {

        /* Em produção o Next esconde o motivo — ver motivoDaFalha. */
        const mensagem = motivoDaFalha(error);

        console.error("[casos] gravação falhou", error);
        setSyncError(mensagem);

        return { ok: false, erro: mensagem };
      }
    );
  }

  // A carga acontece após a montagem: no servidor não há localStorage,
  // e ler durante o render quebraria a hidratação.
  useEffect(() => {

    let ativo = true;

    comNovaTentativa(
      (tentativa) => (tentativa === 0 ? daCargaInicial("casos", listCases) : listCases()),
      /* Só o banco que não respondeu passa; sem sessão ou sem acesso, esperar não muda. */
      (leitura) => !leitura.ok && leitura.motivo === "banco-recusou"
    )
      .then((leitura) => {

        if (!ativo) return;

        if (!leitura.ok) {
          setFalhaDeLeitura(leitura.recado);
          return;
        }

        const rows = leitura.dados;

        baseRef.current = rows;
        setCarregadoEm(new Date());

        if (hasDatabase) {
          setCases(rows);
          return;
        }

        // Demonstração: o que foi editado fica no navegador, por cima
        // do que veio da carga.
        try {
          const salvo =
            localStorage.getItem(STORAGE_KEY);

          setCases(
            salvo
              ? aplicarDiff(
                  rows,
                  JSON.parse(salvo) as CaseDiff
                )
              : rows
          );
        } catch {
          setCases(rows);
        }
      })
      .catch((error: unknown) => {
        if (!ativo) return;

        console.error(
          "[casos] carga falhou",
          error
        );
        setFalhaDeLeitura(
          "Não foi possível carregar as reclamações."
        );
      })
      .finally(() => {
        if (!ativo) return;

        setRestaurado(true);
        setLoading(false);
      });

    return () => {
      ativo = false;
    };

  }, [hasDatabase]);

  useEffect(() => {

    // Com banco quem persiste são as ações, caso a caso.
    if (!restaurado || hasDatabase) return;

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          derivarDiff(baseRef.current, cases)
        )
      );
    } catch {
      // Cota estourada ou modo privado: segue só em memória.
    }

  }, [cases, restaurado, hasDatabase]);

  function setFilter(
    field: keyof CaseFilters,
    value: string
  ) {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  /** Campos ausentes viram vazio, para um filtro salvo antigo não herdar o estado atual. */
  function applyFilters(value: CaseFilters) {
    setFilters({ ...emptyFilters, ...value });
  }

  function clearFilters() {
    setFilters(emptyFilters);
  }

  /**
   * Cria e devolve o que o servidor disse (Fase 10.4).
   *
   * Era "dispara e esquece": a tela avisava "Reclamação criada" e abria a
   * ficha antes da resposta, e uma recusa deixava na lista um caso que
   * não existia no banco — sumia no recarregar. Recusada, a linha sai da
   * lista e a tela fica no formulário, com o que foi digitado.
   */
  async function createCase(data: Case): Promise<Gravacao> {
    setCases((prev) => [data, ...prev]);

    const resultado = await sincronizar(() => saveCase(data));

    if (!resultado.ok) {
      setCases((prev) => prev.filter((item) => item.id !== data.id));
    }

    return resultado;
  }

  function updateCase(data: Case) {

    /**
     * O retrato de antes vai junto (Fase 10.1).
     *
     * `cases` ainda é o que esta sessão carregou — o `setCases` abaixo
     * só roda depois. Com ele, o servidor separa o que **eu** mudei do
     * que mudou no banco enquanto eu editava: sem conflito, grava só o
     * meu e o da outra pessoa fica de pé; com conflito, não grava nada
     * e diz quais campos.
     *
     * Era aqui que o trabalho sumia: a tela mandava o caso inteiro, e
     * quem salvasse depois desfazia, em silêncio, o que o outro tinha
     * feito.
     */
    const anterior = cases.find((item) => item.id === data.id);

    setCases((prev) =>
      prev.map((item) =>
        item.id === data.id
          ? data
          : item
      )
    );

    return sincronizar(() => saveCase(data, { anterior }));
  }

  function deleteCase(id: string) {

    const alvo = cases.find((item) => item.id === id);

    setCases((prev) =>
      prev.filter(
        (item) => item.id !== id
      )
    );

    if (alvo) {
      sincronizar(() => removeCase(alvo.protocol));
    }
  }

  /**
   * Move o caso de status mantendo coerentes os campos que dependem dele.
   *
   * No ciclo real do Reclame Aqui só existem dois estados avaliados —
   * "Resolvido" e "Não resolvido". Mudar só o texto do status deixava os
   * indicadores divergentes do quadro (um caso podia aparecer como
   * resolvido no Kanban e em aberto nas métricas).
   */
  function moveCase(id: string, status: string) {

    const atual = cases.find((item) => item.id === id);

    if (!atual) return;

    /**
     * A regra vive em `case.service.ts` porque a extensão move caso
     * pela rota `/api/extensao/mover`, que não pode chamar server
     * action. Duas cópias divergiriam, e o sintoma seria nota fantasma.
     */
    const movido = moverPara(atual, status, hojeNaOperacao());

    setCases((prev) =>
      prev.map((item) =>
        item.id === id ? movido : item
      )
    );

    // Mover não mexe em etiqueta: pular a sincronização deixa o arraste
    // com uma ida ao banco em vez de três.
    /* O retrato de antes vai junto: arrastar não pode desfazer o que
       outra pessoa mudou no mesmo caso (Fase 10.1). */
    sincronizar(() =>
      saveCase(movido, { syncTags: false, anterior: atual })
    );
  }

  /** Aplica ou remove uma etiqueta do caso. */
  function toggleTag(id: string, tag: string) {

    const atual = cases.find((item) => item.id === id);

    if (!atual) return;

    const current = atual.tags ?? [];

    const etiquetado: Case = {
      ...atual,
      tags: current.includes(tag)
        ? current.filter((value) => value !== tag)
        : [...current, tag],
    };

    setCases((prev) =>
      prev.map((item) =>
        item.id === id ? etiquetado : item
      )
    );

    /* Etiqueta também não pode desfazer o que outra pessoa mudou. */
    sincronizar(() => saveCase(etiquetado, { anterior: atual }));
  }

  const filteredCases = useMemo(() => {

    const term = filters.search
      .trim()
      .toLowerCase();

    const corteDeVencimento = seteDiasAtras();

    return cases.filter((item) => {

      if (
        filters.company &&
        item.company !== filters.company
      ) {
        return false;
      }

      if (
        filters.status &&
        item.status !== filters.status
      ) {
        return false;
      }

      if (
        filters.category &&
        item.category !== filters.category
      ) {
        return false;
      }

      if (
        filters.tag &&
        !(item.tags ?? []).includes(filters.tag)
      ) {
        return false;
      }

      if (
        filters.owner &&
        (item.owner ?? "") !== filters.owner
      ) {
        return false;
      }

      if (
        filters.establishment &&
        (item.establishmentId ?? "") !==
          filters.establishment
      ) {
        return false;
      }

      /*
        Comparação de texto, e não de data.

        `createdAt` é `AAAA-MM-DD`; nesse formato a ordem alfabética é a
        cronológica, e o `>=` de string dá a resposta certa sem passar
        por `Date` — que reintroduziria fuso e faria o caso aberto às
        22h do dia 1º sumir de um filtro que começa no dia 2.
      */
      if (filters.de && item.createdAt < filters.de) {
        return false;
      }

      if (filters.ate && item.createdAt > filters.ate) {
        return false;
      }

      /*
        A situação, que cruza colunas.

        `corteDeVencimento` é calculado uma vez fora do laço: dentro
        dele seriam 341 construções de Date por render, para responder
        sempre a mesma pergunta.
      */
      if (
        filters.situacao &&
        !naSituacao(
          item,
          filters.situacao,
          corteDeVencimento
        )
      ) {
        return false;
      }

      /**
       * A regra do texto mora em `case.service`, e não aqui.
       *
       * Dois consumidores: este filtro e o `check:busca-texto`, que a
       * exercita contra a base real. Enquanto ela vivia dentro deste
       * `useMemo` não tinha como ser provada — e foi assim que passou
       * meses sem procurar por telefone sem ninguém notar.
       */
      return casaComTermo(item, term);

    });

  }, [cases, filters]);

  const value = useMemo(
    () => ({
      cases,

      filteredCases,

      filters,

      setFilter,

      applyFilters,

      clearFilters,

      setCases,

      createCase,

      updateCase,

      deleteCase,

      moveCase,

      toggleTag,

      loading,

      recarregar,

      hasDatabase,

      syncError,

      carregadoEm,
    }),
    [
      cases,
      filteredCases,
      filters,
      loading,
      hasDatabase,
      syncError,
      carregadoEm,
    ]
  );

  /**
   * As telas onde não ter sessão é o funcionamento normal.
   *
   * O provider monta no layout raiz, então roda também em `/login` e
   * `/cadastro` — onde não existe sessão **por definição**. A leitura
   * recusa ali com "sem-sessao", que é a verdade e não é uma falha; sem
   * esta porta, a faixa anunciava uma expiração que nunca aconteceu,
   * por cima da própria tela de entrar.
   */
  const naAutenticacao = /^\/(login|cadastro|recuperar|convite)/.test(
    pathname ?? ""
  );

  /**
   * Quando a faixa aparece — e as duas regras são opostas de propósito.
   *
   * **Gravação sempre.** É sobre algo que a pessoa acabou de fazer, e o
   * que ela escreveu não foi salvo. Esconder isso porque a tela está
   * cheia seria esconder justamente o que ela precisa saber.
   *
   * **Leitura só quando a tela ficou sem nada.** Foi o que o Isaac
   * apontou: "tem que aparecer somente quando não ter dados". Uma
   * recarga que falhou com as reclamações anteriores ainda na tela não
   * muda o que se está olhando — o alarme ali seria ruído, e ruído
   * ensina a ignorar o aviso justamente antes da vez em que ele importa.
   */
  const avisoDeLeitura =
    falhaDeLeitura && cases.length === 0
      ? falhaDeLeitura
      : null;

  /*
    O cadastro não tem a condição da tela vazia porque ele **é** o
    vazio: quando falha, chega o retrato de emergência, sem etapa, sem
    categoria, sem regra de prazo. As reclamações podem ter vindo — o
    quadro diz "353" — e mesmo assim não há coluna onde pô-las.
  */
  const aviso =
    syncError ??
    (naAutenticacao
      ? null
      : avisoDeLeitura ?? falhaDoCadastro);

  return (
    <CaseContext.Provider value={value}>
      {/*
        O aviso mora aqui, e não em cada tela.

        O motivo de estar no provider: ele era preenchido corretamente
        em toda falha de carga e **nenhum componente o lia**. O erro era
        registrado e não tinha para onde ir — a tela mostrava zero em
        tudo, quadro em branco, nenhuma palavra. Aqui, cobre de uma vez
        todas as telas que dependem de reclamação, e nenhuma tela nova
        pode esquecer de mostrar.
      */}
      {aviso && (
        <AvisoDeLeitura
          key={aviso}
          recado={aviso}
          gravacao={Boolean(syncError)}
          onTentarDeNovo={async () => {
            if (syncError) setSyncError(null);
            if (falhaDoCadastro) {
              const w = await recarregarWorkspace().catch(() => null);
              setFalhaDoCadastro(!w ? RECADO["banco-recusou"] : w.indisponivel ? RECADO[w.indisponivel] : null);
            }
            if (falhaDeLeitura) await recarregar();
          }}
        />
      )}

      {children}
    </CaseContext.Provider>
  );
}

/**
 * O aviso de que os dados não vieram — pequeno, no canto, e resolvendo.
 *
 * Era uma faixa fixa no topo, larga, com "Os números abaixo não são a
 * sua operação" e um botão que recarregava a página inteira. O Isaac:
 * "sempre aparecendo a notificação para recarregar … algo tão grande é
 * feio". Aparecia quase toda abertura porque qualquer falha passageira
 * da primeira leitura acendia a faixa; agora a leitura tenta de novo
 * sozinha antes (ver `novaTentativa`), e o que sobra é um aviso do
 * tamanho de um toast, que tenta de novo **sem** recarregar a página.
 *
 * Aviso de leitura pode ser dispensado. Aviso de gravação não some por
 * clique: o que a pessoa escreveu não foi salvo, e ela precisa saber.
 */
function AvisoDeLeitura({
  recado,
  gravacao,
  onTentarDeNovo,
}: {
  recado: string;
  gravacao: boolean;
  onTentarDeNovo: () => Promise<void>;
}) {
  const [tentando, setTentando] = useState(false);
  const [dispensado, setDispensado] = useState(false);

  if (dispensado) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-4 left-4 z-[100] flex w-[340px] max-w-[calc(100vw-2rem)] items-start gap-2.5 rounded-xl border border-amber-200 bg-white px-3.5 py-3 text-[13px] shadow-[0_10px_30px_-12px_rgba(16,24,40,0.3)] dark:border-amber-700/50 dark:bg-zinc-900"
    >
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-zinc-900 dark:text-zinc-100">
          {gravacao ? "Uma alteração não foi salva" : "Os dados não carregaram por completo"}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{recado}</p>
        <div className="mt-2 flex items-center gap-3 text-xs">
          <button
            type="button"
            disabled={tentando}
            onClick={async () => {
              setTentando(true);
              try {
                await onTentarDeNovo();
              } finally {
                setTentando(false);
              }
            }}
            className="font-medium text-violet-700 hover:underline disabled:opacity-60 dark:text-violet-300"
          >
            {tentando ? "Tentando…" : "Tentar de novo"}
          </button>
          <button type="button" onClick={() => window.location.reload()} className="text-zinc-500 hover:text-zinc-800 hover:underline dark:hover:text-zinc-200">
            Recarregar a página
          </button>
        </div>
      </div>
      {!gravacao && (
        <button
          type="button"
          onClick={() => setDispensado(true)}
          aria-label="Dispensar o aviso"
          className="-mr-1 -mt-0.5 rounded-md px-1 text-base leading-none text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
        >
          ×
        </button>
      )}
    </div>
  );
}

export function useCases() {
  const context =
    useContext(CaseContext);

  if (!context) {
    throw new Error(
      "useCases deve estar dentro de CaseProvider."
    );
  }

  return context;
}
