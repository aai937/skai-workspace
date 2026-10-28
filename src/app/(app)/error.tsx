'use client';

// Erreur inattendue dans l'espace privé : message clair et nouvelle tentative, sans détail technique.
import { useEffect } from 'react';

export default function ErreurPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Journal côté serveur uniquement (le digest ne contient aucune donnée personnelle).
    console.error('Erreur de page', error.digest);
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-start gap-4 py-16">
      <p className="text-sm font-medium text-[var(--c-accent)]">Une erreur est survenue</p>
      <h1 className="text-2xl font-semibold tracking-tight">Cette page n’a pas pu s’afficher</h1>
      <p className="text-sm text-[var(--c-ink-soft)]">
        Réessayez. Si le problème persiste, prévenez le bureau en indiquant l’heure approximative.
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={reset} className="min-h-10 rounded-xl bg-[var(--c-accent)] px-4 text-sm font-medium text-[var(--c-accent-ink)] hover:bg-[var(--c-accent-hover)]">
          Réessayer
        </button>
        <a href="/tableau-de-bord" className="inline-flex min-h-10 items-center rounded-xl border border-[var(--c-line)] px-4 text-sm">
          Tableau de bord
        </a>
      </div>
    </div>
  );
}
