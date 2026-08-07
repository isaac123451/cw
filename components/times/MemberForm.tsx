"use client";

import { useEffect, useState } from "react";

import { Save } from "lucide-react";

import Modal, {
  Field,
  GhostButton,
  PrimaryButton,
  inputClass,
} from "@/components/shared/Modal";

import { MemberDraft } from "@/lib/context/TeamsContext";
import { TeamMember } from "@/lib/models/team";

import { ALLOWED_DOMAIN } from "@/lib/auth/access";

/** Cargos usados na operação. O campo aceita texto livre também. */
const CARGOS = [
  "Coordenador de Reputação",
  "Analista de Reputação",
  "Especialista em Retenção",
  "Coordenador de Suporte",
  "Analista de Suporte",
  "Especialista Fiscal",
  "Analista Fiscal",
  "Analista Financeiro",
  "Tech Lead",
  "Engenheiro de Software",
  "Analista de Implantação",
  "Gerente",
];

interface Props {
  open: boolean;
  editing?: TeamMember;
  teamName: string;
  onClose: () => void;
  onSave: (data: MemberDraft) => void;
}

export default function MemberForm({
  open,
  editing,
  teamName,
  onClose,
  onSave,
}: Props) {

  const [name, setName] = useState("");
  const [role, setRole] = useState(CARGOS[1]);
  const [email, setEmail] = useState("");
  const [online, setOnline] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (editing) {
      setName(editing.name);
      setRole(editing.role);
      setEmail(editing.email);
      setOnline(editing.online);
      return;
    }

    setName("");
    setRole(CARGOS[1]);
    setEmail("");
    setOnline(false);
  }, [open, editing]);

  /** Sugere o e-mail corporativo a partir do nome. */
  function sugerirEmail(valor: string) {

    if (editing || email !== "") return;

    const slug = valor
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/\s+/)
      .slice(0, 2)
      .join(".");

    if (slug) setEmail(`${slug}@${ALLOWED_DOMAIN}`);
  }

  const emailValido =
    email.trim() === "" ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const valido =
    name.trim() !== "" &&
    email.trim() !== "" &&
    emailValido;

  return (
    <Modal
      open={open}
      title={
        editing ? "Editar integrante" : "Novo integrante"
      }
      description={`Pessoa do time ${teamName}. Aparece como responsável nos casos e atividades.`}
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
                role: role.trim(),
                email: email.trim().toLowerCase(),
                online,
                openCases: editing?.openCases ?? 0,
              })
            }
            disabled={!valido}
          >
            <Save size={15} />
            {editing ? "Salvar" : "Adicionar"}
          </PrimaryButton>
        </>
      }
    >

      <div className="space-y-5">

        <Field label="Nome completo">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={(e) => sugerirEmail(e.target.value)}
            placeholder="Nome da pessoa"
            className={inputClass}
          />
        </Field>

        <Field
          label="Cargo"
          hint="Escolha um da lista ou digite outro."
        >

          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            list="cargos-operacao"
            placeholder="Ex.: Analista de Reputação"
            className={inputClass}
          />

          <datalist id="cargos-operacao">
            {CARGOS.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>

        </Field>

        <Field
          label="E-mail corporativo"
          hint={
            emailValido
              ? `Sugerido automaticamente a partir do nome.`
              : "E-mail inválido."
          }
        >
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={`nome@${ALLOWED_DOMAIN}`}
            className={`${inputClass} ${
              emailValido
                ? ""
                : "border-rose-300 focus:border-rose-400"
            }`}
          />
        </Field>

        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 p-3.5">

          <input
            type="checkbox"
            checked={online}
            onChange={(e) => setOnline(e.target.checked)}
            className="h-4 w-4 accent-emerald-600"
          />

          <span className="text-sm font-medium text-zinc-800">
            Disponível agora
          </span>

        </label>

      </div>

    </Modal>
  );
}
