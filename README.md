# skAI Workspace

Plateforme interne de l'association : tâches, projets, idées, événements, pôles, documents, notifications et journal d'activité.

Stack : Next.js (App Router, TypeScript strict), Tailwind CSS, Supabase (PostgreSQL, Auth, Storage), Zod, Vercel.

---

## 1. Installer les dépendances

Prérequis : Node.js 20.9 ou plus récent (22 LTS recommandé), npm.

```bash
npm install
```

## 2. Lancer l'application en local

1. Copiez le fichier d'exemple et renseignez vos valeurs (voir section 3) :

   ```bash
   cp .env.example .env.local
   ```

2. Démarrez le serveur de développement :

   ```bash
   npm run dev
   ```

3. Ouvrez [http://localhost:3000/connexion](http://localhost:3000/connexion).

Les adresses `http://localhost:3000/auth/confirm` doivent être autorisées dans Supabase (section 3).

## 3. Configurer Supabase

Créez un projet Supabase (région Europe recommandée). Puis, dans le tableau de bord du projet :

1. **Project Settings > API** : copiez l'URL du projet, la clé `anon` (publique) et la clé `service_role` (**secrète**).
2. **Authentication > Sign In / Providers > Email** : activez le fournisseur e-mail avec mot de passe.
3. **Authentication > Sign In / Providers** : **désactivez « Allow new users to sign up »**. Il n'y a pas d'inscription publique : seul le bureau invite des membres.
4. **Authentication > URL Configuration** :
   - *Site URL* : l'URL de production, par exemple `https://skai.example.org`.
   - *Redirect URLs* : ajoutez `http://localhost:3000/auth/confirm` et `https://skai.example.org/auth/confirm`.
5. **Authentication > Email Templates** : dans les modèles « Invite user » et « Reset password », le lien doit pointer vers la route de confirmation de l'application :

   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/definir-mot-de-passe
   ```

   Pour « Reset password », remplacez `type=invite` par `type=recovery`.

## 4. Appliquer les migrations

Les migrations sont dans `supabase/migrations/`. Elles s'appliquent dans l'ordre (0001 à 0007) et sont idempotentes pour les rôles et le bucket.

**Option A : éditeur SQL (le plus simple).** Dans **SQL Editor**, collez le contenu de chaque fichier dans l'ordre, puis exécutez-le.

**Option B : Supabase CLI (recommandé pour les mises à jour).**

```bash
npx supabase login
npx supabase link --project-ref <identifiant-du-projet>
npx supabase db push
```

Vérifications après migration : la table `public.poles` contient 4 lignes, le bucket `documents` existe (privé), et RLS est activé sur toutes les tables de `public`.

Les tests de sécurité de la base se rejouent localement sans Docker (PGlite) :

```bash
npm run db:test
```

## 5. Créer le premier administrateur (bureau)

Il n'existe **aucun compte par défaut** et aucun mot de passe n'est codé en dur. Le script envoie une invitation à l'adresse indiquée, la personne choisit son mot de passe via le lien reçu.

1. Dans `.env.local`, renseignez `FIRST_ADMIN_EMAIL`, `NEXT_PUBLIC_SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`.
2. Lancez :

   ```bash
   npm run admin:create-first
   ```

3. Ouvrez le lien reçu, choisissez un mot de passe d'au moins 12 caractères.

Le script refuse de s'exécuter s'il existe déjà un membre actif du bureau. **Retirez ensuite la clé `service_role` de votre poste** si vous ne l'utilisez plus, et ne la partagez jamais.

## 6. Envoyer le code sur GitHub

```bash
git init -b main
git add .
git commit -m "Initialisation de skAI Workspace"
git remote add origin https://github.com/<organisation>/skai-workspace.git
git push -u origin main
```

Le fichier `.gitignore` exclut `.env*`, `node_modules` et `.next`. Vérifiez avec `git status` qu'aucun secret n'apparaît.

## 7. Importer le dépôt dans Vercel

1. Vercel > **Add New… > Project** > importez le dépôt GitHub.
2. *Framework Preset* : Next.js (détecté automatiquement). Région de fonctions : `cdg1` (Paris) si disponible.
3. Ne lancez pas encore le déploiement : configurez d'abord les variables (étape 8).

## 8. Configurer les variables d'environnement

Dans Vercel > **Project Settings > Environment Variables**, pour l'environnement **Production** (et **Preview** si vous testez les branches) :

| Variable | Valeur | Secrète |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://skai.example.org` (votre domaine) | non |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase | non |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé `anon` | non |
| `SUPABASE_SERVICE_ROLE_KEY` | clé `service_role` | **oui** (sensible) |
| `CRON_SECRET` | chaîne aléatoire, générée avec `openssl rand -hex 32` | **oui** |
| `FIRST_ADMIN_EMAIL` | adresse de la première personne du bureau (facultatif après création) | non |

Ne mettez jamais ces valeurs dans le dépôt. `NEXT_PUBLIC_` n'est réservé qu'aux valeurs publiques.

## 9. Déployer l'application

Lancez le premier déploiement depuis Vercel (**Deploy**). Chaque push sur `main` déploie ensuite automatiquement. Les pull requests produisent des aperçus.

Vercel Cron appelle `/api/cron/echeances` chaque jour à 7 h UTC (fichier `vercel.json`) avec l'en-tête `Authorization: Bearer <CRON_SECRET>`.

Important : **appliquez les migrations Supabase avant de déployer** une version qui les utilise (section 4).

## 10. Vérifier les fonctionnalités en production

Une fois le déploiement réussi, avec le compte du bureau :

- [ ] `https://<domaine>/connexion` s'affiche ; `https://<domaine>/taches` redirige vers la connexion sans session.
- [ ] Connexion avec le compte du bureau ; le tableau de bord s'affiche.
- [ ] Paramètres > Membres : inviter une adresse de test ; le lien d'invitation arrive et ouvre « Choisir un mot de passe ».
- [ ] Avec un compte **sans invitation** (ou non validé) : la page « Compte en attente » s'affiche et aucune donnée n'apparaît.
- [ ] Un membre simple ne voit pas Paramètres et ne peut pas changer son propre rôle (refus attendu).
- [ ] Créer une tâche, l'attribuer à un membre : la notification apparaît chez ce membre.
- [ ] Un membre passe la tâche en « Bloquée » sans motif : refus ; avec un motif : le responsable est notifié.
- [ ] Proposer une idée, voter, puis la décision du bureau : l'auteur est notifié.
- [ ] Téléverser un PDF de test ; ouvrir le lien : un compte hors du périmètre ne doit pas pouvoir y accéder.
- [ ] `https://<domaine>/api/cron/echeances` sans en-tête renvoie `401`.
- [ ] Supabase > Table Editor : vérifier que les lignes apparaissent (persistance).

Supprimez les comptes et données de test après les vérifications.

## 11. Déployer les mises à jour

```bash
git pull
npm install
npm run lint && npm run typecheck && npm test && npm run build
npx supabase db push        # seulement si de nouvelles migrations ont été ajoutées
git push                    # Vercel redéploie automatiquement
```

---

## Structure du projet

```
src/
  app/
    (app)/            pages privées (session obligatoire)
    actions/          actions serveur : validation Zod + contrôle des droits + écriture
    api/cron/         tâche planifiée des échéances (secret CRON_SECRET)
    auth/confirm/     lien d'invitation et de réinitialisation
  components/         interface (ui.tsx sans état, forms.tsx avec états, layout/)
  lib/
    domain/           règles métier pures : constantes, permissions, schémas, formats
    data/             lectures en base (sous RLS)
    supabase/         clients serveur (session utilisateur) et administrateur (clé service)
  proxy.ts            rafraîchit la session et protège les routes privées
supabase/migrations/  schéma, fonctions d'autorisation, RLS, triggers, seed des pôles, stockage
tests/
  domain/             tests unitaires des permissions et des schémas
  db/                 tests des règles RLS et des triggers sur Postgres embarqué (PGlite)
scripts/create-first-admin.ts   création du premier membre du bureau
```

## Modèle de sécurité

- **Refus par défaut** : RLS est activé sur toutes les tables de `public`. Sans politique, aucun accès.
- **Trois niveaux** : bureau (`profiles.role = 'bureau'`), responsable de pôle et membre (`pole_memberships.role`).
- **Défense en profondeur** : `src/lib/domain/permissions.ts` (serveur, pour l'interface et les actions) et les politiques RLS (base) reproduisent les mêmes règles. Masquer un bouton n'est jamais la protection.
- **Pas d'élévation de privilèges** : un trigger refuse à tout non-bureau de modifier `role` ou `is_active`. Un assigné ne peut modifier que le statut et le blocage de sa tâche.
- **Comptes** : seules les adresses invitées deviennent actives ; les autres restent en attente.
- **Coordonnées personnelles** : table séparée, visible du membre et du bureau uniquement.
- **Documents** : bucket privé ; téléchargement par URL signée de 2 minutes après contrôle des droits.
- **Journal** : écrit par triggers, sans contenu de commentaire ni donnée personnelle.
- **Secrets** : la clé `service_role` n'est utilisée que côté serveur (invitations, script, cron).

## Limites connues

- Les tests de la base tournent sur PGlite (Postgres embarqué) avec un schéma `auth` simulé : ils valident les règles RLS et les triggers, mais pas le comportement exact de Supabase Auth ni du stockage. Les vérifications de la section 10 sont à faire en production.
- Le rappel d'échéances est une tâche quotidienne ; il n'y a pas d'envoi d'e-mail, uniquement des notifications internes.
- Les annonces du tableau de bord ne sont pas encore modélisées.

---

## Messagerie, annonces et e-mails (version 2)

### Ce qui est disponible

- **Messages** (`/messages`) : canal général, un canal par pôle, par projet et par événement (créés automatiquement), et des canaux libres créés par le bureau ou un responsable. Messages en direct, fils de réponses, réactions emoji, mentions et suppression de ses propres messages.
- **Annonces** (`/annonces`) : publiées par le bureau pour tous les membres, ou par un responsable pour son pôle. Épinglage, suivi de lecture, archivage et envoi optionnel par e-mail. Les dernières annonces apparaissent aussi sur le tableau de bord.
- **E-mails** : synthèse quotidienne (ou hebdomadaire le lundi) des notifications, des annonces et des échéances à venir. Chaque membre choisit sa fréquence dans **Mon profil**, ou désactive les e-mails.
- **Calendrier** : chaque membre dispose d'un lien `.ics` personnel (`/api/calendrier?token=...`) à ajouter à son agenda. Le lien se régénère depuis **Mon profil**.

### Activer l'envoi d'e-mails (fournisseur gratuit)

Le code est prêt, mais aucun e-mail ne part tant que le fournisseur n'est pas configuré.

**Option 1 : Brevo (recommandé si vous n'avez pas de nom de domaine).** Créez un compte gratuit sur brevo.com (300 e-mails par jour). Validez une adresse d'expéditeur dans **Senders & IP**, puis créez une clé API dans **SMTP & API**. Renseignez :

```
MAIL_PROVIDER=brevo
MAIL_API_KEY=<clé API Brevo>
MAIL_FROM_EMAIL=<adresse validée>
MAIL_FROM_NAME="skAI Workspace"
```

**Option 2 : Resend (si vous avez un domaine).** Créez un compte gratuit sur resend.com (3 000 e-mails par mois). Vérifiez votre domaine, puis créez une clé API. Renseignez `MAIL_PROVIDER=resend` et les mêmes variables, avec une adresse de ce domaine.

Ajoutez les mêmes variables dans Vercel (Production). La synthèse part chaque jour à 6 h UTC.

### Migration

Appliquez `supabase/migrations/0007_messaging_announcements_mail.sql` après les migrations précédentes. Elle active aussi le temps réel pour les messages.

### Tests

```bash
npm test
```

Les tests de sécurité couvrent les canaux, les messages, les annonces, les préférences de mail et le calendrier.

## Inscriptions et affectation aux pôles

- **Demande d'inscription** : `/inscription`. Une personne crée son compte, mais reste **inactive** tant que le bureau ne l'a pas validée : elle ne voit aucune donnée.
- **Validation et pôle** : dans **Paramètres > Membres et pôles**, le bureau valide le compte (section « En attente de validation »), puis l'affecte à un ou plusieurs pôles, en tant que membre ou responsable. Le bureau peut aussi être affecté à un pôle.
- **Inviter directement** : le bureau peut aussi envoyer une invitation avec le pôle et le rôle déjà choisis.
- Dans Supabase, l'inscription doit rester activée (Authentication > Sign In / Providers) pour que la demande fonctionne. Ajoutez l'URL de production dans **Authentication > URL Configuration**.
