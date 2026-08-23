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
      description="As colunas do quadro e os sete tipos de tratativa — os dois deixaram de ser lista fixa no código."
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
          <li key={etapa.id} className="space-y-2 px-3.5 py-3">

            <div className="flex items-center gap-2">

              <input
                type="color"
                value={etapa.color}
                onChange={(e) =>
                  rascunho.alterar(etapa.id, {
                    color: e.target.value,
                  })
                }
                title="Cor da coluna"
                className="h-8 w-8 shrink-0 cursor-pointer rounded-lg border border-zinc-200 bg-white p-0.5"
              />

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
                placeholder="Nome da etapa"
                className={`${inputClass} h-8 py-1`}
              />

              <input
                type="number"
                value={etapa.order}
                onChange={(e) =>
                  rascunho.alterar(etapa.id, {
                    order: Number(e.target.value),
                  })
                }
                title="Ordem no quadro"
                className={`${inputClass} h-8 w-16 shrink-0 py-1`}
              />

              <label
                title="Encerra o ciclo: carimba a data de fechamento, tira da fila e entra no indicador de resolução."
                className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-600"
              >
                <input
                  type="checkbox"
                  checked={etapa.final}
                  onChange={(e) =>
                    rascunho.alterar(etapa.id, {
                      final: e.target.checked,
                      /*
                        O nome acompanha a marcação.

                        É o prefixo que o resto da aplicação lê — deixar
                        os dois divergirem é criar uma etapa que a tela
                        chama de final e o indicador não.
                      */
                      name: nomeDeEtapa(
                        etapa.name,
                        e.target.checked
                      ),
                    })
                  }
                />
                encerra
              </label>

              <label
                title="Etapa desativada some do quadro, mas o ciclo parado nela continua aparecendo."
                className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-600"
              >
                <input
                  type="checkbox"
                  checked={etapa.active}
                  onChange={(e) =>
                    rascunho.alterar(etapa.id, {
                      active: e.target.checked,
                    })
                  }
                />
                ativa
              </label>

              <button
                onClick={() => excluir(etapa)}
                title="Excluir"
                className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 size={14} />
              </button>

            </div>

            {etapa.final && (

              <div className="pl-10">

                <p className="mb-1 text-[11px] text-zinc-500">
                  Quais tipos podem encerrar aqui
                  {etapa.kinds.length === 0 &&
                    " — nenhum marcado significa todos"}
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
                          className={`rounded-lg px-2 py-1 text-[11px] font-medium ring-1 ring-inset transition-colors ${marcado ? "bg-violet-50 text-violet-700 ring-violet-200" : "text-zinc-500 ring-zinc-200 hover:bg-zinc-50"}`}
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
          <li key={tipo.id} className="space-y-2 px-3.5 py-3">

            <div className="flex items-center gap-2">

              <input
                value={tipo.emoji}
                onChange={(e) =>
                  rascunho.alterar(tipo.id, {
                    emoji: e.target.value.slice(0, 4),
                  })
                }
                title="Emoji"
                className={`${inputClass} h-8 w-12 shrink-0 py-1 text-center`}
              />

              <input
                value={tipo.name}
                onChange={(e) =>
                  rascunho.alterar(tipo.id, {
                    name: e.target.value,
                  })
                }
                placeholder="Nome do tipo"
                className={`${inputClass} h-8 py-1`}
              />

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
                title="Prazo próprio em horas úteis. Vazio usa o prazo do segmento."
                className={`${inputClass} h-8 w-20 shrink-0 py-1`}
              />

              <label className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-600">
                <input
                  type="checkbox"
                  checked={tipo.active}
                  onChange={(e) =>
                    rascunho.alterar(tipo.id, {
                      active: e.target.checked,
                    })
                  }
                />
                ativo
              </label>

              <button
                onClick={() => excluir(tipo)}
                title="Excluir"
                className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 size={14} />
              </button>

            </div>

            <div className="flex flex-wrap gap-3 pl-14 text-xs text-zinc-600">

              {(
                [
                  [
                    "requiresConfirmation",
                    "exige confirmação do cliente",
                    "Sem a resposta de reengajamento, o ciclo não vai para resolvido.",
                  ],
                  [
                    "requiresRootCause",
                    "exige causa raiz",
                    "Trava o encerramento enquanto a causa não estiver marcada.",
                  ],
                  [
                    "opensProcessReview",
                    "abre revisão de processo",
                    "Ao classificar, cria um item em Projetos e Melhorias.",
                  ],
                ] as const
              ).map(([campo, label, dica]) => (
                <label
                  key={campo}
                  title={dica}
                  className="flex items-center gap-1.5"
                >
                  <input
                    type="checkbox"
                    checked={tipo[campo]}
                    onChange={(e) =>
                      rascunho.alterar(tipo.id, {
                        [campo]: e.target.checked,
                      })
                    }
                  />
                  {label}
                </label>
              ))}

            </div>

            <textarea
              value={tipo.action}
              onChange={(e) =>
                rascunho.alterar(tipo.id, {
                  action: e.target.value,
                })
              }
              rows={2}
              placeholder="O que fazer com este tipo — aparece na ficha da tratativa."
              className={`${inputClass} ml-14 w-[calc(100%-3.5rem)] py-1.5 text-xs`}
            />

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
