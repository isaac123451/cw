"use client";

import { useMemo, useState, type ComponentType } from "react";

import {
  X,
  Save,
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  Tag,
  FileText,
  AlertTriangle,
} from "lucide-react";

import { Case } from "@/lib/models/case";
import { useCases } from "@/lib/context/CaseContext";

interface Props {
  open: boolean;
  onClose: () => void;
}

const priorities: Case["priority"][] = [
  "Crítica",
  "Alta",
  "Média",
  "Baixa",
];

const statusOptions = [
  "Novo",
  "Em Atendimento",
  "Aguardando Cliente",
  "Resolvido",
];

export default function CreateCaseModal({
  open,
  onClose,
}: Props) {

  const { cases, createCase } =
    useCases();

  const protocol = useMemo(() => {

    const year = new Date().getFullYear();

    const prefix = `RA-${year}`;

    // Deriva do maior sequencial já usado no ano, e não da quantidade de casos:
    // excluir uma reclamação não pode reciclar um protocolo já emitido.
    const lastNumber = cases.reduce((max, item) => {

      if (!item.protocol.startsWith(prefix)) return max;

      const sequence = Number(
        item.protocol.slice(prefix.length)
      );

      return Number.isNaN(sequence)
        ? max
        : Math.max(max, sequence);

    }, 0);

    return `${prefix}${String(
      lastNumber + 1
    ).padStart(4, "0")}`;

  }, [cases]);

  const [form, setForm] =
    useState<Case>({
      id: crypto.randomUUID(),

      protocol,

      company: "",

      cnpj: "",

      customer: "",

      email: "",

      phone: "",

      city: "",

      state: "",

      source: "Reclame Aqui",

      category: "",

      subcategory: "",

      priority: "Média",

      status: "Novo",

      owner: "",

      title: "",

      description: "",

      publicResponse: "",

      score: 0,

      resolved: false,

      wouldDoBusiness: false,

      responseTime: "-",

      solutionTime: "-",

      sla: "2h",

      createdAt: new Date()
        .toISOString()
        .substring(0, 10),

      updatedAt: new Date()
        .toISOString()
        .substring(0, 10),

      lastInteraction: "Agora",

      tags: [],
    });

  function update<K extends keyof Case>(
    field: K,
    value: Case[K]
  ) {

    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));

  }

  function save() {

    createCase({
      ...form,
      protocol,
    });

    onClose();

  }

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40"
      />

      <aside
        className="fixed right-0 top-0 z-50 flex h-screen w-[850px] flex-col bg-white shadow-2xl"
      >

        <header className="flex items-center justify-between border-b border-zinc-200 px-8 py-6">

          <div>

            <p className="text-xs uppercase tracking-wide text-zinc-500">

              Nova Reclamação

            </p>

            <h2 className="mt-1 text-2xl font-bold">

              Criar Reclamação

            </h2>

          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 hover:bg-zinc-100"
          >

            <X size={20} />

          </button>

        </header>

        <div className="flex-1 overflow-y-auto px-8 py-6">

          <div className="grid grid-cols-2 gap-5">

            <Input
              icon={Building2}
              label="Empresa"
              value={form.company}
              onChange={(v) =>
                update("company", v)
              }
            />

            <Input
              icon={User}
              label="Consumidor"
              value={form.customer}
              onChange={(v) =>
                update("customer", v)
              }
            />

            <Input
              icon={Mail}
              label="Email"
              value={form.email ?? ""}
              onChange={(v) =>
                update("email", v)
              }
            />

            <Input
              icon={Phone}
              label="Telefone"
              value={form.phone ?? ""}
              onChange={(v) =>
                update("phone", v)
              }
            />

            <Input
              icon={MapPin}
              label="Cidade"
              value={form.city ?? ""}
              onChange={(v) =>
                update("city", v)
              }
            />

            <Input
              label="Estado"
              value={form.state ?? ""}
              onChange={(v) =>
                update("state", v)
              }
            />

            <Input
              icon={Tag}
              label="Categoria"
              value={form.category}
              onChange={(v) =>
                update("category", v)
              }
            />

            <Input
              label="Subcategoria"
              value={form.subcategory ?? ""}
              onChange={(v) =>
                update("subcategory", v)
              }
            />

            <Input
              icon={FileText}
              label="Título"
              value={form.title}
              onChange={(v) =>
                update("title", v)
              }
            />

            <Input
              label="Responsável"
              value={form.owner ?? ""}
              onChange={(v) =>
                update("owner", v)
              }
            />

            <div>

              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-600">

                <AlertTriangle size={14} />

                Prioridade

              </label>

              <select
                value={form.priority}
                onChange={(e) =>
                  update(
                    "priority",
                    e.target
                      .value as Case["priority"]
                  )
                }
                className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
              >

                {priorities.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}

              </select>

            </div>

            <div>

              <label className="mb-1.5 block text-xs font-medium text-zinc-600">

                Status

              </label>

              <select
                value={form.status}
                onChange={(e) =>
                  update("status", e.target.value)
                }
                className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
              >

                {statusOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}

              </select>

            </div>

          </div>

          <div className="mt-5">

            <label className="mb-1.5 block text-xs font-medium text-zinc-600">

              Descrição

            </label>

            <textarea
              value={form.description}
              onChange={(e) =>
                update(
                  "description",
                  e.target.value
                )
              }
              rows={5}
              className="w-full resize-none rounded-lg border border-zinc-200 p-3 text-sm outline-none focus:border-zinc-400"
              placeholder="Descreva a reclamação..."
            />

          </div>

        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-zinc-200 px-8 py-5">

          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
          >

            Cancelar

          </button>

          <button
            onClick={save}
            className="flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
          >

            <Save size={16} />

            Salvar Reclamação

          </button>

        </footer>

      </aside>
    </>
  );
}

function Input({
  icon: Icon,
  label,
  value,
  onChange,
}: {
  icon?: ComponentType<{ size?: number }>;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {

  return (
    <div>

      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-600">

        {Icon && <Icon size={14} />}

        {label}

      </label>

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
      />

    </div>
  );
}
