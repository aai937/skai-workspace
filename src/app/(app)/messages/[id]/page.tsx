import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { postMessageAction } from '@/app/actions/messaging';
import { MessageItem } from '@/components/messaging/MessageItem';
import { RealtimeRefresh } from '@/components/messaging/RealtimeRefresh';
import { ActionForm, SubmitButton, TextAreaField } from '@/components/forms';
import { Card, PageHeader } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import { getChannel, listMessages } from '@/lib/data/messaging';
import { getFormOptions } from '@/lib/data/options';

export const metadata: Metadata = { title: 'Canal' };

export default async function CanalPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const channel = await getChannel(id);
  if (!channel) {
    notFound();
  }
  const [{ roots, replies }, options] = await Promise.all([listMessages(id, session.viewer.id), getFormOptions()]);

  return (
    <>
      <RealtimeRefresh channelId={id} />
      <nav className="mb-3 text-sm text-[var(--c-ink-faint)]">
        <Link href="/messages" className="hover:underline">Messages</Link>
      </nav>
      <PageHeader title={`# ${channel.name}`} description={channel.description || undefined} />

      <Card>
        {roots.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--c-ink-faint)]">Aucun message pour l’instant. Lancez la discussion ci-dessous.</p>
        ) : (
          <ul className="divide-y divide-[var(--c-line)]">
            {roots.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                replies={replies[message.id] ?? []}
                viewer={session.viewer}
                channelId={id}
              />
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-6">
        <Card>
          <ActionForm action={postMessageAction} resetOnSuccess className="flex flex-col gap-3">
            <input type="hidden" name="channelId" value={id} />
            <TextAreaField name="body" label="Écrire dans le canal" maxLength={4000} required />
            {options.memberRows.length > 0 ? (
              <fieldset className="flex flex-wrap gap-3 text-sm">
                <legend className="mb-1 text-xs text-[var(--c-ink-soft)]">Mentionner</legend>
                {options.memberRows
                  .filter((m) => m.id !== session.viewer.id)
                  .map((m) => (
                    <label key={m.id} className="inline-flex items-center gap-1.5">
                      <input type="checkbox" name="mentions" value={m.id} className="size-4" />
                      {m.full_name}
                    </label>
                  ))}
              </fieldset>
            ) : null}
            <div>
              <SubmitButton>Envoyer</SubmitButton>
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
