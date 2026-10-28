// Composants d'affichage sans état (utilisables côté serveur).
import Link from 'next/link';
import type { ReactNode } from 'react';
import { LABELS, type TaskPriority, type TaskStatus } from '@/lib/domain/constants';

export function Card({ children, className = '', id, as: Tag = 'section' }: { children: ReactNode; className?: string; id?: string; as?: 'section' | 'article' | 'div' }) {
  return (
    <Tag id={id} className={`rounded-2xl border border-[var(--c-line)] bg-[var(--c-surface)] p-5 fade-in ${className}`}>
      {children}
    </Tag>
  );
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold tracking-tight text-[var(--c-ink)]">{children}</h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--c-ink)]">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-[var(--c-ink-soft)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--c-line)] px-6 py-10 text-center">
      <p className="font-medium text-[var(--c-ink)]">{title}</p>
      {text ? <p className="mx-auto mt-1 max-w-md text-sm text-[var(--c-ink-soft)]">{text}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

const TONES = {
  neutral: 'bg-[var(--c-surface-muted)] text-[var(--c-ink-soft)]',
  accent: 'bg-[var(--c-accent-soft)] text-[var(--c-accent)]',
  success: 'bg-[var(--c-success-soft)] text-[var(--c-success)]',
  warning: 'bg-[var(--c-warning-soft)] text-[var(--c-warning)]',
  danger: 'bg-[var(--c-danger-soft)] text-[var(--c-danger)]',
} as const;

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: keyof typeof TONES }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}

const TASK_STATUS_TONE: Record<TaskStatus, keyof typeof TONES> = {
  a_faire: 'neutral',
  en_cours: 'accent',
  en_attente: 'warning',
  bloquee: 'danger',
  en_revue: 'accent',
  terminee: 'success',
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge tone={TASK_STATUS_TONE[status]}>{LABELS.taskStatus[status]}</Badge>;
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const tone = priority === 'urgente' ? 'danger' : priority === 'haute' ? 'warning' : 'neutral';
  return <Badge tone={tone}>{LABELS.taskPriority[priority]}</Badge>;
}

export function LateBadge() {
  return <Badge tone="danger">En retard</Badge>;
}

export function LinkButton({
  href,
  children,
  variant = 'primary',
}: {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary';
}) {
  const styles =
    variant === 'primary'
      ? 'bg-[var(--c-accent)] text-white hover:opacity-90'
      : 'border border-[var(--c-line)] bg-[var(--c-surface)] text-[var(--c-ink)] hover:bg-[var(--c-surface-muted)]';
  return (
    <Link href={href} className={`inline-flex min-h-10 items-center justify-center rounded-lg px-4 text-sm font-medium transition ${styles}`}>
      {children}
    </Link>
  );
}

export function Stat({ label, value, href, tone }: { label: string; value: number | string; href?: string; tone?: 'danger' | 'warning' }) {
  const body = (
    <>
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--c-ink-faint)]">{label}</span>
      <span
        className={`mt-1 block text-2xl font-semibold tabular-nums ${tone === 'danger' ? 'text-[var(--c-danger)]' : tone === 'warning' ? 'text-[var(--c-warning)]' : 'text-[var(--c-ink)]'}`}
      >
        {value}
      </span>
    </>
  );
  const className = 'block rounded-2xl border border-[var(--c-line)] bg-[var(--c-surface)] p-4 transition hover:border-[var(--c-ink-faint)]';
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--c-surface-muted)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-label={label ?? 'Avancement'}
      >
        <div className="h-full rounded-full bg-[var(--c-accent)] transition-[width]" style={{ width: `${value}%` }} />
      </div>
      <span className="w-10 text-right text-xs font-medium tabular-nums text-[var(--c-ink-soft)]">{value}%</span>
    </div>
  );
}

export function Avatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span aria-hidden="true" className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--c-accent-soft)] text-xs font-semibold text-[var(--c-accent)]">
      {initials || '?'}
    </span>
  );
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-[var(--c-line)]">{children}</ul>;
}
