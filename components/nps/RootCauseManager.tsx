"use client";

import { useState } from "react";

import { Plus, Trash2 } from "lucide-react";

import Modal, {
  GhostButton,
  inputClass,
} from "@/components/shared/Modal";

import BarraDeSalvar from "@/components/shared/BarraDeSalvar";

import { useRascunho } from "@/lib/hooks/useRascunho";
import type { Gravacao } from "@/lib/context/sync";

import { RootCauseOption } from "@/lib/models/nps";

interface Props {
  causas: RootCauseOption[];
  onClose: () => void;
  onSave: (
    causa: RootCauseOption
  ) => Promise<Gravacao>;
  onRemove: (causa: RootCauseOption) => Promise<void>;
}

/**
 * Cadastro de causa raiz.
 *
 * Era uma lista fixa no código; virou cadastro porque a operação
 * descobre categoria nova toda semana e não pode esperar deploy para
 * registrar. Continua **fechada** — um `select`, nunca um campo livre:
 * causa raiz existe para ver tendência, e texto livre transformaria
 * "cobrança", "Cobrança" e "cobranca" em três problemas distintos no
 * mesmo gráfico.
 *
 * **Editar não grava; o botão Salvar grava.** Antes renomear era um
 * lápis, um campo e um `Enter` que ia direto ao banco — e o `Enter`
 * fechava o campo mesmo quando a gravação falhava. Agora a edição é no
 * próprio lugar, como no resto dos cadastros.
 *
 * Excluir uma causa **já usada** desativa em vez de apagar. Apagar
 * reescreveria o passado: as respostas que apontam para ela ficariam
 * sem causa, e a série histórica mudaria sozinha.
 */
export default function RootCauseManager({
  causas,
  onClose,
  onSave,
  onRemove,
}: Props) {

  const rascunho = useRascunho(causas, onSave);

  const [removendo, setRemovendo] = useState<string>();

  const ordenadas = [...rascunho.itens].sort(
    (a, b) => a.order - b.order
  );

  async function excluir(causa: RootCauseOption) {

    /**
     * Causa que só existe no rascunho é esquecida, não apagada.
     *
     * Mandar o servidor apagar um id `padrao-3` — ou um que ainda não
     * foi gravado — devolveria erro sobre uma linha que nunca existiu.
     */
    if (
      causa.id.startsWith("padrao-") ||
      !causas.some((item) => item.id === causa.id)
    ) {
      rascunho.esquecer(causa.id);
      return;
    }

    setRemovendo(causa.id);

    await onRemove(causa);

    rascunho.esquecer(causa.id);

    setRemovendo(undefined);
  }

  return (
    <Modal
      open
      title="Causa raiz"
      description="A lista que aparece no registro de uma resposta. Fechada de propósito — é o que faz a tendência ser comparável."
      onClose={onClose}
      footer={
        <GhostButton onClick={onClose}>
          Fechar
        </GhostButton>
      }
    >

      <div className="space-y-4">

        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">

          {ordenadas.length === 0 && (
            <li className="px-3.5 py-8 text-center text-sm text-zinc-400">
              Nenhuma causa cadastrada.
            </li>
          )}

          {ordenadas.map((causa) => (
            <li
              key={causa.id}
              className="flex items-center gap-2 px-3.5 py-2.5"
            >

              <input
                value={causa.name}
                onChange={(e) =>
                  rascunho.alterar(causa.id, {
                    name: e.target.value,
                  })
                }
                placeholder="Nome da causa"
                className={`${inputClass} h-8 py-1 ${causa.active ? "" : "text-zinc-400 line-through"}`}
              />

              <label
                title="Causa desativada some do formulário, mas continua no registro que já a usava."
                className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-600"
              >
                <input
                  type="checkbox"
                  checked={causa.active}
                  onChange={(e) =>
                    rascunho.alterar(causa.id, {
                      active: e.target.checked,
                    })
                  }
                />
                ativa
              </label>

              <button
                onClick={() => excluir(causa)}
                disabled={removendo === causa.id}
                title="Excluir"
                className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
              >
                <Trash2 size={14} />
              </button>

            </li>
          ))}

        </ul>

        <button
          onClick={() =>
            rascunho.adicionar({
              id: `novo-${Date.now()}`,
              name: "",
              order: rascunho.itens.length,
              active: true,
            })
          }
          className="flex items-center gap-2 rounded-xl border border-dashed border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-600 transition-colors hover:border-violet-300 hover:text-violet-700"
        >
          <Plus size={15} />
          Nova causa
        </button>

        <p className="text-xs leading-relaxed text-zinc-500">
          Renomear arrasta as respostas junto — elas
          guardam o nome, e sem isso a causa antiga e a
          nova apareceriam como coisas diferentes no
          gráfico. Excluir uma causa que já foi usada
          apenas a desativa, pelo mesmo motivo.
        </p>

        <BarraDeSalvar
          rascunho={rascunho}
          nome="causas"
          genero="f"
        />

      </div>

    </Modal>
  );
}
