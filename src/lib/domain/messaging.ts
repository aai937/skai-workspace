// Règles et validation de la messagerie, des annonces et des préférences de mail.
import { z } from 'zod';
import type { Viewer } from './permissions';

export const MAIL_DIGEST_OPTIONS = ['quotidien', 'hebdomadaire', 'desactive'] as const;
export type MailDigest = (typeof MAIL_DIGEST_OPTIONS)[number];

export const REACTION_EMOJIS = ['👍', '🎉', '❤️', '👀', '🙏', '✅'] as const;

// Messages : tout membre actif. Canaux libres : le bureau. Canaux de équipe, projet et événement : automatiques.
export function canCreateChannel(viewer: Viewer): boolean {
  return viewer.isBureau;
}

// Annonces : le bureau uniquement (pour tous les membres ou pour une équipe).
export function canPublishAnnouncement(viewer: Viewer): boolean {
  return viewer.isBureau;
}

export function canPublishAnnouncementAnywhere(viewer: Viewer): boolean {
  return viewer.isBureau;
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
      ctx.addIssue({ code: 'custom', path: ['poleId'], message: 'Choisissez le équipe concerné.' });
    }
  });

export const mailPreferenceSchema = z.object({
  digest: z.enum(MAIL_DIGEST_OPTIONS),
});
