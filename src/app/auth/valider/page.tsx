import type { Metadata } from 'next';
import { confirmLinkAction } from '@/app/actions/auth';
import { Logo } from '@/components/brand/Logo';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Card } from '@/components/ui';

export const metadata: Metadata = { title: 'Confirmer votre accès' };

const TYPES = ['invite', 'recovery', 'signup', 'email'] as const;

export default async function ValiderPage({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string; next?: string }> }) {
  const params = await searchParams;
  const valid = Boolean(params.token_hash) && TYPES.includes(params.type as (typeof TYPES)[number]);

  return (
    <main id="contenu" className="flex min-h-dvh items-center justify-center bg-[radial-gradient(60%_50%_at_50%_0%,var(--c-accent-soft),transparent)] px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <Card>
          {valid ? (
            <>
              <h1 className="text-xl font-semibold tracking-tight">Confirmer votre accès</h1>
              <p className="mt-2 text-sm text-[var(--c-ink-soft)]">Cliquez sur le bouton pour continuer. Le lien ne fonctionne qu’une fois.</p>
              <ActionForm action={confirmLinkAction} className="mt-6 flex flex-col gap-4">
                <input type="hidden" name="token_hash" value={params.token_hash} />
                <input type="hidden" name="type" value={params.type} />
                <input type="hidden" name="next" value={params.next ?? '/definir-mot-de-passe'} />
                <SubmitButton>Continuer</SubmitButton>
              </ActionForm>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold tracking-tight">Lien incomplet</h1>
              <p className="mt-2 text-sm text-[var(--c-ink-soft)]">Ce lien n’est pas valide. Demandez un nouveau lien au bureau ou depuis la page de connexion.</p>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
