import { addCommentAction, deleteCommentAction } from '@/app/actions/comments';
import { ActionForm, ConfirmButton, SubmitButton, TextAreaField } from '@/components/forms';
import { Avatar, Card, CardTitle } from '@/components/ui';
import type { CommentItem } from '@/lib/data/tasks';
import { formatDateTime } from '@/lib/domain/format';

// Commentaires contextuels (tâches, projets, idées, événements). Les mentions notifient les membres cochés.
export function CommentsSection({
  targetType,
  targetId,
  comments,
  members,
  viewerId,
  isBureau,
}: {
  targetType: 'task' | 'project' | 'idea' | 'event';
  targetId: string;
  comments: CommentItem[];
  members: { id: string; full_name: string }[];
  viewerId: string;
  isBureau: boolean;
}) {
  return (
    <Card>
      <CardTitle>Commentaires</CardTitle>
      {comments.length === 0 ? (
        <p className="mb-4 text-sm text-[var(--c-ink-faint)]">Aucun commentaire pour l’instant.</p>
      ) : (
        <ul className="mb-6 flex flex-col gap-4">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar name={c.author?.full_name ?? '?'} />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium">{c.author?.full_name ?? 'Membre supprimé'}</span>
                  <span className="ml-2 text-xs text-[var(--c-ink-faint)]">{formatDateTime(c.created_at)}</span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--c-ink-soft)]">{c.body}</p>
                {c.author?.id === viewerId || isBureau ? (
                  <div className="mt-1">
                    <ConfirmButton
                      message="Supprimer ce commentaire ?"
                      action={deleteCommentAction.bind(null, c.id, targetType, targetId)}
                    >
                      Supprimer
                    </ConfirmButton>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ActionForm action={addCommentAction} resetOnSuccess className="flex flex-col gap-3">
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <TextAreaField name="body" label="Ajouter un commentaire" maxLength={3000} required />
        {members.length > 0 ? (
          <fieldset className="flex flex-wrap gap-3 text-sm">
            <legend className="mb-1 text-xs text-[var(--c-ink-soft)]">Mentionner</legend>
            {members
              .filter((m) => m.id !== viewerId)
              .map((m) => (
                <label key={m.id} className="inline-flex items-center gap-1.5">
                  <input type="checkbox" name="mentions" value={m.id} className="size-4" />
                  {m.full_name}
                </label>
              ))}
          </fieldset>
        ) : null}
        <div>
          <SubmitButton>Publier</SubmitButton>
        </div>
      </ActionForm>
    </Card>
  );
}

