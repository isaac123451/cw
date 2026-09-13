"use client";

import { useMemo, useState } from "react";

import {
  BadgeAlert,
  BadgeCheck,
  Check,
  ChevronDown,
  Copy,
  Send,
} from "lucide-react";

import { Case } from "@/lib/models/case";
import { INICIO_DA_TRILHA } from "@/lib/models/trilha";

import { useWorkflow } from "@/lib/context/WorkflowContext";
import { descreverRegistro } from "@/lib/services/horasUteis";
import { dadosSensiveis, resumoDosAchados } from "@/lib/services/lgpd";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

import SurfaceCard from "@/components/shared/SurfaceCard";
import MacroPicker from "@/components/reclame-aqui/detail/MacroPicker";
import ConferenciaDaResposta from "@/components/reclame-aqui/tratativa/ConferenciaDaResposta";
import { useTratativa } from "@/components/reclame-aqui/tratativa/TratativaProvider";

interface Props {
  data: Case;
  onChange: (patch: Partial<Case>) => void;
  /** O que a validação gravou no servidor, para o rascunho aberto acompanhar. */
  aoMudarNoServidor?: (patch: Partial<Case>) => void;
}

const scores = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * Sim, Não — e **Não definido**, quando a pergunta ainda não tem dono.
 *
 * Antes eram só dois botões, e um deles ficava sempre aceso: um caso
 * que o consumidor nunca avaliou aparecia como "não resolvido, não
 * voltaria", que é uma resposta que ninguém deu. O valor no banco é
 * `false` porque é o padrão da coluna, não porque alguém escolheu — e
 * a tela mostrava o padrão como se fosse decisão.
 *
 * O terceiro estado não é gravado: ele é **derivado** de `evaluated`.
 * Tornar as colunas nulas mexeria em oito serviços que somam esses
 * campos para compor a nota, e o ganho seria o mesmo — a pergunta só
 * faz sentido depois que o consumidor avalia.
 */
function Choice({
  value,
  definido,
  onSelect,
}: {
  value: boolean;
  /** Falso mostra "Não definido" aceso e apaga Sim/Não. */
  definido: boolean;
  onSelect: (next: boolean) => void;
}) {
  return (
    <div className="mt-1.5 grid grid-cols-3 gap-2">

      <span
        className={`flex h-11 items-center justify-center rounded-xl text-sm font-medium ring-1 ring-inset ${
          definido
            ? "text-zinc-400 ring-zinc-200"
            : "bg-zinc-100 text-zinc-600 ring-zinc-300"
        }`}
      >
        Não definido
      </span>

      {[
        { label: "Sim", next: true },
        { label: "Não", next: false },
      ].map((option) => (

        <button
          key={option.label}
          onClick={() => onSelect(option.next)}
          className={`h-11 rounded-xl text-sm font-medium transition-colors ring-1 ring-inset ${
            definido && value === option.next
              ? "bg-violet-50 text-violet-700 ring-violet-300"
              : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50"
          }`}
        >
          {option.label}
        </button>

      ))}

    </div>
  );
}

/**
 * A situação do caso, numa aba que abre em cima.
 *
 * **Antes, marcar "resolvido" mexia no status sozinho** — a escolha da
 * resolução escrevia `status: "Resolvido"` ou `"Não resolvido"` junto.
 * São duas coisas diferentes: a resolução é o que o consumidor
 * respondeu no portal, e o status é onde o caso está no nosso quadro.
 * Um caso pode estar resolvido para o consumidor e ainda em conferência
 * aqui dentro, e o contrário também acontece.
 *
 * Amarrar os dois fazia a avaliação mover o cartão no Kanban sem
 * ninguém pedir, e sem aparecer em lugar nenhum que isso ia acontecer.
 */
function SituacaoPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {

  const { workflow } = useWorkflow();

  const [aberta, setAberta] = useState(false);

  const etapas = workflow
    .filter((item) => item.active)
    .sort((a, b) => a.order - b.order);

  return (
    <div className="relative">

      <button
        type="button"
        onClick={() => setAberta((x) => !x)}
        className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200 transition-colors hover:bg-violet-50"
      >
        {value || "Sem situação"}
        <ChevronDown size={13} className="opacity-60" />
      </button>

      {aberta && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setAberta(false)}
          />

          <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-60 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_12px_32px_-12px_rgba(16,24,40,0.25)]">

            <p className="border-b border-zinc-100 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Situação no quadro
            </p>

            <ul className="max-h-64 overflow-y-auto p-1.5">
              {etapas.map((etapa) => (
                <li key={etapa.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(etapa.name);
                      setAberta(false);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                      etapa.name === value
                        ? "bg-violet-50 text-violet-800"
                        : "text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: etapa.color }}
                    />
                    <span className="flex-1">
                      {etapa.name}
                    </span>
                    {etapa.name === value && (
                      <Check
                        size={14}
                        className="shrink-0 text-violet-700"
                      />
                    )}
                  </button>
                </li>
              ))}
            </ul>

          </div>
        </>
      )}

    </div>
  );
}

export default function EvaluationTab({
  data,
  onChange,
  aoMudarNoServidor,
}: Props) {

  const { abrirContato } = useTratativa();

  const [copiado, setCopiado] = useState(false);

  /**
   * O que falta conferir antes de copiar ou de marcar como publicada.
   *
   * Nenhum dos dois bloqueia: dado pessoal é detectado por padrão (um
   * "0800" da própria empresa também acende) e a validação pode ter sido
   * impossível — o cliente que não respondeu às cinco tentativas recebe a
   * mensagem pública transparente sem validar nada. Mas o clique passa a
   * ser uma decisão, e não um reflexo.
   */
  const [confirmando, setConfirmando] = useState<"copiar" | "publicar" | null>(null);

  const rascunho = (data.draftResponse ?? "").trim();

  const publicada = (data.publicResponse ?? "").trim();

  const achados = useMemo(() => dadosSensiveis(rascunho), [rascunho]);

  /* Reclamação anterior ao registro de contatos não tem validação para mostrar. */
  const semValidacao = !data.validadoEm && data.createdAt >= INICIO_DA_TRILHA;

  const pendencias = [
    semValidacao ? "o cliente ainda não confirmou a solução (Passo 6)" : null,
    achados.length > 0 ? `o texto tem ${resumoDosAchados(achados)}` : null,
  ].filter((p): p is string => Boolean(p));

  function copiar() {
    navigator.clipboard?.writeText(rascunho).then(() => {
      setCopiado(true);
      setConfirmando(null);
      setTimeout(() => setCopiado(false), 1800);
    });
  }

  function publicar() {
    onChange({
      publicResponse:
        publicada === ""
          ? rascunho
          : `${data.publicResponse}\n\n${rascunho}`,
      draftResponse: undefined,
      respondida: true,
      /* A primeira publicação data a resposta; complementos não mudam a data. */
      publicResponseAt: data.publicResponseAt ?? new Date().toISOString(),
    });
    setConfirmando(null);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">

      <div className="space-y-5">

        {/* ---- o que vai ser enviado ---- */}

        <SurfaceCard
          title="Resposta a enviar"
          description="O texto que ainda vai ser publicado no Reclame Aqui. Rascunho: não conta no índice de resposta enquanto não for marcado como publicado."
          action={
            <MacroPicker
              data={data}
              onInsert={(text) =>
                onChange({
                  draftResponse:
                    rascunho === ""
                      ? text
                      : `${data.draftResponse}\n\n${text}`,
                })
              }
            />
          }
        >

          {semValidacao && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-900 ring-1 ring-inset ring-amber-100">
              <span className="min-w-0 flex-1">
                <strong>O Passo 6 vem antes:</strong> confirme com o cliente que tudo voltou a funcionar e só
                depois publique. Sem a confirmação, a resposta pública promete o que ninguém conferiu.
              </span>
              <button
                type="button"
                onClick={() => abrirContato(data, "validacao", { aoSalvar: aoMudarNoServidor })}
                className="shrink-0 rounded-lg bg-white px-2.5 py-1.5 font-medium text-amber-800 ring-1 ring-inset ring-amber-200 transition-colors hover:bg-amber-100"
              >
                Cliente confirmou a solução
              </button>
            </div>
          )}

          <textarea
            value={data.draftResponse ?? ""}
            onChange={(e) =>
              onChange({ draftResponse: e.target.value })
            }
            rows={7}
            placeholder="Comece pelo que só este caso tem: o nome, o problema que a pessoa viveu, o que foi feito. Sem dado pessoal e sem condição negociada."
            className="w-full resize-y rounded-xl border border-zinc-200 p-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400"
          />

          <ConferenciaDaResposta texto={rascunho} protocol={data.protocol} achados={achados} />

          {confirmando && pendencias.length > 0 && (
            <div className="mt-3 rounded-xl bg-zinc-50 px-3.5 py-3 text-xs leading-relaxed text-zinc-700 ring-1 ring-inset ring-zinc-200">
              <p>
                {confirmando === "copiar" ? "Copiar mesmo assim?" : "Marcar como publicada mesmo assim?"}{" "}
                {pendencias.join("; ").replace(/^./, (c) => c.toUpperCase())}.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => (confirmando === "copiar" ? copiar() : publicar())}
                  className="rounded-lg bg-zinc-800 px-3 py-1.5 font-medium text-white transition-colors hover:bg-zinc-900"
                >
                  {confirmando === "copiar" ? "Revisei, copiar" : "Publiquei assim"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmando(null)}
                  className="rounded-lg px-3 py-1.5 font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-white"
                >
                  Voltar ao texto
                </button>
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">

            <button
              type="button"
              disabled={rascunho === ""}
              onClick={() =>
                achados.length > 0 ? setConfirmando("copiar") : copiar()
              }
              className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copiado ? (
                <Check size={13} />
              ) : (
                <Copy size={13} />
              )}
              {copiado ? "copiado" : "copiar"}
            </button>

            {/*
              Publicar não é um botão que publica.

              A extensão não posta no portal e esta tela também não: o
              texto vai para o Reclame Aqui pela mão de quem atende. O
              que este botão faz é **registrar** que foi publicado — e
              é isso que faz o caso contar como respondido no índice.

              Um botão chamado "publicar" que não publica seria a pior
              versão possível: alguém clicaria e iria embora achando que
              o consumidor recebeu resposta.
            */}
            <button
              type="button"
              disabled={rascunho === ""}
              onClick={() =>
                pendencias.length > 0 ? setConfirmando("publicar") : publicar()
              }
              className="flex h-9 items-center gap-1.5 rounded-xl bg-violet-800 px-3.5 text-xs font-medium text-white transition-colors hover:bg-violet-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={13} />
              Já publiquei no portal
            </button>

          </div>

          <p className="mt-2.5 text-xs leading-relaxed text-zinc-400">
            Copie, cole no Reclame Aqui e volte aqui para
            marcar — depois, Salvar. Esta tela não publica no
            portal: quem publica é você, e o registro só vale
            depois disso.
          </p>

        </SurfaceCard>

        {/* ---- o que já foi publicado ---- */}

        <SurfaceCard
          title="Resposta publicada"
          description="O que já está no ar no Reclame Aqui. É este texto que conta no índice de resposta."
        >

          <textarea
            value={data.publicResponse ?? ""}
            onChange={(e) =>
              onChange({
                publicResponse: e.target.value,
                respondida: e.target.value.trim() !== "",
              })
            }
            rows={6}
            placeholder="Ainda sem resposta publicada."
            className="w-full resize-y rounded-xl border border-zinc-200 p-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400"
          />

          {/*
            A data é a da primeira publicação, e não a da última edição.

            Mostrava `updatedAt` — que muda a cada etiqueta ou arrasto de
            cartão. "Respondida em" dizia quando alguém mexeu no caso pela
            última vez, e o lembrete de avaliação (dois dias depois da
            resposta) não tinha de onde partir.
          */}
          <p className="mt-3 text-xs leading-relaxed text-zinc-400">
            {publicada === ""
              ? "Sem resposta pública — este é o fator de maior peso no índice de resposta."
              : data.publicResponseAt
                ? `Respondida em ${descreverRegistro(data.publicResponseAt)}.`
                : "Respondida — a data da publicação não foi registrada."}
          </p>

        </SurfaceCard>

      </div>

      <div className="space-y-5">

        <SurfaceCard
          title="Resolução"
          description="O que o consumidor respondeu no portal."
          action={
            <SituacaoPicker
              value={data.status}
              onChange={(status) => onChange({ status })}
            />
          }
        >

          <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Situação resolvida?
          </label>

          <Choice
            value={data.resolved}
            definido={Boolean(data.evaluated)}
            onSelect={(next) =>
              onChange({
                resolved: next,
                sla: next ? "Concluído" : data.sla,
              })
            }
          />

          {/*
            A situação do quadro fica no botão acima, e não aqui.

            Marcar a resolução movia o cartão no Kanban sozinho, sem
            aparecer em lugar nenhum que isso ia acontecer. São duas
            perguntas: o que o consumidor respondeu, e onde o caso está
            do nosso lado.
          */}
          <p className="mt-3 text-xs leading-relaxed text-zinc-400">
            {data.evaluated
              ? "Resposta do consumidor na avaliação do portal."
              : "Fica indefinida até o consumidor avaliar."}{" "}
            A situação no quadro é escolhida no botão acima
            e não muda sozinha.
          </p>

        </SurfaceCard>

        <SurfaceCard title="Avaliação do cliente">

          <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Nota da avaliação
          </label>

          <div className="mt-1.5 flex flex-wrap gap-1.5">

            {/*
              "Não definido" escrito por extenso.

              Era um traço num botão quadrado, do tamanho das notas —
              e ninguém sabia se aquilo era "zero", "sem nota" ou um
              separador. O estado mais comum da base merece o nome
              inteiro: das 342 reclamações, 127 nunca foram avaliadas.
            */}
            <button
              onClick={() =>
                onChange({
                  evaluated: false,
                  score: undefined,
                  evaluatedAt: undefined,
                })
              }
              className={`h-10 rounded-xl px-3 text-xs font-medium transition-colors ring-1 ring-inset ${
                !data.evaluated
                  ? "bg-violet-50 text-violet-700 ring-violet-300"
                  : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50"
              }`}
            >
              Não definido
            </button>

            {scores.map((score) => (

              <button
                key={score}
                onClick={() =>
                  onChange({
                    evaluated: true,
                    score,
                    wouldDoBusiness: score >= 7,
                    // Ao marcar a nota sem data registrada, assume hoje —
                    // pode ser corrigido no campo abaixo.
                    evaluatedAt:
                      data.evaluatedAt ?? hojeNaOperacao(),
                  })
                }
                className={`h-10 w-10 rounded-xl text-sm font-medium tabular-nums transition-colors ring-1 ring-inset ${
                  data.evaluated && data.score === score
                    ? "bg-violet-50 text-violet-700 ring-violet-300"
                    : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50"
                }`}
              >
                {score}
              </button>

            ))}

          </div>

          <div className="mt-5">

            <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Data da avaliação
            </label>

            <input
              type="date"
              value={data.evaluatedAt ?? ""}
              disabled={!data.evaluated}
              onChange={(e) =>
                onChange({
                  evaluatedAt: e.target.value || undefined,
                })
              }
              className={`mt-1.5 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none transition-colors focus:border-violet-400 ${
                data.evaluated
                  ? ""
                  : "cursor-not-allowed bg-zinc-50 text-zinc-400"
              }`}
            />

            <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
              {data.evaluated
                ? "O portal registra apenas o dia da avaliação, sem horário."
                : "Disponível depois que o consumidor avaliar."}
            </p>

          </div>

          <div className="mt-5">

            <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Voltaria a fazer negócio?
            </label>

            <Choice
              value={data.wouldDoBusiness}
              definido={Boolean(data.evaluated)}
              onSelect={(next) =>
                onChange({ wouldDoBusiness: next })
              }
            />

          </div>

          {data.evaluated && (

            <div className="mt-5 border-t border-zinc-100 pt-4">

              <button
                onClick={() =>
                  onChange({
                    scoreDisregarded:
                      !data.scoreDisregarded,
                  })
                }
                title="Tira esta avaliação do cálculo da nota, como o Reclame Aqui faz com as que invalida."
                className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-colors ring-1 ring-inset ${data.scoreDisregarded ? "bg-amber-50 text-amber-800 ring-amber-200 hover:bg-amber-100" : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50"}`}
              >

                {data.scoreDisregarded ? (
                  <BadgeAlert size={15} />
                ) : (
                  <BadgeCheck size={15} />
                )}

                {data.scoreDisregarded
                  ? "Nota desconsiderada"
                  : "Desconsiderar nota"}

              </button>

              {data.scoreDisregarded && (
                <p className="mt-2.5 rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800 ring-1 ring-inset ring-amber-100">
                  Avaliação desconsiderada:{" "}
                  <strong className="font-semibold">
                    fica fora do cálculo da nota
                  </strong>
                  , como o Reclame Aqui faz com as que
                  invalida. O caso continua na lista, com a
                  nota registrada.
                </p>
              )}

            </div>

          )}

          <p className="mt-4 border-t border-zinc-100 pt-3 text-xs leading-relaxed text-zinc-400">
            Notas de 7 a 10 contam como promotor no cálculo da
            reputação.
          </p>

        </SurfaceCard>

      </div>

    </div>
  );
}
