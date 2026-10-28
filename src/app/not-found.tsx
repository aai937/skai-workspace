import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';

export default function NotFound() {
  return (
    <main id="contenu" className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo />
      <p className="text-sm font-medium text-[var(--c-accent)]">Erreur 404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Cette page n’existe pas</h1>
      <p className="max-w-sm text-sm text-[var(--c-ink-soft)]">Le lien est peut-être ancien, ou la page a été déplacée.</p>
      <Link href="/tableau-de-bord" className="inline-flex min-h-10 items-center rounded-xl bg-[var(--c-accent)] px-4 text-sm font-medium text-[var(--c-accent-ink)] hover:bg-[var(--c-accent-hover)]">
        Retour au tableau de bord
      </Link>
    </main>
  );
}
