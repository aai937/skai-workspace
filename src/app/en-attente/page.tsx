import type { Metadata } from 'next';
import { signOutAction } from '@/app/actions/auth';
import { Card } from '@/components/ui';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Compte en attente' };

export default async function EnAttentePage() {
  const session = await getSession();
  if (session?.profile.is_active) {
    redirect('/tableau-de-bord');
  }
  return (
    <main id="contenu" className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Card>
          <h1 className="text-xl font-semibold tracking-tight">Compte en attente de validation</h1>
          <p className="mt-2 text-sm text-[var(--c-ink-soft)]">
            Votre compte a bien été créé, mais le bureau doit encore le valider avant que vous accédiez à l’espace de l’association.
          </p>
          <form action={signOutAction} className="mt-6">
            <button type="submit" className="min-h-10 rounded-lg border border-[var(--c-line)] px-4 text-sm">
              Se déconnecter
            </button>
          </form>
        </Card>
      </div>
    </main>
  );
}
