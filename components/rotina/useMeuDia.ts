"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAgenda } from "@/lib/context/AgendaContext";
import { useCases } from "@/lib/context/CaseContext";
import { useMovements } from "@/lib/context/MovementsContext";
import { useNps } from "@/lib/context/NpsContext";
import { useSla } from "@/lib/context/SlaContext";
import { useAvaliacoesGoogle } from "@/lib/context/useAvaliacoesGoogle";
import { useAgora } from "@/lib/hooks/useAgora";
import { useEsperaNoWhatsapp } from "@/lib/hooks/useEsperaNoWhatsapp";
import { itensDaEspera } from "@/lib/models/esperaNoWhatsapp";

import {
  desfazerMarcasDeItens,
  lerMeuDia,
  listarRotina,
  marcarItensDaRotina,
  salvarMarcas,
  type CargaDoMeuDia,
  type DuracaoDaMarca,
} from "@/lib/actions/rotina";

import { atividadesDoDia, sequenciaDeDias, type AtividadeDaRotina } from "@/lib/models/rotina";
import { contarRotina, planoDoDia, type MarcaDeItem, type TipoDeMarcaDeItem } from "@/lib/models/meuDia";
import { paredeDe } from "@/lib/services/horasUteis";
import { useToast } from "@/lib/context/ToastContext";

/**
 * As atividades de lista que fecham sozinhas quando não resta nada (1.91).
 *
 * "As atividades têm de ser finalizadas automaticamente quando houver
 * atualização." O número de cada uma sai dos dados: o caso respondido, o
 * NPS contatado, a avaliação pedida pela extensão saem da lista sozinhos.
 * Quando a lista zera, a atividade é marcada como feita — com um aviso só.
 * Checkpoint, indicadores, processos, sprint, métrica e relatório não
 * entram: o zero delas não quer dizer que o trabalho foi feito.
 */
const FECHAM_SOZINHAS = new Set(["novos", "em-aberto", "fups", "moderacoes", "avaliacoes", "ligacoes", "concluidos", "areas", "pendencias"]);

/**
 * O Meu dia inteiro, para quem desenha: a rotina, as marcas, as
 * contagens de cada atividade e o plano que cabe no expediente.
 *
 * Os números saem das mesmas listas que as outras telas já carregam
 * (casos, NPS, Google, áreas, agenda); do servidor vêm só as marcas, a
 * métrica do dia, as ligações pela cadência e o resumo de ontem.
 */
const SEM_MARCAS: MarcaDeItem[] = [];

export function useMeuDia() {

  const { cases, loading: carregandoCasos } = useCases();
  const { responses, kinds, loading: carregandoNps } = useNps();
  const { avaliacoes, carregando: carregandoGoogle } = useAvaliacoesGoogle();
  const { movements, loading: carregandoMovimentos } = useMovements();
  const { tasks, loading: carregandoAgenda } = useAgenda();
  const { rules, expediente } = useSla();
  const agora = useAgora();
  const espera = useEsperaNoWhatsapp();

  const [atividades, setAtividades] = useState<AtividadeDaRotina[] | null>(null);
  const [carga, setCarga] = useState<CargaDoMeuDia | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    try {
      const [lista, dados] = await Promise.all([listarRotina(), lerMeuDia()]);
      setAtividades(lista);
      setCarga(dados);
      setErro(null);
    } catch {
      setErro("Não deu para ler a rotina agora. Recarregue a página.");
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    Promise.all([listarRotina(), lerMeuDia()])
      .then(([lista, dados]) => {
        if (!ativo) return;
        setAtividades(lista);
        setCarga(dados);
      })
      .catch(() => ativo && setErro("Não deu para ler a rotina agora. Recarregue a página."));
    return () => {
      ativo = false;
    };
  }, []);

  const hoje = agora ? paredeDe(agora).dia : null;

  const doDia = useMemo(
    () => (atividades && hoje ? atividadesDoDia(atividades, hoje, expediente) : []),
    [atividades, hoje, expediente]
  );

  const continuas = useMemo(
    () => (atividades ?? []).filter((a) => a.ativa && a.frequencia === "continua").sort((a, b) => a.ordem - b.ordem),
    [atividades]
  );

  const contagens = useMemo(
    () =>
      agora
        ? contarRotina(
            {
              casos: cases,
              nps: responses,
              tiposNps: kinds,
              google: avaliacoes,
              movimentos: movements,
              tarefas: tasks,
              regrasSla: rules,
              metricaHoje: carga?.metricaHoje ?? null,
              ligacoes: carga?.ligacoes ?? [],
              relatorio: carga?.relatorio ?? null,
              marcasDeItens: carga?.marcasDeItens ?? [],
              aguardandoRetorno: carga?.aguardandoRetorno ?? [],
              esperaNoWhatsapp: itensDaEspera(espera, agora),
            },
            agora,
            expediente
          )
        : null,
    [agora, cases, responses, kinds, avaliacoes, movements, tasks, rules, carga, expediente, espera]
  );

  const feitasHoje = useMemo(
    () => new Set((carga?.marcas ?? []).filter((m) => m.dia === hoje).map((m) => m.atividadeId)),
    [carga, hoje]
  );

  const sequencia = useMemo(
    () => (atividades && hoje && carga ? sequenciaDeDias(atividades, carga.marcas, hoje, expediente) : 0),
    [atividades, hoje, carga, expediente]
  );

  const planejar = useCallback(
    (feitas: Set<string>) => (contagens && agora ? planoDoDia(doDia, contagens, feitas, agora, expediente) : null),
    [contagens, agora, doDia, expediente]
  );

  const { notify } = useToast();
  const tentadas = useRef<string>("");

  useEffect(() => {
    /* Só com tudo carregado: uma lista vazia porque ainda não chegou não é uma lista zerada. */
    if (!contagens || !hoje || !carga || !atividades || carregandoCasos || carregandoNps || carregandoMovimentos || carregandoAgenda || carregandoGoogle) return;
    const zeradas = doDia.filter(
      (a) => a.chave && FECHAM_SOZINHAS.has(a.chave) && contagens[a.chave]?.total === 0 && !feitasHoje.has(a.id)
    );
    if (zeradas.length === 0) return;
    /* Uma tentativa por conjunto e por dia: se o servidor recusar, não insiste em laço. */
    const chave = `${hoje}|${zeradas.map((a) => a.id).sort().join(",")}`;
    if (tentadas.current === chave) return;
    tentadas.current = chave;
    salvarMarcas({ dia: hoje, feitas: [...feitasHoje, ...zeradas.map((a) => a.id)] })
      .then((r) => {
        if (!r.ok) return;
        if (r.atividades) setAtividades(r.atividades);
        setCarga((atual) =>
          atual ? { ...atual, marcas: [...atual.marcas.filter((m) => m.dia !== hoje), ...r.feitas.map((atividadeId) => ({ atividadeId, dia: hoje }))] } : atual
        );
        notify({
          tone: "success",
          title: zeradas.length === 1 ? `"${zeradas[0].titulo}" fechou sozinha` : `${zeradas.length} atividades fecharam sozinhas`,
          detail: "Não sobrou nada nelas hoje.",
        });
      })
      .catch(() => {});
  }, [contagens, hoje, carga, atividades, doDia, feitasHoje, carregandoCasos, carregandoNps, carregandoMovimentos, carregandoAgenda, carregandoGoogle, notify]);

  /** Depois do Salvar: as marcas de hoje como o servidor gravou. */
  const aplicarMarcas = useCallback(
    (feitas: string[], lista?: AtividadeDaRotina[]) => {
      if (lista) setAtividades(lista);
      setCarga((atual) =>
        atual && hoje
          ? { ...atual, marcas: [...atual.marcas.filter((m) => m.dia !== hoje), ...feitas.map((atividadeId) => ({ atividadeId, dia: hoje }))] }
          : atual
      );
    },
    [hoje]
  );

  /**
   * Tirar itens das atividades — feito hoje, ou não se aplica.
   *
   * A lista só muda depois que o servidor gravou: quem chama mostra o
   * aviso com o que voltou, e o erro fica na tela se não gravou.
   */
  const marcarItens = useCallback(
    async (itens: { chave: string; item: string; titulo: string }[], tipo: TipoDeMarcaDeItem, duracao: DuracaoDaMarca = "hoje", volta?: string) => {
      const r = await marcarItensDaRotina({ itens, tipo, duracao, volta });
      if (r.ok) {
        const novas = new Set(r.marcas.map((m) => m.id));
        const mesmas = new Set(r.marcas.map((m) => `${m.chave}|${m.item}|${m.dia}`));
        setCarga((atual) =>
          atual
            ? {
                ...atual,
                marcasDeItens: [
                  ...r.marcas,
                  ...atual.marcasDeItens.filter((m) => !novas.has(m.id) && !mesmas.has(`${m.chave}|${m.item}|${m.dia}`)),
                ],
              }
            : atual
        );
      }
      return r;
    },
    []
  );

  const desfazerMarcas = useCallback(async (ids: string[]) => {
    const r = await desfazerMarcasDeItens(ids);
    if (r.ok) {
      const saem = new Set(ids);
      setCarga((atual) => (atual ? { ...atual, marcasDeItens: atual.marcasDeItens.filter((m) => !saem.has(m.id)) } : atual));
    }
    return r;
  }, []);

  return {
    /*
      Os casos e o NPS também: sem eles a conta sai zerada, e o plano dizia
      "Nada da rotina pendente. Bom trabalho." até os dados chegarem.
    */
    carregando: atividades === null || carga === null || !agora || carregandoCasos || carregandoNps,
    erro,
    hoje,
    agora,
    expediente,
    atividades: atividades ?? [],
    setAtividades,
    doDia,
    continuas,
    contagens,
    feitasHoje,
    sequencia,
    ontem: carga?.ontem ?? null,
    hojeAteAgora: carga?.hojeAteAgora ?? null,
    /* As marcas de itens que valem hoje — o fim do dia conta as feitas hoje. */
    marcasDeItens: carga?.marcasDeItens ?? SEM_MARCAS,
    planejar,
    aplicarMarcas,
    marcarItens,
    desfazerMarcas,
    recarregar,
  };
}
