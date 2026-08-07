"use client";

import { useEffect, useMemo, useState } from "react";

import { Save, Search } from "lucide-react";

import Modal, {
  Field,
  GhostButton,
  PrimaryButton,
  inputClass,
  textareaClass,
} from "@/components/shared/Modal";

import { useCases } from "@/lib/context/CaseContext";
import { useSession } from "@/lib/context/SessionContext";
import { useEstablishments } from "@/lib/context/EstablishmentsContext";
import { useClients } from "@/lib/context/ClientsContext";

import { ImpactRecord, ImpactType } from "@/lib/models/impact";
import { ImpactDraft } from "@/lib/context/ImpactContext";
import { slugify } from "@/lib/services/slug";

const TIPOS: {
  id: ImpactType;
  label: string;
  hint: string;
  sinal: 1 | -1;
}[] = [
  {
    id: "Cancelamento evitado",
    label: "Cancelamento evitado",
    hint: "Receita preservada ao reverter um pedido de cancelamento.",
    sinal: 1,
  },
  {
    id: "Cliente recuperado",
    label: "Cliente recuperado",
    hint: "Cliente que voltou a usar a plataforma após a tratativa.",
    sinal: 1,
  },
  {
    id: "Módulo contratado",
    label: "Módulo contratado",
    hint: "Receita nova gerada a partir do atendimento.",
    sinal: 1,
  },
  {
    id: "Valor recuperado",
    label: "Valor recuperado",
    hint: "Cobrança indevida reconciliada.",
    sinal: 1,
  },
  {
    id: "Oferta concedida",
    label: "Oferta concedida",
    hint: "Desconto ou isenção dada para reter o cliente — entra como custo.",
    sinal: -1,
  },
];

interface Props {
  open: boolean;
  editing?: ImpactRecord;
  /** Pré-vincula a um caso, quando aberto de dentro da reclamação. */
  presetCaseId?: string;
  onClose: () => void;
  onSave: (data: ImpactDraft | ImpactRecord) => void;
}

export default function ImpactForm({
  open,
  editing,
  presetCaseId,
  onClose,
  onSave,
}: Props) {

  const { cases } = useCases();
  const session = useSession();
  const { establishments } = useEstablishments();
  const { clients } = useClients();

  const [type, setType] = useState<ImpactType>(
    "Cancelamento evitado"
  );
  const [company, setCompany] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [caseId, setCaseId] = useState("");
  const [caseSearch, setCaseSearch] = useState("");
  const [establishmentId, setEstablishmentId] =
    useState("");
  const [clientSlug, setClientSlug] = useState("");

  /** Texto digitado enquanto o nome ainda não casa com nenhum cliente. */
  const [clientName, setClientName] = useState("");

  useEffect(() => {
    if (!open) return;

    if (editing) {
      setType(editing.type);
      setCompany(editing.company);
      setDescription(editing.description ?? "");
      setAmount(String(Math.abs(editing.amount)));
      setDate(editing.date);
      setCaseId(editing.relatedCase ?? "");
      setEstablishmentId(editing.establishmentId ?? "");
      setClientSlug(editing.clientSlug ?? "");
      setClientName("");
      return;
    }

    const preset = presetCaseId
      ? cases.find((item) => item.id === presetCaseId)
      : undefined;

    setType("Cancelamento evitado");
    setCompany(preset?.company ?? "");
    setDescription("");
    setAmount("");
    setDate(preset?.createdAt ?? "");
    setCaseId(preset?.protocol ?? "");
    setCaseSearch("");
    setEstablishmentId(preset?.establishmentId ?? "");
    setClientSlug(
      preset ? slugify(preset.customer) : ""
    );
    setClientName("");
  }, [open, editing, presetCaseId, cases]);

  const sinal =
    TIPOS.find((item) => item.id === type)?.sinal ?? 1;

  const resultados = useMemo(() => {

    const termo = caseSearch.trim().toLowerCase();

    if (!termo) return [];

    return cases
      .filter(
        (item) =>
          item.protocol.toLowerCase().includes(termo) ||
          item.customer.toLowerCase().includes(termo) ||
          item.title.toLowerCase().includes(termo)
      )
      .slice(0, 6);

  }, [cases, caseSearch]);

  const valor = Number(
    amount.replace(/\./g, "").replace(",", ".")
  );

  const valido =
    company.trim() !== "" &&
    date !== "" &&
    Number.isFinite(valor) &&
    valor > 0;

  function salvar() {

    if (!valido) return;

    const base: ImpactDraft = {
      type,
      company: company.trim(),
      description: description.trim(),
      amount: Math.round(valor) * sinal,
      owner: session?.name ?? "Operação",
      date,
      relatedCase: caseId.trim() || undefined,
      establishmentId: establishmentId || undefined,
      clientSlug: clientSlug || undefined,
    };

    onSave(
      editing ? { ...base, id: editing.id } : base
    );
  }

  return (
    <Modal
      open={open}
      size="wide"
      title={
        editing
          ? "Editar registro de impacto"
          : "Novo registro de impacto"
      }
      description="Vincule o resultado financeiro à reclamação e ao cliente que o originou."
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
            {editing ? "Salvar" : "Registrar"}
          </PrimaryButton>
        </>
      }
    >

      <div className="space-y-5">

        <Field label="Tipo de impacto">

          <div className="grid gap-2 sm:grid-cols-2">

            {TIPOS.map((item) => (

              <button
                key={item.id}
                onClick={() => setType(item.id)}
                title={item.hint}
                className={`rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors ring-1 ring-inset ${
                  type === item.id
                    ? "bg-violet-50 text-violet-800 ring-violet-300"
                    : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50"
                }`}
              >

                <span className="flex items-center justify-between gap-2">

                  {item.label}

                  <span
                    className={`text-[10px] font-semibold ${
                      item.sinal > 0
                        ? "text-emerald-600"
                        : "text-rose-600"
                    }`}
                  >
                    {item.sinal > 0 ? "entrada" : "custo"}
                  </span>

                </span>

                <span className="mt-1 block text-[11px] font-normal leading-snug text-zinc-500">
                  {item.hint}
                </span>

              </button>

            ))}

          </div>

        </Field>

        <div className="grid gap-4 sm:grid-cols-2">

          <Field
            label="Valor (R$)"
            hint={
              sinal < 0
                ? "Será registrado como custo da operação."
                : "Será somado ao resultado da área."
            }
          >
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              className={inputClass}
            />
          </Field>

          <Field label="Data">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </Field>

        </div>

        <Field
          label="Nome exibido"
          hint="Preenchido automaticamente ao vincular uma reclamação, cliente ou estabelecimento."
        >
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Nome do cliente ou estabelecimento"
            className={inputClass}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">

          <Field
            label="Estabelecimento"
            hint="Opcional — liga este impacto a uma conta."
          >
            <select
              value={establishmentId}
              onChange={(e) => {
                const id = e.target.value;
                setEstablishmentId(id);

                const found = establishments.find(
                  (item) => item.id === id
                );

                if (found && !clientSlug) {
                  setCompany(found.name);
                }
              }}
              className={inputClass}
            >
              <option value="">Sem vínculo</option>

              {establishments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Cliente"
            hint="Opcional — digite para buscar entre todos os clientes da base."
          >

            <input
              value={
                clients.find(
                  (item) => item.slug === clientSlug
                )?.name ?? clientName
              }
              onChange={(e) => {

                const valor = e.target.value;
                setClientName(valor);

                // O datalist devolve o nome; guardamos o slug
                // correspondente para o vínculo ficar estável.
                const found = clients.find(
                  (item) => item.name === valor
                );

                setClientSlug(found?.slug ?? "");
                if (found) setCompany(found.name);
              }}
              list="clientes-impacto"
              placeholder="Buscar cliente..."
              className={inputClass}
            />

            <datalist id="clientes-impacto">
              {clients.map((item) => (
                <option key={item.slug} value={item.name} />
              ))}
            </datalist>

          </Field>

        </div>

        <Field
          label="Reclamação vinculada"
          hint={
            caseId
              ? `Vinculado ao protocolo ${caseId}.`
              : "Opcional — busque pelo protocolo, cliente ou título."
          }
        >

          <div className="relative">

            <Search
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
            />

            <input
              value={caseSearch}
              onChange={(e) =>
                setCaseSearch(e.target.value)
              }
              placeholder="Buscar reclamação..."
              className={`${inputClass} pl-10`}
            />

          </div>

          {resultados.length > 0 && (

            <ul className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-zinc-200">

              {resultados.map((item) => (

                <li key={item.id}>

                  <button
                    onClick={() => {
                      setCaseId(item.protocol);
                      setCompany(item.customer);
                      setEstablishmentId(
                        item.establishmentId ?? ""
                      );
                      setClientSlug(
                        slugify(item.customer)
                      );
                      setCaseSearch("");
                    }}
                    className="w-full border-b border-zinc-100 px-3.5 py-2.5 text-left transition-colors last:border-0 hover:bg-violet-50/50"
                  >

                    <p className="truncate text-sm font-medium text-zinc-800">
                      {item.title}
                    </p>

                    <p className="mt-0.5 truncate font-mono text-[11px] text-violet-700">
                      {item.protocol} · {item.customer}
                    </p>

                  </button>

                </li>

              ))}

            </ul>

          )}

          {caseId && (
            <button
              onClick={() => setCaseId("")}
              className="mt-2 text-xs font-medium text-rose-600 hover:underline"
            >
              Remover vínculo
            </button>
          )}

        </Field>

        <Field label="Descrição">
          <textarea
            value={description}
            onChange={(e) =>
              setDescription(e.target.value)
            }
            rows={3}
            placeholder="O que gerou este impacto"
            className={textareaClass}
          />
        </Field>

      </div>

    </Modal>
  );
}
