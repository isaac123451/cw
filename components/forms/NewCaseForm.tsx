"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Loader2, Plus } from "lucide-react";

import { useCases } from "@/lib/context/CaseContext";
import { useSettings } from "@/lib/context/SettingsContext";
import { useWorkflow } from "@/lib/context/WorkflowContext";
import { useSession } from "@/lib/context/SessionContext";
import { useToast } from "@/lib/context/ToastContext";
import { useOwners } from "@/lib/hooks/useOwners";

import type { Case } from "@/lib/models/case";

const campo =
  "h-11 w-full rounded-xl border border-zinc-200 px-3.5 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400";

const rotulo =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500";

/**
 * Abrir uma reclamação à mão.
 *
 * **Esta tela não criava nada.** Até 23/08/2026 o `onSubmit` fazia
 * `console.log(form)` e `alert("Caso criado (mock)")` — e nada mais. O
 * responsável vinha fixo no código como "Carlos Isaac", a categoria era
 * texto livre sem relação com o cadastro, e o caso simplesmente não
 * existia depois do clique. Quem usasse sairia convencido de ter aberto
 * um chamado.
 *
 * As varreduras não pegavam: `check:telas` confirma que a tela **abre**,
 * e `check:persistencia` percorre os contextos, não os formulários.
 *
 * Agora grava pelo mesmo caminho de todo o resto — `createCase` do
 * `CaseContext`, que chama a server action e invalida o cache. E os
 * campos vêm dos cadastros de verdade: categoria, subcategoria, etapa e
 * responsável saem das listas que a operação mantém, não de texto solto
 * que ninguém consegue filtrar depois.
 */
export default function NewCaseForm() {

  const router = useRouter();

  const { createCase } = useCases();
  const { categories, subcategories } = useSettings();
  const { workflow } = useWorkflow();
  const owners = useOwners();
  const sessao = useSession();
  const { notify } = useToast();

  const [salvando, setSalvando] = useState(false);

  const etapas = useMemo(
    () =>
      workflow
        .filter((s) => s.active)
        .sort((a, b) => a.order - b.order),
    [workflow]
  );

  const categoriasAtivas = useMemo(
    () => categories.filter((c) => c.active),
    [categories]
  );

  const [form, setForm] = useState({
    customer: "",
    company: "",
    document: "",
    phone: "",
    email: "",
    city: "",
    state: "",
    source: "Reclame Aqui",
    category: "",
    subcategory: "",
    priority: "Média" as Case["priority"],
    status: "",
    owner: "",
    title: "",
    description: "",
  });

  const subsDaCategoria = useMemo(
    () =>
      subcategories.filter(
        (s) => s.category === form.category && s.active
      ),
    [subcategories, form.category]
  );

  function set<K extends keyof typeof form>(
    chave: K,
    valor: (typeof form)[K]
  ) {
    setForm((atual) => ({ ...atual, [chave]: valor }));
  }

  /**
   * O mínimo para a reclamação fazer sentido depois.
   *
   * Título e cliente são o que a lista mostra; categoria é o que os
   * indicadores agrupam. Um caso sem categoria vira linha órfã em toda
   * análise, então ele não passa daqui sem uma.
   */
  const podeSalvar =
    form.customer.trim().length > 1 &&
    form.title.trim().length > 2 &&
    form.category !== "" &&
    !salvando;

  async function enviar(e: React.FormEvent) {

    e.preventDefault();

    if (!podeSalvar) return;

    setSalvando(true);

    const agora = new Date()
      .toISOString()
      .slice(0, 10);

    /**
     * O protocolo nasce aqui, com marca de origem manual.
     *
     * As reclamações importadas usam o id do Reclame Aqui. Um caso
     * aberto à mão não tem um, e reaproveitar o formato faria parecer
     * que veio do portal — na hora de conciliar com o export, ninguém
     * saberia por que aquele número não existe lá.
     */
    const protocolo = `CW-${Date.now().toString(36).toUpperCase()}`;

    const novo: Case = {
      id: protocolo,
      protocol: protocolo,
      customer: form.customer.trim(),
      company: form.company.trim() || form.customer.trim(),
      document:
        form.document.replace(/\D/g, "") || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
      source: form.source,
      category: form.category,
      subcategory: form.subcategory || undefined,
      priority: form.priority,
      status: form.status || etapas[0]?.name || "Novo",
      owner: form.owner || undefined,
      title: form.title.trim(),
      description: form.description.trim(),
      resolved: false,
      wouldDoBusiness: false,
      evaluated: false,
      sla: "",
      createdAt: agora,
      tags: [],
    };

    createCase(novo);

    notify({
      tone: "success",
      title: `Reclamação ${protocolo} criada.`,
      detail: `${novo.customer} · ${novo.category}`,
      href: `/reclame-aqui/${protocolo}`,
      hrefLabel: "abrir",
    });

    router.push(`/reclame-aqui/${protocolo}`);
  }

  return (
    <form
      onSubmit={enviar}
      className="space-y-6 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
    >

      <div>
        <h2 className="text-lg font-semibold text-zinc-900">
          Nova reclamação
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Para o que chega fora do Reclame Aqui — telefone,
          e-mail, rede social. O que vem do portal entra
          pela importação.
        </p>
      </div>

      {/* ---- quem reclamou ---- */}

      <div className="grid gap-4 sm:grid-cols-2">

        <div>
          <label htmlFor="customer" className={rotulo}>
            Nome do cliente *
          </label>
          <input
            id="customer"
            value={form.customer}
            onChange={(e) =>
              set("customer", e.target.value)
            }
            placeholder="Como ele se identificou"
            className={campo}
          />
        </div>

        <div>
          <label htmlFor="company" className={rotulo}>
            Estabelecimento
          </label>
          <input
            id="company"
            value={form.company}
            onChange={(e) =>
              set("company", e.target.value)
            }
            placeholder="Nome do restaurante"
            className={campo}
          />
        </div>

        <div>
          <label htmlFor="document" className={rotulo}>
            CPF ou CNPJ
          </label>
          <input
            id="document"
            value={form.document}
            onChange={(e) =>
              set("document", e.target.value)
            }
            placeholder="Só números"
            inputMode="numeric"
            className={campo}
          />
          {/*
            O documento é o que liga a reclamação ao cadastro do
            estabelecimento — por CPF ou CNPJ, nunca por nome. Sem ele o
            vínculo fica para alguém fazer à mão depois.
          */}
          <p className="mt-1.5 text-xs text-zinc-400">
            É por aqui que o caso encontra o
            estabelecimento.
          </p>
        </div>

        <div>
          <label htmlFor="phone" className={rotulo}>
            Telefone
          </label>
          <input
            id="phone"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="(11) 99999-9999"
            inputMode="tel"
            className={campo}
          />
        </div>

        <div>
          <label htmlFor="email" className={rotulo}>
            E-mail
          </label>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            className={campo}
          />
        </div>

        <div className="grid grid-cols-[1fr_5rem] gap-2">

          <div>
            <label htmlFor="city" className={rotulo}>
              Cidade
            </label>
            <input
              id="city"
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              className={campo}
            />
          </div>

          <div>
            <label htmlFor="state" className={rotulo}>
              UF
            </label>
            <input
              id="state"
              value={form.state}
              maxLength={2}
              onChange={(e) =>
                set(
                  "state",
                  e.target.value.toUpperCase()
                )
              }
              className={campo}
            />
          </div>

        </div>

      </div>

      {/* ---- do que se trata ---- */}

      <div className="space-y-4 border-t border-zinc-100 pt-5">

        <div>
          <label htmlFor="title" className={rotulo}>
            Título *
          </label>
          <input
            id="title"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Uma frase que resuma o problema"
            className={campo}
          />
        </div>

        <div>
          <label htmlFor="description" className={rotulo}>
            O que aconteceu
          </label>
          <textarea
            id="description"
            value={form.description}
            onChange={(e) =>
              set("description", e.target.value)
            }
            rows={5}
            placeholder="O relato do cliente, com o máximo de detalhe que ele deu."
            className="w-full rounded-xl border border-zinc-200 p-3.5 text-sm leading-relaxed outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400"
          />
        </div>

      </div>

      {/* ---- classificação ---- */}

      <div className="grid gap-4 border-t border-zinc-100 pt-5 sm:grid-cols-2 lg:grid-cols-3">

        <div>
          <label htmlFor="source" className={rotulo}>
            Origem
          </label>
          <select
            id="source"
            value={form.source}
            onChange={(e) => set("source", e.target.value)}
            className={campo}
          >
            <option>Reclame Aqui</option>
            <option>WhatsApp</option>
            <option>Instagram</option>
            <option>Facebook</option>
            <option>ManyChat</option>
            <option>Telefone</option>
            <option>E-mail</option>
          </select>
        </div>

        <div>
          <label htmlFor="category" className={rotulo}>
            Categoria *
          </label>
          <select
            id="category"
            value={form.category}
            onChange={(e) => {
              set("category", e.target.value);
              // A subcategoria pertence à categoria — trocar uma zera a outra.
              set("subcategory", "");
            }}
            className={campo}
          >
            <option value="">Escolha…</option>
            {categoriasAtivas.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="subcategory" className={rotulo}>
            Assunto
          </label>
          <select
            id="subcategory"
            value={form.subcategory}
            disabled={subsDaCategoria.length === 0}
            onChange={(e) =>
              set("subcategory", e.target.value)
            }
            className={`${campo} disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400`}
          >
            <option value="">
              {form.category === ""
                ? "Escolha a categoria antes"
                : subsDaCategoria.length === 0
                  ? "Sem assuntos cadastrados"
                  : "Opcional"}
            </option>
            {subsDaCategoria.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="priority" className={rotulo}>
            Prioridade
          </label>
          <select
            id="priority"
            value={form.priority}
            onChange={(e) =>
              set(
                "priority",
                e.target.value as Case["priority"]
              )
            }
            className={campo}
          >
            <option>Baixa</option>
            <option>Média</option>
            <option>Alta</option>
            <option>Crítica</option>
          </select>
        </div>

        <div>
          <label htmlFor="status" className={rotulo}>
            Etapa
          </label>
          <select
            id="status"
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
            className={campo}
          >
            <option value="">
              {etapas[0]?.name ?? "Novo"} (padrão)
            </option>
            {etapas.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="owner" className={rotulo}>
            Responsável
          </label>
          <select
            id="owner"
            value={form.owner}
            onChange={(e) => set("owner", e.target.value)}
            className={campo}
          >
            <option value="">Sem responsável</option>
            {/*
              Quem está logado entra na lista mesmo sem cadastro —
              mesma regra do "atribuir para mim" na tela do caso.
            */}
            {[
              ...new Set(
                [
                  ...owners,
                  sessao?.name?.trim() ?? "",
                ].filter(Boolean)
              ),
            ]
              .sort()
              .map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                  {nome === sessao?.name?.trim()
                    ? " (você)"
                    : ""}
                </option>
              ))}
          </select>
        </div>

      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-5">

        <button
          type="submit"
          disabled={!podeSalvar}
          className="flex h-11 items-center gap-2 rounded-xl bg-violet-800 px-5 text-sm font-medium text-white transition-colors hover:bg-violet-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {salvando ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Plus size={15} />
          )}
          Criar reclamação
        </button>

        <p className="text-xs text-zinc-400">
          Nome do cliente, título e categoria são
          obrigatórios.
        </p>

      </div>

    </form>
  );
}
