'use server';

import { redirect } from 'next/navigation';
import { fail, ok, type ActionResult } from '@/lib/result';
import { createClient } from '@/lib/supabase/server';
import { siteOrigin } from '@/lib/site';
import { passwordSchema } from '@/lib/domain/schemas';
import { z } from 'zod';

// Message identique pour un mauvais mot de passe et un compte inexistant : pas d'énumération des comptes.
const BAD_CREDENTIALS = 'Adresse e-mail ou mot de passe incorrect.';

export async function signInAction(formData: FormData): Promise<ActionResult> {
  const parsed = z
    .object({
      email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
      password: z.string().min(1).max(128),
      next: z.string().max(300).optional(),
    })
    .safeParse({
      email: formData.get('email'),
      password: formData.get('password'),
      next: formData.get('next') || undefined,
    });
  if (!parsed.success) {
    return fail(BAD_CREDENTIALS);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    return fail(BAD_CREDENTIALS);
  }

  // Redirection interne uniquement : on n'accepte que les chemins relatifs du site.
  const next = parsed.data.next && /^\/(?!\/)[\w\-/]*$/.test(parsed.data.next) ? parsed.data.next : '/tableau-de-bord';
  redirect(next);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/connexion');
}

export async function requestPasswordResetAction(formData: FormData): Promise<ActionResult> {
  const email = z.string().trim().toLowerCase().max(254).pipe(z.email()).safeParse(formData.get('email'));
  // Réponse identique que l'adresse existe ou non.
  if (email.success) {
    const supabase = await createClient();
    const origin = await siteOrigin();
    await supabase.auth.resetPasswordForEmail(email.data, {
      redirectTo: `${origin}/auth/confirm?type=recovery&next=/definir-mot-de-passe`,
    });
  }
  return ok(undefined, 'Si cette adresse est membre de l\'association, un lien vient de lui être envoyé.');
}

export async function setPasswordAction(formData: FormData): Promise<ActionResult> {
  const parsed = passwordSchema.safeParse(formData.get('password'));
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Mot de passe invalide.');
  }
  if (formData.get('password') !== formData.get('confirmation')) {
    return fail('Les deux mots de passe ne correspondent pas.');
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    return fail('Le mot de passe n\'a pas pu être enregistré. Demandez un nouveau lien.');
  }
  redirect('/tableau-de-bord');
}

// Demande d'inscription : le compte est créé mais reste inactif tant que le bureau ne l'a pas validé.
export async function signUpAction(formData: FormData): Promise<ActionResult> {
  const parsed = z
    .object({
      fullName: z.string().trim().min(2, 'Indiquez votre nom complet.').max(120),
      email: z.string().trim().toLowerCase().max(254).pipe(z.email('Adresse e-mail invalide.')),
      password: passwordSchema,
    })
    .safeParse({
      fullName: formData.get('fullName'),
      email: formData.get('email'),
      password: formData.get('password'),
    });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Données invalides.');
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
    },
  });
  // Même message dans tous les cas : pas de révélation des comptes existants.
  if (error && error.status !== 422 && error.status !== 400) {
    return fail('La demande n’a pas pu être enregistrée. Réessayez dans quelques minutes.');
  }
  return ok(undefined, 'Demande enregistrée. Le bureau validera votre accès et vous affectera à une équipe.');
}
