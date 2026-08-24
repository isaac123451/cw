"use client";

import { useState } from "react";

import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

import Modal, {
  Field,
  GhostButton,
  PrimaryButton,
  inputClass,
  textareaClass,
} from "@/components/shared/Modal";

import { useSession } from "@/lib/context/SessionContext";
import { PlaybookDraft } from "@/lib/context/DocsContext";

import {
  Playbook,
  PlaybookStep,
} from "@/lib/models/playbook";

const ESCOPOS = [
  "Reclame Aqui",
  "Redes Sociais",
  "Plataforma",
  "Comercial",
  "Financeiro",
  "Tecnologia",
];

interface Props {
  open: boolean;
  editing?: Playbook;
  onClose: () => void;
  onSave: (data: PlaybookDraft | Playbook) => void;
}

export default function PlaybookForm({
  open,
  editing,
  onClose,
  onSave,
}: Props) {

  const session = useSession();

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
    editing?.title ?? ""
  );
  const [summary, setSummary] = useState(
    editing?.summary ?? ""
  );
  const [scope, setScope] = useState(
    editing?.scope ?? ESCOPOS[0]
  );
  const [owner, setOwner] = useState(
    editing?.owner ?? session?.name ?? "Operação"
  );
  const [version, setVersion] = useState(
    editing?.version ?? "1.0"
  );
  const [confluenceUrl, setConfluenceUrl] = useState(
    editing?.confluenceUrl ?? ""
  );
  /**
   * Um passo em branco no cadastro novo.
   *
   * Um playbook sem passo nenhum é um formulário que não diz o que
   * fazer — a primeira linha vazia é o convite.
   */
  const [steps, setSteps] = useState<PlaybookStep[]>(
    editing?.steps ?? [
      { title: "", owner: "", detail: "" },
    ]
  );
  const [rules, setRules] = useState<string[]>(
    editing?.rules ?? []
  );
  const [ruleDraft, setRuleDraft] = useState("");

  function patchStep(
    index: number,
    patch: Partial<PlaybookStep>
  ) {
    setSteps((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, ...patch } : item
      )
    );
  }

  function moveStep(index: number, direction: -1 | 1) {

    const target = index + direction;

    if (target < 0 || target >= steps.length) return;

    setSteps((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  }

  const urlValida =
    confluenceUrl === "" ||
    /^https?:\/\//i.test(confluenceUrl);

  const valido =
    title.trim() !== "" &&
    summary.trim() !== "" &&
    owner.trim() !== "" &&
    urlValida;

  function salvar() {

    if (!valido) return;

    const base: PlaybookDraft = {
      title: title.trim(),
      summary: summary.trim(),
      scope,
      owner: owner.trim(),
      version: version.trim() || "1.0",
      updatedAt: new Date()
        .toISOString()
        .slice(0, 10),
      confluenceUrl: confluenceUrl.trim() || undefined,
      steps: steps.filter(
        (item) => item.title.trim() !== ""
      ),
      rules: rules.length > 0 ? rules : undefined,
    };

    onSave(
      editing
        ? { ...base, id: editing.id, slug: editing.slug }
        : base
    );
  }

  return (
    <Modal
      open={open}
      size="wide"
      title={
        editing ? "Editar documento" : "Novo documento"
      }
      description="Procedimentos e fluxos oficiais da operação."
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
            {editing ? "Salvar" : "Criar documento"}
          </PrimaryButton>
        </>
      }
    >

      <div className="space-y-5">

        <Field label="Título">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: tratativa de cobrança duplicada"
            className={inputClass}
          />
        </Field>

        <Field label="Resumo">
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
            placeholder="O que este documento cobre"
            className={textareaClass}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">

          <Field label="Escopo">
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className={inputClass}
            >
              {ESCOPOS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Responsável">
            <input
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Versão">
            <input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.0"
              className={inputClass}
            />
          </Field>

        </div>

        <Field
          label="Página no Confluence"
          hint={
            urlValida
              ? "Opcional. Com o link preenchido, aparece um botão para abrir a doc oficial."
              : "Informe uma URL começando com http:// ou https://"
          }
        >

          <div className="relative">

            <ExternalLink
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
            />

            <input
              value={confluenceUrl}
              onChange={(e) =>
                setConfluenceUrl(e.target.value)
              }
              placeholder="https://cardapioweb.atlassian.net/wiki/..."
              className={`${inputClass} pl-10 ${
                urlValida
                  ? ""
                  : "border-rose-300 focus:border-rose-400"
              }`}
            />

          </div>

        </Field>

        {/* Etapas */}

        <div>

          <div className="flex items-center justify-between">

            <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Etapas do fluxo
            </label>

            <button
              onClick={() =>
                setSteps((prev) => [
                  ...prev,
                  { title: "", owner: "", detail: "" },
                ])
              }
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-50"
            >
              <Plus size={13} />
              Adicionar etapa
            </button>

          </div>

          <div className="mt-2 space-y-3">

            {steps.map((step, index) => (

              <div
                key={index}
                className="rounded-xl border border-zinc-200 p-3.5"
              >

                <div className="flex items-center gap-2">

                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[11px] font-semibold text-violet-700">
                    {index + 1}
                  </span>

                  <input
                    value={step.title}
                    onChange={(e) =>
                      patchStep(index, {
                        title: e.target.value,
                      })
                    }
                    placeholder="Nome da etapa"
                    className="h-9 flex-1 rounded-lg border border-zinc-200 px-2.5 text-sm outline-none focus:border-violet-400"
                  />

                  <button
                    onClick={() => moveStep(index, -1)}
                    disabled={index === 0}
                    title="Subir"
                    className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 disabled:opacity-30"
                  >
                    <ArrowUp size={13} />
                  </button>

                  <button
                    onClick={() => moveStep(index, 1)}
                    disabled={index === steps.length - 1}
                    title="Descer"
                    className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 disabled:opacity-30"
                  >
                    <ArrowDown size={13} />
                  </button>

                  <button
                    onClick={() =>
                      setSteps((prev) =>
                        prev.filter((_, i) => i !== index)
                      )
                    }
                    title="Remover etapa"
                    className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 size={13} />
                  </button>

                </div>

                <div className="mt-2.5 grid gap-2 sm:grid-cols-2">

                  <input
                    value={step.owner}
                    onChange={(e) =>
                      patchStep(index, {
                        owner: e.target.value,
                      })
                    }
                    placeholder="Área responsável"
                    className="h-9 w-full rounded-lg border border-zinc-200 px-2.5 text-sm outline-none focus:border-violet-400"
                  />

                  <input
                    value={step.sla ?? ""}
                    onChange={(e) =>
                      patchStep(index, {
                        sla: e.target.value || undefined,
                      })
                    }
                    placeholder="SLA (opcional)"
                    className="h-9 w-full rounded-lg border border-zinc-200 px-2.5 text-sm outline-none focus:border-violet-400"
                  />

                </div>

                <textarea
                  value={step.detail}
                  onChange={(e) =>
                    patchStep(index, {
                      detail: e.target.value,
                    })
                  }
                  rows={2}
                  placeholder="O que acontece nesta etapa"
                  className="mt-2 w-full resize-none rounded-lg border border-zinc-200 p-2.5 text-sm outline-none focus:border-violet-400"
                />

              </div>

            ))}

          </div>

        </div>

        {/* Regras */}

        <Field label="Regras da operação">

          <div className="flex gap-2">

            <input
              value={ruleDraft}
              onChange={(e) => setRuleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const valor = ruleDraft.trim();
                  if (valor) {
                    setRules((prev) => [...prev, valor]);
                    setRuleDraft("");
                  }
                }
              }}
              placeholder="Digite uma regra e pressione Enter"
              className={inputClass}
            />

          </div>

          {rules.length > 0 && (

            <ul className="mt-2 space-y-1.5">

              {rules.map((rule, index) => (

                <li
                  key={index}
                  className="flex items-start gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-600"
                >

                  <span className="flex-1">{rule}</span>

                  <button
                    onClick={() =>
                      setRules((prev) =>
                        prev.filter((_, i) => i !== index)
                      )
                    }
                    aria-label="Remover regra"
                    className="shrink-0 text-zinc-400 hover:text-rose-600"
                  >
                    <X size={13} />
                  </button>

                </li>

              ))}

            </ul>

          )}

        </Field>

      </div>

    </Modal>
  );
}
