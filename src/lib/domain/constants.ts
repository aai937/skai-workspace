// Vocabulaire métier partagé par la base (enums PostgreSQL), l'interface et la validation.
// Toute valeur ici doit correspondre exactement à supabase/migrations/0001_schema.sql.

export const TASK_STATUSES = ['a_faire', 'en_cours', 'en_attente', 'bloquee', 'en_revue', 'terminee'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['basse', 'normale', 'haute', 'urgente'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const PROJECT_STATUSES = ['a_lancer', 'en_cours', 'en_pause', 'termine', 'archive'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const EVENT_STATUSES = ['preparation', 'pret', 'en_cours', 'termine', 'annule'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const IDEA_STATUSES = [
  'nouvelle',
  'a_etudier',
  'en_discussion',
  'approuvee',
  'refusee',
  'en_pause',
  'convertie',
] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const IDEA_EFFORTS = ['faible', 'moyen', 'eleve'] as const;
export type IdeaEffort = (typeof IDEA_EFFORTS)[number];

export const DOCUMENT_VISIBILITIES = ['bureau', 'pole', 'membres'] as const;
export type DocumentVisibility = (typeof DOCUMENT_VISIBILITIES)[number];

export const DOCUMENT_CATEGORIES = [
  'compte_rendu',
  'procedure',
  'partenariat',
  'presentation',
  'formation',
  'projet',
  'evenement',
  'autre',
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const COMMENT_TARGETS = ['task', 'project', 'idea', 'event'] as const;
export type CommentTarget = (typeof COMMENT_TARGETS)[number];

export const EVENT_GUEST_KINDS = ['intervenant', 'partenaire'] as const;
export type EventGuestKind = (typeof EVENT_GUEST_KINDS)[number];

// Checklist logistique d'un événement : chaque élément est une tâche du module tâches.
export const CHECKLIST_CATEGORIES = [
  'reservation_salle',
  'materiel',
  'videoprojecteur',
  'sonorisation',
  'disposition_salle',
  'accueil_intervenants',
  'communication',
  'inscriptions',
  'restauration',
  'benevoles',
  'remerciements',
] as const;
export type ChecklistCategory = (typeof CHECKLIST_CATEGORIES)[number];

export const GLOBAL_ROLES = ['bureau', 'membre'] as const;
export type GlobalRole = (typeof GLOBAL_ROLES)[number];

// Les équipes sont des équipes : leurs membres y participent, la gestion revient au bureau.
export const POLE_ROLES = ['membre'] as const;
export type PoleRole = (typeof POLE_ROLES)[number];

export const LABELS = {
  taskStatus: {
    a_faire: 'À faire',
    en_cours: 'En cours',
    en_attente: 'En attente',
    bloquee: 'Bloquée',
    en_revue: 'En revue',
    terminee: 'Terminée',
  },
  taskPriority: { basse: 'Basse', normale: 'Normale', haute: 'Haute', urgente: 'Urgente' },
  projectStatus: {
    a_lancer: 'À lancer',
    en_cours: 'En cours',
    en_pause: 'En pause',
    termine: 'Terminé',
    archive: 'Archivé',
  },
  eventStatus: {
    preparation: 'En préparation',
    pret: 'Prêt',
    en_cours: 'En cours',
    termine: 'Terminé',
    annule: 'Annulé',
  },
  ideaStatus: {
    nouvelle: 'Nouvelle',
    a_etudier: 'À étudier',
    en_discussion: 'En discussion',
    approuvee: 'Approuvée',
    refusee: 'Refusée',
    en_pause: 'En pause',
    convertie: 'Convertie en projet',
  },
  ideaEffort: { faible: 'Faible', moyen: 'Moyen', eleve: 'Élevé' },
  documentVisibility: { bureau: 'Bureau', pole: 'Équipe', membres: 'Tous les membres' },
  documentCategory: {
    compte_rendu: 'Compte rendu',
    procedure: 'Procédure',
    partenariat: 'Partenariat',
    presentation: 'Présentation',
    formation: 'Formation',
    projet: 'Projet',
    evenement: 'Événement',
    autre: 'Autre',
  },
  commentTarget: { task: 'tâche', project: 'projet', idea: 'idée', event: 'événement' },
  eventGuestKind: { intervenant: 'Intervenant', partenaire: 'Partenaire' },
  globalRole: { bureau: 'Bureau', membre: 'Membre' },
  poleRole: { membre: 'Membre' },
  checklist: {
    reservation_salle: 'Réservation de salle',
    materiel: 'Matériel',
    videoprojecteur: 'Vidéoprojecteur',
    sonorisation: 'Micros et sonorisation',
    disposition_salle: 'Chaises et disposition de la salle',
    accueil_intervenants: 'Accueil des intervenants',
    communication: 'Communication et promotion',
    inscriptions: 'Inscriptions des participants',
    restauration: 'Restauration et buffet',
    benevoles: 'Coordination des bénévoles',
    remerciements: 'Remerciements et suivi',
  },
} as const;

// Statuts qui comptent comme « terminé » pour l'avancement et les retards.
export const DONE_TASK_STATUSES: readonly TaskStatus[] = ['terminee'];

// Statuts d'idée ouverts au vote.
export const VOTABLE_IDEA_STATUSES: readonly IdeaStatus[] = ['nouvelle', 'a_etudier', 'en_discussion', 'en_pause'];

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const ALLOWED_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'text/plain',
  'text/markdown',
] as const;
