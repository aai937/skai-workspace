// Règles de permissions de l'application (côté serveur).
// Ces fonctions reproduisent les politiques RLS de supabase/migrations : elles décident ce que l'interface
// affiche et ce que les actions acceptent. La base reste la dernière barrière.
// Les équipes sont des équipes : seul le bureau gère les tâches, projets, événements et annonces.
// Masquer un bouton n'est jamais une mesure de sécurité.

import type { DocumentVisibility, IdeaStatus } from './constants';
import { VOTABLE_IDEA_STATUSES } from './constants';

export type Viewer = {
  id: string;
  isBureau: boolean;
  // Équipes (équipes) auxquelles le membre appartient.
  poleIds: readonly string[];
};

export function isPoleMember(viewer: Viewer, poleId: string | null | undefined): boolean {
  return !!poleId && viewer.poleIds.includes(poleId);
}

// Membres et équipes : le bureau.
export function canManageMembers(viewer: Viewer): boolean {
  return viewer.isBureau;
}

export function canManagePoles(viewer: Viewer): boolean {
  return viewer.isBureau;
}

export function canManagePoleMembers(viewer: Viewer): boolean {
  return viewer.isBureau;
}

type TaskLike = {
  poleId: string;
  creatorId: string | null;
  assigneeId: string | null;
};

export function canCreateTask(viewer: Viewer): boolean {
  return viewer.isBureau;
}

// Gestion complète d'une tâche : le bureau.
export function canManageTask(viewer: Viewer, task: TaskLike): boolean {
  void task;
  return viewer.isBureau;
}

// Mise à jour de l'avancement : le bureau, et la personne à qui la tâche est attribuée.
export function canUpdateTaskProgress(viewer: Viewer, task: TaskLike): boolean {
  return canManageTask(viewer, task) || task.assigneeId === viewer.id;
}

// Suppression définitive : bureau seulement. Les autres passent par l'archivage.
export function canDeleteTask(viewer: Viewer): boolean {
  return viewer.isBureau;
}

type ProjectLike = {
  leadId: string | null;
  createdBy: string | null;
  poleIds: readonly string[];
};

export function canCreateProject(viewer: Viewer): boolean {
  return viewer.isBureau;
}

// Le bureau, ou le responsable désigné du projet (lead) et son créateur.
export function canManageProject(viewer: Viewer, project: ProjectLike): boolean {
  return (
    viewer.isBureau ||
    (project.leadId !== null && project.leadId === viewer.id) ||
    (project.createdBy !== null && project.createdBy === viewer.id)
  );
}

type EventLike = ProjectLike;

export function canCreateEvent(viewer: Viewer): boolean {
  return viewer.isBureau;
}

export function canManageEvent(viewer: Viewer, event: EventLike): boolean {
  return canManageProject(viewer, event);
}

export function canDeleteEvent(viewer: Viewer): boolean {
  return viewer.isBureau;
}

// Idées : tout membre propose ; seul le bureau décide.
export function canDecideIdea(viewer: Viewer): boolean {
  return viewer.isBureau;
}

export function canEditIdea(viewer: Viewer, idea: { authorId: string | null; status: IdeaStatus }): boolean {
  if (viewer.isBureau) {
    return true;
  }
  return idea.authorId === viewer.id && idea.status === 'nouvelle';
}

// Un vote par membre et par idée (contrainte de clé primaire en base).
export function canVoteIdea(idea: { status: IdeaStatus }): boolean {
  return VOTABLE_IDEA_STATUSES.includes(idea.status);
}

type DocumentLike = {
  visibility: DocumentVisibility;
  poleId: string | null;
  uploadedBy: string | null;
};

export function canReadDocument(viewer: Viewer, doc: DocumentLike): boolean {
  if (viewer.isBureau || doc.visibility === 'membres') {
    return true;
  }
  if (doc.visibility === 'pole') {
    return isPoleMember(viewer, doc.poleId);
  }
  return false;
}

// Un membre ne publie qu'à destination de tous ou de son équipe ; le bureau peut tout publier.
export function canUploadDocument(viewer: Viewer, visibility: DocumentVisibility, poleId: string | null): boolean {
  if (visibility === 'bureau') {
    return viewer.isBureau;
  }
  if (visibility === 'pole') {
    return viewer.isBureau || isPoleMember(viewer, poleId);
  }
  return true;
}

export function canManageDocument(viewer: Viewer, doc: DocumentLike): boolean {
  return viewer.isBureau || (doc.uploadedBy !== null && doc.uploadedBy === viewer.id);
}

// Affectation à une équipe : le bureau uniquement.
export function canAssignPoleRole(viewer: Viewer): boolean {
  return viewer.isBureau;
}
