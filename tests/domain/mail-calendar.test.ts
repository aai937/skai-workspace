import { describe, expect, it } from 'vitest';
import { buildIcs } from '@/lib/calendar/ics';
import { buildAnnouncementMail, buildDigest, escapeHtml } from '@/lib/mail/digest';
import { canPublishAnnouncement, canCreateChannel } from '@/lib/domain/messaging';
import type { Viewer } from '@/lib/domain/permissions';

const POLE = 'pole-a';
const bureau: Viewer = { id: 'b', isBureau: true, poleRoles: {} };
const responsable: Viewer = { id: 'r', isBureau: false, poleRoles: { [POLE]: 'responsable' } };
const membre: Viewer = { id: 'm', isBureau: false, poleRoles: { [POLE]: 'membre' } };

describe('annonces et canaux', () => {
  it('seul le bureau publie pour tous les membres', () => {
    expect(canPublishAnnouncement(bureau, 'tous', null)).toBe(true);
    expect(canPublishAnnouncement(responsable, 'tous', null)).toBe(false);
  });

  it('un responsable publie pour son pôle, pas pour un autre', () => {
    expect(canPublishAnnouncement(responsable, 'pole', POLE)).toBe(true);
    expect(canPublishAnnouncement(responsable, 'pole', 'autre')).toBe(false);
    expect(canPublishAnnouncement(membre, 'pole', POLE)).toBe(false);
  });

  it('les canaux libres sont créés par le bureau ou un responsable', () => {
    expect(canCreateChannel(bureau)).toBe(true);
    expect(canCreateChannel(responsable)).toBe(true);
    expect(canCreateChannel(membre)).toBe(false);
  });
});

describe('synthèse par e-mail', () => {
  const site = 'https://skai.example.org';

  it("n'envoie rien quand il n'y a rien à signaler", () => {
    expect(buildDigest({ siteUrl: site, name: 'Ada', period: 'quotidien', notifications: [], announcements: [], dueTasks: [] })).toBeNull();
  });

  it('résume les éléments avec des liens absolus et échappe le HTML', () => {
    const d = buildDigest({
      siteUrl: site,
      name: 'Ada <script>',
      period: 'quotidien',
      notifications: [{ title: 'Tâche <b>urgente</b>', body: '', link: '/taches/1' }],
      announcements: [],
      dueTasks: [{ title: 'Salle', body: 'Échéance le 2026-11-03', link: '/taches/2' }],
    });
    expect(d).not.toBeNull();
    expect(d!.subject).toContain('2 nouveautés');
    expect(d!.html).toContain('https://skai.example.org/taches/1');
    expect(d!.html).not.toContain('<script>');
    expect(d!.html).toContain('&lt;b&gt;urgente&lt;/b&gt;');
    expect(d!.text).toContain('https://skai.example.org/profil');
  });

  it("échappe correctement les caractères spéciaux", () => {
    expect(escapeHtml(`"a" & 'b' <c>`)).toBe('&quot;a&quot; &amp; &#39;b&#39; &lt;c&gt;');
  });

  it("produit l'e-mail d'une annonce", () => {
    const m = buildAnnouncementMail({ siteUrl: site, title: 'Hackathon', body: 'Le 5 novembre', author: 'Bureau' });
    expect(m.subject).toBe('Annonce : Hackathon');
    expect(m.text).toContain('https://skai.example.org/annonces');
  });
});

describe('calendrier iCalendar', () => {
  const stamp = new Date('2026-10-28T10:00:00Z');

  it('produit un calendrier valide avec événements journée et horaires', () => {
    const ics = buildIcs('skAI · Ada', [
      { uid: 'task-1', summary: 'Échéance : Réserver la salle', allDay: true, start: '2026-11-03' },
      { uid: 'event-1', summary: 'Hackathon', allDay: false, start: '2026-11-05T17:00:00.000Z', end: '2026-11-05T20:00:00.000Z', description: 'Amphi A, Bâtiment 2' },
    ], stamp);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261103');
    expect(ics).toContain('DTEND;VALUE=DATE:20261104');
    expect(ics).toContain('DTSTART:20261105T170000Z');
    expect(ics).toContain('DESCRIPTION:Amphi A\\, Bâtiment 2');
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
  });

  it('replie les lignes longues sur 75 caractères', () => {
    const ics = buildIcs('x', [{ uid: 'a', summary: 'a'.repeat(200), allDay: true, start: '2026-11-03' }], stamp);
    for (const line of ics.split('\r\n')) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
  });
});
