import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardTitle, PageHeader } from '@/components/ui';
import { requireSiteAdmin } from '@/lib/auth';

export const metadata: Metadata = { title: 'Paramètres' };

export default async function ParametresPage() {
  await requireSiteAdmin();

  return (
    <>
      <PageHeader title="Paramètres" description="Réservé au bureau : membres, invitations, équipes et droits d'accès." />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Membres et invitations</CardTitle>
          <p className="mb-4 text-sm text-[var(--c-ink-soft)]">Inviter, valider les comptes en attente, attribuer les rôles et les équipes.</p>
          <Link href="/parametres/membres" className="text-sm font-medium text-[var(--c-accent)] hover:underline">Ouvrir la gestion des membres</Link>
        </Card>
        <Card>
          <CardTitle>Équipes</CardTitle>
          <p className="mb-4 text-sm text-[var(--c-ink-soft)]">Renommer ou créer une équipe sans modifier le code.</p>
          <Link href="/parametres/membres#poles" className="text-sm font-medium text-[var(--c-accent)] hover:underline">Gérer les équipes</Link>
        </Card>
      </div>
    </>
  );
}
