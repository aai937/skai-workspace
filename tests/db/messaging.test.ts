import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

// Règles de la messagerie, des annonces et du calendrier (migration 0007), rejouées sur PGlite.
const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
const migrations = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql') && !f.includes('storage'))
  .sort();

const ids = {
  bureau: '10000000-0000-4000-8000-000000000001',
  responsable: '10000000-0000-4000-8000-000000000002',
  membre: '10000000-0000-4000-8000-000000000003',
  inactif: '10000000-0000-4000-8000-000000000004',
} as const;

let db: PGlite;

async function asUser<T>(userId: string, run: () => Promise<T>): Promise<T> {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.exec('set role authenticated');
  try {
    return await run();
  } finally {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

async function denied(promise: Promise<unknown>) {
  await expect(promise).rejects.toThrow();
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create schema if not exists auth;
    create table auth.users (
      id uuid primary key,
      email text not null,
      raw_user_meta_data jsonb not null default '{}'::jsonb
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
  `);
  for (const file of migrations) {
    await db.exec(readFileSync(path.join(migrationsDir, file), 'utf8'));
  }
  await db.exec(`
    insert into public.invitations (email, role) values
      ('bureau@skai.test', 'bureau'), ('resp@skai.test', 'membre'), ('membre@skai.test', 'membre');
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${ids.bureau}', 'bureau@skai.test', '{"full_name":"Bureau"}'),
      ('${ids.responsable}', 'resp@skai.test', '{"full_name":"Responsable"}'),
      ('${ids.membre}', 'membre@skai.test', '{"full_name":"Membre"}'),
      ('${ids.inactif}', 'inactif@skai.test', '{"full_name":"Inactif"}');
  `);
  const pole = await db.query<{ id: string }>("select id from public.poles where slug = 'projets-innovation'");
  await db.query(
    "insert into public.pole_memberships (profile_id, pole_id, role) values ($1, $2, 'responsable'), ($3, $2, 'membre')",
    [ids.responsable, pole.rows[0]!.id, ids.membre],
  );
});

describe('canaux', () => {
  it('crée un canal pour chaque pôle et un canal général', async () => {
    const r = await db.query<{ slug: string }>("select slug from public.channels where kind in ('pole','general')");
    expect(r.rows.length).toBe(5);
  });

  it('crée un canal de projet automatiquement', async () => {
    await db.query("insert into public.projects (title, created_by) values ('Hackathon IA', $1)", [ids.responsable]);
    const r = await db.query("select id from public.channels where kind = 'projet' and name = 'Hackathon IA'");
    expect(r.rows).toHaveLength(1);
  });

  it('un membre simple ne crée pas de canal libre', async () => {
    await denied(
      asUser(ids.membre, () =>
        db.query("insert into public.channels (slug, name, kind, created_by) values ('sauvage', 'Sauvage', 'libre', $1)", [ids.membre]),
      ),
    );
  });
});

describe('messages', () => {
  let generalId: string;

  beforeAll(async () => {
    generalId = (await db.query<{ id: string }>("select id from public.channels where slug = 'general'")).rows[0]!.id;
  });

  it('un membre actif publie un message', async () => {
    await asUser(ids.membre, () =>
      db.query('insert into public.messages (channel_id, author_id, body) values ($1, $2, $3)', [generalId, ids.membre, 'Bonjour à tous']),
    );
    const r = await db.query('select id from public.messages where channel_id = $1', [generalId]);
    expect(r.rows.length).toBe(1);
  });

  it('un compte inactif ne voit ni ne poste de message', async () => {
    const seen = await asUser(ids.inactif, () => db.query('select id from public.messages'));
    expect(seen.rows).toHaveLength(0);
    await denied(
      asUser(ids.inactif, () =>
        db.query('insert into public.messages (channel_id, author_id, body) values ($1, $2, $3)', [generalId, ids.inactif, 'Intrus']),
      ),
    );
  });

  it('une réponse ne peut pas changer de canal', async () => {
    const parent = await db.query<{ id: string }>('select id from public.messages limit 1');
    const other = await db.query<{ id: string }>("select id from public.channels where slug = 'projets-innovation'");
    await denied(
      asUser(ids.responsable, () =>
        db.query('insert into public.messages (channel_id, author_id, parent_id, body) values ($1, $2, $3, $4)', [
          other.rows[0]!.id, ids.responsable, parent.rows[0]!.id, 'Réponse hors fil',
        ]),
      ),
    );
  });

  it('un message archivé canal ne peut plus recevoir de message', async () => {
    const c = await db.query<{ id: string }>("insert into public.channels (slug, name, kind, created_by, archived_at) values ('ferme', 'Fermé', 'libre', $1, now()) returning id", [ids.bureau]);
    await denied(
      asUser(ids.bureau, () =>
        db.query('insert into public.messages (channel_id, author_id, body) values ($1, $2, $3)', [c.rows[0]!.id, ids.bureau, 'Trop tard']),
      ),
    );
  });

  it('la mention notifie le membre mentionné', async () => {
    await asUser(ids.membre, () =>
      db.query('insert into public.messages (channel_id, author_id, body, mentions) values ($1, $2, $3, $4)', [
        generalId, ids.membre, '@Responsable regarde ça', [ids.responsable],
      ]),
    );
    const n = await asUser(ids.responsable, () => db.query("select id from public.notifications where kind = 'mention'"));
    expect(n.rows.length).toBeGreaterThan(0);
  });
});

describe('annonces', () => {
  it('un membre simple ne publie pas d\'annonce pour tous', async () => {
    await denied(
      asUser(ids.membre, () =>
        db.query("insert into public.announcements (title, body, audience, author_id) values ('Fausse', 'Message officiel', 'tous', $1)", [ids.membre]),
      ),
    );
  });

  it('le responsable publie pour son pôle, et seuls les membres du pôle le voient', async () => {
    const pole = await db.query<{ id: string }>("select id from public.poles where slug = 'projets-innovation'");
    await asUser(ids.responsable, () =>
      db.query("insert into public.announcements (title, body, audience, pole_id, author_id) values ('Réunion pôle', 'Mardi 18h', 'pole', $1, $2)", [pole.rows[0]!.id, ids.responsable]),
    );
    const membreVoit = await asUser(ids.membre, () => db.query("select id from public.announcements where title = 'Réunion pôle'"));
    expect(membreVoit.rows).toHaveLength(1);
    const autre = await db.query<{ id: string }>("select id from public.poles where slug = 'women-in-tech'");
    await denied(
      asUser(ids.responsable, () =>
        db.query("insert into public.announcements (title, body, audience, pole_id, author_id) values ('Hors pôle', 'Non', 'pole', $1, $2)", [autre.rows[0]!.id, ids.responsable]),
      ),
    );
  });

  it('la lecture d\'une annonce est enregistrée pour son auteur seulement', async () => {
    const a = await db.query<{ id: string }>("select id from public.announcements where title = 'Réunion pôle'");
    await asUser(ids.membre, () =>
      db.query('insert into public.announcement_reads (announcement_id, profile_id) values ($1, $2)', [a.rows[0]!.id, ids.membre]),
    );
    await denied(
      asUser(ids.membre, () =>
        db.query('insert into public.announcement_reads (announcement_id, profile_id) values ($1, $2)', [a.rows[0]!.id, ids.bureau]),
      ),
    );
  });
});

describe('préférences et calendrier', () => {
  it('chaque membre a un jeton de calendrier unique et une préférence de mail', async () => {
    const r = await db.query<{ calendar_token: string; email_digest: string }>(
      'select calendar_token, email_digest from public.profiles where id = $1',
      [ids.membre],
    );
    expect(r.rows[0]!.calendar_token).toBeTruthy();
    expect(r.rows[0]!.email_digest).toBe('quotidien');
  });

  it('un membre ne modifie pas le jeton de calendrier d\'un autre', async () => {
    const before = await db.query<{ calendar_token: string }>('select calendar_token from public.profiles where id = $1', [ids.bureau]);
    await asUser(ids.membre, () =>
      db.query('update public.profiles set calendar_token = gen_random_uuid() where id = $1', [ids.bureau]),
    );
    const after = await db.query<{ calendar_token: string }>('select calendar_token from public.profiles where id = $1', [ids.bureau]);
    expect(after.rows[0]!.calendar_token).toBe(before.rows[0]!.calendar_token);
  });
});
