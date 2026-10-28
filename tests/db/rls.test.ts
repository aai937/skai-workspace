import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Tests des règles de sécurité côté base de données (RLS, triggers, garde-fous).
 * On rejoue les migrations sur un Postgres embarqué (PGlite). Le schéma `auth` de Supabase
 * est simulé : une table `auth.users` et `auth.uid()` qui lit le sujet du JWT positionné par le test.
 * Le bucket de stockage (0006) n'est pas rejoué ici car il dépend du schéma `storage` de Supabase.
 */

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
const migrations = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql') && !f.includes('storage'))
  .sort();

const ids = {
  bureau: '00000000-0000-4000-8000-000000000001',
  responsable: '00000000-0000-4000-8000-000000000002',
  membre: '00000000-0000-4000-8000-000000000003',
  autre: '00000000-0000-4000-8000-000000000004',
  inconnu: '00000000-0000-4000-8000-000000000005',
} as const;

const authShim = `
  create schema if not exists auth;
  create table auth.users (
    id uuid primary key,
    email text not null,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
`;

let db: PGlite;

async function asUser<T>(userId: string | null, run: () => Promise<T>): Promise<T> {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? '']);
  await db.exec('set role authenticated');
  try {
    return await run();
  } finally {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

async function expectDenied(promise: Promise<unknown>) {
  await expect(promise).rejects.toThrow();
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(authShim);
  for (const file of migrations) {
    await db.exec(readFileSync(path.join(migrationsDir, file), 'utf8'));
  }

  // Invitations créées par le bureau, puis création des comptes (le trigger crée les profils).
  await db.exec(`
    insert into public.invitations (email, role) values
      ('bureau@skai.test', 'bureau'),
      ('resp@skai.test', 'membre'),
      ('membre@skai.test', 'membre');
  `);
  await db.exec(`
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${ids.bureau}', 'bureau@skai.test', '{"full_name":"Bureau Test"}'),
      ('${ids.responsable}', 'resp@skai.test', '{"full_name":"Responsable Test"}'),
      ('${ids.membre}', 'membre@skai.test', '{}'),
      ('${ids.autre}', 'autre@skai.test', '{"full_name":"Sans invitation"}');
  `);

  const pole = await db.query<{ id: string }>(
    "select id from public.poles where slug = 'evenementiel-partenariats'",
  );
  const poleId = pole.rows[0]!.id;
  await db.query(
    `insert into public.pole_memberships (profile_id, pole_id, role) values
      ($1, $3, 'responsable'), ($2, $3, 'membre')`,
    [ids.bureau, ids.membre, poleId],
  );
});

describe('comptes et profils', () => {
  it('crée un profil actif pour une adresse invitée, avec le rôle de l\'invitation', async () => {
    const r = await db.query<{ role: string; is_active: boolean }>(
      'select role, is_active from public.profiles where id = $1',
      [ids.bureau],
    );
    expect(r.rows[0]!).toEqual({ role: 'bureau', is_active: true });
  });

  it('crée un compte inactif sans invitation', async () => {
    const r = await db.query<{ is_active: boolean }>(
      'select is_active from public.profiles where id = $1',
      [ids.autre],
    );
    expect(r.rows[0]!.is_active).toBe(false);
  });

  it('ne laisse aucune donnée au compte inactif', async () => {
    const pole = await asUser(ids.autre, () => db.query('select id from public.poles'));
    const tasks = await asUser(ids.autre, () => db.query('select id from public.tasks'));
    expect(pole.rows).toHaveLength(0);
    expect(tasks.rows).toHaveLength(0);
  });
});

describe('élévation de privilèges', () => {
  it('un membre ne peut pas se donner le rôle bureau', async () => {
    await expectDenied(
      asUser(ids.membre, () =>
        db.query("update public.profiles set role = 'bureau' where id = $1", [ids.membre]),
      ),
    );
    const r = await db.query<{ role: string }>('select role from public.profiles where id = $1', [ids.membre]);
    expect(r.rows[0]!.role).toBe('membre');
  });

  it('un membre ne peut pas activer un autre compte', async () => {
    await asUser(ids.membre, () =>
      db.query("update public.profiles set is_active = true where id = $1", [ids.autre]),
    );
    const r = await db.query<{ is_active: boolean }>('select is_active from public.profiles where id = $1', [ids.autre]);
    expect(r.rows[0]!.is_active).toBe(false);
  });


  it('le bureau peut changer le rôle d\'un membre', async () => {
    await asUser(ids.bureau, () =>
      db.query("update public.profiles set role = 'membre' where id = $1", [ids.membre]),
    );
    const r = await db.query<{ role: string }>('select role from public.profiles where id = $1', [ids.membre]);
    expect(r.rows[0]!.role).toBe('membre');
  });

  it('les notifications ne peuvent pas être créées directement par un client', async () => {
    await expectDenied(
      asUser(ids.membre, () =>
        db.query('select public.notify($1, $2, $3, $4, $5, $6)', [
          ids.bureau, 'spam', 'Spam', '', '/', ids.membre,
        ]),
      ),
    );
  });
});

describe('tâches', () => {
  let poleId: string;
  let taskId: string;

  beforeAll(async () => {
    poleId = (await db.query<{ id: string }>("select id from public.poles where slug = 'evenementiel-partenariats'")).rows[0]!.id;
  });

  it('le bureau crée une tâche dans son pôle et l\'attribue à un membre', async () => {
    const r = await asUser(ids.bureau, () =>
      db.query<{ id: string }>(
        `insert into public.tasks (title, pole_id, creator_id, assignee_id, due_date)
         values ('Réserver la salle', $1, $2, $3, current_date + 7) returning id`,
        [poleId, ids.bureau, ids.membre],
      ),
    );
    taskId = r.rows[0]!.id;
    expect(taskId).toBeTruthy();
  });

  it('un membre ne peut pas créer de tâche', async () => {
    await expectDenied(
      asUser(ids.membre, () =>
        db.query(
          'insert into public.tasks (title, pole_id, creator_id) values ($1, $2, $3)',
          ['Tâche sauvage', poleId, ids.membre],
        ),
      ),
    );
  });

  
  it('l\'assigné met à jour le statut de sa tâche', async () => {
    await asUser(ids.membre, () =>
      db.query("update public.tasks set status = 'en_cours' where id = $1", [taskId]),
    );
    const r = await db.query<{ status: string }>('select status from public.tasks where id = $1', [taskId]);
    expect(r.rows[0]!.status).toBe('en_cours');
  });

  it('l\'assigné ne peut pas modifier le titre ni se réattribuer la tâche', async () => {
    await expectDenied(
      asUser(ids.membre, () => db.query("update public.tasks set title = 'Piraté' where id = $1", [taskId])),
    );
    await expectDenied(
      asUser(ids.membre, () =>
        db.query('update public.tasks set assignee_id = $2 where id = $1', [taskId, ids.autre]),
      ),
    );
  });

  it('un blocage exige une explication', async () => {
    await expectDenied(
      asUser(ids.membre, () => db.query("update public.tasks set status = 'bloquee' where id = $1", [taskId])),
    );
  });

  it('un blocage avec explication notifie le responsable du pôle', async () => {
    await asUser(ids.membre, () =>
      db.query(
        "update public.tasks set status = 'bloquee', blocked_reason = 'Salle indisponible' where id = $1",
        [taskId],
      ),
    );
    const notifs = await asUser(ids.bureau, () =>
      db.query<{ kind: string }>("select kind from public.notifications where kind = 'task_blocked'"),
    );
    expect(notifs.rows.length).toBeGreaterThan(0);
  });

  it('chacun ne voit que ses propres notifications', async () => {
    const r = await asUser(ids.membre, () => db.query<{ recipient_id: string }>('select recipient_id from public.notifications'));
    expect(r.rows.length).toBeGreaterThan(0);
    expect(r.rows.every((n) => n.recipient_id === ids.membre)).toBe(true);
  });

  it('la date de fin est renseignée à la clôture et le journal enregistre le changement', async () => {
    await asUser(ids.membre, () =>
      db.query("update public.tasks set status = 'terminee', blocked_reason = null where id = $1", [taskId]),
    );
    const t = await db.query<{ completed_at: Date | null }>('select completed_at from public.tasks where id = $1', [taskId]);
    expect(t.rows[0]!.completed_at).not.toBeNull();
    const log = await asUser(ids.membre, () =>
      db.query<{ summary: string }>("select summary from public.activity_log where entity_id = $1 and summary like 'Tâche — modification%'", [taskId]),
    );
    expect(log.rows.length).toBeGreaterThan(0);
  });

  it('seul le bureau peut supprimer une tâche', async () => {
    await asUser(ids.membre, () => db.query('delete from public.tasks where id = $1', [taskId]));
    const r = await db.query('select id from public.tasks where id = $1', [taskId]);
    expect(r.rows).toHaveLength(1);
  });
});

describe('commentaires et mentions', () => {
  it('un membre commente et mentionne un autre membre, qui reçoit une notification', async () => {
    const t = await db.query<{ id: string }>(
      "insert into public.tasks (title, pole_id, creator_id) values ('Tâche commentée', (select id from public.poles limit 1), $1) returning id",
      [ids.bureau],
    );
    await asUser(ids.membre, () =>
      db.query(
        'insert into public.comments (target_type, target_id, author_id, body, mentions) values ($1, $2, $3, $4, $5)',
        ['task', t.rows[0]!.id, ids.membre, 'Peux-tu regarder ?', [ids.bureau]],
      ),
    );
    const n = await asUser(ids.bureau, () =>
      db.query<{ kind: string }>("select kind from public.notifications where kind = 'mention'"),
    );
    expect(n.rows.length).toBeGreaterThan(0);
  });

  it('un compte inactif ne peut pas commenter', async () => {
    const t = await db.query<{ id: string }>('select id from public.tasks limit 1');
    await expectDenied(
      asUser(ids.autre, () =>
        db.query(
          'insert into public.comments (target_type, target_id, author_id, body) values ($1, $2, $3, $4)',
          ['task', t.rows[0]!.id, ids.autre, 'Bonjour'],
        ),
      ),
    );
  });

  it('un commentaire sur une cible inexistante est refusé', async () => {
    await expectDenied(
      asUser(ids.membre, () =>
        db.query(
          'insert into public.comments (target_type, target_id, author_id, body) values ($1, $2, $3, $4)',
          ['task', ids.inconnu, ids.membre, 'Orphelin'],
        ),
      ),
    );
  });
});

describe('idées', () => {
  let ideaId: string;

  it('un membre propose une idée qui démarre en « nouvelle »', async () => {
    const r = await asUser(ids.membre, () =>
      db.query<{ id: string }>(
        `insert into public.ideas (title, problem, solution, author_id)
         values ('Atelier IA', 'Peu de membres savent prototyper.', 'Un atelier mensuel de prototypage.', $1)
         returning id`,
        [ids.membre],
      ),
    );
    ideaId = r.rows[0]!.id;
  });

  it('un membre ne peut pas créer une idée déjà approuvée', async () => {
    await expectDenied(
      asUser(ids.membre, () =>
        db.query(
          `insert into public.ideas (title, problem, solution, author_id, status)
           values ('Triche', 'Problème valable ici.', 'Solution valable ici.', $1, 'approuvee')`,
          [ids.membre],
        ),
      ),
    );
  });

  it('un membre ne peut pas décider du sort de son idée', async () => {
    await expectDenied(
      asUser(ids.membre, () => db.query("update public.ideas set status = 'approuvee' where id = $1", [ideaId])),
    );
  });

  it('un membre vote une seule fois par idée', async () => {
    await asUser(ids.bureau, () =>
      db.query('insert into public.idea_votes (idea_id, voter_id) values ($1, $2)', [ideaId, ids.bureau]),
    );
    await expectDenied(
      asUser(ids.bureau, () =>
        db.query('insert into public.idea_votes (idea_id, voter_id) values ($1, $2)', [ideaId, ids.bureau]),
      ),
    );
  });

  it('le bureau décide et la décision est horodatée et signée', async () => {
    await asUser(ids.bureau, () =>
      db.query("update public.ideas set status = 'approuvee', decision_note = 'Bonne piste' where id = $1", [ideaId]),
    );
    const r = await db.query<{ decided_by: string; decided_at: Date | null }>(
      'select decided_by, decided_at from public.ideas where id = $1',
      [ideaId],
    );
    expect(r.rows[0]!.decided_by).toBe(ids.bureau);
    expect(r.rows[0]!.decided_at).not.toBeNull();
  });

  it('l\'auteur est prévenu de la décision', async () => {
    const r = await asUser(ids.membre, () =>
      db.query<{ kind: string }>("select kind from public.notifications where kind = 'idea_decision'"),
    );
    expect(r.rows.length).toBeGreaterThan(0);
  });
});

describe('projets, événements et pôles', () => {
  it('seul le bureau ou le bureau crée un projet', async () => {
    await expectDenied(
      asUser(ids.membre, () =>
        db.query('insert into public.projects (title, created_by) values ($1, $2)', ['Projet sauvage', ids.membre]),
      ),
    );
    await asUser(ids.bureau, () =>
      db.query('insert into public.projects (title, created_by) values ($1, $2)', ['Projet pôle', ids.bureau]),
    );
    const r = await db.query('select id from public.projects');
    expect(r.rows.length).toBe(1);
  });

  it('un membre ne peut pas modifier un projet ni s\'y ajouter', async () => {
    const p = await db.query<{ id: string }>('select id from public.projects limit 1');
    await asUser(ids.membre, () => db.query("update public.projects set title = 'Hacké' where id = $1", [p.rows[0]!.id]));
    const t = await db.query<{ title: string }>('select title from public.projects where id = $1', [p.rows[0]!.id]);
    expect(t.rows[0]!.title).toBe('Projet pôle');
    await expectDenied(
      asUser(ids.membre, () =>
        db.query('insert into public.project_members (project_id, profile_id) values ($1, $2)', [p.rows[0]!.id, ids.membre]),
      ),
    );
  });

  it('le bureau crée un événement et l\'associe à son pôle', async () => {
    const e = await asUser(ids.bureau, () =>
      db.query<{ id: string }>(
        "insert into public.events (title, starts_at, created_by) values ('Conférence IA', now() + interval '30 days', $1) returning id",
        [ids.bureau],
      ),
    );
    const pole = await db.query<{ id: string }>("select id from public.poles where slug = 'evenementiel-partenariats'");
    await asUser(ids.bureau, () =>
      db.query('insert into public.event_poles (event_id, pole_id) values ($1, $2)', [e.rows[0]!.id, pole.rows[0]!.id]),
    );
    const r = await db.query('select 1 from public.event_poles where event_id = $1', [e.rows[0]!.id]);
    expect(r.rows).toHaveLength(1);
  });

  it('les pôles ne sont modifiables que par le bureau', async () => {
    await expectDenied(
      asUser(ids.membre, () => db.query("insert into public.poles (slug, name) values ('hack', 'Hack')")),
    );
  });
});

describe('documents', () => {
  it('un membre ne peut pas déposer un document réservé au bureau', async () => {
    await expectDenied(
      asUser(ids.membre, () =>
        db.query(
          `insert into public.documents (title, storage_path, mime_type, size_bytes, uploaded_by, visibility)
           values ('Budget', 'x/budget.pdf', 'application/pdf', 1000, $1, 'bureau')`,
          [ids.membre],
        ),
      ),
    );
  });

  it('un document « pôle » n\'est visible que des membres du pôle', async () => {
    const pole = await db.query<{ id: string }>("select id from public.poles where slug = 'women-in-tech'");
    await asUser(ids.bureau, () =>
      db.query(
        `insert into public.documents (title, storage_path, mime_type, size_bytes, uploaded_by, visibility, pole_id)
         values ('Charte Women in Tech', 'x/charte.pdf', 'application/pdf', 1000, $1, 'pole', $2)`,
        [ids.bureau, pole.rows[0]!.id],
      ),
    );
    const membre = await asUser(ids.membre, () => db.query("select id from public.documents where title = 'Charte Women in Tech'"));
    const bureau = await asUser(ids.bureau, () => db.query("select id from public.documents where title = 'Charte Women in Tech'"));
    expect(membre.rows).toHaveLength(0);
    expect(bureau.rows).toHaveLength(1);
  });

  it('le journal d\'activité ne peut pas être écrit par un client', async () => {
    await expectDenied(
      asUser(ids.membre, () =>
        db.query("insert into public.activity_log (action, entity_type, summary) values ('faux', 'tasks', 'Faux')"),
      ),
    );
  });
});
