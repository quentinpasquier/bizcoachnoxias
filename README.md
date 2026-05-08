# Noxias Coach

> Coach IA pour commerciaux. Simulez un appel de prospection non sollicité, mesurez votre performance, progressez.

Une session = un appel téléphonique simulé avec un prospect joué par Claude (Anthropic). Le commercial choisit un persona (DG PME, DAF, DRH, Dir. Marketing) et un niveau de difficulté (Débutant → Expert), puis tente d'obtenir un RDV. Le prospect peut raccrocher à tout moment selon le niveau choisi. À la fin, une restitution chiffrée sur 5 axes (accroche, découverte, objections, valeur, closing) avec forces, axes d'amélioration et prochaines actions.

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

Pour ajouter un persona : éditer `src/lib/personas.ts`.

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
