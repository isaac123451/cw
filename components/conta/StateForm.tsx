"use client";

import { ReactNode, useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

import { ActionState } from "@/lib/auth/account";

interface Props {
  action: (
    state: ActionState,
    formData: FormData
  ) => Promise<ActionState>;
  submitLabel: string;
  disabled?: boolean;
  children: ReactNode;
}

function Submit({
  label,
  disabled,
}: {
  label: string;
  disabled?: boolean;
}) {

  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-800 px-5 text-sm font-medium text-white transition-colors hover:bg-violet-900 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending && (
        <Loader2 size={15} className="animate-spin" />
      )}
      {label}
    </button>
  );
}

/**
 * Formulário ligado a uma server action, com retorno de erro e sucesso.
 * O AuthForm original só trata erro e monta os campos sozinho — aqui os
 * campos vêm de fora, porque cada aba da conta tem um layout diferente.
 */
export default function StateForm({
  action,
  submitLabel,
  disabled,
  children,
}: Props) {

  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4">

      {children}

      {state.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-100"
        >
          <AlertCircle
            size={15}
            className="mt-0.5 shrink-0"
          />
          {state.error}
        </p>
      )}

      {state.success && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-100"
        >
          <CheckCircle2
            size={15}
            className="mt-0.5 shrink-0"
          />
          {state.success}
        </p>
      )}

      <Submit
        label={submitLabel}
        disabled={disabled}
      />

    </form>
  );
}
