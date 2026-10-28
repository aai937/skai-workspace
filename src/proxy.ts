// Proxy (ex-middleware, Next.js 16) : rafraîchit la session Supabase et redirige
// les visiteurs non connectés vers la connexion. Ce n'est qu'une vérification rapide :
// chaque page et chaque action vérifient à nouveau la session et les droits côté serveur.
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { readPublicEnv } from '@/lib/env';

// Routes publiques : connexion, lien e-mail, et routes protégées par un secret (CRON_SECRET) ou un jeton (calendrier).
const PUBLIC_PATHS = ['/connexion', '/inscription', '/auth/confirm', '/mot-de-passe-oublie', '/api/cron', '/api/calendrier'];

export async function proxy(request: NextRequest) {
  const env = readPublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname === p || request.nextUrl.pathname.startsWith(`${p}/`));

  if (!data?.claims && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/connexion';
    url.search = '';
    if (request.nextUrl.pathname !== '/') {
      url.searchParams.set('suite', request.nextUrl.pathname);
    }
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|icon.png|apple-icon.png|brand/|robots.txt|sitemap.xml).*)'],
};
