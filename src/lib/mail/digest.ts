// Contenu des e-mails : synthèse quotidienne ou hebdomadaire, et annonce diffusée par mail.
// Fonctions pures (aucun accès réseau) pour pouvoir les tester.

export type DigestItem = { title: string; body: string; link: string };

export type DigestInput = {
  siteUrl: string;
  name: string;
  period: 'quotidien' | 'hebdomadaire';
  notifications: DigestItem[];
  announcements: DigestItem[];
  dueTasks: DigestItem[];
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function absolute(siteUrl: string, link: string): string {
  return `${siteUrl.replace(/\/$/, '')}${link.startsWith('/') ? link : `/${link}`}`;
}

function section(title: string, items: DigestItem[], siteUrl: string): { html: string; text: string } {
  if (items.length === 0) {
    return { html: '', text: '' };
  }
  const html = `<h2 style="font-size:16px;margin:24px 0 8px">${escapeHtml(title)}</h2><ul style="padding-left:18px">${items
    .map(
      (i) =>
        `<li style="margin-bottom:8px"><a href="${escapeHtml(absolute(siteUrl, i.link))}" style="color:#8b1a1f">${escapeHtml(i.title)}</a>${i.body ? `<br><span style="color:#55554f">${escapeHtml(i.body)}</span>` : ''}</li>`,
    )
    .join('')}</ul>`;
  const text = `\n${title}\n${items
    .map((i) => `- ${i.title}${i.body ? ` : ${i.body}` : ''} (${absolute(siteUrl, i.link)})`)
    .join('\n')}\n`;
  return { html, text };
}

// Renvoie null s'il n'y a rien à signaler : aucun e-mail vide n'est envoyé.
export function buildDigest(input: DigestInput): { subject: string; html: string; text: string } | null {
  const total = input.notifications.length + input.announcements.length + input.dueTasks.length;
  if (total === 0) {
    return null;
  }
  const when = input.period === 'quotidien' ? 'aujourd’hui' : 'cette semaine';
  const subject = `skAI : ${total} nouveauté${total > 1 ? 's' : ''} ${when}`;

  const blocks = [
    section('Échéances à venir', input.dueTasks, input.siteUrl),
    section('Annonces', input.announcements, input.siteUrl),
    section('Vos notifications', input.notifications, input.siteUrl),
  ];
  const settings = absolute(input.siteUrl, '/profil');

  const html = `<!doctype html><html lang="fr"><body style="font-family:Arial,sans-serif;color:#1c1c1a;max-width:600px;margin:0 auto;padding:24px">
<p style="font-size:14px">Bonjour ${escapeHtml(input.name)},</p>
<p style="font-size:14px">Voici ce qui vous concerne ${escapeHtml(when)} dans skAI Workspace.</p>
${blocks.map((b) => b.html).join('')}
<p style="font-size:12px;color:#8a8a83;margin-top:32px">Vous recevez ce message parce que vous êtes membre de l’association. Pour changer la fréquence ou ne plus recevoir de mails : <a href="${escapeHtml(settings)}">mon profil</a>.</p>
</body></html>`;

  const text = `Bonjour ${input.name},\n\nVoici ce qui vous concerne ${when} dans skAI Workspace.\n${blocks
    .map((b) => b.text)
    .join('')}\nChanger la fréquence des mails : ${settings}\n`;

  return { subject, html, text };
}

// Mail envoyé à toute une audience lors d'une annonce diffusée par e-mail.
export function buildAnnouncementMail(input: { siteUrl: string; title: string; body: string; author: string }) {
  const link = absolute(input.siteUrl, '/annonces');
  const html = `<!doctype html><html lang="fr"><body style="font-family:Arial,sans-serif;color:#1c1c1a;max-width:600px;margin:0 auto;padding:24px">
<p style="font-size:12px;color:#55554f">Annonce de ${escapeHtml(input.author)}</p>
<h1 style="font-size:20px">${escapeHtml(input.title)}</h1>
<p style="font-size:14px;white-space:pre-wrap">${escapeHtml(input.body)}</p>
<p><a href="${escapeHtml(link)}" style="color:#8b1a1f">Voir l’annonce dans skAI Workspace</a></p>
</body></html>`;
  const text = `Annonce de ${input.author}\n\n${input.title}\n\n${input.body}\n\nVoir : ${link}\n`;
  return { subject: `Annonce : ${input.title}`.slice(0, 200), html, text };
}
