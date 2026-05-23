# Déploiement — BIFFCOACH

Pas à pas pour mettre en production sur **Vercel** + **Supabase** + **Anthropic**.

---

## 1. Supabase — Base de données et auth

### 1.1 Créer le projet

1. Va sur [supabase.com](https://supabase.com) → **New project**.
2. Nom : `noxias-coach` (ou autre). Région : `eu-west-3 (Paris)` recommandé.
3. Génère un mot de passe Postgres fort, garde-le.
4. Attends la création (~2 min).

### 1.2 Récupérer les clés

Dans **Project Settings → API** :
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

> La `service_role` key n'est PAS nécessaire pour cette app : toutes les requêtes passent par le client SSR avec l'anon key + RLS, ce qui est plus sûr. Tu peux l'ignorer.

### 1.3 Exécuter les migrations

Dans **SQL Editor → New query**, exécute dans l'ordre :

1. `supabase/migrations/0001_init.sql` — profiles, sessions, messages, RLS
2. `supabase/migrations/0002_clients.sql` — table clients, restriction email @noxias.com, seed de 3 clients exemple

Pour chaque migration : copie-colle le contenu, clique **Run**.

Vérifie ensuite dans **Table Editor** que tu as bien :
- `profiles` (RLS activée)
- `sessions` (RLS activée, avec colonnes `client_id` + `client_name_snapshot`)
- `messages` (RLS activée)
- `clients` (RLS activée, 3 lignes seed)

> **Restriction email** : un trigger Postgres bloque les inscriptions hors `@noxias.com`. Pour ajouter un commercial dont l'email n'est pas en @noxias.com (cas exceptionnel), tu peux désactiver ou modifier le trigger `enforce_noxias_email_domain_trigger` sur `auth.users`.

### 1.4 Configurer l'auth

Dans **Authentication → Providers** :
- Active **Email** (par défaut).
- Décoche **Confirm email** : les commerciaux sont créés directement par l'admin, pas besoin d'email de confirmation.

Dans **Authentication → URL Configuration** :
- **Site URL** : `https://ton-domaine.vercel.app` (en local : `http://localhost:3000`)

> Pas besoin de configurer Redirect URLs : il n'y a pas d'inscription publique, les comptes sont créés par l'admin.

### 1.5 Créer les comptes commerciaux

L'app n'a **pas de signup public** — les commerciaux ne peuvent pas s'inscrire seuls. Pour ajouter un commercial, deux méthodes :

#### Méthode A — Dashboard Supabase (recommandé, 2 clics)

1. **Authentication → Users → Add user → Create new user**
2. Renseigne :
   - **Email** : `prenom.nom@noxias.com`
   - **Password** : un mot de passe que tu communiques au commercial
   - ✓ **Auto Confirm User** (sinon il devra confirmer par email)
3. **Create user**

Le profil est créé automatiquement (trigger `on_auth_user_created`). Le commercial peut se connecter immédiatement sur `/login`.

#### Méthode B — SQL Editor (en bulk)

```sql
-- Crée un commercial Noxias en SQL.
-- Le trigger enforce_noxias_email_domain_trigger valide le domaine @noxias.com.
-- Le trigger on_auth_user_created crée automatiquement la ligne profiles.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'prenom.nom@noxias.com',
  crypt('MotDePasseFort123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Prénom Nom"}'::jsonb,
  now(),
  now()
);
```

> Note : la restriction `@noxias.com` est appliquée par un trigger Postgres. Si tu dois exceptionnellement ajouter un email hors domaine (ex : consultant externe), désactive temporairement le trigger :
> ```sql
> alter table auth.users disable trigger enforce_noxias_email_domain_trigger;
> -- ... ton insert ...
> alter table auth.users enable trigger enforce_noxias_email_domain_trigger;
> ```

---

## 2. Anthropic — Clé API Claude

1. [console.anthropic.com](https://console.anthropic.com) → connecte-toi.
2. **Settings → API Keys → Create Key**.
3. Nomme-la `noxias-coach-prod`.
4. Copie la clé (elle ne sera plus jamais ré-affichée).
5. Vérifie ton crédit (au moins quelques dollars pour démarrer — chaque session coûte ~0,02–0,10 $).

---

## 3. Vercel — Déploiement

### 3.1 Importer le projet

1. [vercel.com](https://vercel.com) → **Add New → Project**.
2. Importe le repo `quentinpasquier/bizcoachnoxias`.
3. Sélectionne la branche `main` (ou la branche que tu veux déployer).
4. Framework preset : **Next.js** (auto-détecté).
5. Root directory : `.` (par défaut).

### 3.2 Variables d'environnement

Dans **Settings → Environment Variables**, ajoute :

| Nom | Valeur | Environment |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Production, Preview, Development |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Production, Preview, Development |
| `NEXT_PUBLIC_APP_URL` | `https://ton-domaine.vercel.app` | Production |

> **À ne jamais commit.** Le fichier `.env.local` est dans `.gitignore`. Sur Vercel, les variables sont chiffrées au repos.

### 3.3 Déployer

1. Clique **Deploy**. Premier build ~2 min.
2. Une fois en ligne, copie l'URL de prod (ex : `https://noxias-coach.vercel.app`).
3. Retourne sur Supabase → **Authentication → URL Configuration** et mets à jour la **Site URL** + **Redirect URLs** avec le vrai domaine Vercel.
4. Redéploie sur Vercel après avoir mis à jour les variables (Settings → Deployments → Redeploy).

---

## 4. Vérification post-déploiement

1. Ouvre ton URL de prod.
2. Crée un compte (`/signup`).
3. Confirme l'email reçu (si la confirmation est activée).
4. Crée une nouvelle session :
   - Persona : Marc Lefèvre (DG PME)
   - Difficulté : Débutant
   - Pitch : `SaaS de pilotage de la trésorerie`
5. Lance l'appel — le prospect doit décrocher en 1-2 secondes (« Allô ? »).
6. Tente une accroche, demande un RDV. Termine la session.
7. La restitution doit s'afficher en 5-10 secondes avec un score sur 100.

Si **erreur 500 sur la restitution**, vérifie :
- `ANTHROPIC_API_KEY` valide et avec du crédit.
- Les logs Vercel (`Functions → /api/sessions/[id]/evaluate`).

---

## 5. Coûts indicatifs

- **Supabase** : Plan Free (500 MB DB, 50k MAU). Ça tient large pour les premières équipes.
- **Vercel** : Plan Hobby gratuit pour usage perso/petit. Pro ($20/mois) si tu veux des domaines custom et + d'usage.
- **Anthropic** : ~0,02 à 0,10 $ par session (selon longueur). Compte ~5 $ pour 100 sessions.

Total pour une équipe de 5 commerciaux faisant 5 sessions/jour : **~50 $/mois** côté Anthropic, le reste gratuit.

---

## 6. Troubleshooting

### Le prospect ne répond pas / erreur 500 sur `/api/sessions/[id]/message`
→ `ANTHROPIC_API_KEY` manquante ou invalide. Check les Vars d'env Vercel.

### Auth bloque toutes les routes
→ `NEXT_PUBLIC_SUPABASE_URL` ou `NEXT_PUBLIC_SUPABASE_ANON_KEY` mal renseignée. Le middleware redirige vers `/login` quand il n'arrive pas à valider la session.

### « JWT expired » / déconnexions surprises
→ Vérifie que la **Site URL** Supabase correspond à ton domaine Vercel.

### La migration échoue
→ Souvent à cause d'un trigger déjà existant. Le script utilise `drop trigger if exists` et `drop policy if exists` — il est idempotent. Re-execute-le.

---

## 7. Évolutions

Pour ajouter un persona, édite `src/lib/personas.ts`. Pour toucher la palette, `src/app/globals.css`. Pour l'accroche du prospect ou les règles de difficulté, `src/lib/personas.ts → buildProspectSystemPrompt()`.
