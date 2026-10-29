// Lien reçu (invitation, réinitialisation) : on ne consomme pas le jeton ici. Un aperçu automatique
// (messagerie, antivirus, navigateur) ouvrirait le lien et l'épuiserait. On affiche une page de confirmation.
import { NextResponse, type NextRequest } from 'next/server';

export function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const target = new URL('/auth/valider', origin);
  for (const key of ['token_hash', 'type', 'next']) {
    const value = searchParams.get(key);
    if (value) target.searchParams.set(key, value);
  }
  return NextResponse.redirect(target);
}
