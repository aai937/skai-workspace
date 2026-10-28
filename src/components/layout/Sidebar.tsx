'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export type NavItem = { href: string; label: string; match: string };

export const NAV_ITEMS: NavItem[] = [
  { href: '/tableau-de-bord', label: "Vue d'ensemble", match: '/tableau-de-bord' },
  { href: '/taches?vue=mes-taches', label: 'Mes tâches', match: '/taches?vue=mes-taches' },
  { href: '/taches', label: 'Toutes les tâches', match: '/taches' },
  { href: '/projets', label: 'Projets', match: '/projets' },
  { href: '/idees', label: 'Idées', match: '/idees' },
  { href: '/evenements', label: 'Événements', match: '/evenements' },
  { href: '/poles', label: 'Pôles et membres', match: '/poles' },
  { href: '/documents', label: 'Documents', match: '/documents' },
  { href: '/activite', label: 'Activité', match: '/activite' },
  { href: '/parametres', label: 'Paramètres', match: '/parametres' },
];

function isActive(pathname: string, item: NavItem): boolean {
  // « Toutes les tâches » ne s'allume pas sur « Mes tâches ».
  if (item.href === '/taches') {
    return pathname.startsWith('/taches');
  }
  return pathname === item.match || pathname.startsWith(`${item.match}/`);
}

export function Sidebar({ isBureau }: { isBureau: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = isBureau ? NAV_ITEMS : NAV_ITEMS.filter((i) => i.href !== '/parametres');

  const nav = (
    <nav aria-label="Navigation principale" className="flex flex-col gap-1">
      {items.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            onClick={() => setOpen(false)}
            className={`rounded-lg px-3 py-2 text-sm transition ${
              active
                ? 'bg-[var(--c-accent-soft)] font-medium text-[var(--c-accent)]'
                : 'text-[var(--c-ink-soft)] hover:bg-[var(--c-surface-muted)] hover:text-[var(--c-ink)]'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--c-line)] bg-[var(--c-surface)] px-4 py-3 lg:hidden">
        <Link href="/tableau-de-bord" className="font-semibold tracking-tight">
          skAI <span className="font-normal text-[var(--c-ink-faint)]">Workspace</span>
        </Link>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="menu-mobile"
          onClick={() => setOpen((v) => !v)}
          className="min-h-10 rounded-lg border border-[var(--c-line)] px-3 text-sm"
        >
          {open ? 'Fermer' : 'Menu'}
        </button>
      </div>
      {open ? (
        <div id="menu-mobile" className="border-b border-[var(--c-line)] bg-[var(--c-surface)] p-3 lg:hidden">
          {nav}
        </div>
      ) : null}
      <aside className="hidden w-60 shrink-0 border-r border-[var(--c-line)] bg-[var(--c-surface)] lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:p-4">
        <Link href="/tableau-de-bord" className="mb-6 px-3 pt-1 text-base font-semibold tracking-tight">
          skAI <span className="font-normal text-[var(--c-ink-faint)]">Workspace</span>
        </Link>
        {nav}
      </aside>
    </>
  );
}
