// Clients Supabase côté serveur.
// - `createClient` agit au nom de l'utilisateur connecté (cookies) : les politiques RLS s'appliquent.
// - `createAdminClient` utilise la clé service : il contourne RLS. Réservé aux invitations et aux scripts
//   d'administration. Ne jamais l'importer depuis un composant client ni le réexporter.
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { readPublicEnv, readServerEnv } from '@/lib/env';

export async function createClient() {
  const cookieStore = await cookies();
  const env = readPublicEnv();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Appelé depuis un composant de rendu : les cookies seront rafraîchis par le proxy.
        }
      },
    },
  });
}

export function createAdminClient() {
  const env = readPublicEnv();
  const serviceKey = readServerEnv().SUPABASE_SERVICE_ROLE_KEY;

  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
