// Validation des données reçues (formulaires et actions serveur). Toute entrée passe par ces schémas.
import { z } from 'zod';
import {
  CHECKLIST_CATEGORIES,
  COMMENT_TARGETS,
  DOCUMENT_CATEGORIES,
  DOCUMENT_VISIBILITIES,
  EVENT_GUEST_KINDS,
  EVENT_STATUSES,
  IDEA_EFFORTS,
  IDEA_STATUSES,
  PROJECT_STATUSES,
  POLE_ROLES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  GLOBAL_ROLES,
} from './constants';

const text = (max: number, min = 0) => z.string().trim().min(min).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v));
const uuid = z.uuid();
const optionalUuid = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .pipe(z.uuid().nullable());
// Date au format AAAA-MM-JJ (input type="date"), ou null.
const isoDate = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .pipe(z.iso.date().nullable());
// Date et heure locales (input type="datetime-local"), converties ensuite en instant avec le fuseau de Paris.
const localDateTime = z.string().trim().min(1, 'Date obligatoire').pipe(z.iso.datetime({ local: true, offset: true }));
const labelsList = z
  .string()
  .trim()
  .transform((v) =>
    v
      .split(',')
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean),
  )
  .pipe(z.array(z.string().max(30)).max(10));

export const taskInputSchema = z
  .object({
    title: text(200, 2),
    description: text(5000),
    poleId: uuid,
    projectId: optionalUuid,
    eventId: optionalUuid,
    assigneeId: optionalUuid,
    priority: z.enum(TASK_PRIORITIES),
    status: z.enum(TASK_STATUSES),
    dueDate: isoDate,
    labels: labelsList,
    blockedReason: optionalText(1000),
    checklistCategory: z.enum(CHECKLIST_CATEGORIES).nullable().default(null),
  })
  .superRefine((value, ctx) => {
    if (value.status === 'bloquee' && !value.blockedReason) {
      ctx.addIssue({ code: 'custom', path: ['blockedReason'], message: 'Expliquez le blocage.' });
    }
    if (value.checklistCategory && !value.eventId) {
      ctx.addIssue({ code: 'custom', path: ['checklistCategory'], message: 'Un élément de checklist doit appartenir à un événement.' });
    }
  });

export const taskProgressSchema = z
  .object({
    taskId: uuid,
    status: z.enum(TASK_STATUSES),
    blockedReason: optionalText(1000),
  })
  .superRefine((value, ctx) => {
    if (value.status === 'bloquee' && !value.blockedReason) {
      ctx.addIssue({ code: 'custom', path: ['blockedReason'], message: 'Expliquez le blocage.' });
    }
  });

export const commentSchema = z.object({
  targetType: z.enum(COMMENT_TARGETS),
  targetId: uuid,
  body: text(3000, 1),
  mentions: z.array(uuid).max(20).default([]),
});

export const projectInputSchema = z
  .object({
    title: text(160, 2),
    description: text(5000),
    objectives: text(3000),
    deliverables: text(3000),
    status: z.enum(PROJECT_STATUSES),
    priority: z.enum(TASK_PRIORITIES),
    leadId: optionalUuid,
    poleIds: z.array(uuid).min(1, 'Choisissez au moins un équipe').max(4),
    startDate: isoDate,
    dueDate: isoDate,
  })
  .superRefine((value, ctx) => {
    if (value.startDate && value.dueDate && value.dueDate < value.startDate) {
      ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'La fin doit suivre le début.' });
    }
  });

export const milestoneSchema = z.object({
  projectId: uuid,
  title: text(160, 2),
  dueDate: z.iso.date(),
});

export const ideaInputSchema = z.object({
  title: text(160, 2),
  problem: text(3000, 10),
  solution: text(3000, 10),
  benefits: text(3000),
  poleId: optionalUuid,
  effort: z.enum(IDEA_EFFORTS),
});

export const ideaDecisionSchema = z
  .object({
    ideaId: uuid,
    status: z.enum(IDEA_STATUSES),
    decisionNote: text(2000),
  })
  .superRefine((value, ctx) => {
    if ((value.status === 'refusee' || value.status === 'approuvee') && !value.decisionNote) {
      ctx.addIssue({ code: 'custom', path: ['decisionNote'], message: 'Expliquez la décision.' });
    }
  });

export const eventInputSchema = z
  .object({
    title: text(160, 2),
    description: text(5000),
    startsAt: localDateTime,
    endsAt: z
      .string()
      .trim()
      .transform((v) => (v === '' ? null : v))
      .pipe(z.iso.datetime({ local: true, offset: true }).nullable()),
    location: text(200),
    leadId: optionalUuid,
    poleIds: z.array(uuid).min(1, 'Choisissez au moins un équipe').max(4),
    status: z.enum(EVENT_STATUSES),
    budgetEuros: z
      .string()
      .trim()
      .transform((v) => (v === '' ? null : Number(v.replace(',', '.'))))
      .pipe(z.number().min(0).max(10_000_000).nullable()),
    logisticsNotes: text(5000),
  });

export const eventGuestSchema = z.object({
  eventId: uuid,
  kind: z.enum(EVENT_GUEST_KINDS),
  name: text(120, 2),
  organization: text(120),
});

export const documentMetaSchema = z
  .object({
    title: text(200, 2),
    description: text(2000),
    category: z.enum(DOCUMENT_CATEGORIES),
    visibility: z.enum(DOCUMENT_VISIBILITIES),
    poleId: optionalUuid,
    projectId: optionalUuid,
    eventId: optionalUuid,
    tags: labelsList,
  })
  .superRefine((value, ctx) => {
    if (value.visibility === 'pole' && !value.poleId) {
      ctx.addIssue({ code: 'custom', path: ['poleId'], message: 'Choisissez le équipe concerné.' });
    }
  });

export const memberInviteSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email('Adresse e-mail invalide')),
  role: z.enum(GLOBAL_ROLES),
  poleId: optionalUuid,
  poleRole: z.enum(POLE_ROLES).default('membre'),
});

export const profileSchema = z.object({
  fullName: text(120, 2),
  bio: text(500),
  professionalEmail: z
    .string()
    .trim()
    .max(254)
    .transform((v) => (v === '' ? null : v))
    .pipe(z.email().nullable()),
  phone: optionalText(30),
});

export const poleSchema = z.object({
  name: text(80, 2),
  description: text(1000),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,60}$/, 'Identifiant : lettres minuscules, chiffres et tirets.'),
});

export const passwordSchema = z
  .string()
  .min(12, 'Au moins 12 caractères.')
  .max(128, 'Au plus 128 caractères.');

export const uuidSchema = uuid;
