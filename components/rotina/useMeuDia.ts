"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useAgenda } from "@/lib/context/AgendaContext";
import { useCases } from "@/lib/context/CaseContext";
import { useMovements } from "@/lib/context/MovementsContext";
import { useNps } from "@/lib/context/NpsContext";
import { useSla } from "@/lib/context/SlaContext";
import { useAvaliacoesGoogle } from "@/lib/context/useAvaliacoesGoogle";
import { useAgora } from "@/lib/hooks/useAgora";

import { lerMeuDia, listarRotina, type CargaDoMeuDia } from "@/lib/actions/rotina";

import { atividadesDoDia, sequenciaDeDias, type AtividadeDaRotina } from "@/lib/models/rotina";
import { contarRotina, planoDoDia } from "@/lib/models/meuDia";
import { paredeDe } from "@/lib/services/horasUteis";

/**
 * O Meu dia inteiro, para quem desenha: a rotina, as marcas, as
 * contagens de cada atividade e o plano que cabe no expediente.
 *
 * Os números saem das mesmas listas que as outras telas já carregam
 * (casos, NPS, Google, áreas, agenda); do servidor vêm só as marcas, a
 * métrica do dia, as ligações pela cadência e o resumo de ontem.
 */
export function useMeuDia() {

  const { cases } = useCases();
  const { responses, kinds } = useNps();
  const { avaliacoes } = useAvaliacoesGoogle();
  const { movements } = useMovements();
  const { tasks } = useAgenda();
  const { rules, expediente } = useSla();
  const agora = useAgora();

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
            },
            agora,
            expediente
          )
        : null,
    [agora, cases, responses, kinds, avaliacoes, movements, tasks, rules, carga, expediente]
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

  return {
    carregando: atividades === null || carga === null || !agora,
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
    planejar,
    aplicarMarcas,
    recarregar,
  };
}
