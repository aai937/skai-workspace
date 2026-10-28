// Création du premier membre du bureau. À lancer une seule fois, depuis un poste de confiance :
//   npm run admin:create-first
// Aucun mot de passe n'est créé ni affiché : la personne reçoit un lien d'invitation et choisit le sien.
// Le script refuse de s'exécuter s'il existe déjà un membre actif du bureau.
import { createClient } from '@supabase/supabase-js';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Variable manquante : ${name}. Renseignez-la dans .env.local (voir .env.example).`);
  }
  return value;
}

async function main() {
  const url = required('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY');
  const email = required('FIRST_ADMIN_EMAIL').toLowerCase();
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('FIRST_ADMIN_EMAIL n\'est pas une adresse e-mail valide.');
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { count, error: countError } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'bureau')
    .eq('is_active', true);
  if (countError) {
    throw new Error(`Lecture des profils impossible : ${countError.message}`);
  }
  if ((count ?? 0) > 0) {
    console.log('Un membre du bureau est déjà actif. Aucune action effectuée.');
    console.log('Pour ajouter d\'autres membres, utilisez Paramètres > Membres dans l\'application.');
    return;
  }

  const { error: inviteRowError } = await admin
    .from('invitations')
    .upsert({ email, role: 'bureau', accepted_at: null }, { onConflict: 'email' });
  if (inviteRowError) {
    throw new Error(`Enregistrement de l'invitation impossible : ${inviteRowError.message}`);
  }

  const { data: existing } = await admin.from('profiles').select('id').eq('email', email).maybeSingle();
  if (existing) {
    // Le compte existe déjà (créé sans invitation) : on le valide directement pour le bureau.
    const { error } = await admin.from('profiles').update({ role: 'bureau', is_active: true }).eq('id', existing.id);
    if (error) {
      throw new Error(`Validation du compte impossible : ${error.message}`);
    }
    await admin.from('invitations').update({ accepted_at: new Date().toISOString() }).eq('email', email);
    console.log(`Le compte ${email} existe déjà et a été validé comme membre du bureau.`);
    console.log('Connectez-vous avec votre mot de passe, ou utilisez « Mot de passe oublié ».');
    return;
  }

  const { error: sendError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${site}/auth/confirm?type=invite&next=/definir-mot-de-passe`,
  });
  if (sendError) {
    throw new Error(`Envoi de l'invitation impossible : ${sendError.message}`);
  }
  console.log(`Invitation envoyée à ${email}. Le lien permet de choisir un mot de passe, puis le compte est actif (rôle bureau).`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
