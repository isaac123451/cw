"use client";

import { useState } from "react";

import { Check, Pencil, Plus, Trash2, X } from "lucide-react";

import Modal, {
  GhostButton,
  inputClass,
  PrimaryButton,
} from "@/components/shared/Modal";

import { RootCauseOption } from "@/lib/models/nps";

interface Props {
  causas: RootCauseOption[];
  salvando: boolean;
  onClose: () => void;
  onSave: (causa: RootCauseOption) => Promise<void>;
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
 * Excluir uma causa **já usada** desativa em vez de apagar. Apagar
 * reescreveria o passado: as respostas que apontam para ela ficariam
 * sem causa, e a série histórica mudaria sozinha.
 */
export default function RootCauseManager({
  causas,
  salvando,
  onClose,
  onSave,
  onRemove,
}: Props) {

  const [nova, setNova] = useState("");
  const [editando, setEditando] = useState<string>();
  const [rascunho, setRascunho] = useState("");

  async function criar() {

    const nome = nova.trim();

    if (nome === "") return;

    await onSave({
      id: "",
      name: nome,
      order: causas.length,
      active: true,
    });

    setNova("");
  }

  async function renomear(causa: RootCauseOption) {

    const nome = rascunho.trim();

    if (nome === "" || nome === causa.name) {
      setEditando(undefined);
      return;
    }

    await onSave({ ...causa, name: nome });

    setEditando(undefined);
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

        <div className="flex gap-2">

          <input
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") criar();
            }}
            placeholder="Nova causa — ex.: Integração com iFood"
            className={inputClass}
          />

          <PrimaryButton
            onClick={criar}
            disabled={salvando || nova.trim() === ""}
          >
            <Plus size={15} />
            Adicionar
          </PrimaryButton>

        </div>

        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">

          {causas.length === 0 && (
            <li className="px-3.5 py-8 text-center text-sm text-zinc-400">
              Nenhuma causa cadastrada.
            </li>
          )}

          {causas.map((causa) => (
            <li
              key={causa.id}
              className="flex items-center gap-2 px-3.5 py-2.5"
            >

              {editando === causa.id ? (

                <>
                  <input
                    autoFocus
                    value={rascunho}
                    onChange={(e) =>
                      setRascunho(e.target.value)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        renomear(causa);
                      }
                      if (e.key === "Escape") {
                        setEditando(undefined);
                      }
                    }}
                    className={`${inputClass} h-8 py-1`}
                  />

                  <button
                    onClick={() => renomear(causa)}
                    title="Salvar"
                    className="shrink-0 rounded-lg p-1.5 text-emerald-600 transition-colors hover:bg-emerald-50"
                  >
                    <Check size={15} />
                  </button>

                  <button
                    onClick={() => setEditando(undefined)}
                    title="Cancelar"
                    className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-50"
                  >
                    <X size={15} />
                  </button>
                </>

              ) : (

                <>
                  <span
                    className={`min-w-0 flex-1 truncate text-sm ${causa.active ? "text-zinc-800" : "text-zinc-400 line-through"}`}
                  >
                    {causa.name}
                  </span>

                  {!causa.active && (
                    <button
                      onClick={() =>
                        onSave({ ...causa, active: true })
                      }
                      className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium text-violet-600 transition-colors hover:bg-violet-50"
                    >
                      Reativar
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setEditando(causa.id);
                      setRascunho(causa.name);
                    }}
                    title="Renomear"
                    className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-700"
                  >
                    <Pencil size={14} />
                  </button>

                  <button
                    onClick={() => onRemove(causa)}
                    title="Excluir"
                    className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </>

              )}

            </li>
          ))}

        </ul>

        <p className="text-xs leading-relaxed text-zinc-500">
          Renomear arrasta as respostas junto — elas guardam o nome, e sem isso a causa antiga e a nova apareceriam como coisas diferentes no gráfico. Excluir uma causa que já foi usada apenas a desativa, pelo mesmo motivo.
        </p>

      </div>

    </Modal>
  );
}
