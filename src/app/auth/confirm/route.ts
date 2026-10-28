// Lien reçu par e-mail (invitation, réinitialisation) : vérifie le jeton puis ouvre la page suivante.
import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_TYPES: EmailOtpType[] = ['invite', 'recovery', 'signup', 'email'];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next');
  const safeNext = next && /^\/(?!\/)[\w\-/]*$/.test(next) ? next : '/definir-mot-de-passe';

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, origin));
    }
  }
  return NextResponse.redirect(new URL('/connexion?erreur=lien', origin));
}
