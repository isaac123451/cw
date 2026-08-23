"use client";

import { useState } from "react";

import { Plus, Trash2 } from "lucide-react";

import Modal, {
  GhostButton,
  inputClass,
} from "@/components/shared/Modal";

import BarraDeSalvar from "@/components/shared/BarraDeSalvar";

import { useRascunho } from "@/lib/hooks/useRascunho";
import { sincronizar } from "@/lib/context/sync";

import {
  emAndamento,
  finaisDoTipo,
  NpsKindOption,
  NpsStageOption,
  nomeDeEtapa,
  rotuloDeEtapa,
} from "@/lib/models/nps";

import {
  removeNpsKind,
  removeNpsStage,
  saveNpsKind,
  saveNpsStage,
} from "@/lib/actions/npsCadastro";

interface Props {
  etapas: NpsStageOption[];
  tipos: NpsKindOption[];
  onClose: () => void;
  /** Depois de gravar: descarta a carga do workspace e relê. */
  onSaved: () => Promise<void>;
}

/**
 * Cadastro das etapas do quadro e dos tipos de tratativa do NPS.
 *
 * Eram duas listas fixas no código — as quatro colunas e os sete tipos
 * do guia. O quadro do Reclame Aqui já deixava criar etapa; o do NPS
 * não, e o processo do NPS muda tanto quanto o outro.
 *
 * Três coisas que este cadastro precisa acertar, e que não são óbvias:
 *
 * - **Etapa final não é igual às outras.** Quem encerra o ciclo carimba
 *   `closedAt`, sai da fila e entra no indicador de resolução. Por isso
 *   a marcação existe — e por isso a gravação põe o prefixo
 *   `[Encerrado]` no nome: é ele que o resto da aplicação lê.
 * - **Etapa final precisa dizer quem chega nela.** Sem isso a etapa
 *   nasce inalcançável: o ciclo entra num tipo que não a lista e nunca
 *   encontra como encerrar.
 * - **A extensão sobe pela mesma escada.** Ela lê a lista que o
 *   servidor manda, não uma cópia — as duas pontas não podem discordar
 *   sobre qual é o próximo passo.
 */
export default function StageManager({
  etapas,
  tipos,
  onClose,
  onSaved,
}: Props) {

  const [aba, setAba] = useState<"etapas" | "tipos">(
    "etapas"
  );

  const rascunhoEtapas = useRascunho<NpsStageOption>(
    etapas,
    (item) => sincronizar(() => saveNpsStage(item))
  );

  const rascunhoTipos = useRascunho<NpsKindOption>(
    tipos,
    (item) => sincronizar(() => saveNpsKind(item))
  );

  async function fechar() {
    await onSaved();
    onClose();
  }

  return (
    <Modal
      open
      title="Etapas e tipos do NPS"
      description="Duas listas que definem o quadro: por onde o ciclo passa e como ele é classificado."
      size="wide"
      onClose={fechar}
      footer={
        <GhostButton onClick={fechar}>
          Fechar
        </GhostButton>
      }
    >

      <div className="space-y-4">

        <div className="flex gap-1 rounded-lg bg-zinc-100 p-0.5">
          {(
            [
              ["etapas", "Etapas do quadro"],
              ["tipos", "Tipos de tratativa"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${aba === id ? "bg-white text-violet-700 shadow-sm" : "text-zinc-600 hover:text-zinc-800"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/*
          Uma linha dizendo **para que serve a aba aberta**.

          O título do modal cobre as duas, e quem abre pela primeira vez
          não tem como saber a diferença entre "etapa" e "tipo" — são
          conceitos do processo, não do produto.
        */}
        <p className="text-xs leading-relaxed text-zinc-500">
          {aba === "etapas"
            ? "As colunas do quadro do NPS: por onde a tratativa caminha, em que ordem, e quais colunas encerram o ciclo."
            : "Como cada resposta é classificada — e o que essa classificação passa a exigir antes de deixar encerrar."}
        </p>

        {aba === "etapas" ? (
          <Etapas
            rascunho={rascunhoEtapas}
            tipos={rascunhoTipos.itens}
            onSaved={onSaved}
          />
        ) : (
          <Tipos
            rascunho={rascunhoTipos}
            etapas={rascunhoEtapas.itens}
            onSaved={onSaved}
          />
        )}

      </div>

    </Modal>
  );
}

/* ============================================================
   PEÇAS COMPARTILHADAS PELAS DUAS ABAS
============================================================ */

/**
 * Campo com rótulo em cima.
 *
 * A versão anterior não tinha rótulo nenhum: os campos eram
 * distinguidos por largura e por `title`, e o resultado é o que o Isaac
 * viu — uma caixa larga vazia, uma bolinha colorida no meio, e nenhuma
 * pista do que era cada uma.
 */
function Campo({
  rotulo,
  dica,
  children,
}: {
  rotulo: string;
  dica?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">

      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {rotulo}
        {dica && (
          <span className="ml-1 font-normal normal-case tracking-normal text-zinc-400">
            {dica}
          </span>
        )}
      </span>

      {children}

    </label>
  );
}

/**
 * Caixa de marcar com o motivo **visível**.
 *
 * O motivo morava num `title`: aparecia depois de um segundo parado com
 * o mouse em cima, e nunca em telefone. Quem configura isto faz uma vez
 * a cada muitos meses — é exatamente quem não lembra o que a opção faz.
 */
function Marcador({
  marcado,
  onChange,
  titulo,
  explicacao,
}: {
  marcado: boolean;
  onChange: (valor: boolean) => void;
  titulo: string;
  explicacao: string;
}) {
  return (
    <label
      className={`flex cursor-pointer gap-2.5 rounded-lg border p-2.5 transition-colors ${marcado ? "border-violet-200 bg-violet-50/50" : "border-zinc-200 hover:bg-zinc-50"}`}
    >

      <input
        type="checkbox"
        checked={marcado}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-violet-600"
      />

      <span className="min-w-0">

        <span
          className={`block text-xs font-medium ${marcado ? "text-violet-900" : "text-zinc-700"}`}
        >
          {titulo}
        </span>

        <span className="mt-0.5 block text-[11px] leading-relaxed text-zinc-500">
          {explicacao}
        </span>

      </span>

    </label>
  );
}

/* ============================================================
   ETAPAS
============================================================ */

function Etapas({
  rascunho,
  tipos,
  onSaved,
}: {
  rascunho: ReturnType<
    typeof useRascunho<NpsStageOption>
  >;
  tipos: NpsKindOption[];
  onSaved: () => Promise<void>;
}) {

  const ordenadas = [...rascunho.itens].sort(
    (a, b) => a.order - b.order
  );

  const andamento = emAndamento(rascunho.itens);

  async function excluir(etapa: NpsStageOption) {

    /**
     * Item que só existe no rascunho é esquecido, não apagado.
     *
     * Chamar a action com um id `novo-...` pediria ao banco para apagar
     * uma linha que nunca foi criada.
     */
    if (
      etapa.id.startsWith("novo-") ||
      etapa.id.startsWith("padrao-")
    ) {
      rascunho.esquecer(etapa.id);
      return;
    }

    await sincronizar(() => removeNpsStage(etapa.id));

    rascunho.esquecer(etapa.id);

    await onSaved();
  }

  return (
    <div className="space-y-3">

      <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">

        {ordenadas.map((etapa) => (
          <li
            key={etapa.id}
            className="space-y-3 px-4 py-3.5"
          >

            {/*
              O cabeçalho existe para a lista ser **percorrível**.

              Sem ele, catorze linhas de campos vazios em sequência não
              dizem qual é qual: a versão anterior mostrava só uma
              bolinha colorida no meio de uma caixa, e para descobrir de
              que etapa se tratava era preciso clicar dentro.
            */}
            <div className="flex items-center gap-2.5">

              <span
                aria-hidden
                className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                style={{ background: etapa.color }}
              />

              <strong className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-900">
                {rotuloDeEtapa(etapa.name) || (
                  <span className="font-normal text-zinc-400">
                    Etapa sem nome
                  </span>
                )}
              </strong>

              {etapa.final && (
                <span className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
                  encerra
                </span>
              )}

              {!etapa.active && (
                <span className="shrink-0 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                  inativa
                </span>
              )}

              <button
                onClick={() => excluir(etapa)}
                title="Excluir etapa"
                className="shrink-0 rounded-lg p-1.5 text-zinc-300 transition-colors hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 size={14} />
              </button>

            </div>

            {/*
              Grade que **quebra** em vez de estourar.

              A versão anterior era um `flex` com um campo `w-full` ao
              lado de três `shrink-0`: a soma passava da largura do
              modal, e o que sobrava era barra de rolagem horizontal com
              o campo do nome empurrado para fora da vista.
            */}
            <div className="grid gap-3 sm:grid-cols-[4rem_1fr_5.5rem]">

              <Campo rotulo="Cor">
                <input
                  type="color"
                  value={etapa.color}
                  onChange={(e) =>
                    rascunho.alterar(etapa.id, {
                      color: e.target.value,
                    })
                  }
                  className="h-9 w-full cursor-pointer rounded-lg border border-zinc-200 bg-white p-0.5"
                />
              </Campo>

              <Campo rotulo="Nome da etapa">
                <input
                  value={rotuloDeEtapa(etapa.name)}
                  onChange={(e) =>
                    rascunho.alterar(etapa.id, {
                      name: nomeDeEtapa(
                        e.target.value,
                        etapa.final
                      ),
                    })
                  }
                  placeholder="Ex.: Em tratativa"
                  className={`${inputClass} h-9`}
                />
              </Campo>

              <Campo
                rotulo="Posição"
                dica="ordem no quadro"
              >
                <input
                  type="number"
                  value={etapa.order}
                  onChange={(e) =>
                    rascunho.alterar(etapa.id, {
                      order: Number(e.target.value),
                    })
                  }
                  className={`${inputClass} h-9`}
                />
              </Campo>

            </div>

            <div className="space-y-1.5">

              <Marcador
                marcado={etapa.final}
                onChange={(valor) =>
                  rascunho.alterar(etapa.id, {
                    final: valor,
                    /*
                      O nome acompanha a marcação.

                      É o prefixo que o resto da aplicação lê — deixar
                      os dois divergirem é criar uma etapa que a tela
                      chama de final e o indicador não.
                    */
                    name: nomeDeEtapa(etapa.name, valor),
                  })
                }
                titulo="Esta etapa encerra o ciclo"
                explicacao="Carimba a data de fechamento, tira o ciclo da fila e conta no indicador de resolução. O nome ganha o prefixo [Encerrado], que é o que o resto do sistema lê."
              />

              <Marcador
                marcado={etapa.active}
                onChange={(valor) =>
                  rascunho.alterar(etapa.id, {
                    active: valor,
                  })
                }
                titulo="Aparece no quadro"
                explicacao="Desmarcada, a etapa some das colunas — mas o ciclo que já estava nela continua visível, para não desaparecer sem ninguém ter movido."
              />

            </div>

            {etapa.final && (

              <div className="rounded-xl bg-zinc-50 p-3">

                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Quem pode encerrar aqui
                </p>

                <p className="mb-2 mt-0.5 text-[11px] leading-relaxed text-zinc-500">
                  {etapa.kinds.length === 0
                    ? "Nenhum marcado — vale para todos os tipos."
                    : "Só os tipos marcados vão oferecer esta etapa como saída."}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {tipos
                    .filter((t) => t.active)
                    .map((tipo) => {

                      const marcado =
                        etapa.kinds.includes(tipo.name);

                      return (
                        <button
                          key={tipo.id}
                          onClick={() =>
                            rascunho.alterar(etapa.id, {
                              kinds: marcado
                                ? etapa.kinds.filter(
                                    (k) => k !== tipo.name
                                  )
                                : [
                                    ...etapa.kinds,
                                    tipo.name,
                                  ],
                            })
                          }
                          className={`rounded-lg px-2 py-1 text-[11px] font-medium ring-1 ring-inset transition-colors ${marcado ? "bg-violet-100 text-violet-800 ring-violet-300" : "bg-white text-zinc-500 ring-zinc-200 hover:bg-zinc-50"}`}
                        >
                          {tipo.emoji} {tipo.name}
                        </button>
                      );
                    })}
                </div>

              </div>

            )}

          </li>
        ))}

      </ul>

      <button
        onClick={() =>
          rascunho.adicionar({
            id: `novo-${Date.now()}`,
            name: "",
            color: "#7B3FBF",
            order: rascunho.itens.length,
            active: true,
            final: false,
            kinds: [],
          })
        }
        className="flex items-center gap-2 rounded-xl border border-dashed border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-600 transition-colors hover:border-violet-300 hover:text-violet-700"
      >
        <Plus size={15} />
        Nova etapa
      </button>

      {andamento.length === 0 && (
        <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700 ring-1 ring-inset ring-rose-100">
          Nenhuma etapa de andamento ativa: sem pelo menos
          uma, um ciclo novo não teria coluna onde nascer.
        </p>
      )}

      <p className="text-xs leading-relaxed text-zinc-500">
        Renomear uma etapa arrasta os ciclos junto — a
        resposta guarda o nome do status, não o id, e sem
        isso eles sumiriam do quadro sem ninguém ter
        movido nada. Excluir uma etapa que já tem ciclo
        parado nela apenas a desativa, pelo mesmo motivo.
      </p>

      <BarraDeSalvar
        rascunho={rascunho}
        nome="etapas"
        genero="f"
      />

    </div>
  );
}

/* ============================================================
   TIPOS
============================================================ */

function Tipos({
  rascunho,
  etapas,
  onSaved,
}: {
  rascunho: ReturnType<
    typeof useRascunho<NpsKindOption>
  >;
  /** Para saber quem ficou sem por onde sair. */
  etapas: NpsStageOption[];
  onSaved: () => Promise<void>;
}) {

  const ordenados = [...rascunho.itens].sort(
    (a, b) => a.order - b.order
  );

  /**
   * Tipos ativos que nenhuma etapa final aceita.
   *
   * `finaisDoTipo` já responde isso — é a mesma função que a gaveta
   * usa para desenhar os botões de encerrar. Perguntar aqui com ela, e
   * não com uma varredura própria, é o que garante que o aviso e o
   * comportamento nunca discordem.
   */
  const semFinal = rascunho.itens
    .filter(
      (tipo) =>
        tipo.active &&
        tipo.name.trim() !== "" &&
        finaisDoTipo(etapas, tipo.name).length === 0
    )
    .map((tipo) => tipo.name);

  async function excluir(tipo: NpsKindOption) {

    if (
      tipo.id.startsWith("novo-") ||
      tipo.id.startsWith("padrao-")
    ) {
      rascunho.esquecer(tipo.id);
      return;
    }

    await sincronizar(() => removeNpsKind(tipo.id));

    rascunho.esquecer(tipo.id);

    await onSaved();
  }

  return (
    <div className="space-y-3">

      <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">

        {ordenados.map((tipo) => (
          <li
            key={tipo.id}
            className="space-y-3 px-4 py-3.5"
          >

            <div className="flex items-center gap-2.5">

              <span
                aria-hidden
                className="shrink-0 text-base leading-none"
              >
                {tipo.emoji || "⚪"}
              </span>

              <strong className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-900">
                {tipo.name || (
                  <span className="font-normal text-zinc-400">
                    Tipo sem nome
                  </span>
                )}
              </strong>

              {!tipo.active && (
                <span className="shrink-0 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                  inativo
                </span>
              )}

              <button
                onClick={() => excluir(tipo)}
                title="Excluir tipo"
                className="shrink-0 rounded-lg p-1.5 text-zinc-300 transition-colors hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 size={14} />
              </button>

            </div>

            <div className="grid gap-3 sm:grid-cols-[4rem_1fr_7rem]">

              <Campo rotulo="Emoji">
                <input
                  value={tipo.emoji}
                  onChange={(e) =>
                    rascunho.alterar(tipo.id, {
                      emoji: e.target.value.slice(0, 4),
                    })
                  }
                  placeholder="⚪"
                  className={`${inputClass} h-9 text-center`}
                />
              </Campo>

              <Campo rotulo="Nome do tipo">
                <input
                  value={tipo.name}
                  onChange={(e) =>
                    rascunho.alterar(tipo.id, {
                      name: e.target.value,
                    })
                  }
                  placeholder="Ex.: Reclamação"
                  className={`${inputClass} h-9`}
                />
              </Campo>

              <Campo
                rotulo="Prazo"
                dica="horas úteis; vazio usa o do segmento"
              >
                <input
                  type="number"
                  value={tipo.ownDeadlineHours ?? ""}
                  onChange={(e) =>
                    rascunho.alterar(tipo.id, {
                      ownDeadlineHours: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                  placeholder="—"
                  className={`${inputClass} h-9`}
                />
              </Campo>

            </div>

            {/*
              As travas, com a explicação **na tela**.

              Eram três caixas com rótulo de quatro palavras e o motivo
              escondido num `title`. Quem nunca configurou isso não tem
              como adivinhar que "exige causa raiz" trava o encerramento
              — e tooltip não existe em telefone.
            */}
            <div className="space-y-1.5">

              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                O que este tipo exige
              </p>

              <Marcador
                marcado={tipo.requiresConfirmation}
                onChange={(valor) =>
                  rascunho.alterar(tipo.id, {
                    requiresConfirmation: valor,
                  })
                }
                titulo="Confirmar com o cliente antes de encerrar"
                explicacao="Enquanto o cliente não responder ao reengajamento, o ciclo não pode ir para uma etapa de encerramento."
              />

              <Marcador
                marcado={tipo.requiresRootCause}
                onChange={(valor) =>
                  rascunho.alterar(tipo.id, {
                    requiresRootCause: valor,
                  })
                }
                titulo="Registrar a causa raiz"
                explicacao="O encerramento fica travado enquanto ninguém marcar a causa. É o que faz a análise de tendência ter o que agrupar."
              />

              <Marcador
                marcado={tipo.opensProcessReview}
                onChange={(valor) =>
                  rascunho.alterar(tipo.id, {
                    opensProcessReview: valor,
                  })
                }
                titulo="Abrir revisão de processo"
                explicacao="Ao classificar o ciclo com este tipo, um item é criado em Projetos e Melhorias — para o problema virar trabalho, e não só registro."
              />

              <Marcador
                marcado={tipo.active}
                onChange={(valor) =>
                  rascunho.alterar(tipo.id, {
                    active: valor,
                  })
                }
                titulo="Aparece na classificação"
                explicacao="Desmarcado, o tipo deixa de ser oferecido nas tratativas novas. Os ciclos que já o usam continuam como estão."
              />

            </div>

            <Campo
              rotulo="O que fazer com este tipo"
              dica="aparece na ficha da tratativa"
            >
              <textarea
                value={tipo.action}
                onChange={(e) =>
                  rascunho.alterar(tipo.id, {
                    action: e.target.value,
                  })
                }
                rows={2}
                placeholder="Ex.: contatar em até 48 h úteis, registrar e enviar link de acompanhamento."
                className={`${inputClass} h-auto resize-y py-2 text-xs leading-relaxed`}
              />
            </Campo>

          </li>
        ))}

      </ul>

      <button
        onClick={() =>
          rascunho.adicionar({
            id: `novo-${Date.now()}`,
            name: "",
            emoji: "⚪",
            color: "#71717A",
            action: "",
            requiresConfirmation: false,
            requiresRootCause: false,
            opensProcessReview: false,
            order: rascunho.itens.length,
            active: true,
          })
        }
        className="flex items-center gap-2 rounded-xl border border-dashed border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-600 transition-colors hover:border-violet-300 hover:text-violet-700"
      >
        <Plus size={15} />
        Novo tipo
      </button>

      {/*
        O aviso que fecha o beco.

        Criar um tipo e esquecer de marcá-lo em alguma etapa final
        produz um ciclo que entra e nunca sai. A gaveta da tratativa já
        avisava — mas só quando alguém já estava preso lá dentro, com a
        classificação feita. Aqui o aviso aparece no momento em que o
        buraco é criado, que é quando ainda custa um clique consertar.
      */}
      {semFinal.length > 0 && (
        <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-800 ring-1 ring-inset ring-amber-100">
          <strong className="font-semibold">
            {semFinal.length === 1
              ? `O tipo "${semFinal[0]}" não tem etapa final.`
              : `${semFinal.length} tipos não têm etapa final: ${semFinal.join(", ")}.`}
          </strong>{" "}
          Um ciclo classificado assim entra e não encontra
          como sair. Marque-o em alguma etapa de
          encerramento, na aba ao lado — ou deixe a etapa
          sem tipo nenhum, que vale para todos.
        </p>
      )}

      <p className="text-xs leading-relaxed text-zinc-500">
        A lista continua <strong>fechada</strong>, e não um
        campo livre: o tipo alimenta a análise de
        tendência, e texto aberto transformaria
        &ldquo;Reclamação&rdquo; e &ldquo;reclamacao&rdquo;
        em dois problemas diferentes no mesmo gráfico.
      </p>

      <BarraDeSalvar rascunho={rascunho} nome="tipos" />

    </div>
  );
}
