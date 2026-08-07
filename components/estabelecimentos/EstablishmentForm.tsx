"use client";

import { useEffect, useMemo, useState } from "react";

import { Save } from "lucide-react";

import Modal, {
  Field,
  GhostButton,
  PrimaryButton,
  inputClass,
  textareaClass,
} from "@/components/shared/Modal";

import { useTeams } from "@/lib/context/TeamsContext";
import { useSession } from "@/lib/context/SessionContext";
import { EstablishmentDraft } from "@/lib/context/EstablishmentsContext";

import {
  Establishment,
  EstablishmentPlan,
  EstablishmentStatus,
  ESTABLISHMENT_PLANS,
  ESTABLISHMENT_SEGMENTS,
  ESTABLISHMENT_STATUSES,
} from "@/lib/models/establishment";

const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO",
  "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR",
  "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

const statusHint: Record<EstablishmentStatus, string> = {
  Ativo: "Contrato em dia e plataforma em uso.",
  "Em risco": "Sinalizou cancelamento ou tem reclamação aberta grave.",
  Trial: "Período de teste, ainda sem contrato assinado.",
  Cancelado: "Encerrou o contrato — mantido para histórico.",
};

interface Props {
  open: boolean;
  editing?: Establishment;
  onClose: () => void;
  onSave: (
    data: EstablishmentDraft | Establishment
  ) => void;
}

/** Aplica a máscara de CNPJ conforme digita. */
function maskCnpj(value: string) {

  const digits = value.replace(/\D/g, "").slice(0, 14);

  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export default function EstablishmentForm({
  open,
  editing,
  onClose,
  onSave,
}: Props) {

  const { people } = useTeams();
  const session = useSession();

  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [segment, setSegment] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [plan, setPlan] =
    useState<EstablishmentPlan>("Essencial");
  const [status, setStatus] =
    useState<EstablishmentStatus>("Ativo");
  const [mrr, setMrr] = useState("");
  const [owner, setOwner] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;

    if (editing) {
      setName(editing.name);
      setCnpj(editing.cnpj ?? "");
      setSegment(editing.segment ?? "");
      setCity(editing.city ?? "");
      setState(editing.state ?? "");
      setPlan(editing.plan);
      setStatus(editing.status);
      setMrr(
        editing.mrr ? String(editing.mrr) : ""
      );
      setOwner(editing.owner ?? "");
      setStartedAt(editing.startedAt ?? "");
      setPhone(editing.phone ?? "");
      setEmail(editing.email ?? "");
      setNotes(editing.notes ?? "");
      return;
    }

    setName("");
    setCnpj("");
    setSegment("");
    setCity("");
    setState("");
    setPlan("Essencial");
    setStatus("Ativo");
    setMrr("");
    setOwner(session?.name ?? "Operação");
    setStartedAt(new Date().toISOString().slice(0, 10));
    setPhone("");
    setEmail("");
    setNotes("");
  }, [open, editing, session]);

  const responsaveis = useMemo(
    () =>
      [
        ...new Set(
          [
            session?.name,
            ...people.map((item) => item.name),
          ].filter((item): item is string => !!item)
        ),
      ].sort(),
    [people, session]
  );

  const valorMrr = Number(
    mrr.replace(/\./g, "").replace(",", ".")
  );

  const mrrValido =
    mrr.trim() === "" ||
    (Number.isFinite(valorMrr) && valorMrr >= 0);

  const valido = name.trim() !== "" && mrrValido;

  function salvar() {

    if (!valido) return;

    const base: EstablishmentDraft = {
      name: name.trim(),
      cnpj: cnpj.trim() || undefined,
      segment: segment.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      plan,
      status,
      mrr: mrr.trim() === "" ? undefined : valorMrr,
      owner: owner.trim() || undefined,
      startedAt: startedAt || undefined,
      phone: phone.trim() || undefined,
      email: email.trim().toLowerCase() || undefined,
      notes: notes.trim() || undefined,
    };

    onSave(
      editing
        ? {
            ...base,
            id: editing.id,
            slug: editing.slug,
          }
        : base
    );
  }

  return (
    <Modal
      open={open}
      size="wide"
      title={
        editing
          ? "Editar estabelecimento"
          : "Novo estabelecimento"
      }
      description="O restaurante que contrata a Cardápio Web. As pessoas ficam em Clientes."
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
            {editing ? "Salvar" : "Criar estabelecimento"}
          </PrimaryButton>
        </>
      }
    >

      <div className="space-y-5">

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">

          <Field label="Nome do estabelecimento">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Pizzaria do Bairro"
              className={inputClass}
            />
          </Field>

          <Field label="CNPJ" hint="Opcional.">
            <input
              value={cnpj}
              onChange={(e) =>
                setCnpj(maskCnpj(e.target.value))
              }
              placeholder="00.000.000/0001-00"
              inputMode="numeric"
              className={inputClass}
            />
          </Field>

        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px]">

          <Field
            label="Segmento"
            hint="Escolha um da lista ou digite outro."
          >

            <input
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              list="segmentos-estabelecimento"
              placeholder="Ex.: Hamburgueria"
              className={inputClass}
            />

            <datalist id="segmentos-estabelecimento">
              {ESTABLISHMENT_SEGMENTS.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>

          </Field>

          <Field label="Cidade">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Cidade"
              className={inputClass}
            />
          </Field>

          <Field label="UF">
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className={inputClass}
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

        <Field label="Plano">

          <div className="flex items-center rounded-xl border border-zinc-200 p-1">

            {ESTABLISHMENT_PLANS.map((item) => (

              <button
                key={item}
                onClick={() => setPlan(item)}
                className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
                  plan === item
                    ? "bg-violet-700 text-white"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {item}
              </button>

            ))}

          </div>

        </Field>

        <Field
          label="Situação da conta"
          hint={statusHint[status]}
        >

          <div className="grid gap-2 sm:grid-cols-4">

            {ESTABLISHMENT_STATUSES.map((item) => (

              <button
                key={item}
                onClick={() => setStatus(item)}
                title={statusHint[item]}
                className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ring-1 ring-inset ${
                  status === item
                    ? "bg-violet-50 text-violet-800 ring-violet-300"
                    : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50"
                }`}
              >
                {item}
              </button>

            ))}

          </div>

        </Field>

        <div className="grid gap-4 sm:grid-cols-3">

          <Field
            label="Mensalidade (R$)"
            hint={
              mrrValido
                ? "Usada no cálculo de receita em risco."
                : "Informe um número válido."
            }
          >
            <input
              value={mrr}
              onChange={(e) => setMrr(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              className={`${inputClass} ${
                mrrValido
                  ? ""
                  : "border-rose-300 focus:border-rose-400"
              }`}
            />
          </Field>

          <Field label="Responsável na CW">
            <select
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className={inputClass}
            >
              <option value="">Sem responsável</option>

              {responsaveis.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Cliente desde">
            <input
              type="date"
              value={startedAt}
              onChange={(e) =>
                setStartedAt(e.target.value)
              }
              className={inputClass}
            />
          </Field>

        </div>

        <div className="grid gap-4 sm:grid-cols-2">

          <Field label="Telefone">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
              className={inputClass}
            />
          </Field>

          <Field label="E-mail">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contato@estabelecimento.com.br"
              className={inputClass}
            />
          </Field>

        </div>

        <Field label="Observações">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Contexto da conta, acordos, histórico comercial..."
            className={textareaClass}
          />
        </Field>

      </div>

    </Modal>
  );
}
