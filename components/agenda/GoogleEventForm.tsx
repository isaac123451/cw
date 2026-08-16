"use client";

import { useState } from "react";

import Modal, {
  Field,
  GhostButton,
  inputClass,
  PrimaryButton,
  textareaClass,
} from "@/components/shared/Modal";

import {
  GoogleEvent,
  GoogleEventDraft,
  REPEAT_LABELS,
  RepeatKind,
} from "@/lib/models/google";

interface Props {
  open: boolean;
  /** Ausente = criando. */
  editing?: GoogleEvent;
  /** Data sugerida ao criar a partir de um dia da lista. */
  presetDate?: string;
  saving: boolean;
  onClose: () => void;
  onSave: (data: GoogleEventDraft) => void;
}

/**
 * Formulário de evento do Google.
 *
 * Monta e desmonta com a abertura (`key` em quem abre), então os campos
 * são inicializados no `useState` — sem `setState` em efeito, que é a
 * dívida registrada no ROADMAP.
 */
export default function GoogleEventForm({
  open,
  editing,
  presetDate,
  saving,
  onClose,
  onSave,
}: Props) {

  const [title, setTitle] = useState(
    editing?.title ?? ""
  );

  const [date, setDate] = useState(
    editing?.date ??
      presetDate ??
      new Date().toISOString().slice(0, 10)
  );

  const [time, setTime] = useState(editing?.time ?? "");

  const [endTime, setEndTime] = useState(
    editing?.endTime ?? ""
  );

  const [description, setDescription] = useState(
    editing?.description ?? ""
  );

  const [repeatKind, setRepeatKind] =
    useState<RepeatKind>("nenhuma");

  const [everyDays, setEveryDays] = useState(7);
  const [until, setUntil] = useState("");

  const podeSalvar =
    title.trim() !== "" && date !== "" && !saving;

  /**
   * Repetição só na criação.
   *
   * Editar uma ocorrência solta mexe naquele dia; mudar a regra da série
   * inteira é outra operação no Google e daria a impressão errada de
   * estar reagendando só aquele evento.
   */
  const mostrarRepeticao = !editing;

  return (
    <Modal
      open={open}
      title={
        editing ? "Editar evento" : "Novo evento"
      }
      description="O evento vai para a sua agenda principal do Google."
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>
            Cancelar
          </GhostButton>

          <PrimaryButton
            onClick={() =>
              onSave({
                title: title.trim(),
                date,
                time: time || undefined,
                endTime: endTime || undefined,
                description:
                  description.trim() || undefined,
                repeat: mostrarRepeticao
                  ? {
                      kind: repeatKind,
                      everyDays,
                      until: until || undefined,
                    }
                  : undefined,
              })
            }
            disabled={!podeSalvar}
          >
            {saving
              ? "Salvando..."
              : editing
              ? "Salvar"
              : "Criar evento"}
          </PrimaryButton>
        </>
      }
    >

      <div className="space-y-4">

        <Field label="Título">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Check point da reputação"
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">

          <Field label="Data">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field
            label="Início"
            hint="Vazio = dia inteiro."
          >
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field
            label="Término"
            hint={
              time && !endTime
                ? "Vazio = 1h."
                : undefined
            }
          >
            <input
              type="time"
              value={endTime}
              // Sem início não há término: o evento é de dia inteiro.
              disabled={!time}
              onChange={(e) =>
                setEndTime(e.target.value)
              }
              className={`${inputClass} disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400`}
            />
          </Field>

        </div>

        {time && endTime && endTime <= time && (
          <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-700 ring-1 ring-inset ring-amber-100">
            O término precisa ser depois do início — do
            jeito que está, o evento vai durar uma hora.
          </p>
        )}

        {mostrarRepeticao && (

          <div className="rounded-xl border border-zinc-200 p-3.5">

            <Field label="Repetição">
              <select
                value={repeatKind}
                onChange={(e) =>
                  setRepeatKind(
                    e.target.value as RepeatKind
                  )
                }
                className={inputClass}
              >
                {(
                  Object.keys(
                    REPEAT_LABELS
                  ) as RepeatKind[]
                ).map((k) => (
                  <option key={k} value={k}>
                    {REPEAT_LABELS[k]}
                  </option>
                ))}
              </select>
            </Field>

            {repeatKind !== "nenhuma" && (

              <div className="mt-3 grid grid-cols-2 gap-3">

                {repeatKind === "personalizada" && (
                  <Field label="A cada (dias)">
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={everyDays}
                      onChange={(e) =>
                        setEveryDays(
                          Math.max(
                            Number(e.target.value) || 1,
                            1
                          )
                        )
                      }
                      className={inputClass}
                    />
                  </Field>
                )}

                <Field
                  label="Repetir até"
                  hint="Em branco = sem fim."
                  className={
                    repeatKind === "personalizada"
                      ? undefined
                      : "col-span-2"
                  }
                >
                  <input
                    type="date"
                    value={until}
                    min={date}
                    onChange={(e) =>
                      setUntil(e.target.value)
                    }
                    className={inputClass}
                  />
                </Field>

              </div>

            )}

          </div>

        )}

        {editing?.recurring && (
          <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-700 ring-1 ring-inset ring-amber-100">
            Este evento se repete. A alteração vale{" "}
            <strong className="font-semibold">
              só para este dia
            </strong>{" "}
            — a série continua como está.
          </p>
        )}

        <Field label="Descrição">
          <textarea
            value={description}
            onChange={(e) =>
              setDescription(e.target.value)
            }
            rows={3}
            placeholder="Opcional"
            className={textareaClass}
          />
        </Field>

      </div>

    </Modal>
  );
}
