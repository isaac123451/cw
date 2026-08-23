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

import { TeamDraft } from "@/lib/context/TeamsContext";
import { Team } from "@/lib/models/team";

const DEPARTAMENTOS = [
  "Experiência do Cliente",
  "Suporte",
  "Fiscal",
  "Financeiro",
  "Tecnologia",
  "Produto",
  "Comercial",
  "Implantação",
  "Qualidade",
];

interface Props {
  open: boolean;
  editing?: Team;
  onClose: () => void;
  onSave: (data: TeamDraft) => void;
}

export default function TeamForm({
  open,
  editing,
  onClose,
  onSave,
}: Props) {

  /**
   * Os campos nascem preenchidos, e o formulário remonta a cada
   * abertura.
   *
   * Era um `useEffect` que copiava `editing` para o estado quando o
   * modal abria. Funcionava, mas ao custo de uma renderização a mais
   * por abertura — e de uma janela em que o formulário já estava na
   * tela com os campos do registro anterior. Quem abre passa `key`, e
   * é ela que garante instância nova.
   */
  const [name, setName] = useState(
    editing?.name ?? ""
  );
  const [description, setDescription] = useState(
    editing?.description ?? ""
  );
  const [department, setDepartment] = useState(
    editing?.department ?? DEPARTAMENTOS[0]
  );
  const [leader, setLeader] = useState(
    editing?.leader ?? ""
  );
  const [active, setActive] = useState(
    editing?.active ?? true
  );

  const valido = name.trim() !== "";

  return (
    <Modal
      open={open}
      title={editing ? "Editar time" : "Novo time"}
      description="Times usados para classificar responsáveis e áreas envolvidas."
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>
            Cancelar
          </GhostButton>

          <PrimaryButton
            onClick={() =>
              valido &&
              onSave({
                name: name.trim(),
                description: description.trim(),
                department,
                leader: leader.trim(),
                active,
              })
            }
            disabled={!valido}
          >
            <Save size={15} />
            {editing ? "Salvar" : "Criar time"}
          </PrimaryButton>
        </>
      }
    >

      <div className="space-y-5">

        <Field label="Nome do time">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Reputação"
            className={inputClass}
          />
        </Field>

        <Field label="Descrição">
          <textarea
            value={description}
            onChange={(e) =>
              setDescription(e.target.value)
            }
            rows={2}
            placeholder="O que este time faz"
            className={textareaClass}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">

          <Field label="Departamento">
            <select
              value={department}
              onChange={(e) =>
                setDepartment(e.target.value)
              }
              className={inputClass}
            >
              {DEPARTAMENTOS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Responsável pelo time">
            <input
              value={leader}
              onChange={(e) => setLeader(e.target.value)}
              placeholder="Quem lidera"
              className={inputClass}
            />
          </Field>

        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-3.5">

          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-violet-600"
          />

          <span>

            <span className="block text-sm font-medium text-zinc-800">
              Time ativo
            </span>

            <span className="mt-0.5 block text-xs text-zinc-500">
              Times inativos somem dos seletores, mas
              continuam visíveis para consulta de histórico.
            </span>

          </span>

        </label>

      </div>

    </Modal>
  );
}
