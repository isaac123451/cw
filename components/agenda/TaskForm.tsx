"use client";

import { useMemo, useState } from "react";

import { Save, Search } from "lucide-react";

import Modal, {
  Field,
  GhostButton,
  PrimaryButton,
  inputClass,
} from "@/components/shared/Modal";

import { useCases } from "@/lib/context/CaseContext";
import { useSession } from "@/lib/context/SessionContext";
import { useTeams } from "@/lib/context/TeamsContext";
import { TaskDraft } from "@/lib/context/AgendaContext";

import { AgendaTask, TaskType } from "@/lib/models/agenda";

const TIPOS: { id: TaskType; hint: string }[] = [
  {
    id: "Follow-up",
    hint: "Retornar ao cliente sobre uma tratativa em curso.",
  },
  {
    id: "Cobrança interna",
    hint: "Acionar outra área que está segurando o caso.",
  },
  {
    id: "Solicitação de avaliação",
    hint: "Pedir a nota ao consumidor após a solução.",
  },
  {
    id: "Pendência",
    hint: "Algo que precisa ser resolvido e não tem dono claro.",
  },
  {
    id: "Recorrente",
    hint: "Rotina que se repete no calendário da operação.",
  },
];

const PRIORIDADES: AgendaTask["priority"][] = [
  "Alta",
  "Média",
  "Baixa",
];

interface Props {
  open: boolean;
  editing?: AgendaTask;
  /** Data pré-selecionada ao criar a partir de um dia do quadro. */
  presetDate?: string;
  /** Reclamação já vinculada, ao criar a partir do detalhe do caso. */
  presetCase?: {
    protocol: string;
    company: string;
    title: string;
  };
  onClose: () => void;
  onSave: (data: TaskDraft | AgendaTask) => void;
}

export default function TaskForm({
  open,
  editing,
  presetDate,
  presetCase,
  onClose,
  onSave,
}: Props) {

  const { cases } = useCases();
  const session = useSession();
  const { people } = useTeams();

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
  const [title, setTitle] = useState(
    editing?.title ??
      (presetCase
        ? `Follow-up: ${presetCase.title}`
        : "")
  );
  const [type, setType] = useState<TaskType>(
    editing?.type ?? "Follow-up"
  );
  const [priority, setPriority] = useState<
    AgendaTask["priority"]
  >(editing?.priority ?? "Média");
  const [dueDate, setDueDate] = useState(
    editing?.dueDate ?? presetDate ?? ""
  );
  const [time, setTime] = useState(
    editing?.time ?? ""
  );
  const [owner, setOwner] = useState(
    editing?.owner ?? session?.name ?? "Operação"
  );
  const [caseProtocol, setCaseProtocol] = useState(
    editing?.relatedCase ?? presetCase?.protocol ?? ""
  );
  const [company, setCompany] = useState(
    editing?.relatedCompany ?? presetCase?.company ?? ""
  );
  const [caseSearch, setCaseSearch] = useState("");

  const responsaveis = useMemo(
    () =>
      [
        ...new Set(
          [
            session?.name,
            ...people.map((item) => item.name),
            ...cases
              .map((item) => item.owner)
              .filter(Boolean),
          ].filter((item): item is string => !!item)
        ),
      ].sort(),
    [cases, session, people]
  );

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

  const valido =
    title.trim() !== "" &&
    dueDate !== "" &&
    owner.trim() !== "";

  function salvar() {

    if (!valido) return;

    const base: TaskDraft = {
      title: title.trim(),
      type,
      priority,
      dueDate,
      time: time || undefined,
      owner: owner.trim(),
      done: editing?.done ?? false,
      relatedCase: caseProtocol || undefined,
      relatedCompany: company || undefined,
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
        editing ? "Editar atividade" : "Nova atividade"
      }
      description="Follow-ups, cobranças internas e pendências da rotina."
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
            {editing ? "Salvar" : "Criar atividade"}
          </PrimaryButton>
        </>
      }
    >

      <div className="space-y-5">

        <Field label="O que precisa ser feito">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: retornar ao cliente sobre o estorno"
            className={inputClass}
          />
        </Field>

        <Field label="Tipo">

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
                {item.id}

                <span className="mt-0.5 block text-[11px] font-normal leading-snug text-zinc-500">
                  {item.hint}
                </span>
              </button>

            ))}

          </div>

        </Field>

        <div className="grid gap-4 sm:grid-cols-3">

          <Field label="Data">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Horário" hint="Opcional.">
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Prioridade">

            <div className="flex items-center rounded-xl border border-zinc-200 p-1">

              {PRIORIDADES.map((item) => (

                <button
                  key={item}
                  onClick={() => setPriority(item)}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
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

        <Field label="Responsável">
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className={inputClass}
          >
            <option value="">Selecione</option>

            {responsaveis.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Reclamação vinculada"
          hint={
            caseProtocol
              ? `Vinculada ao protocolo ${caseProtocol}.`
              : "Opcional — a atividade passa a aparecer no caso."
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
                      setCaseProtocol(item.protocol);
                      setCompany(item.company);
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

          {caseProtocol && (
            <button
              onClick={() => {
                setCaseProtocol("");
                setCompany("");
              }}
              className="mt-2 text-xs font-medium text-rose-600 hover:underline"
            >
              Remover vínculo
            </button>
          )}

        </Field>

      </div>

    </Modal>
  );
}
