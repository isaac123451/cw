"use client";

import { useEffect, useState, useTransition } from "react";

import {
  CircleAlert,
  Gauge,
  Loader2,
  Save,
  Sparkles,
  Timer,
} from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { useToast } from "@/lib/context/ToastContext";

import {
  getIaConfig,
  listIaPerfis,
  medirIa,
  saveIaConfig,
  type MedicaoDaIA,
  type RetratoDaIA,
} from "@/lib/actions/ia";

import type {
  Perfil,
  PerfilDeVelocidade,
} from "@/lib/services/iaConfig.service";

const campo =
  "h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400";

/**
 * Qual IA responde, e quão rápido.
 *
 * A escolha era variável de ambiente, o que tem dois problemas: mudar
 * exige deploy, e o valor fica invisível para quem usa a ferramenta. "A
 * IA está demorando" é reclamação da operação, e a resposta estava num
 * arquivo que a operação não abre.
 *
 * **O botão de medir é metade da tela.** Escolher velocidade sem poder
 * conferir é escolher no escuro — e foi o escuro que deixou uma
 * instalação rodando 39 segundos por chamada sem ninguém saber. O
 * pedido medido é o mesmo do `npm run check:ia`, para os dois números
 * serem comparáveis.
 */
export default function IaCard() {

  const { notify } = useToast();

  const [retrato, setRetrato] =
    useState<RetratoDaIA | null>(null);

  const [perfis, setPerfis] = useState<
    PerfilDeVelocidade[]
  >([]);

  const [avancado, setAvancado] = useState(false);
  const [salvando, startSalvar] = useTransition();

  const [medindo, setMedindo] = useState<
    "" | "normal" | "rapido"
  >("");

  const [medicao, setMedicao] = useState<
    (MedicaoDaIA & { via: string }) | null
  >(null);

  /** O rascunho: só vai ao banco quando clicar em Salvar. */
  const [draft, setDraft] = useState<{
    perfil: Perfil;
    provedorPreferido: "auto" | "anthropic" | "gemini";
    modelo: string;
    modeloRapido: string;
    modeloReserva: string;
    hedgeSegundos: number;
    timeoutSegundos: number;
  } | null>(null);

  useEffect(() => {

    let ativo = true;

    Promise.all([getIaConfig(), listIaPerfis()])
      .then(([config, lista]) => {

        if (!ativo) return;

        setRetrato(config);
        setPerfis(lista);

        setDraft({
          perfil: config.perfil,
          provedorPreferido: config.provedorPreferido,
          modelo: config.modelo,
          modeloRapido: config.modeloRapido,
          modeloReserva: config.modeloReserva,
          hedgeSegundos: config.hedgeSegundos,
          timeoutSegundos: config.timeoutSegundos,
        });
      })
      .catch(() => {
        if (ativo) setRetrato(null);
      });

    return () => {
      ativo = false;
    };

  }, []);

  if (!retrato || !draft) {
    return (
      <SurfaceCard
        title="Inteligência artificial"
        description="Carregando configuração..."
      >
        <p className="text-sm text-zinc-400">
          Carregando...
        </p>
      </SurfaceCard>
    );
  }

  /**
   * Trocar de perfil reescreve os avançados.
   *
   * É o que faz o perfil significar alguma coisa: sem isso, escolher
   * "Rápido" com um prazo de 60 s deixado de um ajuste anterior
   * entregaria uma tela que promete rápido e uma chamada que não é.
   * Quem quiser afinar reabre "Ajuste fino" depois.
   */
  function escolherPerfil(id: Perfil) {

    const perfil = perfis.find((p) => p.id === id);

    if (!perfil || !draft) return;

    setDraft({
      ...draft,
      perfil: id,
      modelo: perfil.modelo,
      modeloRapido: perfil.modeloRapido,
      hedgeSegundos: perfil.hedgeSegundos,
      timeoutSegundos: perfil.timeoutSegundos,
    });
  }

  function salvar() {

    if (!draft) return;

    startSalvar(async () => {

      const saida = await saveIaConfig(draft);

      if (saida.erro) {
        notify({
          tone: "error",
          title: "Não foi possível salvar.",
          detail: saida.erro,
        });
        return;
      }

      const atual = await getIaConfig();

      setRetrato(atual);

      notify({
        tone: "success",
        title: `Velocidade: ${perfis.find((p) => p.id === draft.perfil)?.nome ?? draft.perfil}.`,
        detail:
          "Vale para a próxima chamada — do assistente, da triagem e do resumo da extensão.",
      });
    });
  }

  async function medir(rapido: boolean) {

    setMedindo(rapido ? "rapido" : "normal");
    setMedicao(null);

    const saida = await medirIa(rapido);

    setMedicao({
      ...saida,
      via: rapido ? "resumo" : "triagem",
    });

    setMedindo("");
  }

  const alterado =
    draft.perfil !== retrato.perfil ||
    draft.provedorPreferido !==
      retrato.provedorPreferido ||
    draft.modelo !== retrato.modelo ||
    draft.modeloRapido !== retrato.modeloRapido ||
    draft.modeloReserva !== retrato.modeloReserva ||
    draft.hedgeSegundos !== retrato.hedgeSegundos ||
    draft.timeoutSegundos !== retrato.timeoutSegundos;

  return (
    <SurfaceCard
      title="Inteligência artificial"
      description="Quem responde a triagem, o assistente e o resumo de conversa da extensão — e quão rápido."
      hint="A escolha vale para todo mundo e para a próxima chamada. Ela muda o tempo de resposta e a profundidade do julgamento, nessa ordem de sensibilidade."
    >

      <div className="space-y-5">

        {/* Quem está respondendo agora */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-zinc-50 px-3.5 py-2.5 text-sm">

          <Sparkles
            size={15}
            className="shrink-0 text-violet-600"
          />

          {retrato.disponivel ? (
            <span className="text-zinc-700">
              Respondendo por{" "}
              <strong className="font-semibold">
                {retrato.provedor}
              </strong>{" "}
              · modelo{" "}
              <code className="rounded bg-white px-1.5 py-0.5 text-[11px] text-violet-700">
                {retrato.modelo}
              </code>
            </span>
          ) : (
            <span className="text-zinc-700">
              Nenhuma IA configurada neste ambiente.
            </span>
          )}

          <span className="ml-auto text-xs text-zinc-400">
            {retrato.origem === "banco"
              ? "escolhido aqui"
              : "vindo do ambiente"}
          </span>

        </div>

        {/*
          As chaves, como sim/não.

          Saber que a chave da Anthropic não está preenchida é o que
          explica por que escolher "Anthropic" não muda nada — e era a
          informação que mais faltava.
        */}
        {!retrato.chaves.anthropic && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-800 ring-1 ring-inset ring-amber-100">
            <CircleAlert
              size={14}
              className="mt-0.5 shrink-0"
            />
            <span>
              A chave da Anthropic não está preenchida
              neste ambiente, então escolher
              &ldquo;Anthropic&rdquo; não muda nada. O
              Gemini responde pela camada gratuita, que
              entra em fila nos horários de pico — é o teto
              de velocidade que nenhum perfil aqui vence.
            </span>
          </p>
        )}

        {/* Velocidade */}
        <div>

          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Velocidade
          </p>

          <div className="grid gap-2 sm:grid-cols-3">

            {perfis.map((perfil) => {

              const ativo = draft.perfil === perfil.id;

              return (
                <button
                  key={perfil.id}
                  onClick={() =>
                    escolherPerfil(perfil.id)
                  }
                  disabled={!retrato.permitido}
                  className={`rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${ativo ? "border-violet-400 bg-violet-50/60 ring-1 ring-inset ring-violet-200" : "border-zinc-200 hover:border-violet-300 hover:bg-zinc-50"}`}
                >

                  <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
                    <Gauge
                      size={14}
                      className={
                        ativo
                          ? "text-violet-600"
                          : "text-zinc-400"
                      }
                    />
                    {perfil.nome}
                  </span>

                  <span className="mt-1 block text-[11px] leading-snug text-zinc-500">
                    {perfil.resumo}
                  </span>

                  <span className="mt-1.5 block text-[11px] font-medium tabular-nums text-violet-700">
                    {perfil.medido}
                  </span>

                </button>
              );
            })}

          </div>

        </div>

        {/* Provedor */}
        <div className="grid gap-3 sm:grid-cols-2">

          <label className="block">

            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Provedor
            </span>

            <select
              value={draft.provedorPreferido}
              disabled={!retrato.permitido}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  provedorPreferido: e.target
                    .value as typeof draft.provedorPreferido,
                })
              }
              className={campo}
            >
              <option value="auto">
                Automático — o que tiver chave
              </option>
              <option value="anthropic">
                Anthropic
                {retrato.chaves.anthropic
                  ? ""
                  : " (sem chave)"}
              </option>
              <option value="gemini">
                Gemini
                {retrato.chaves.gemini
                  ? ""
                  : " (sem chave)"}
              </option>
            </select>

          </label>

          <div className="flex items-end">
            <button
              onClick={() => setAvancado(!avancado)}
              className="text-xs font-medium text-violet-700 underline underline-offset-4 hover:text-violet-800"
            >
              {avancado
                ? "Esconder o ajuste fino"
                : "Ajuste fino (modelo e prazos)"}
            </button>
          </div>

        </div>

        {avancado && (

          <div className="space-y-3 rounded-xl border border-zinc-200 p-3.5">

            <p className="text-xs leading-relaxed text-zinc-500">
              Fixar um modelo aqui vence o perfil. É a
              saída de emergência para quando a família se
              renova e um nome some do ar —{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px]">
                npm run check:ia
              </code>{" "}
              lista o que a conta enxerga.
            </p>

            <div className="grid gap-3 sm:grid-cols-3">

              {(
                [
                  ["modelo", "Modelo principal"],
                  ["modeloRapido", "Modelo da via rápida"],
                  [
                    "modeloReserva",
                    "Reserva contra o 404",
                  ],
                ] as const
              ).map(([chave, rotulo]) => (
                <label key={chave} className="block">

                  <span className="mb-1.5 block text-[11px] font-medium text-zinc-600">
                    {rotulo}
                  </span>

                  <input
                    value={draft[chave]}
                    disabled={!retrato.permitido}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        [chave]: e.target.value,
                      })
                    }
                    className={campo}
                  />

                </label>
              ))}

            </div>

            <div className="grid gap-3 sm:grid-cols-2">

              <label className="block">

                <span className="mb-1.5 block text-[11px] font-medium text-zinc-600">
                  Corrida com a reserva (segundos)
                </span>

                <input
                  type="number"
                  min={0}
                  max={60}
                  value={draft.hedgeSegundos}
                  disabled={!retrato.permitido}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      hedgeSegundos: Number(
                        e.target.value
                      ),
                    })
                  }
                  className={campo}
                />

                <span className="mt-1 block text-[11px] leading-snug text-zinc-500">
                  Depois disso, um segundo modelo parte em
                  paralelo e vale quem chegar bem primeiro.
                  <strong className="font-medium">
                    {" "}
                    Zero desliga a corrida
                  </strong>{" "}
                  — é o que o perfil Profundo faz.
                </span>

              </label>

              <label className="block">

                <span className="mb-1.5 block text-[11px] font-medium text-zinc-600">
                  Desistir depois de (segundos)
                </span>

                <input
                  type="number"
                  min={5}
                  max={120}
                  value={draft.timeoutSegundos}
                  disabled={!retrato.permitido}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      timeoutSegundos: Number(
                        e.target.value
                      ),
                    })
                  }
                  className={campo}
                />

                <span className="mt-1 block text-[11px] leading-snug text-zinc-500">
                  Medido: uma triagem chegou a 162 segundos
                  na camada gratuita congestionada, e o
                  botão ficou dois minutos e meio em
                  &ldquo;Lendo…&rdquo;.
                </span>

              </label>

            </div>

          </div>

        )}

        {/* Medir */}
        <div className="rounded-xl border border-zinc-200 p-3.5">

          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Conferir na prática
          </p>

          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Faz uma chamada de verdade com o que está
            gravado — não com o rascunho acima. Salve
            antes de medir.
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">

            {(
              [
                [false, "Medir a triagem"],
                [true, "Medir o resumo"],
              ] as const
            ).map(([rapido, rotulo]) => (
              <button
                key={rotulo}
                onClick={() => medir(rapido)}
                disabled={
                  medindo !== "" || !retrato.disponivel
                }
                className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:border-violet-300 hover:text-violet-700 disabled:opacity-50"
              >
                {medindo ===
                (rapido ? "rapido" : "normal") ? (
                  <Loader2
                    size={13}
                    className="animate-spin"
                  />
                ) : (
                  <Timer size={13} />
                )}
                {rotulo}
              </button>
            ))}

            {medicao && (
              <span
                className={`text-xs ${medicao.erro ? "text-rose-700" : "text-zinc-600"}`}
              >
                {medicao.erro ? (
                  <>falhou — {medicao.erro}</>
                ) : (
                  <>
                    <strong className="font-semibold tabular-nums">
                      {(
                        (medicao.ms ?? 0) / 1000
                      ).toFixed(1)}{" "}
                      s
                    </strong>{" "}
                    na via de {medicao.via} ·{" "}
                    {medicao.provedor} ·{" "}
                    {medicao.entrada ?? 0}/
                    {medicao.saida ?? 0} tokens
                    {medicao.amostra
                      ? ` · "${medicao.amostra}"`
                      : ""}
                  </>
                )}
              </span>
            )}

          </div>

        </div>

        {retrato.permitido ? (

          <div className="flex items-center justify-end gap-2">

            {alterado && (
              <span className="mr-auto text-xs text-amber-700">
                Alteração não salva.
              </span>
            )}

            <button
              onClick={salvar}
              disabled={salvando || !alterado}
              className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:opacity-50"
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

        ) : (

          <p className="text-xs text-zinc-500">
            Só administradores mudam esta configuração —
            ela vale para todo mundo.
          </p>

        )}

      </div>

    </SurfaceCard>
  );
}
