// Un message, ses réactions et ses réponses. Rendu côté serveur ; les actions sont liées côté serveur.
import { deleteMessageAction, postMessageAction, toggleReactionAction } from '@/app/actions/messaging';
import { ActionButton, ActionForm, ConfirmButton, SubmitButton, TextAreaField } from '@/components/forms';
import { Avatar } from '@/components/ui';
import { REACTION_EMOJIS, canDeleteMessage } from '@/lib/domain/messaging';
import type { Viewer } from '@/lib/domain/permissions';
import type { MessageItem as Message } from '@/lib/data/messaging';
import { formatDateTime } from '@/lib/domain/format';

function Reactions({ message }: { message: Message }) {
  const counts = new Map(message.reactions.map((r) => [r.emoji, r]));
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {REACTION_EMOJIS.map((emoji) => {
        const current = counts.get(emoji);
        const mine = current?.mine ?? false;
        return (
          <ActionButton
            key={emoji}
            action={toggleReactionAction.bind(null, message.id, emoji, !mine)}
            className={`!min-h-7 !px-2 text-xs ${mine ? '!border-[var(--c-accent)] !bg-[var(--c-accent-soft)]' : ''}`}
          >
            {emoji} {current ? current.count : ''}
          </ActionButton>
        );
      })}
    </div>
  );
}

export function MessageItem({
  message,
  replies,
  viewer,
  channelId,
}: {
  message: Message;
  replies: Message[];
  viewer: Viewer;
  channelId: string;
}) {
  const deleted = message.deleted_at !== null;
  const own = canDeleteMessage(viewer, { authorId: message.author?.id ?? null });

  return (
    <li className="flex gap-3 py-4">
      <Avatar name={message.author?.full_name ?? '?'} />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-medium">{message.author?.full_name ?? 'Membre supprimé'}</span>
          <span className="ml-2 text-xs text-[var(--c-ink-faint)]">{formatDateTime(message.created_at)}</span>
          {message.edited_at && !deleted ? <span className="ml-2 text-xs text-[var(--c-ink-faint)]">(modifié)</span> : null}
        </p>
        <p className={`mt-1 whitespace-pre-wrap text-sm ${deleted ? 'italic text-[var(--c-ink-faint)]' : 'text-[var(--c-ink-soft)]'}`}>{message.body}</p>

        {!deleted ? <Reactions message={message} /> : null}

        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          {!deleted ? (
            <details>
              <summary className="cursor-pointer text-[var(--c-accent)]">
                Répondre{message.replyCount > 0 ? ` (${message.replyCount})` : ''}
              </summary>
              <ActionForm action={postMessageAction} resetOnSuccess className="mt-3 flex flex-col gap-2">
                <input type="hidden" name="channelId" value={channelId} />
                <input type="hidden" name="parentId" value={message.id} />
                <TextAreaField name="body" label="Votre réponse" maxLength={4000} required />
                <div>
                  <SubmitButton>Répondre</SubmitButton>
                </div>
              </ActionForm>
            </details>
          ) : null}
          {own && !deleted ? (
            <ConfirmButton message="Supprimer ce message ?" action={deleteMessageAction.bind(null, message.id)}>
              Supprimer
            </ConfirmButton>
          ) : null}
        </div>

        {replies.length > 0 ? (
          <ul className="mt-3 flex flex-col divide-y divide-[var(--c-line)] border-l-2 border-[var(--c-line)] pl-4">
            {replies.map((r) => (
              <li key={r.id} className="py-3">
                <p className="text-sm">
                  <span className="font-medium">{r.author?.full_name ?? 'Membre supprimé'}</span>
                  <span className="ml-2 text-xs text-[var(--c-ink-faint)]">{formatDateTime(r.created_at)}</span>
                </p>
                <p className={`mt-1 whitespace-pre-wrap text-sm ${r.deleted_at ? 'italic text-[var(--c-ink-faint)]' : 'text-[var(--c-ink-soft)]'}`}>{r.body}</p>
                {!r.deleted_at ? <Reactions message={r} /> : null}
                {canDeleteMessage(viewer, { authorId: r.author?.id ?? null }) && !r.deleted_at ? (
                  <div className="mt-1">
                    <ConfirmButton message="Supprimer cette réponse ?" action={deleteMessageAction.bind(null, r.id)}>
                      Supprimer
                    </ConfirmButton>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}
