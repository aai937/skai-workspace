import { describe, expect, it } from 'vitest';
import {
  canAssignPoleRole,
  canCreateProject,
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

const EQUIPE_A = 'equipe-a';
const EQUIPE_B = 'equipe-b';

const bureau: Viewer = { id: 'u-bureau', isBureau: true, poleIds: [] };
const membre: Viewer = { id: 'u-membre', isBureau: false, poleIds: [EQUIPE_A] };

describe('tâches', () => {
  const task = { poleId: EQUIPE_A, creatorId: 'u-bureau', assigneeId: 'u-membre' };

  it('seul le bureau crée et gère les tâches', () => {
    expect(canCreateTask(bureau)).toBe(true);
    expect(canManageTask(bureau, task)).toBe(true);
    expect(canCreateTask(membre)).toBe(false);
    expect(canManageTask(membre, task)).toBe(false);
  });

  it("l'assigné met à jour l'avancement de sa tâche, pas celui des autres", () => {
    expect(canUpdateTaskProgress(membre, task)).toBe(true);
    expect(canUpdateTaskProgress(membre, { ...task, assigneeId: 'autre' })).toBe(false);
  });
});

describe('projets', () => {
  it('seul le bureau crée un projet ; le responsable désigné gère le sien', () => {
    expect(canCreateProject(bureau)).toBe(true);
    expect(canCreateProject(membre)).toBe(false);
    expect(canManageProject(membre, { leadId: 'u-membre', createdBy: null, poleIds: [] })).toBe(true);
    expect(canManageProject(membre, { leadId: null, createdBy: null, poleIds: [EQUIPE_A] })).toBe(false);
  });
});

describe('idées', () => {
  it('seul le bureau décide, chacun propose', () => {
    expect(canDecideIdea(bureau)).toBe(true);
    expect(canDecideIdea(membre)).toBe(false);
    expect(canEditIdea(membre, { authorId: 'u-membre', status: 'nouvelle' })).toBe(true);
    expect(canEditIdea(membre, { authorId: 'u-membre', status: 'approuvee' })).toBe(false);
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

  it("un document d'équipe est visible des membres de l'équipe seulement", () => {
    const doc = { visibility: 'pole' as const, poleId: EQUIPE_A, uploadedBy: null };
    expect(canReadDocument(membre, doc)).toBe(true);
    expect(canReadDocument(membre, { ...doc, poleId: EQUIPE_B })).toBe(false);
  });

  it('un membre ne publie pas à destination du bureau', () => {
    expect(canUploadDocument(membre, 'bureau', null)).toBe(false);
    expect(canUploadDocument(membre, 'membres', null)).toBe(true);
  });
});

describe('équipes', () => {
  it('seul le bureau affecte un membre à une équipe', () => {
    expect(canAssignPoleRole(bureau)).toBe(true);
    expect(canAssignPoleRole(membre)).toBe(false);
  });
});
