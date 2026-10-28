// Origine publique du site, utilisée pour les liens envoyés par e-mail (invitations, réinitialisation).
import { headers } from 'next/headers';

export async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  const h = await headers();
  return `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`;
}
