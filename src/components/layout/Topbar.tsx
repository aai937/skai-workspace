// Barre supérieure : recherche globale, création rapide, notifications et profil. Sans JavaScript côté client.
import Link from 'next/link';
import { signOutAction } from '@/app/actions/auth';
import { Avatar } from '@/components/ui';
import type { Session } from '@/lib/auth';

const QUICK_CREATE = [
  { href: '/taches/nouvelle', label: 'Tâche', allowed: (s: Session) => s.poles.some((p) => p.role === 'responsable') || s.viewer.isBureau },
  { href: '/idees/nouvelle', label: 'Idée', allowed: () => true },
  { href: '/projets/nouveau', label: 'Projet', allowed: (s: Session) => s.poles.some((p) => p.role === 'responsable') || s.viewer.isBureau },
  { href: '/evenements/nouveau', label: 'Événement', allowed: (s: Session) => s.poles.some((p) => p.role === 'responsable') || s.viewer.isBureau },
  { href: '/documents/nouveau', label: 'Document', allowed: () => true },
];

export function Topbar({ session, unread }: { session: Session; unread: number }) {
  const actions = QUICK_CREATE.filter((a) => a.allowed(session));

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-[var(--c-line)] bg-[var(--c-canvas)]/90 px-4 py-3 backdrop-blur lg:px-6">
      <form action="/recherche" role="search" className="order-last w-full flex-1 sm:order-none sm:w-auto">
        <label htmlFor="recherche-globale" className="sr-only">
          Recherche globale
        </label>
        <input
          id="recherche-globale"
          name="q"
          type="search"
          placeholder="Rechercher tâches, projets, idées, événements, documents…"
          className="w-full max-w-xl rounded-lg border border-[var(--c-line)] bg-[var(--c-surface)] px-3 py-2 text-sm"
        />
      </form>

      <details className="relative">
        <summary className="inline-flex min-h-10 cursor-pointer list-none items-center rounded-lg bg-[var(--c-accent)] px-4 text-sm font-medium text-white">
          Créer
        </summary>
        <div className="absolute right-0 z-30 mt-2 w-44 rounded-xl border border-[var(--c-line)] bg-[var(--c-surface)] p-1 shadow-lg">
          {actions.map((a) => (
            <Link key={a.href} href={a.href} className="block rounded-lg px-3 py-2 text-sm hover:bg-[var(--c-surface-muted)]">
              {a.label}
            </Link>
          ))}
        </div>
      </details>

      <Link
        href="/notifications"
        aria-label={unread > 0 ? `Notifications, ${unread} non lues` : 'Notifications'}
        className="relative inline-flex size-10 items-center justify-center rounded-lg border border-[var(--c-line)] bg-[var(--c-surface)] text-sm"
      >
        <span aria-hidden="true">🔔</span>
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[var(--c-danger)] px-1 text-center text-[11px] font-semibold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </Link>

      <details className="relative">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-[var(--c-surface-muted)]">
          <Avatar name={session.profile.full_name} />
          <span className="text-sm font-medium">{session.profile.full_name}</span>
        </summary>
        <div className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-[var(--c-line)] bg-[var(--c-surface)] p-1 shadow-lg">
          <p className="px-3 py-2 text-xs text-[var(--c-ink-faint)]">{session.profile.email}</p>
          <Link href="/profil" className="block rounded-lg px-3 py-2 text-sm hover:bg-[var(--c-surface-muted)]">
            Mon profil
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--c-surface-muted)]">
              Se déconnecter
            </button>
          </form>
        </div>
      </details>
    </header>
  );
}
