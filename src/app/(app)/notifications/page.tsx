import type { Metadata } from 'next';
import Link from 'next/link';
import { markAllNotificationsReadAction, markNotificationReadAction } from '@/app/actions/notifications';
import { ActionButton } from '@/components/forms';
import { EmptyState, PageHeader } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import { listNotifications } from '@/lib/data/activity';
import { formatDateTime } from '@/lib/domain/format';

export const metadata: Metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  await requireSession();
  const notifications = await listNotifications(100);
  const unread = notifications.filter((n) => !n.read_at).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Attributions, mentions, blocages et décisions qui vous concernent."
        actions={unread > 0 ? <ActionButton action={markAllNotificationsReadAction}>Tout marquer comme lu</ActionButton> : null}
      />
      {notifications.length === 0 ? (
        <EmptyState title="Rien à signaler" text="Vous serez prévenu lorsqu'une tâche vous est attribuée ou qu'on vous mentionne." />
      ) : (
        <ul className="divide-y divide-[var(--c-line)] overflow-hidden rounded-2xl border border-[var(--c-line)] bg-[var(--c-surface)]">
          {notifications.map((n) => (
            <li key={n.id} className={`flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between ${n.read_at ? '' : 'bg-[var(--c-accent-soft)]/40'}`}>
              <div className="min-w-0">
                <Link href={n.link} className="font-medium hover:underline">
                  {n.title}
                </Link>
                {n.body ? <p className="mt-0.5 line-clamp-2 text-sm text-[var(--c-ink-soft)]">{n.body}</p> : null}
                <p className="mt-1 text-xs text-[var(--c-ink-faint)]">
                  {n.actor ? `${n.actor.full_name} · ` : ''}
                  {formatDateTime(n.created_at)}
                </p>
              </div>
              {!n.read_at ? <ActionButton action={markNotificationReadAction.bind(null, n.id)}>Marquer comme lue</ActionButton> : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
