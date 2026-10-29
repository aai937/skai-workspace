'use client';

// Barre de navigation en bas de l'écran, pour les téléphones : accès direct aux sections principales.
import { CalendarDays, FolderKanban, House, ListChecks, Megaphone, MessagesSquare, Users, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Tab = { href: string; label: string; icon: LucideIcon; match: string };

const TABS: Tab[] = [
  { href: '/tableau-de-bord', label: 'Accueil', icon: House, match: '/tableau-de-bord' },
  { href: '/messages', label: 'Messages', icon: MessagesSquare, match: '/messages' },
  { href: '/taches', label: 'Tâches', icon: ListChecks, match: '/taches' },
  { href: '/annonces', label: 'Annonces', icon: Megaphone, match: '/annonces' },
  { href: '/projets', label: 'Projets', icon: FolderKanban, match: '/projets' },
];

export function MobileTabBar({ isBureau }: { isBureau: boolean }) {
  const pathname = usePathname();
  const tabs = isBureau ? TABS : TABS.filter((t) => t.href !== '/projets');
  const more: Tab = { href: '/poles', label: 'Équipes', icon: Users, match: '/poles' };
  const all = [...tabs.slice(0, 4), more];

  return (
    <nav
      aria-label="Navigation rapide"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--c-line)] bg-[var(--c-surface)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {all.map((tab) => {
          const active = pathname === tab.match || pathname.startsWith(`${tab.match}/`);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium transition-colors ${
                  active ? 'text-[var(--c-accent)]' : 'text-[var(--c-ink-faint)]'
                }`}
              >
                <Icon aria-hidden="true" className="size-5" strokeWidth={active ? 2.2 : 1.8} />
                <span className="truncate">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
