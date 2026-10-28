import { describe, expect, it } from 'vitest';
import {
  canAssignPoleRole,
  canCreateTask,
  canDecideIdea,
  canEditIdea,
  canManageProject,
  canManageTask,
  canReadDocument,
  canUpdateTaskProgress,
  canUploadDocument,
  canVoteIdea,
  type Viewer,
} from '@/lib/domain/permissions';

const POLE_A = 'pole-a';
const POLE_B = 'pole-b';

const bureau: Viewer = { id: 'u-bureau', isBureau: true, poleRoles: {} };
const responsable: Viewer = { id: 'u-resp', isBureau: false, poleRoles: { [POLE_A]: 'responsable' } };
const membre: Viewer = { id: 'u-membre', isBureau: false, poleRoles: { [POLE_A]: 'membre' } };

describe('tâches', () => {
  const taskA = { poleId: POLE_A, creatorId: 'u-resp', assigneeId: 'u-membre' };
  const taskB = { poleId: POLE_B, creatorId: 'u-bureau', assigneeId: null };

  it('le bureau gère toutes les tâches', () => {
    expect(canManageTask(bureau, taskA)).toBe(true);
    expect(canManageTask(bureau, taskB)).toBe(true);
  });

  it('un responsable gère les tâches de son pôle seulement', () => {
    expect(canManageTask(responsable, taskA)).toBe(true);
    expect(canManageTask(responsable, taskB)).toBe(false);
  });

  it('un responsable crée des tâches dans son pôle uniquement', () => {
    expect(canCreateTask(responsable, POLE_A)).toBe(true);
    expect(canCreateTask(responsable, POLE_B)).toBe(false);
  });

  it('un membre ne crée pas de tâche', () => {
    expect(canCreateTask(membre, POLE_A)).toBe(false);
  });

  it("l'assigné met à jour l'avancement de sa tâche, pas celui des autres", () => {
    expect(canUpdateTaskProgress(membre, taskA)).toBe(true);
    expect(canUpdateTaskProgress(membre, { ...taskA, assigneeId: 'autre' })).toBe(false);
  });
});

describe('projets', () => {
  it('le responsable du pôle lié peut gérer le projet ; un membre non responsable non', () => {
    const project = { leadId: null, createdBy: null, poleIds: [POLE_A] };
    expect(canManageProject(responsable, project)).toBe(true);
    expect(canManageProject(membre, project)).toBe(false);
  });

  it('le responsable lead peut gérer un projet même sans pôle', () => {
    expect(canManageProject(membre, { leadId: 'u-membre', createdBy: null, poleIds: [] })).toBe(true);
  });
});

describe('idées', () => {
  it('seul le bureau décide', () => {
    expect(canDecideIdea(bureau)).toBe(true);
    expect(canDecideIdea(responsable)).toBe(false);
    expect(canDecideIdea(membre)).toBe(false);
  });

  it("l'auteur modifie son idée seulement tant qu'elle est nouvelle", () => {
    expect(canEditIdea(membre, { authorId: 'u-membre', status: 'nouvelle' })).toBe(true);
    expect(canEditIdea(membre, { authorId: 'u-membre', status: 'approuvee' })).toBe(false);
    expect(canEditIdea(membre, { authorId: 'autre', status: 'nouvelle' })).toBe(false);
    expect(canEditIdea(bureau, { authorId: 'autre', status: 'approuvee' })).toBe(true);
  });

  it('on vote sur les idées ouvertes seulement', () => {
    expect(canVoteIdea({ status: 'en_discussion' })).toBe(true);
    expect(canVoteIdea({ status: 'refusee' })).toBe(false);
  });
});

describe('documents', () => {
  it('un document réservé au bureau reste fermé aux autres', () => {
    expect(canReadDocument(membre, { visibility: 'bureau', poleId: null, uploadedBy: null })).toBe(false);
    expect(canReadDocument(bureau, { visibility: 'bureau', poleId: null, uploadedBy: null })).toBe(true);
  });

  it('un document de pôle est visible des membres de ce pôle seulement', () => {
    const doc = { visibility: 'pole' as const, poleId: POLE_A, uploadedBy: null };
    expect(canReadDocument(membre, doc)).toBe(true);
    expect(canReadDocument(membre, { ...doc, poleId: POLE_B })).toBe(false);
  });

  it('un membre ne publie pas à destination du bureau', () => {
    expect(canUploadDocument(membre, 'bureau', null)).toBe(false);
    expect(canUploadDocument(membre, 'membres', null)).toBe(true);
  });
});

describe('rôles de pôle', () => {
  it('un responsable ne nomme que des membres simples de son pôle', () => {
    expect(canAssignPoleRole(responsable, POLE_A, 'membre')).toBe(true);
    expect(canAssignPoleRole(responsable, POLE_A, 'responsable')).toBe(false);
    expect(canAssignPoleRole(responsable, POLE_B, 'membre')).toBe(false);
    expect(canAssignPoleRole(bureau, POLE_B, 'responsable')).toBe(true);
  });
});
