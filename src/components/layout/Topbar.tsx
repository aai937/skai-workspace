// Barre supérieure : recherche globale, création rapide, notifications et profil. Rendue côté serveur.
import { Bell, CalendarDays, CircleUser, FileText, FolderKanban, Lightbulb, ListChecks, LogOut, Megaphone, Plus, Search, Users } from 'lucide-react';
import Link from 'next/link';
import { signOutAction } from '@/app/actions/auth';
import { Avatar } from '@/components/ui';
import type { Session } from '@/lib/auth';
import { canCreateEvent, canCreateProject, canCreateTask } from '@/lib/domain/permissions';
import { canPublishAnnouncementAnywhere } from '@/lib/domain/messaging';

const dropdownItem =
  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[var(--c-ink)] transition-colors hover:bg-[var(--c-surface-muted)]';

export function Topbar({ session, unread }: { session: Session; unread: number }) {
  const v = session.viewer;
  const create = [
    { href: '/taches/nouvelle', label: 'Tâche', icon: ListChecks, show: canCreateTask(v) },
    { href: '/idees/nouvelle', label: 'Idée', icon: Lightbulb, show: true },
    { href: '/projets/nouveau', label: 'Projet', icon: FolderKanban, show: canCreateProject(v) },
    { href: '/evenements/nouveau', label: 'Événement', icon: CalendarDays, show: canCreateEvent(v) },
    { href: '/annonces', label: 'Annonce', icon: Megaphone, show: canPublishAnnouncementAnywhere(v) },
    { href: '/documents/nouveau', label: 'Document', icon: FileText, show: true },
  ].filter((a) => a.show);

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--c-line)] bg-[var(--c-canvas)]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 lg:px-8">
        <form action="/recherche" role="search" className="relative order-last w-full sm:order-none sm:w-auto sm:flex-1">
          <label htmlFor="recherche-globale" className="sr-only">
            Recherche globale
          </label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--c-ink-faint)]" />
          <input
            id="recherche-globale"
            name="q"
            type="search"
            placeholder="Rechercher…"
            className="h-10 w-full rounded-xl border border-[var(--c-line)] bg-[var(--c-surface)] pl-9 pr-3 text-sm shadow-[var(--shadow-card)] placeholder:text-[var(--c-ink-faint)] focus:border-[var(--c-accent)] sm:max-w-md"
          />
        </form>

        <div className="ml-auto flex items-center gap-2">
          <details className="relative">
            <summary className="inline-flex h-10 cursor-pointer list-none items-center gap-1.5 rounded-xl bg-[var(--c-accent)] px-3.5 text-sm font-medium text-[var(--c-accent-ink)] transition hover:bg-[var(--c-accent-hover)]">
              <Plus aria-hidden="true" className="size-4" strokeWidth={2.4} />
              Créer
            </summary>
            <div className="absolute right-0 z-30 mt-2 w-52 rounded-xl border border-[var(--c-line)] bg-[var(--c-surface)] p-1.5 shadow-[var(--shadow-card)]">
              {create.map((a) => (
                <Link key={a.href} href={a.href} className={dropdownItem}>
                  <a.icon aria-hidden="true" className="size-4 text-[var(--c-ink-soft)]" />
                  {a.label}
                </Link>
              ))}
            </div>
          </details>

          <Link
            href="/notifications"
            aria-label={unread > 0 ? `Notifications, ${unread} non lues` : 'Notifications'}
            className="relative inline-flex size-10 items-center justify-center rounded-xl border border-[var(--c-line)] bg-[var(--c-surface)] text-[var(--c-ink-soft)] transition hover:text-[var(--c-ink)]"
          >
            <Bell aria-hidden="true" className="size-[18px]" />
            {unread > 0 ? (
              <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-[var(--c-accent)] px-1 text-[11px] font-semibold leading-5 text-[var(--c-accent-ink)]">
                {unread > 99 ? '99+' : unread}
              </span>
            ) : null}
          </Link>

          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl py-1 pl-1 pr-2.5 transition hover:bg-[var(--c-surface-muted)]">
              <Avatar name={session.profile.full_name} />
              <span className="hidden text-sm font-medium sm:inline">{session.profile.full_name}</span>
            </summary>
            <div className="absolute right-0 z-30 mt-2 w-60 rounded-xl border border-[var(--c-line)] bg-[var(--c-surface)] p-1.5 shadow-[var(--shadow-card)]">
              <p className="truncate px-3 py-2 text-xs text-[var(--c-ink-faint)]">{session.profile.email}</p>
              <Link href="/profil" className={dropdownItem}>
                <CircleUser aria-hidden="true" className="size-4 text-[var(--c-ink-soft)]" />
                Mon profil
              </Link>
              {session.profile.is_site_admin ? (
                <Link href="/parametres/membres" className={dropdownItem}>
                  <Users aria-hidden="true" className="size-4 text-[var(--c-ink-soft)]" />
                  Gérer les membres
                </Link>
              ) : null}
              <form action={signOutAction}>
                <button type="submit" className={`${dropdownItem} w-full text-left`}>
                  <LogOut aria-hidden="true" className="size-4 text-[var(--c-ink-soft)]" />
                  Se déconnecter
                </button>
              </form>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
