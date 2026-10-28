// Règles et validation de la messagerie, des annonces et des préférences de mail.
import { z } from 'zod';
import type { Viewer } from './permissions';
import { isAnyPoleResponsable, isPoleResponsable } from './permissions';

export const MAIL_DIGEST_OPTIONS = ['quotidien', 'hebdomadaire', 'desactive'] as const;
export type MailDigest = (typeof MAIL_DIGEST_OPTIONS)[number];

export const REACTION_EMOJIS = ['👍', '🎉', '❤️', '👀', '🙏', '✅'] as const;

// Un message est publié par tout membre actif dans un canal ouvert. Les canaux libres sont créés
// par le bureau ou un responsable ; les canaux de pôle, projet et événement sont créés automatiquement.
export function canCreateChannel(viewer: Viewer): boolean {
  return viewer.isBureau || Object.values(viewer.poleRoles).includes('responsable');
}

// Annonce « tous les membres » : bureau uniquement. Annonce « pôle » : bureau ou responsable de ce pôle.
export function canPublishAnnouncement(viewer: Viewer, audience: 'tous' | 'pole', poleId: string | null): boolean {
  if (viewer.isBureau) {
    return true;
  }
  return audience === 'pole' && isPoleResponsable(viewer, poleId);
}

export function canPublishAnnouncementAnywhere(viewer: Viewer): boolean {
  return viewer.isBureau || isAnyPoleResponsable(viewer);
}

export function canDeleteMessage(viewer: Viewer, message: { authorId: string | null }): boolean {
  return viewer.isBureau || message.authorId === viewer.id;
}

const body = (max: number) => z.string().trim().min(1, 'Le message est vide.').max(max);

export const messageSchema = z.object({
  channelId: z.uuid(),
  parentId: z.uuid().nullable(),
  body: body(4000),
  mentions: z.array(z.uuid()).max(20),
});

export const channelSchema = z.object({
  name: z.string().trim().min(2, 'Au moins 2 caractères.').max(80),
  description: z.string().trim().max(500),
});

export const announcementSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    body: z.string().trim().min(1).max(5000),
    audience: z.enum(['tous', 'pole']),
    poleId: z.uuid().nullable(),
    pinned: z.boolean(),
    sendEmail: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.audience === 'pole' && !value.poleId) {
      ctx.addIssue({ code: 'custom', path: ['poleId'], message: 'Choisissez le pôle concerné.' });
    }
  });

export const mailPreferenceSchema = z.object({
  digest: z.enum(MAIL_DIGEST_OPTIONS),
});
