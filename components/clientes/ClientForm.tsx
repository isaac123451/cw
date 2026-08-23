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

import { useEstablishments } from "@/lib/context/EstablishmentsContext";
import { ManualClientDraft } from "@/lib/context/ClientsContext";

import { ClientProfile } from "@/lib/services/client.service";

import {
  ClientKind,
  CLIENT_KINDS,
} from "@/lib/models/client";

const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO",
  "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR",
  "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

const kindHint: Record<ClientKind, string> = {
  Consumidor:
    "Fez um pedido e reclamou — é quem aparece no Reclame Aqui.",
  Proprietário:
    "Dono da conta do estabelecimento na Cardápio Web.",
  Operador:
    "Trabalha no estabelecimento e usa a plataforma no dia a dia.",
  Parceiro:
    "Entregador, integrador ou fornecedor ligado à operação.",
};

interface Props {
  open: boolean;
  editing?: ClientProfile;
  onClose: () => void;
  onSave: (data: ManualClientDraft) => void;
}

export default function ClientForm({
  open,
  editing,
  onClose,
  onSave,
}: Props) {

  const { establishments } = useEstablishments();

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
  const [kind, setKind] = useState<ClientKind>(
    editing?.kind ?? "Consumidor"
  );
  const [email, setEmail] = useState(
    editing?.email ?? ""
  );
  const [phone, setPhone] = useState(
    editing?.phone ?? ""
  );
  const [document, setDocument] = useState(
    editing?.document ?? ""
  );
  const [city, setCity] = useState(
    editing?.city ?? ""
  );
  const [state, setState] = useState(
    editing?.state ?? ""
  );
  const [establishmentId, setEstablishmentId] = useState(
    editing?.establishmentId ?? ""
  );
  const [notes, setNotes] = useState(
    editing?.notes ?? ""
  );

  /** Vindo de uma reclamação, nome e contato não se editam aqui. */
  const derivado = Boolean(editing && !editing.manual);

  const emailValido =
    email.trim() === "" ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const valido = name.trim() !== "" && emailValido;

  function salvar() {

    if (!valido) return;

    onSave({
      name: name.trim(),
      kind,
      email: email.trim().toLowerCase() || undefined,
      phone: phone.trim() || undefined,
      document: document.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      establishmentId: establishmentId || undefined,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <Modal
      open={open}
      size="wide"
      title={editing ? "Editar cliente" : "Novo cliente"}
      description={
        derivado
          ? "Esta pessoa veio de uma reclamação real — nome e contato ficam como no Reclame Aqui."
          : "A pessoa por trás do atendimento. O restaurante fica em Estabelecimentos."
      }
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
            {editing ? "Salvar" : "Criar cliente"}
          </PrimaryButton>
        </>
      }
    >

      <div className="space-y-5">

        <Field
          label="Nome"
          hint={
            derivado
              ? "Vem do Reclame Aqui e não é editável."
              : undefined
          }
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={derivado}
            placeholder="Nome completo"
            className={`${inputClass} ${
              derivado
                ? "cursor-not-allowed bg-zinc-50 text-zinc-500"
                : ""
            }`}
          />
        </Field>

        <Field
          label="Tipo de relação"
          hint={kindHint[kind]}
        >

          <div className="grid gap-2 sm:grid-cols-2">

            {CLIENT_KINDS.map((item) => (

              <button
                key={item}
                onClick={() => setKind(item)}
                title={kindHint[item]}
                className={`rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors ring-1 ring-inset ${
                  kind === item
                    ? "bg-violet-50 text-violet-800 ring-violet-300"
                    : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50"
                }`}
              >
                {item}

                <span className="mt-0.5 block text-[11px] font-normal leading-snug text-zinc-500">
                  {kindHint[item]}
                </span>
              </button>

            ))}

          </div>

        </Field>

        <Field
          label="Estabelecimento vinculado"
          hint="Liga esta pessoa a um restaurante da base — aparece nos dois lados."
        >
          <select
            value={establishmentId}
            onChange={(e) =>
              setEstablishmentId(e.target.value)
            }
            className={inputClass}
          >
            <option value="">Sem vínculo</option>

            {establishments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.city ? ` — ${item.city}` : ""}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">

          <Field
            label="E-mail"
            hint={
              emailValido
                ? derivado
                  ? "Mascarado na importação por proteção de dados."
                  : undefined
                : "E-mail inválido."
            }
          >
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={derivado}
              placeholder="nome@email.com"
              className={`${inputClass} ${
                derivado
                  ? "cursor-not-allowed bg-zinc-50 text-zinc-500"
                  : ""
              } ${
                emailValido
                  ? ""
                  : "border-rose-300 focus:border-rose-400"
              }`}
            />
          </Field>

          <Field label="Telefone">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={derivado}
              placeholder="(00) 00000-0000"
              className={`${inputClass} ${
                derivado
                  ? "cursor-not-allowed bg-zinc-50 text-zinc-500"
                  : ""
              }`}
            />
          </Field>

        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px]">

          <Field
            label="Documento"
            hint="CPF ou CNPJ. Não vem do Reclame Aqui."
          >
            <input
              value={document}
              onChange={(e) => setDocument(e.target.value)}
              placeholder="Opcional"
              className={inputClass}
            />
          </Field>

          <Field label="Cidade">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={derivado}
              placeholder="Cidade"
              className={`${inputClass} ${
                derivado
                  ? "cursor-not-allowed bg-zinc-50 text-zinc-500"
                  : ""
              }`}
            />
          </Field>

          <Field label="UF">
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              disabled={derivado}
              className={`${inputClass} ${
                derivado
                  ? "cursor-not-allowed bg-zinc-50 text-zinc-500"
                  : ""
              }`}
            >
              <option value="">—</option>

              {UFS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>

        </div>

        <Field
          label="Observações"
          hint="Contexto que ajuda no próximo atendimento desta pessoa."
        >
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Histórico, acordos, preferências de contato..."
            className={textareaClass}
          />
        </Field>

      </div>

    </Modal>
  );
}
