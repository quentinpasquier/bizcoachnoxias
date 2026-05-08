# Noxias Coach

> Outil interne Noxias. Coach IA pour les commerciaux qui font de la prospection externalisée.

Noxias prospecte au nom de plusieurs clients. Avant de décrocher pour de vrai, ses commerciaux s'entraînent ici : ils choisissent un **client** (avec son pitch et ses objections), un **persona** à appeler (DG PME, DAF, DRH, Dir. Marketing, Founder scaleup, CEO grand compte) et un **niveau** (Débutant → Expert), puis tentent d'obtenir un RDV. Le prospect peut raccrocher selon son niveau d'exigence. À la fin, une restitution chiffrée sur 5 axes (accroche, découverte, objections, valeur, closing) avec forces, axes d'amélioration et prochaines actions.

Accès réservé aux emails **@noxias.com** (enforced en base via trigger Postgres).

## Stack

- **Next.js 15** (App Router) + React 19 + TypeScript
- **Tailwind CSS** avec design tokens Noxias intégrés
- **Supabase** (Postgres + Auth + RLS)
- **Anthropic Claude Sonnet 4.6** (rôle prospect + évaluateur)
- **Vercel** (déploiement)

## Démarrage local

```bash
# 1. Dépendances
npm install

# 2. Variables d'environnement
cp .env.example .env.local
# Renseigne les clés Supabase et Anthropic (cf. DEPLOYMENT.md)

# 3. Migrations Supabase
# Dans le SQL Editor de ton projet Supabase, exécute :
#   supabase/migrations/0001_init.sql

# 4. Dev server
npm run dev
# → http://localhost:3000
```

## Architecture

```
src/
├── app/
│   ├── (auth)/                  # login, signup
│   ├── (app)/                   # routes protégées (middleware)
│   │   ├── dashboard/
│   │   ├── history/
│   │   └── sessions/
│   │       ├── new/             # config nouvelle session
│   │       └── [id]/            # chat live + feedback
│   ├── api/
│   │   └── sessions/
│   │       ├── start/           # POST → crée la session
│   │       └── [id]/
│   │           ├── message/     # POST → envoie un msg + récup réponse prospect
│   │           ├── end/         # POST → clôture côté commercial
│   │           └── evaluate/    # POST → génère restitution Claude
│   ├── auth/callback/           # OAuth/email callback Supabase
│   ├── globals.css              # design tokens Noxias
│   ├── layout.tsx
│   └── page.tsx                 # landing
├── components/
│   ├── ui/                      # Button, Card, Input, Badge
│   ├── Header.tsx
│   ├── Logo.tsx
│   └── SignOutButton.tsx
├── lib/
│   ├── anthropic.ts             # client Claude
│   ├── personas.ts              # 4 personas + 4 niveaux + system prompts
│   ├── prospect-engine.ts       # génération réponse + parsing signaux
│   ├── evaluator.ts             # restitution chiffrée
│   ├── format.ts
│   └── supabase/                # clients ssr + types
├── middleware.ts                # auth + redirections
└── ...
supabase/
└── migrations/
    └── 0001_init.sql            # profiles + sessions + messages + RLS
```

## Mécanique du prospect IA

Le prospect respecte un **system prompt** strict :
- Identité (nom, rôle, entreprise, contexte, pain points cachés)
- Niveau de difficulté (comportement, règles de raccroche, critères d'acceptation du RDV)
- Règles de jeu (français, brièveté, pas de méta-commentaire)

À la fin de chaque réponse, il peut émettre un **signal** :
- `[CONTINUE]` — la conversation continue (par défaut)
- `[HANGUP:reason="..."]` — il raccroche
- `[APPOINTMENT:date="..."]` — il accepte le RDV

Ces tags sont parsés côté serveur pour clôturer la session automatiquement.

## Évaluation

À la clôture, l'évaluateur (Claude) reçoit le transcript complet + contexte (niveau, persona, issue) et renvoie un JSON :

```json
{
  "overall_score": 72,
  "axes": {
    "accroche": { "score": 16, "comment": "..." },
    "decouverte": { "score": 14, "comment": "..." },
    "objections": { "score": 13, "comment": "..." },
    "valeur": { "score": 15, "comment": "..." },
    "closing": { "score": 14, "comment": "..." }
  },
  "strengths": [...],
  "improvements": [...],
  "next_steps": [...],
  "outcome_summary": "..."
}
```

Le score est calibré selon le niveau (60/100 sur Expert ≫ 60/100 sur Débutant).

## Personas livrés (v1)

| Key | Persona |
|---|---|
| `dg-pme-industrie` | Marc Lefèvre — DG PME industrielle (sous-traitance, Lyon) |
| `directeur-marketing-scaleup` | Sarah Benchikh — Dir. Marketing scaleup SaaS B2B série B |
| `daf-holding` | Jean-Pierre Mercier — DAF holding familiale BTP, Bordeaux |
| `drh-grand-compte` | Aurélie Dubois — DRH groupe industriel coté |
| `founder-scaleup` | Léo Marchetti — Founder & CEO scaleup série A |
| `ceo-grand-compte` | Marie-Agnès Vasseur — CEO groupe coté CAC Mid 60 |

Pour ajouter un persona : éditer `src/lib/personas.ts`.

## Clients

Chaque client = une boîte pour qui Noxias prospecte. Ses champs :
- `name`, `sector`, `description`
- `value_proposition` — la promesse en une phrase
- `product_pitch` — ce que le commercial Noxias doit pitcher (l'IA prospect base son jugement là-dessus)
- `ideal_targets` — les personas pertinents pour ce client (texte libre)
- `typical_objections` — array d'objections que l'IA prospect peut ressortir naturellement
- `active` — désactiver sans supprimer

Gestion via l'UI : `/clients` (liste, création, édition, désactivation).
3 clients d'exemple sont seedés via `0002_clients.sql` (TrésoFlow, Cabinet Lelong RH, Studio Octant) — éditer/supprimer selon besoin.

## Niveaux de difficulté

| Niveau | Comportement | Critères de RDV |
|---|---|---|
| **Débutant** | Ouvert, peu d'objections | RDV facile dès qu'on est poli |
| **Intermédiaire** | 2-3 objections classiques | Pitch clair + 1 objection bien gérée |
| **Avancé** | Multi-objections, sceptique | Accroche perso + bénéfice chiffré + closing assertif |
| **Expert** | Hostile, raccroche vite | Tous les critères ci-dessus + preuve sociale |

## Design System Noxias

Tokens CSS dans `src/app/globals.css`, théme Tailwind dans `tailwind.config.ts`.

- **Couleurs** : `#34244B` (purple), `#221932` (dark), `#3CC879` (green), `#F4F1F8` (lavender), `#8B7FA3` (gray), `#E94B4B` (red)
- **Typo** : Anton (display) + Ubuntu (corps) — Google Fonts via `next/font`
- **Espacement** : multiple de 4px
- **Principe** : « Le vert est précieux » — réservé aux CTA et accents

## Scripts

```bash
npm run dev         # dev server
npm run build       # build prod
npm run start       # serve build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
```

## Déploiement

Voir [`DEPLOYMENT.md`](./DEPLOYMENT.md) — instructions pas à pas Vercel + Supabase + Anthropic.

## Roadmap (post-v1)

- Streaming des réponses Claude (SSE) pour un effet « temps réel »
- Mode vocal (Whisper STT + ElevenLabs TTS)
- Personas custom par entreprise (cluster sectoriel)
- Comparatif d'équipe (admin)
- Export PDF de la restitution
