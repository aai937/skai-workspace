import type { Metadata } from 'next';
import Link from 'next/link';
import { Avatar, Card, EmptyState, PageHeader } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import { listMembers, listPoles } from '@/lib/data/people';
import { LABELS } from '@/lib/domain/constants';

export const metadata: Metadata = { title: 'Équipes et membres' };

export default async function PolesPage() {
  await requireSession();
  const [poles, members] = await Promise.all([listPoles(), listMembers()]);
  const activeMembers = members.filter((m) => m.is_active);

  return (
    <>
      <PageHeader title="Équipes et membres" description="Les équipes de l’association et l’annuaire des membres." />

      <section aria-label="Équipes" className="mb-8 grid gap-4 md:grid-cols-2">
        {poles.length === 0 ? (
          <EmptyState title="Aucun équipe" text="Le bureau peut créer les équipes depuis les paramètres." />
        ) : (
          poles.map((pole) => {
            const count = pole.pole_memberships.length;
            return (
              <Card key={pole.id}>
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/poles/${pole.slug}`} className="text-lg font-semibold tracking-tight hover:underline">
                    {pole.name}
                  </Link>
                  <span className="text-xs text-[var(--c-ink-faint)]">{count} membre(s)</span>
                </div>
                <p className="mt-2 text-sm text-[var(--c-ink-soft)]">{pole.description || 'Pas encore de description.'}</p>
              </Card>
            );
          })
        )}
      </section>

      <section aria-label="Annuaire des membres">
        <h2 className="mb-4 text-base font-semibold">Annuaire</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activeMembers.map((m) => {
            const poleNames = m.pole_memberships.filter((pm) => pm.pole && !pm.pole.archived_at).map((pm) => `${pm.pole!.name}`);
            return (
              <li key={m.id} className="flex items-start gap-3 rounded-2xl border border-[var(--c-line)] bg-[var(--c-surface)] p-4">
                <Avatar name={m.full_name} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.full_name}</p>
                  <p className="text-xs text-[var(--c-ink-faint)]">{LABELS.globalRole[m.role]}</p>
                  <p className="mt-1 text-xs text-[var(--c-ink-soft)]">{poleNames.join(' · ') || 'Aucun équipe'}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
