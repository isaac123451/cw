"use client";

import { useEffect, useState } from "react";

import { Save } from "lucide-react";

import Modal, {
  Field,
  GhostButton,
  PrimaryButton,
  inputClass,
  textareaClass,
} from "@/components/shared/Modal";

import { JourneyStage } from "@/lib/models/journey";

/** Paleta das etapas — mesma linguagem de cor do resto da plataforma. */
const CORES = [
  "#6D28D9",
  "#0EA5E9",
  "#22C55E",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
  "#14B8A6",
  "#71717A",
];

interface Props {
  open: boolean;
  editing?: JourneyStage;
  /** Ordem sugerida para uma etapa nova: última da fila. */
  nextOrder: number;
  onClose: () => void;
  onSave: (data: JourneyStage) => void;
}

export default function StageForm({
  open,
  editing,
  nextOrder,
  onClose,
  onSave,
}: Props) {

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(CORES[0]);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!open) return;

    if (editing) {
      setName(editing.name);
      setDescription(editing.description);
      setColor(editing.color);
      setActive(editing.active);
      return;
    }

    setName("");
    setDescription("");
    setColor(CORES[0]);
    setActive(true);
  }, [open, editing]);

  const valido = name.trim() !== "";

  function salvar() {

    if (!valido) return;

    onSave({
      id: editing?.id ?? crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
      color,
      order: editing?.order ?? nextOrder,
      active,
    });
  }

  return (
    <Modal
      open={open}
      title={editing ? "Editar etapa" : "Nova etapa"}
      description="Colunas do ciclo de vida do cliente no quadro da Jornada."
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>
            Cancelar
          </GhostButton>

          <PrimaryButton
            onClick={salvar}
            disabled={!valido}
          >
            <Save size={15} />
            {editing ? "Salvar" : "Criar etapa"}
          </PrimaryButton>
        </>
      }
    >

      <div className="space-y-5">

        <Field label="Nome da etapa">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Em recuperação"
            className={inputClass}
          />
        </Field>

        <Field
          label="Descrição"
          hint="Aparece no topo da coluna e ajuda o time a classificar igual."
        >
          <textarea
            value={description}
            onChange={(e) =>
              setDescription(e.target.value)
            }
            rows={2}
            placeholder="O que caracteriza um cliente nesta etapa"
            className={textareaClass}
          />
        </Field>

        <Field label="Cor">

          <div className="flex flex-wrap gap-2">

            {CORES.map((item) => (

              <button
                key={item}
                onClick={() => setColor(item)}
                title={item}
                style={{ background: item }}
                className={`h-9 w-9 rounded-xl transition-transform ${
                  color === item
                    ? "scale-110 ring-2 ring-zinc-900 ring-offset-2"
                    : "hover:scale-105"
                }`}
              />

            ))}

          </div>

        </Field>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-3.5">

          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-violet-700"
          />

          <span>

            <span className="block text-sm font-medium text-zinc-800">
              Etapa ativa
            </span>

            <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">
              Etapas inativas somem do quadro, mas o
              histórico de quem passou por elas é mantido.
            </span>

          </span>

        </label>

      </div>

    </Modal>
  );
}
