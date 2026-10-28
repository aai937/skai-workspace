// Vérification du secret des tâches planifiées (Vercel envoie « Authorization: Bearer <CRON_SECRET> »).
import { timingSafeEqual } from 'node:crypto';

export function isCronAuthorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) {
    return false;
  }
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
