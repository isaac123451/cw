"use client";

import { useEffect, useState } from "react";

import { Save, X } from "lucide-react";

import Modal, {
  Field,
  GhostButton,
  PrimaryButton,
  inputClass,
  textareaClass,
} from "@/components/shared/Modal";

import { useSession } from "@/lib/context/SessionContext";
import { ProjectDraft } from "@/lib/context/ProjectsContext";

import { Project, ProjectStage } from "@/lib/models/project";

const ETAPAS: ProjectStage[] = [
  "Ideia",
  "Planejado",
  "Em andamento",
  "Concluído",
];

const IMPACTOS: Project["impact"][] = [
  "Alto",
  "Médio",
  "Baixo",
];

interface Props {
  open: boolean;
  editing?: Project;
  presetStage?: ProjectStage;
  onClose: () => void;
  onSave: (data: ProjectDraft | Project) => void;
}

export default function ProjectForm({
  open,
  editing,
  presetStage,
  onClose,
  onSave,
}: Props) {

  const session = useSession();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stage, setStage] = useState<ProjectStage>("Ideia");
  const [impact, setImpact] =
    useState<Project["impact"]>("Médio");
  const [owner, setOwner] = useState("");
  const [progress, setProgress] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");

  useEffect(() => {
    if (!open) return;

    if (editing) {
      setTitle(editing.title);
      setDescription(editing.description);
      setStage(editing.stage);
      setImpact(editing.impact);
      setOwner(editing.owner);
      setProgress(editing.progress);
      setTags(editing.tags);
      return;
    }

    setTitle("");
    setDescription("");
    setStage(presetStage ?? "Ideia");
    setImpact("Médio");
    setOwner(session?.name ?? "Operação");
    setProgress(0);
    setTags([]);
    setTagDraft("");
  }, [open, editing, presetStage, session]);

  function addTag() {
    const valor = tagDraft.trim();

    if (!valor || tags.includes(valor)) return;

    setTags((prev) => [...prev, valor]);
    setTagDraft("");
  }

  const valido =
    title.trim() !== "" && owner.trim() !== "";

  function salvar() {

    if (!valido) return;

    const base: ProjectDraft = {
      title: title.trim(),
      description: description.trim(),
      stage,
      impact,
      owner: owner.trim(),
      progress:
        stage === "Concluído" ? 100 : progress,
      updatedAt: new Date()
        .toISOString()
        .slice(0, 10),
      tags,
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
        editing ? "Editar iniciativa" : "Nova iniciativa"
      }
      description="Ideias, melhorias de processo e projetos da área."
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
            {editing ? "Salvar" : "Criar iniciativa"}
          </PrimaryButton>
        </>
      }
    >

      <div className="space-y-5">

        <Field label="Título">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: alertas automáticos de SLA"
            className={inputClass}
          />
        </Field>

        <Field label="Descrição">
          <textarea
            value={description}
            onChange={(e) =>
              setDescription(e.target.value)
            }
            rows={3}
            placeholder="O que essa iniciativa resolve"
            className={textareaClass}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">

          <Field label="Etapa">
            <select
              value={stage}
              onChange={(e) =>
                setStage(e.target.value as ProjectStage)
              }
              className={inputClass}
            >
              {ETAPAS.map((item) => (
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
              placeholder="Quem conduz"
              className={inputClass}
            />
          </Field>

        </div>

        <Field label="Impacto esperado">

          <div className="flex items-center rounded-xl border border-zinc-200 p-1">

            {IMPACTOS.map((item) => (

              <button
                key={item}
                onClick={() => setImpact(item)}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                  impact === item
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
          label="Progresso"
          hint={
            stage === "Concluído"
              ? "Concluído entra sempre como 100%."
              : `${progress}% concluído.`
          }
        >
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={stage === "Concluído" ? 100 : progress}
            disabled={stage === "Concluído"}
            onChange={(e) =>
              setProgress(Number(e.target.value))
            }
            className="w-full accent-violet-700 disabled:opacity-50"
          />
        </Field>

        <Field label="Etiquetas">

          <div className="flex gap-2">

            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="Digite e pressione Enter"
              className={inputClass}
            />

            <button
              onClick={addTag}
              className="shrink-0 rounded-xl border border-zinc-200 px-4 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
            >
              Adicionar
            </button>

          </div>

          {tags.length > 0 && (

            <div className="mt-2.5 flex flex-wrap gap-1.5">

              {tags.map((tag) => (

                <span
                  key={tag}
                  className="flex items-center gap-1 rounded-lg bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-600"
                >

                  {tag}

                  <button
                    onClick={() =>
                      setTags((prev) =>
                        prev.filter((item) => item !== tag)
                      )
                    }
                    aria-label={`Remover ${tag}`}
                    className="text-zinc-400 hover:text-rose-600"
                  >
                    <X size={11} />
                  </button>

                </span>

              ))}

            </div>

          )}

        </Field>

      </div>

    </Modal>
  );
}
