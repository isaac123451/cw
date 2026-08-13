"use client";

import { useState } from "react";

import { Save } from "lucide-react";

import Modal, {
  Field,
  GhostButton,
  PrimaryButton,
  inputClass,
  textareaClass,
} from "@/components/shared/Modal";

import { MovementRule } from "@/lib/models/movement";
import { MovementRuleDraft } from "@/lib/context/MovementsContext";

interface Props {
  editing?: MovementRule;
  onClose: () => void;
  onSave: (data: MovementRuleDraft | MovementRule) => void;
}

/**
 * Prazo padrão de retorno de um destino.
 *
 * Monta e desmonta junto com a abertura (o pai só renderiza quando
 * `open`), então o estado inicial sai do `useState` — sem o efeito de
 * reset que os formulários mais antigos usam.
 */
export default function MovementRuleForm({
  editing,
  onClose,
  onSave,
}: Props) {

  const [destination, setDestination] = useState(
    editing?.destination ?? ""
  );

  const [hours, setHours] = useState(
    String(editing?.hours ?? 24)
  );

  const [note, setNote] = useState(editing?.note ?? "");

  const [active, setActive] = useState(
    editing?.active ?? true
  );

  const prazo = Number(hours);

  const valido =
    destination.trim() !== "" &&
    Number.isFinite(prazo) &&
    prazo > 0;

  function salvar() {
    if (!valido) return;

    const dados = {
      destination: destination.trim(),
      hours: prazo,
      note: note.trim() === "" ? undefined : note.trim(),
      active,
    };

    onSave(
      editing ? { ...dados, id: editing.id } : dados
    );
  }

  return (
    <Modal
      open
      title={
        editing
          ? "Editar destino"
          : "Novo destino de movimentação"
      }
      description="Prazo que a área tem para devolver o caso à Reputação."
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
            <Save size={16} />
            Salvar
          </PrimaryButton>
        </>
      }
    >

      <div className="space-y-4">

        <Field
          label="Destino"
          hint="Uma área interna ou o próprio cliente."
        >
          <input
            value={destination}
            onChange={(e) =>
              setDestination(e.target.value)
            }
            placeholder="Ex.: Adoção"
            className={inputClass}
          />
        </Field>

        <Field
          label="Prazo de retorno (horas)"
          hint="Vem preenchido no encaminhamento e continua editável caso a caso."
        >
          <input
            type="number"
            min={1}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Quando usar">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Ex.: erro de sistema que precisa de investigação técnica."
            className={textareaClass}
          />
        </Field>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-zinc-700">

          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 accent-violet-600"
          />

          Destino ativo — aparece na lista ao encaminhar
        </label>

      </div>

    </Modal>
  );
}
