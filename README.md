# GALLUBIX CRM v5 — Guide de déploiement complet

CRM professionnel pour la gestion de prospects (LED, PAC, Panneaux Solaires, Isolation).
Temps réel, multi-utilisateurs, sécurité entreprise.

---

## Architecture

| Couche | Technologie |
|--------|-------------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| Hébergement | Vercel (CDN mondial, HTTPS gratuit) |
| Cartes | Leaflet + OpenStreetMap |
| Icônes | Lucide React |
| APIs externes | API Entreprises (SIRET) + API Adresse (géocodage) |

---

## Prérequis

- **Node.js** 18+ installé → [nodejs.org](https://nodejs.org)
- **Git** installé → [git-scm.com](https://git-scm.com)
- **Compte Supabase** (gratuit) → [supabase.com](https://supabase.com)
- **Compte Vercel** (gratuit) → [vercel.com](https://vercel.com)
- **Compte GitHub** → [github.com](https://github.com)

---

## ÉTAPE 1 — Créer le projet Supabase

1. Aller sur [supabase.com](https://supabase.com) → **New Project**
2. Choisir un nom (ex: `gallubix-crm`)
3. Choisir **Region: EU West (Paris)** pour la latence la plus faible
4. Définir un **Database Password** fort → le noter quelque part
5. Attendre ~2 minutes que le projet se crée

### Récupérer les clés API

1. Aller dans **Settings** → **API** (menu de gauche)
2. Copier :
   - **Project URL** → `https://xxxxxxxx.supabase.co`
   - **anon (public) key** → commence par `eyJ...`

> ⚠️ Ne JAMAIS utiliser la `service_role key` dans le frontend.

---

## ÉTAPE 2 — Configurer la base de données

1. Dans Supabase, aller dans **SQL Editor** (menu de gauche)
2. Cliquer **New query**
3. Ouvrir le fichier `database.sql` du ZIP dans un éditeur de texte
4. **Copier TOUT le contenu** et le coller dans le SQL Editor

### ⚠️ IMPORTANT — Modifier votre email admin

**Avant d'exécuter**, repérer la DERNIÈRE LIGNE du fichier (ligne ~654) :

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'votre-email@example.com';
```

**Remplacer** `votre-email@example.com` par l'email que vous utiliserez pour vous connecter.

5. Cliquer **Run** (ou Ctrl+Enter)
6. Vérifier qu'il n'y a aucune erreur rouge

### Vérification

Aller dans **Table Editor** → table `profiles` :
- Si elle est vide, c'est normal (les profils se créent à la première connexion)
- Après votre première connexion, vous devriez voir votre email avec `role: admin`

### Realtime & Storage — Déjà configurés ✅

Le fichier `database.sql` active automatiquement :
- **Realtime** sur les 5 tables (prospects, assignments, notes, documents, reminders)
- **Storage** : bucket `documents` + policies d'accès

Aucune action manuelle nécessaire. Pour vérifier après exécution :
- **Database → Replication** : les 5 tables doivent apparaître dans `supabase_realtime`
- **Storage** : le bucket `documents` doit être visible

---

## ÉTAPE 3 — Configurer le projet en local

### 3.1 — Extraire le ZIP

```bash
mkdir gallubix-crm
cd gallubix-crm
# Extraire le contenu du ZIP ici
```

### 3.2 — Créer le fichier `.env`

À la racine du projet, créer un fichier `.env` :

```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...votre-clé-complète
```

> Remplacer par vos vraies valeurs copiées à l'Étape 1.

### 3.3 — Installer les dépendances

```bash
npm install
```

### 3.4 — Tester en local

```bash
npm run dev
```

Ouvrir `http://localhost:5173` dans le navigateur.

**Premier test :**
1. Cliquer **Créer un compte**
2. Utiliser l'email que vous avez mis dans le SQL (celui du `UPDATE profiles SET role = 'admin'`)
3. Vérifier votre boîte mail pour le lien de confirmation Supabase
4. Après confirmation, vous devriez accéder au CRM en tant qu'**admin**

> Si vous restez bloqué sur le login après confirmation, rafraîchir la page.

### 3.5 — Vérifier le build production

```bash
npm run build
```

Doit afficher `✓ built in Xs` sans erreur.

---

## ÉTAPE 4 — Publier sur GitHub

### 4.1 — Créer le dépôt GitHub

1. Aller sur [github.com/new](https://github.com/new)
2. Nom : `gallubix-crm` (ou ce que vous voulez)
3. **Private** (recommandé pour un produit commercial)
4. Ne PAS cocher "Initialize with README" (on en a déjà un)
5. Cliquer **Create repository**

### 4.2 — Push le code

```bash
# Depuis le dossier du projet
git init
git add .
git commit -m "🚀 GALLUBIX CRM v5 — Production ready"

# Remplacer par VOTRE URL GitHub :
git remote add origin https://github.com/VOTRE-USERNAME/gallubix-crm.git
git branch -M main
git push -u origin main
```

> Si Git demande un mot de passe, utiliser un **Personal Access Token** GitHub :
> Settings → Developer Settings → Personal Access Tokens → Generate new token

---

## ÉTAPE 5 — Déployer sur Vercel

### 5.1 — Importer le projet

1. Aller sur [vercel.com](https://vercel.com) → **Add New** → **Project**
2. Connecter votre compte GitHub si pas déjà fait
3. Sélectionner le repo `gallubix-crm`
4. Vercel détecte automatiquement **Vite** comme framework

### 5.2 — Ajouter les variables d'environnement

Dans la section **Environment Variables**, ajouter :

| Nom | Valeur |
|-----|--------|
| `VITE_SUPABASE_URL` | `https://votre-projet.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...votre-clé-complète` |

> ⚠️ Les deux variables sont **obligatoires**. Sans elles, l'app affiche une page blanche.

### 5.3 — Déployer

1. Cliquer **Deploy**
2. Attendre ~1 minute
3. Vercel fournit une URL : `https://gallubix-crm-xxx.vercel.app`

### 5.4 — Domaine personnalisé (optionnel)

1. Dans Vercel → Settings → Domains
2. Ajouter votre domaine (ex: `crm.gallubix.fr`)
3. Configurer le DNS chez votre registrar :
   - Type: `CNAME`
   - Nom: `crm`
   - Valeur: `cname.vercel-dns.com`
4. Vercel génère le certificat HTTPS automatiquement

---

## ÉTAPE 6 — Ajouter des utilisateurs

### Méthode 1 : Inscription directe

Chaque utilisateur va sur l'URL de l'app et clique **Créer un compte**.
→ Il reçoit un email de confirmation Supabase
→ Après confirmation, il a accès en tant qu'**utilisateur** (ne voit que ses prospects assignés)

### Méthode 2 : Via Supabase Dashboard

1. Aller dans Supabase → **Authentication** → **Users**
2. Cliquer **Add User** → **Create New User**
3. Renseigner email + mot de passe

### Promouvoir un utilisateur en admin

Dans Supabase → **SQL Editor** :

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'email-du-user@example.com';
```

Ou depuis l'interface du CRM : **Utilisateurs** → cliquer sur le rôle → changer en Admin.

---

## ÉTAPE 7 — Configurer l'email (optionnel mais recommandé)

Par défaut, Supabase envoie les emails de confirmation avec son propre service (limité à 4/heure en gratuit).

Pour la production, configurer un service SMTP :

1. Supabase → **Settings** → **Auth** → **SMTP Settings**
2. Activer **Custom SMTP**
3. Configurer avec votre service (Brevo, Mailgun, SendGrid...) :
   - Host, Port, User, Password
   - Sender email : `noreply@votredomaine.fr`

---

## Mises à jour futures

Après modification du code :

```bash
git add .
git commit -m "description de la modification"
git push
```

Vercel redéploie **automatiquement** en ~30 secondes. Aucune action manuelle.

---

## Structure des fichiers

```
gallubix-crm/
├── src/
│   ├── App.jsx              # Interface complète (1126 lignes)
│   ├── main.jsx             # Point d'entrée React
│   ├── index.css            # Styles Tailwind
│   ├── contexts/
│   │   └── AuthContext.jsx   # Authentification + gestion sessions
│   ├── hooks/
│   │   └── useData.js       # Toute la logique métier (626 lignes)
│   └── lib/
│       └── supabase.js      # Client Supabase + helpers
├── database.sql             # Schéma complet + RLS + fonctions SQL
├── public/
│   ├── favicon.svg
│   └── logo.png
├── .env.example             # Template des variables d'environnement
├── vercel.json              # Config Vercel (SPA rewrite)
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── index.html
```

---

## Fonctionnalités complètes

### Pour tous les utilisateurs
- Créer / modifier des prospects
- Recherche instantanée (debounce 300ms)
- Filtres multi-critères (statut, produit, catégorie, installateur)
- Changement de statut en 1 clic (optimistic update — instantané)
- Notes / commentaires en temps réel
- Upload de documents (PDF, images, etc.)
- Rappels avec notifications navigateur (vérification toutes les 30s)
- Lookup SIRET automatique (API Entreprises)
- Autocomplétion adresse (API Adresse gouv.fr)
- Vue carte géographique (Leaflet)

### Pour les administrateurs uniquement
- Voir TOUS les prospects (users ne voient que les leurs)
- Supprimer des prospects
- Importer / Exporter CSV
- Dupliquer des prospects
- Attribuer / retirer des utilisateurs sur les fiches
- Opérations en masse (statut, attribution, suppression)
- Gérer les paramètres (catégories, statuts, produits, installateurs)
- Gérer les utilisateurs (rôles, activation/désactivation)
- Statistiques et classement d'équipe (par période)
- Journal d'activité complet
- Filtrer par attribution dans la sidebar

### Sécurité
- 41 politiques RLS (Row Level Security) dans PostgreSQL
- Double verrou : UI masque les boutons + DB bloque les requêtes non autorisées
- Aucun secret dans le code source (variables d'environnement)
- Sessions persistantes avec refresh automatique des tokens
- Protection contre les race conditions d'authentification

### Performance
- Optimistic updates sur 5 fonctions critiques (avec rollback automatique si erreur)
- 24 composants mémorisés (React.memo)
- 44 fonctions optimisées (useCallback)
- Zéro console.log en production
- Pagination serveur pour supporter 500K+ prospects
- Batch processing (100-200 par lot) pour les opérations en masse

---

## Dépannage

| Problème | Solution |
|----------|----------|
| Page blanche après déploiement | Vérifier les 2 variables d'environnement dans Vercel |
| "Non connecté — reconnectez-vous" | Vérifier que l'email est confirmé dans Supabase Auth |
| Pas de rôle admin | Exécuter le `UPDATE profiles SET role = 'admin'` dans le SQL Editor |
| Realtime ne fonctionne pas | Vérifier dans Database → Replication que les 5 tables sont listées (normalement automatique via le SQL) |
| Upload de documents échoue | Vérifier dans Storage que le bucket `documents` existe (normalement automatique via le SQL) |
| Notifications ne s'affichent pas | Autoriser les notifications dans le navigateur (icône cadenas) |
| Erreur RLS / permission denied | Vérifier que le SQL complet a été exécuté sans erreur |
| Build échoue sur Vercel | Vérifier que `npm run build` passe en local d'abord |

---

## Commandes utiles

```bash
npm run dev      # Serveur de développement (localhost:5173)
npm run build    # Build production (dossier dist/)
npm run preview  # Prévisualiser le build production
```

---

**GALLUBIX CRM v5** — Conçu et développé par Jeremie | LED and CO
