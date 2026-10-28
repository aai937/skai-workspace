// Lecture et validation des variables d'environnement. Une variable manquante arrête l'application
// au premier usage, avec un message clair (et jamais sa valeur).
import { z } from 'zod';

const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});

export type PublicEnv = z.infer<typeof publicSchema>;

export function readPublicEnv(): PublicEnv {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => String(issue.path[0])).join(', ');
    throw new Error(`Configuration incomplète : variables manquantes ou invalides (${names}). Voir .env.example.`);
  }
  return parsed.data;
}

export function readServerEnv() {
  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  if (!parsed.success) {
    throw new Error('Configuration serveur incomplète : SUPABASE_SERVICE_ROLE_KEY est absente.');
  }
  return parsed.data;
}
