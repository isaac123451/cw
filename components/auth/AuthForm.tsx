"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { AlertCircle, Loader2 } from "lucide-react";

import { FormState } from "@/lib/auth/actions";

interface Field {
  name: string;
  label: string;
  type: string;
  placeholder?: string;
  autoComplete?: string;
  hint?: string;
}

interface Props {
  action: (
    state: FormState,
    formData: FormData
  ) => Promise<FormState>;
  fields: Field[];
  submitLabel: string;
}

function Submit({ label }: { label: string }) {

  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-800 text-sm font-medium text-white transition-colors hover:bg-violet-900 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending && (
        <Loader2 size={15} className="animate-spin" />
      )}
      {label}
    </button>
  );
}

export default function AuthForm({
  action,
  fields,
  submitLabel,
}: Props) {

  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4">

      {fields.map((field) => (

        <div key={field.name}>

          <label
            htmlFor={field.name}
            className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
          >
            {field.label}
          </label>

          <input
            id={field.name}
            name={field.name}
            type={field.type}
            required
            placeholder={field.placeholder}
            autoComplete={field.autoComplete}
            className="mt-1.5 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400"
          />

          {field.hint && (
            <p className="mt-1.5 text-xs text-zinc-400">
              {field.hint}
            </p>
          )}

        </div>

      ))}

      {state.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-100"
        >
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {state.error}
        </p>
      )}

      <Submit label={submitLabel} />

    </form>
  );
}
