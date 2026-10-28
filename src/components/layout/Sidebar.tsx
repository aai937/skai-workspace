'use client';

import {
  Activity,
  CalendarDays,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  Lightbulb,
  Megaphone,
  Menu,
  MessagesSquare,
  Settings,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Logo } from '@/components/brand/Logo';

type NavItem = { href: string; label: string; icon: LucideIcon; bureauOnly?: boolean };
type NavGroup = { title: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Espace',
    items: [
      { href: '/tableau-de-bord', label: "Vue d'ensemble", icon: LayoutDashboard },
      { href: '/messages', label: 'Messages', icon: MessagesSquare },
      { href: '/annonces', label: 'Annonces', icon: Megaphone },
    ],
  },
  {
    title: 'Travail',
    items: [
      { href: '/taches?vue=mes-taches', label: 'Mes tâches', icon: ListChecks },
      { href: '/taches', label: 'Toutes les tâches', icon: ListTodo },
      { href: '/projets', label: 'Projets', icon: FolderKanban },
      { href: '/idees', label: 'Idées', icon: Lightbulb },
      { href: '/evenements', label: 'Événements', icon: CalendarDays },
    ],
  },
  {
    title: 'Association',
    items: [
      { href: '/poles', label: 'Pôles et membres', icon: Users },
      { href: '/documents', label: 'Documents', icon: FileText },
      { href: '/activite', label: 'Activité', icon: Activity },
      { href: '/parametres', label: 'Paramètres', icon: Settings, bureauOnly: true },
    ],
  },
];

function isActive(pathname: string, vue: string | null, href: string): boolean {
  if (href === '/taches?vue=mes-taches') return pathname === '/taches' && vue === 'mes-taches';
  // « Toutes les tâches » reste actif sur les pages de tâches, sauf en vue « Mes tâches ».
  if (href === '/taches') return pathname.startsWith('/taches') && vue !== 'mes-taches';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ isBureau, name }: { isBureau: boolean; name: string }) {
  const pathname = usePathname();
  const vue = useSearchParams().get('vue');
  const [open, setOpen] = useState(false);

  const nav = (
    <nav aria-label="Navigation principale" className="flex flex-col gap-6">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((i) => !i.bureauOnly || isBureau);
        return (
          <div key={group.title} className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--c-ink-faint)]">{group.title}</p>
            {items.map((item) => {
              const active = isActive(pathname, vue, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? 'bg-[var(--c-accent-soft)] font-medium text-[var(--c-accent)]'
                      : 'text-[var(--c-ink-soft)] hover:bg-[var(--c-surface-muted)] hover:text-[var(--c-ink)]'
                  }`}
                >
                  <Icon aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={active ? 2.1 : 1.8} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--c-line)] bg-[var(--c-surface)]/95 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/tableau-de-bord" aria-label="Accueil skAI Workspace">
          <Logo />
        </Link>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="menu-mobile"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex size-10 items-center justify-center rounded-lg border border-[var(--c-line)] text-[var(--c-ink)]"
        >
          {open ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
          <span className="sr-only">{open ? 'Fermer le menu' : 'Ouvrir le menu'}</span>
        </button>
      </header>

      {open ? (
        <div
          id="menu-mobile"
          className="fixed inset-x-0 bottom-0 top-[57px] z-40 overflow-y-auto border-t border-[var(--c-line)] bg-[var(--c-surface)] p-4 lg:hidden"
        >
          {nav}
          <p className="mt-8 px-3 text-xs text-[var(--c-ink-faint)]">Connecté : {name}</p>
        </div>
      ) : null}

      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-[var(--c-line)] bg-[var(--c-surface)] px-4 py-5 lg:flex">
        <Link href="/tableau-de-bord" className="mb-8 px-2" aria-label="Accueil skAI Workspace">
          <Logo />
        </Link>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">{nav}</div>
        <p className="mt-4 px-2 text-xs text-[var(--c-ink-faint)]">
          <span className="block truncate font-medium text-[var(--c-ink-soft)]">{name}</span>
          {isBureau ? 'Bureau' : 'Membre'}
        </p>
      </aside>
    </>
  );
}
