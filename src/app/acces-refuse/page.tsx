import type { Metadata } from 'next';
import { Card, LinkButton } from '@/components/ui';

export const metadata: Metadata = { title: 'Accès refusé' };

export default function AccesRefusePage() {
  return (
    <main id="contenu" className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Card>
          <h1 className="text-xl font-semibold tracking-tight">Accès refusé</h1>
          <p className="mt-2 text-sm text-[var(--c-ink-soft)]">Cette page est réservée au bureau de l’association.</p>
          <div className="mt-6">
            <LinkButton href="/tableau-de-bord" variant="secondary">
              Retour au tableau de bord
            </LinkButton>
          </div>
        </Card>
      </div>
    </main>
  );
}
