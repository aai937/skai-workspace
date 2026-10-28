import type { Metadata } from 'next';
import Link from 'next/link';
import { createChannelAction } from '@/app/actions/messaging';
import { ActionForm, SubmitButton, TextAreaField, TextField } from '@/components/forms';
import { Card, CardTitle, PageHeader } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import { listChannels, type ChannelRow } from '@/lib/data/messaging';
import { canCreateChannel } from '@/lib/domain/messaging';

export const metadata: Metadata = { title: 'Messages' };

const GROUPS: { kind: ChannelRow['kind']; title: string }[] = [
  { kind: 'general', title: 'Général' },
  { kind: 'pole', title: 'Pôles' },
  { kind: 'projet', title: 'Projets' },
  { kind: 'evenement', title: 'Événements' },
  { kind: 'libre', title: 'Canaux libres' },
];

export default async function MessagesPage() {
  const session = await requireSession();
  const channels = await listChannels();
  const canCreate = canCreateChannel(session.viewer);

  return (
    <>
      <PageHeader
        title="Messages"
        description="Discutez par pôle, par projet ou par événement. Les réponses se regroupent en fils, et les messages se mettent à jour en direct."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {GROUPS.map((group) => {
            const list = channels.filter((c) => c.kind === group.kind);
            if (list.length === 0) return null;
            return (
              <Card key={group.kind}>
                <CardTitle>{group.title}</CardTitle>
                <ul className="divide-y divide-[var(--c-line)]">
                  {list.map((c) => (
                    <li key={c.id} className="py-3">
                      <Link href={`/messages/${c.id}`} className="font-medium hover:underline">
                        # {c.name}
                      </Link>
                      {c.description ? <p className="mt-0.5 text-xs text-[var(--c-ink-faint)]">{c.description}</p> : null}
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>

        {canCreate ? (
          <Card>
            <CardTitle>Nouveau canal libre</CardTitle>
            <ActionForm action={createChannelAction} className="grid gap-3">
              <TextField name="name" label="Nom" required minLength={2} maxLength={80} />
              <TextAreaField name="description" label="Description" maxLength={500} />
              <SubmitButton>Créer le canal</SubmitButton>
            </ActionForm>
          </Card>
        ) : null}
      </div>
    </>
  );
}
