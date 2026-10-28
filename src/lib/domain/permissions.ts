// Règles de permissions de l'application (côté serveur).
// Ces fonctions reproduisent les politiques RLS de supabase/migrations/0003_rls.sql :
// elles décident ce que l'interface affiche et ce que les actions acceptent. La base reste la dernière barrière.
// Masquer un bouton n'est jamais une mesure de sécurité : chaque action serveur appelle ces fonctions.

import type { DocumentVisibility, IdeaStatus, PoleRole } from './constants';
import { VOTABLE_IDEA_STATUSES } from './constants';

export type Viewer = {
  id: string;
  isBureau: boolean;
  // Rôle par pôle : un membre peut être responsable d'un pôle et simple membre d'un autre.
  poleRoles: Readonly<Record<string, PoleRole>>;
};

export function isPoleResponsable(viewer: Viewer, poleId: string | null | undefined): boolean {
  return !!poleId && viewer.poleRoles[poleId] === 'responsable';
}

export function isAnyPoleResponsable(viewer: Viewer): boolean {
  return Object.values(viewer.poleRoles).includes('responsable');
}

export function isPoleMember(viewer: Viewer, poleId: string | null | undefined): boolean {
  return !!poleId && poleId in viewer.poleRoles;
}

// Membres et rôles : uniquement le bureau.
export function canManageMembers(viewer: Viewer): boolean {
  return viewer.isBureau;
}

// Pôles : le bureau crée et renomme ; un responsable gère les membres simples de son pôle.
export function canManagePoles(viewer: Viewer): boolean {
  return viewer.isBureau;
}

export function canManagePoleMembers(viewer: Viewer, poleId: string): boolean {
  return viewer.isBureau || isPoleResponsable(viewer, poleId);
}

type TaskLike = {
  poleId: string;
  creatorId: string | null;
  assigneeId: string | null;
};

export function canCreateTask(viewer: Viewer, poleId: string): boolean {
  return viewer.isBureau || isPoleResponsable(viewer, poleId);
}

// Gestion complète d'une tâche (titre, attribution, date, archivage).
export function canManageTask(viewer: Viewer, task: TaskLike): boolean {
  return viewer.isBureau || isPoleResponsable(viewer, task.poleId);
}

// Mise à jour de l'avancement : gestionnaires, et personne à qui la tâche est attribuée.
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
  return viewer.isBureau || isAnyPoleResponsable(viewer);
}

export function canManageProject(viewer: Viewer, project: ProjectLike): boolean {
  return (
    viewer.isBureau ||
    (project.leadId !== null && project.leadId === viewer.id) ||
    (project.createdBy !== null && project.createdBy === viewer.id) ||
    project.poleIds.some((poleId) => isPoleResponsable(viewer, poleId))
  );
}

type EventLike = ProjectLike;

export function canCreateEvent(viewer: Viewer): boolean {
  return viewer.isBureau || isAnyPoleResponsable(viewer);
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
  if (viewer.isBureau) {
    return true;
  }
  if (doc.visibility === 'membres') {
    return true;
  }
  if (doc.visibility === 'pole') {
    return isPoleMember(viewer, doc.poleId);
  }
  return false;
}

// Un membre ne peut publier qu'à destination de tous ou de son pôle ; le bureau peut tout publier.
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

// Rôle dans un pôle : le bureau attribue tout ; un responsable ne nomme que des membres simples de son pôle.
export function canAssignPoleRole(viewer: Viewer, poleId: string, role: PoleRole): boolean {
  if (viewer.isBureau) {
    return true;
  }
  return role === 'membre' && isPoleResponsable(viewer, poleId);
}
