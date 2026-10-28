import { describe, expect, it } from 'vitest';
import { eventInputSchema, ideaInputSchema, memberInviteSchema, passwordSchema, taskInputSchema } from '@/lib/domain/schemas';
import { isOverdue, parisLocalToIso, progressPercent } from '@/lib/domain/format';

const POLE = '3f1b4c1e-2d3a-4b5c-8d9e-0f1a2b3c4d5e';

const validTask = {
  title: 'Réserver la salle',
  description: '',
  poleId: POLE,
  projectId: '',
  eventId: '',
  assigneeId: '',
  priority: 'normale',
  status: 'a_faire',
  dueDate: '2026-11-03',
  labels: 'logistique, Salle',
  blockedReason: '',
  checklistCategory: null,
};

describe('taskInputSchema', () => {
  it('accepte une tâche valide et normalise les champs vides', () => {
    const r = taskInputSchema.parse(validTask);
    expect(r.assigneeId).toBeNull();
    expect(r.projectId).toBeNull();
    expect(r.labels).toEqual(['logistique', 'salle']);
  });

  it('exige une explication pour une tâche bloquée', () => {
    expect(taskInputSchema.safeParse({ ...validTask, status: 'bloquee' }).success).toBe(false);
  });

  it('refuse un élément de checklist sans événement', () => {
    expect(taskInputSchema.safeParse({ ...validTask, checklistCategory: 'materiel' }).success).toBe(false);
  });

  it('refuse un identifiant de pôle invalide', () => {
    expect(taskInputSchema.safeParse({ ...validTask, poleId: 'pas-un-uuid' }).success).toBe(false);
  });
});

describe('ideaInputSchema', () => {
  it('exige un problème et une solution suffisamment décrits', () => {
    const r = ideaInputSchema.safeParse({
      title: 'Chatbot', problem: 'court', solution: 'Un assistant pour le bureau.', benefits: '', poleId: '', effort: 'moyen',
    });
    expect(r.success).toBe(false);
  });
});

describe('eventInputSchema', () => {
  it('convertit un budget saisi avec une virgule', () => {
    const r = eventInputSchema.parse({
      title: 'Hackathon', description: '', startsAt: '2026-11-03T18:30', endsAt: '', location: 'Amphi',
      leadId: '', poleIds: [POLE], status: 'preparation', budgetEuros: '1250,5', logisticsNotes: '',
    });
    expect(r.budgetEuros).toBeCloseTo(1250.5);
    expect(r.endsAt).toBeNull();
  });
});

describe('memberInviteSchema', () => {
  it("normalise l'adresse et refuse les adresses invalides", () => {
    expect(memberInviteSchema.parse({ email: ' Ada@Exemple.FR ', role: 'membre', poleId: '', poleRole: 'membre' }).email).toBe('ada@exemple.fr');
    expect(memberInviteSchema.safeParse({ email: 'pas-une-adresse', role: 'membre', poleId: '' }).success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it('exige au moins douze caractères', () => {
    expect(passwordSchema.safeParse('court').success).toBe(false);
    expect(passwordSchema.safeParse('une phrase assez longue').success).toBe(true);
  });
});

describe('format', () => {
  it("convertit une heure de Paris en instant UTC (heure d'été)", () => {
    expect(parisLocalToIso('2026-07-01T10:00')).toBe('2026-07-01T08:00:00.000Z');
  });

  it("convertit une heure de Paris en instant UTC (heure d'hiver)", () => {
    expect(parisLocalToIso('2026-01-15T10:00')).toBe('2026-01-15T09:00:00.000Z');
  });

  it("calcule un pourcentage d'avancement sans division par zéro", () => {
    expect(progressPercent(0, 0)).toBe(0);
    expect(progressPercent(1, 4)).toBe(25);
  });

  it('détecte les retards hors tâches terminées', () => {
    const now = new Date('2026-10-28T12:00:00Z');
    expect(isOverdue('2026-10-20', 'en_cours', now)).toBe(true);
    expect(isOverdue('2026-10-20', 'terminee', now)).toBe(false);
    expect(isOverdue('2026-10-30', 'en_cours', now)).toBe(false);
  });
});
