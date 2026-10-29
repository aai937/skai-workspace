'use client';

import { createContext, useActionState, useContext, useState, useTransition, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import type { ActionResult } from '@/lib/result';

// Les erreurs de champ remontent du serveur ; chaque champ les lit par contexte.
const FieldErrorsContext = createContext<Record<string, string>>({});

type FormState = { error?: string; message?: string; fieldErrors?: Record<string, string>; version: number } | null;

type FormAction = (formData: FormData) => Promise<ActionResult<unknown> | void>;

// Formulaire relié à une action serveur. La validation est faite côté serveur ; ici seulement l'affichage.
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  id,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  id?: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(async (_previous, formData) => {
    const result = await action(formData);
    const version = Date.now();
    if (!result) {
      return { version };
    }
    if (result.ok) {
      return { message: result.message, version };
    }
    return { error: result.error, fieldErrors: result.fieldErrors, version };
  }, null);

  const [formKey, setFormKey] = useState(0);
  if (resetOnSuccess && state?.message && formKey !== state.version) {
    setFormKey(state.version);
  }

  return (
    <FieldErrorsContext.Provider value={state?.fieldErrors ?? {}}>
      <form key={resetOnSuccess ? formKey : undefined} id={id} action={formAction} className={className} noValidate>
        {children}
        {state?.error ? (
          <p role="alert" className="rounded-lg bg-[var(--c-danger-soft)] px-3 py-2 text-sm text-[var(--c-danger)]">
            {state.error}
          </p>
        ) : null}
        {state?.message ? (
          <p role="status" className="rounded-lg bg-[var(--c-success-soft)] px-3 py-2 text-sm text-[var(--c-success)]">
            {state.message}
          </p>
        ) : null}
      </form>
    </FieldErrorsContext.Provider>
  );
}

export function SubmitButton({ children, variant = 'primary', className = '' }: { children: ReactNode; variant?: 'primary' | 'secondary' | 'danger'; className?: string }) {
  const { pending } = useFormStatus();
  const styles = {
    primary: 'bg-[var(--c-accent)] text-[var(--c-accent-ink)] hover:opacity-90',
    secondary: 'border border-[var(--c-line)] bg-[var(--c-surface)] text-[var(--c-ink)] hover:bg-[var(--c-surface-muted)]',
    danger: 'bg-[var(--c-danger)] text-white hover:opacity-90',
  };
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-medium transition disabled:opacity-60 ${styles[variant]} ${className}`}
    >
      {pending ? 'Enregistrement…' : children}
    </button>
  );
}

const inputClass =
  'mt-1 block w-full min-h-11 rounded-lg border border-[var(--c-line)] bg-[var(--c-surface)] px-3 py-2 text-base text-[var(--c-ink)] sm:text-sm placeholder:text-[var(--c-ink-faint)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--c-accent)]';

function FieldShell({ name, label, hint, children }: { name: string; label: string; hint?: string; children: ReactNode }) {
  const errors = useContext(FieldErrorsContext);
  const error = errors[name];
  return (
    <div className="block">
      <span className="text-sm font-medium text-[var(--c-ink)]">{label}</span>
      {children}
      {hint && !error ? <span className="mt-1 block text-xs text-[var(--c-ink-faint)]">{hint}</span> : null}
      {error ? <span className="mt-1 block text-xs text-[var(--c-danger)]">{error}</span> : null}
    </div>
  );
}

export function TextField({
  name,
  label,
  hint,
  ...input
}: { name: string; label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell name={name} label={label} hint={hint}>
      <input name={name} className={inputClass} {...input} />
    </FieldShell>
  );
}

export function TextAreaField({
  name,
  label,
  hint,
  ...input
}: { name: string; label: string; hint?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell name={name} label={label} hint={hint}>
      <textarea name={name} rows={4} className={`${inputClass} min-h-24`} {...input} />
    </FieldShell>
  );
}

export function SelectField({
  name,
  label,
  hint,
  options,
  placeholder,
  ...input
}: {
  name: string;
  label: string;
  hint?: string;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldShell name={name} label={label} hint={hint}>
      <select name={name} className={inputClass} {...input}>
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

// Action destructive ou sensible : confirmation explicite avant l'appel serveur.
export function ConfirmButton({
  action,
  message,
  children,
  variant = 'secondary',
}: {
  action: () => Promise<ActionResult | void>;
  message: string;
  children: ReactNode;
  variant?: 'secondary' | 'danger';
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(message)) return;
          setError(null);
          start(async () => {
            const result = await action();
            if (result && !result.ok) setError(result.error);
          });
        }}
        className={`inline-flex min-h-9 items-center rounded-lg px-3 text-sm font-medium disabled:opacity-60 ${
          variant === 'danger'
            ? 'bg-[var(--c-danger-soft)] text-[var(--c-danger)]'
            : 'border border-[var(--c-line)] bg-[var(--c-surface)] text-[var(--c-ink-soft)] hover:text-[var(--c-ink)]'
        }`}
      >
        {pending ? '…' : children}
      </button>
      {error ? <span role="alert" className="text-xs text-[var(--c-danger)]">{error}</span> : null}
    </span>
  );
}

// Bouton d'action immédiate (sans confirmation), ex. « Voter », « Marquer comme lu ».
export function ActionButton({ action, children, className = '' }: { action: () => Promise<ActionResult | void>; children: ReactNode; className?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const result = await action();
            if (result && !result.ok) setError(result.error);
          });
        }}
        className={`inline-flex min-h-9 items-center rounded-lg border border-[var(--c-line)] bg-[var(--c-surface)] px-3 text-sm font-medium text-[var(--c-ink)] hover:bg-[var(--c-surface-muted)] disabled:opacity-60 ${className}`}
      >
        {pending ? '…' : children}
      </button>
      {error ? <span role="alert" className="text-xs text-[var(--c-danger)]">{error}</span> : null}
    </span>
  );
}
