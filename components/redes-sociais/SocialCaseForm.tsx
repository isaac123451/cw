"use client";

import { useMemo, useState } from "react";

import { Camera, Save } from "lucide-react";

import Modal, {
  Field,
  GhostButton,
  PrimaryButton,
  inputClass,
  textareaClass,
} from "@/components/shared/Modal";

import { useSettings } from "@/lib/context/SettingsContext";
import { useSession } from "@/lib/context/SessionContext";
import { useWorkflow } from "@/lib/context/WorkflowContext";

import { Case } from "@/lib/models/case";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

interface Props {
  open: boolean;
  editing?: Case;
  onClose: () => void;
  onSave: (data: Case) => void;
}

const PRIORIDADES: Case["priority"][] = [
  "Crítica",
  "Alta",
  "Média",
  "Baixa",
];

export default function SocialCaseForm({
  open,
  editing,
  onClose,
  onSave,
}: Props) {

  const { categories, subcategories, teams } =
    useSettings();

  const { workflow } = useWorkflow();
  const session = useSession();

  /**
   * As etapas ativas, na ordem do quadro — a primeira é onde o caso
   * novo nasce.
   *
   * Fica **antes** do estado porque é dela que sai o valor inicial do
   * status. Antes ela existia memoizada para o efeito não reexecutar a
   * cada render; sem o efeito, ela existe só para ser lida uma vez.
   */
  const etapas = useMemo(
    () =>
      workflow
        .filter((item) => item.active)
        .sort((a, b) => a.order - b.order),
    [workflow]
  );

  /**
   * Os campos nascem preenchidos, e o formulário remonta a cada
   * abertura.
   *
   * Era um `useEffect` que copiava `editing` para o estado quando o
   * modal abria. Funcionava, mas ao custo de uma renderização a mais
   * por abertura — e de uma janela em que o formulário já estava na
   * tela com os campos do caso anterior. Quem abre passa `key`, e é
   * ela que garante instância nova.
   */
  const [title, setTitle] = useState(
    editing?.title ?? ""
  );
  const [customer, setCustomer] = useState(
    editing?.customer ?? ""
  );
  const [handle, setHandle] = useState(
    editing?.email ?? ""
  );
  const [phone, setPhone] = useState(
    editing?.phone ?? ""
  );
  const [city, setCity] = useState(
    editing?.city ?? ""
  );
  const [state, setState] = useState(
    editing?.state ?? ""
  );
  const [category, setCategory] = useState(
    editing?.category ?? categories[0]?.name ?? ""
  );
  const [subcategory, setSubcategory] = useState(
    editing?.subcategory ?? ""
  );
  const [team, setTeam] = useState(
    editing?.department ?? ""
  );
  const [priority, setPriority] = useState<
    Case["priority"]
  >(editing?.priority ?? "Média");
  const [status, setStatus] = useState(
    editing?.status ?? etapas[0]?.name ?? "Novo"
  );
  const [createdAt, setCreatedAt] = useState(
    editing?.createdAt ?? hojeNaOperacao()
  );
  const [description, setDescription] = useState(
    editing?.description ?? ""
  );

  const subsDaCategoria = subcategories.filter(
    (item) => item.category === category
  );

  const valido =
    title.trim() !== "" &&
    customer.trim() !== "" &&
    createdAt !== "";

  function salvar() {

    if (!valido) return;

    const base: Case = {
      id: editing?.id ?? crypto.randomUUID(),
      protocol:
        editing?.protocol ??
        `IG-${Date.now().toString().slice(-8)}`,
      company: customer.trim(),
      customer: customer.trim(),
      email: handle.trim() || undefined,
      phone: phone.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      // Hoje o único canal social ativo.
      source: "Instagram",
      category: category || "Outros",
      subcategory: subcategory || undefined,
      priority,
      status,
      owner: editing?.owner ?? session?.name,
      department: team || undefined,
      title: title.trim(),
      description: description.trim(),
      publicResponse: editing?.publicResponse ?? "",
      score: editing?.score,
      evaluated: editing?.evaluated ?? false,
      resolved: editing?.resolved ?? false,
      wouldDoBusiness: editing?.wouldDoBusiness ?? false,
      responseTime: editing?.responseTime ?? "-",
      solutionTime: editing?.solutionTime ?? "-",
      sla: editing?.sla ?? "4h",
      createdAt,
      updatedAt: hojeNaOperacao(),
      lastInteraction: hojeNaOperacao(),
      churnRisk: editing?.churnRisk ?? false,
      tags: editing?.tags ?? [],
    };

    onSave(base);
  }

  return (
    <Modal
      open={open}
      size="wide"
      title={
        editing
          ? "Editar atendimento"
          : "Novo atendimento do Instagram"
      }
      description="Registre uma conversa recebida pelas redes sociais."
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

        <div className="flex items-center gap-3 rounded-xl bg-pink-50/60 p-4 ring-1 ring-inset ring-pink-100">

          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-pink-600 ring-1 ring-inset ring-pink-100">
            <Camera size={18} />
          </span>

          <div>

            <p className="text-sm font-semibold text-zinc-900">
              Instagram
            </p>

            <p className="text-xs text-zinc-500">
              Único canal social ativo no momento.
            </p>

          </div>

        </div>

        <Field label="Assunto">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: cliente relatou cobrança em duplicidade no direct"
            className={inputClass}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">

          <Field label="Nome do cliente">
            <input
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="Quem enviou a mensagem"
              className={inputClass}
            />
          </Field>

          <Field label="@ do Instagram" hint="Opcional.">
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@usuario"
              className={inputClass}
            />
          </Field>

          <Field label="Telefone" hint="Habilita o WhatsApp no caso.">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11)90000-0000"
              className={inputClass}
            />
          </Field>

          <Field label="Data do contato">
            <input
              type="date"
              value={createdAt}
              onChange={(e) => setCreatedAt(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Cidade">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="UF">
            <input
              value={state}
              onChange={(e) =>
                setState(e.target.value.toUpperCase())
              }
              maxLength={2}
              className={inputClass}
            />
          </Field>

        </div>

        <div className="grid gap-4 sm:grid-cols-3">

          <Field label="Categoria">
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setSubcategory("");
              }}
              className={inputClass}
            >
              {categories.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Subcategoria">
            <select
              value={subcategory}
              onChange={(e) =>
                setSubcategory(e.target.value)
              }
              className={inputClass}
            >
              <option value="">Nenhuma</option>

              {subsDaCategoria.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Time responsável">
            <select
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              className={inputClass}
            >
              <option value="">Nenhum</option>

              {teams
                .filter((item) => item.active)
                .map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name}
                  </option>
                ))}
            </select>
          </Field>

        </div>

        <div className="grid gap-4 sm:grid-cols-2">

          <Field label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={inputClass}
            >
              {etapas.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Prioridade">

            <div className="flex items-center rounded-xl border border-zinc-200 p-1">

              {PRIORIDADES.map((item) => (

                <button
                  key={item}
                  onClick={() => setPriority(item)}
                  className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
                    priority === item
                      ? "bg-violet-700 text-white"
                      : "text-zinc-600 hover:bg-zinc-100"
                  }`}
                >
                  {item}
                </button>

              ))}

            </div>

          </Field>

        </div>

        <Field label="O que o cliente relatou">
          <textarea
            value={description}
            onChange={(e) =>
              setDescription(e.target.value)
            }
            rows={4}
            placeholder="Resumo da conversa"
            className={textareaClass}
          />
        </Field>

      </div>

    </Modal>
  );
}
