"use client";

import { useMemo, useState } from "react";

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

    const number =
      cases.length + 1;

    return `RA-${new Date().getFullYear()}${String(
      number
    ).padStart(5, "0")}`;

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

      id: crypto.randomUUID(),

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
        className="
          fixed
          right-0
          top-0
          z-50
          flex
          h-screen
          w-[850px]
          flex-col
          bg-white
          shadow-2xl
        "
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